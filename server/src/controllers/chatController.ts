import { Response } from 'express';
import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation';
import { User } from '../models/User';
import { Message } from '../models/Message';
import { cache } from '../config/redis';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/authMiddleware';

// ─── Get all conversations for user ─────────────────────────────────────────
export const getConversations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const cacheKey = `conversations:${userId}:${page}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const conversations = await Conversation.find({
      members: new mongoose.Types.ObjectId(userId),
      _id: { $nin: [] }, // Archived filter could go here
    })
      .populate('members', 'username profilePicture isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        populate: { path: 'senderId', select: 'username profilePicture' },
      })
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const result = { conversations, page, hasMore: conversations.length === limit };
    await cache.set(cacheKey, result, 30); // 30 second cache

    res.json(result);
  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

// ─── Create or get direct conversation ──────────────────────────────────────
export const createOrGetConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { targetUserId } = req.body;

    if (!targetUserId || targetUserId === userId) {
      res.status(400).json({ error: 'Invalid target user' });
      return;
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      type: 'direct',
      members: {
        $all: [
          new mongoose.Types.ObjectId(userId),
          new mongoose.Types.ObjectId(targetUserId),
        ],
        $size: 2,
      },
    })
      .populate('members', 'username profilePicture isOnline lastSeen')
      .populate('lastMessage');

    if (!conversation) {
      conversation = await Conversation.create({
        type: 'direct',
        members: [userId, targetUserId],
        createdBy: userId,
      });

      await conversation.populate('members', 'username profilePicture isOnline lastSeen');
    }

    // Invalidate cache
    await cache.delPattern(`conversations:${userId}:*`);
    await cache.delPattern(`conversations:${targetUserId}:*`);

    res.json({ conversation });
  } catch (error) {
    logger.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
};

// ─── Create group conversation ───────────────────────────────────────────────
export const createGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { name, memberIds, description } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ error: 'Group name is required' });
      return;
    }

    if (!memberIds || memberIds.length < 2) {
      res.status(400).json({ error: 'Group must have at least 2 other members' });
      return;
    }

    const members = [userId, ...memberIds];
    const uniqueMembers = [...new Set(members)];

    const group = await Conversation.create({
      type: 'group',
      name: name.trim(),
      description,
      members: uniqueMembers,
      admins: [userId],
      createdBy: userId,
    });

    // System message
    await Message.create({
      conversationId: group._id,
      senderId: userId,
      messageType: 'system',
      text: `Group "${name}" was created`,
    });

    await group.populate('members', 'username profilePicture isOnline lastSeen');

    res.status(201).json({ conversation: group });
  } catch (error) {
    logger.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
};

// ─── Get conversation by ID ──────────────────────────────────────────────────
export const getConversationById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      members: new mongoose.Types.ObjectId(userId),
    })
      .populate('members', 'username profilePicture isOnline lastSeen bio')
      .populate({
        path: 'lastMessage',
        populate: { path: 'senderId', select: 'username' },
      });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.json({ conversation });
  } catch (error) {
    logger.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
};

// ─── Pin/Unpin conversation ──────────────────────────────────────────────────
export const togglePin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { conversationId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isPinned = user.pinnedChats.some(id => id.toString() === conversationId);
    if (isPinned) {
      user.pinnedChats = user.pinnedChats.filter(id => id.toString() !== conversationId);
    } else {
      if (user.pinnedChats.length >= 5) {
        res.status(400).json({ error: 'Cannot pin more than 5 conversations' });
        return;
      }
      user.pinnedChats.push(new mongoose.Types.ObjectId(conversationId));
    }

    await user.save();
    await cache.delPattern(`conversations:${userId}:*`);

    res.json({ pinned: !isPinned });
  } catch (error) {
    logger.error('Toggle pin error:', error);
    res.status(500).json({ error: 'Failed to toggle pin' });
  }
};

// ─── Archive/Unarchive conversation ─────────────────────────────────────────
export const toggleArchive = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { conversationId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isArchived = user.archivedChats.some(id => id.toString() === conversationId);
    if (isArchived) {
      user.archivedChats = user.archivedChats.filter(id => id.toString() !== conversationId);
    } else {
      user.archivedChats.push(new mongoose.Types.ObjectId(conversationId));
    }

    await user.save();
    await cache.delPattern(`conversations:${userId}:*`);

    res.json({ archived: !isArchived });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle archive' });
  }
};

// ─── Add members to group ────────────────────────────────────────────────────
export const addGroupMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { conversationId } = req.params;
    const { memberIds } = req.body;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: 'group',
      admins: new mongoose.Types.ObjectId(userId),
    });

    if (!conversation) {
      res.status(403).json({ error: 'Not authorized to add members' });
      return;
    }

    const newMembers = memberIds.filter(
      (id: string) => !conversation.members.some(m => m.toString() === id)
    );

    conversation.members.push(...newMembers.map((id: string) => new mongoose.Types.ObjectId(id)));
    await conversation.save();

    await conversation.populate('members', 'username profilePicture isOnline lastSeen');
    res.json({ conversation });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add members' });
  }
};

// ─── Leave group ─────────────────────────────────────────────────────────────
export const leaveGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: 'group',
      members: new mongoose.Types.ObjectId(userId),
    });

    if (!conversation) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    conversation.members = conversation.members.filter(m => m.toString() !== userId);

    // If admin leaves, transfer admin to first member
    if (conversation.admins?.some(a => a.toString() === userId)) {
      conversation.admins = conversation.admins!.filter(a => a.toString() !== userId);
      if (conversation.admins!.length === 0 && conversation.members.length > 0) {
        conversation.admins!.push(conversation.members[0]);
      }
    }

    await conversation.save();

    // System message
    const user = await User.findById(userId);
    await Message.create({
      conversationId,
      senderId: userId,
      messageType: 'system',
      text: `${user?.username} left the group`,
    });

    res.json({ message: 'Left group successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to leave group' });
  }
};
