import { Response } from 'express';
import mongoose from 'mongoose';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';
import { cache } from '../config/redis';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/authMiddleware';
import { notificationService } from '../services/notificationService';

// ─── Get messages for a conversation ────────────────────────────────────────
export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { conversationId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const before = req.query.before as string; // For cursor-based pagination

    // Verify membership
    const conversation = await Conversation.findOne({
      _id: conversationId,
      members: new mongoose.Types.ObjectId(userId),
    });

    if (!conversation) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const query: any = {
      conversationId,
      deletedFor: { $ne: userId },
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('senderId', 'username profilePicture')
      .populate({
        path: 'replyTo',
        populate: { path: 'senderId', select: 'username' },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      messages: messages.reverse(),
      hasMore: messages.length === limit,
      page,
    });
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// ─── Send message ────────────────────────────────────────────────────────────
export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { conversationId, text, messageType = 'text', mediaUrl, mediaType, mediaSize, mediaName, replyTo } = req.body;

    if (!conversationId) {
      res.status(400).json({ error: 'Conversation ID required' });
      return;
    }

    if (!text && !mediaUrl) {
      res.status(400).json({ error: 'Message content required' });
      return;
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      members: new mongoose.Types.ObjectId(userId),
    });

    if (!conversation) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const message = await Message.create({
      conversationId,
      senderId: userId,
      text: text?.trim(),
      messageType,
      mediaUrl,
      mediaType,
      mediaSize,
      mediaName,
      replyTo: replyTo || null,
      status: 'sent',
    });

    // Update conversation
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      lastMessageAt: new Date(),
      $inc: Object.fromEntries(
        conversation.members
          .filter(m => m.toString() !== userId)
          .map(m => [`unreadCounts.${m}`, 1])
      ),
    });

    await message.populate('senderId', 'username profilePicture');
    if (replyTo) {
      await message.populate({ path: 'replyTo', populate: { path: 'senderId', select: 'username' } });
    }

    // Invalidate cache
    await cache.delPattern(`conversations:${userId}:*`);

    // Send push notifications to offline members
    const otherMembers = conversation.members.filter(m => m.toString() !== userId);
    await notificationService.sendMessageNotification(message, otherMembers.map(m => m.toString()));

    res.status(201).json({ message });
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// ─── Edit message ────────────────────────────────────────────────────────────
export const editMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { messageId } = req.params;
    const { text } = req.body;

    if (!text?.trim()) {
      res.status(400).json({ error: 'Message text required' });
      return;
    }

    const message = await Message.findOne({
      _id: messageId,
      senderId: userId,
      messageType: 'text',
      isDeleted: false,
    });

    if (!message) {
      res.status(404).json({ error: 'Message not found or cannot be edited' });
      return;
    }

    // Can only edit within 24 hours
    const hoursDiff = (Date.now() - message.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursDiff > 24) {
      res.status(400).json({ error: 'Cannot edit messages older than 24 hours' });
      return;
    }

    message.text = text.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    await message.populate('senderId', 'username profilePicture');

    res.json({ message });
  } catch (error) {
    logger.error('Edit message error:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
};

// ─── Delete message ──────────────────────────────────────────────────────────
export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { messageId } = req.params;
    const { deleteFor = 'me' } = req.body; // 'me' | 'everyone'

    const message = await Message.findById(messageId);

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (deleteFor === 'everyone') {
      if (message.senderId.toString() !== userId) {
        res.status(403).json({ error: 'Can only delete your own messages for everyone' });
        return;
      }
      message.isDeleted = true;
      message.deletedAt = new Date();
      message.text = undefined;
      message.mediaUrl = undefined;
    } else {
      // Delete for me only
      if (!message.deletedFor.some(id => id.toString() === userId)) {
        message.deletedFor.push(new mongoose.Types.ObjectId(userId));
      }
    }

    await message.save();

    res.json({ success: true, deleteFor });
  } catch (error) {
    logger.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

// ─── Add/Remove reaction ─────────────────────────────────────────────────────
export const reactToMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      res.status(400).json({ error: 'Emoji required' });
      return;
    }

    const message = await Message.findById(messageId);
    if (!message || message.isDeleted) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    const existingIdx = message.reactions.findIndex(
      r => r.userId.toString() === userId && r.emoji === emoji
    );

    if (existingIdx >= 0) {
      // Remove reaction
      message.reactions.splice(existingIdx, 1);
    } else {
      // Remove any existing reaction from this user for same emoji or different emoji
      message.reactions = message.reactions.filter(r => r.userId.toString() !== userId);
      // Add new reaction
      message.reactions.push({
        emoji,
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: new Date(),
      });
    }

    await message.save();
    res.json({ reactions: message.reactions });
  } catch (error) {
    logger.error('React to message error:', error);
    res.status(500).json({ error: 'Failed to update reaction' });
  }
};

// ─── Forward message ─────────────────────────────────────────────────────────
export const forwardMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { messageId } = req.params;
    const { targetConversationIds } = req.body;

    const originalMessage = await Message.findById(messageId);
    if (!originalMessage || originalMessage.isDeleted) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    const forwardedMessages = await Promise.all(
      targetConversationIds.map(async (convId: string) => {
        const conversation = await Conversation.findOne({
          _id: convId,
          members: new mongoose.Types.ObjectId(userId),
        });

        if (!conversation) return null;

        const msg = await Message.create({
          conversationId: convId,
          senderId: userId,
          text: originalMessage.text,
          mediaUrl: originalMessage.mediaUrl,
          messageType: originalMessage.messageType,
          forwardedFrom: originalMessage._id,
          status: 'sent',
        });

        await Conversation.findByIdAndUpdate(convId, {
          lastMessage: msg._id,
          lastMessageAt: new Date(),
        });

        return msg;
      })
    );

    res.json({ messages: forwardedMessages.filter(Boolean) });
  } catch (error) {
    logger.error('Forward message error:', error);
    res.status(500).json({ error: 'Failed to forward message' });
  }
};

// ─── Search messages ─────────────────────────────────────────────────────────
export const searchMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { q, conversationId } = req.query;

    if (!q || (q as string).trim().length < 2) {
      res.status(400).json({ error: 'Search query too short' });
      return;
    }

    const query: any = {
      $text: { $search: q as string },
      isDeleted: false,
      deletedFor: { $ne: userId },
    };

    if (conversationId) {
      // Verify access
      const conversation = await Conversation.findOne({
        _id: conversationId,
        members: new mongoose.Types.ObjectId(userId),
      });
      if (conversation) {
        query.conversationId = conversationId;
      }
    } else {
      // Only search in user's conversations
      const userConversations = await Conversation.find(
        { members: new mongoose.Types.ObjectId(userId) },
        '_id'
      );
      query.conversationId = { $in: userConversations.map(c => c._id) };
    }

    const messages = await Message.find(query, {
      score: { $meta: 'textScore' },
    })
      .sort({ score: { $meta: 'textScore' } })
      .limit(50)
      .populate('senderId', 'username profilePicture')
      .populate('conversationId', 'name type members')
      .lean();

    res.json({ messages, query: q });
  } catch (error) {
    logger.error('Search messages error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

// ─── Mark messages as seen ───────────────────────────────────────────────────
export const markAsSeen = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { conversationId } = req.params;

    await Message.updateMany(
      {
        conversationId,
        senderId: { $ne: new mongoose.Types.ObjectId(userId) },
        'seenBy.userId': { $ne: new mongoose.Types.ObjectId(userId) },
        isDeleted: false,
      },
      {
        $push: { seenBy: { userId, seenAt: new Date() } },
        $set: { status: 'seen' },
      }
    );

    // Reset unread count
    await Conversation.findByIdAndUpdate(conversationId, {
      $set: { [`unreadCounts.${userId}`]: 0 },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Mark as seen error:', error);
    res.status(500).json({ error: 'Failed to mark messages as seen' });
  }
};

// ─── Pin/unpin message ───────────────────────────────────────────────────────
export const togglePinMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    // Verify user is in the conversation
    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      members: new mongoose.Types.ObjectId(userId),
    });

    if (!conversation) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    message.isPinned = !message.isPinned;
    await message.save();

    res.json({ pinned: message.isPinned });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle pin' });
  }
};
