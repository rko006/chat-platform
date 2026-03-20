import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';
import { onlineStatus } from '../config/redis';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

interface AuthSocket extends Socket {
  userId?: string;
  username?: string;
}

interface JwtPayload {
  userId: string;
}

let io: Server;

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export function initSocketServer(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ─── Authentication Middleware ─────────────────────────────────────────────
  io.use(async (socket: AuthSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      const user = await User.findById(decoded.userId).select('username');

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = decoded.userId;
      socket.username = user.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ─── Connection Handler ────────────────────────────────────────────────────
  io.on('connection', async (socket: AuthSocket) => {
    const userId = socket.userId!;
    logger.info(`Socket connected: ${socket.username} (${userId})`);

    // Mark user online
    await onlineStatus.setOnline(userId, socket.id);
    await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

    // Notify contacts that user is online
    socket.broadcast.emit('user_online', { userId, socketId: socket.id });

    // Auto-join user's conversations
    const conversations = await Conversation.find(
      { members: new mongoose.Types.ObjectId(userId) },
      '_id'
    );
    conversations.forEach(conv => socket.join(conv._id.toString()));

    // ─── Join conversation room ──────────────────────────────────────────────
    socket.on('join_conversation', async ({ conversationId }: { conversationId: string }) => {
      try {
        const conversation = await Conversation.findOne({
          _id: conversationId,
          members: new mongoose.Types.ObjectId(userId),
        });

        if (conversation) {
          socket.join(conversationId);
          socket.emit('joined_conversation', { conversationId });
        }
      } catch (error) {
        logger.error('Join conversation error:', error);
      }
    });

    // ─── Leave conversation room ─────────────────────────────────────────────
    socket.on('leave_conversation', ({ conversationId }: { conversationId: string }) => {
      socket.leave(conversationId);
    });

    // ─── Send message ────────────────────────────────────────────────────────
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, text, messageType = 'text', mediaUrl, mediaType, mediaSize, mediaName, replyTo } = data;

        const conversation = await Conversation.findOne({
          _id: conversationId,
          members: new mongoose.Types.ObjectId(userId),
        });

        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found or access denied' });
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

        await message.populate('senderId', 'username profilePicture');
        if (replyTo) {
          await message.populate({ path: 'replyTo', populate: { path: 'senderId', select: 'username' } });
        }

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

        // Emit to all in conversation room
        io.to(conversationId).emit('receive_message', message);

        // Emit delivery status to sender
        socket.emit('message_sent', { messageId: message._id, tempId: data.tempId });

        // Mark as delivered for online recipients
        const otherMembers = conversation.members.filter(m => m.toString() !== userId);
        for (const memberId of otherMembers) {
          const memberOnline = await onlineStatus.isOnline(memberId.toString());
          if (memberOnline) {
            await Message.findByIdAndUpdate(message._id, {
              $push: { deliveredTo: { userId: memberId, deliveredAt: new Date() } },
              status: 'delivered',
            });
            socket.emit('message_delivered', { messageId: message._id, userId: memberId });
          }
        }

      } catch (error) {
        logger.error('Socket send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ─── Typing indicator ────────────────────────────────────────────────────
    const typingTimers: Map<string, NodeJS.Timeout> = new Map();

    socket.on('typing', ({ conversationId }: { conversationId: string }) => {
      socket.to(conversationId).emit('typing', {
        userId,
        username: socket.username,
        conversationId,
      });

      // Auto stop after 3s
      const existing = typingTimers.get(conversationId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        socket.to(conversationId).emit('stop_typing', { userId, conversationId });
        typingTimers.delete(conversationId);
      }, 3000);
      typingTimers.set(conversationId, timer);
    });

    socket.on('stop_typing', ({ conversationId }: { conversationId: string }) => {
      const existing = typingTimers.get(conversationId);
      if (existing) {
        clearTimeout(existing);
        typingTimers.delete(conversationId);
      }
      socket.to(conversationId).emit('stop_typing', { userId, conversationId });
    });

    // ─── Message seen ────────────────────────────────────────────────────────
    socket.on('message_seen', async ({ conversationId, messageIds }: { conversationId: string; messageIds: string[] }) => {
      try {
        await Message.updateMany(
          {
            _id: { $in: messageIds },
            conversationId,
            'seenBy.userId': { $ne: new mongoose.Types.ObjectId(userId) },
          },
          {
            $push: { seenBy: { userId, seenAt: new Date() } },
            $set: { status: 'seen' },
          }
        );

        await Conversation.findByIdAndUpdate(conversationId, {
          $set: { [`unreadCounts.${userId}`]: 0 },
        });

        socket.to(conversationId).emit('messages_seen', {
          conversationId,
          messageIds,
          seenBy: userId,
          seenAt: new Date(),
        });
      } catch (error) {
        logger.error('Message seen error:', error);
      }
    });

    // ─── Message reaction ────────────────────────────────────────────────────
    socket.on('add_reaction', async ({ messageId, emoji, conversationId }: { messageId: string; emoji: string; conversationId: string }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message || message.isDeleted) return;

        // Remove existing reaction from this user
        message.reactions = message.reactions.filter(r => r.userId.toString() !== userId);

        // Add new reaction
        message.reactions.push({
          emoji,
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: new Date(),
        });

        await message.save();

        io.to(conversationId).emit('reaction_updated', {
          messageId,
          reactions: message.reactions,
        });
      } catch (error) {
        logger.error('Reaction error:', error);
      }
    });

    socket.on('remove_reaction', async ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        message.reactions = message.reactions.filter(r => r.userId.toString() !== userId);
        await message.save();

        io.to(conversationId).emit('reaction_updated', {
          messageId,
          reactions: message.reactions,
        });
      } catch (error) {
        logger.error('Remove reaction error:', error);
      }
    });

    // ─── Edit message ────────────────────────────────────────────────────────
    socket.on('edit_message', async ({ messageId, text, conversationId }: { messageId: string; text: string; conversationId: string }) => {
      try {
        const message = await Message.findOne({ _id: messageId, senderId: userId });
        if (!message || message.isDeleted) return;

        message.text = text.trim();
        message.isEdited = true;
        message.editedAt = new Date();
        await message.save();

        io.to(conversationId).emit('message_edited', {
          messageId,
          text: message.text,
          editedAt: message.editedAt,
        });
      } catch (error) {
        logger.error('Edit message error:', error);
      }
    });

    // ─── Delete message ──────────────────────────────────────────────────────
    socket.on('delete_message', async ({ messageId, conversationId, deleteFor }: { messageId: string; conversationId: string; deleteFor: string }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        if (deleteFor === 'everyone' && message.senderId.toString() === userId) {
          message.isDeleted = true;
          message.deletedAt = new Date();
          message.text = undefined;
          message.mediaUrl = undefined;
          await message.save();

          io.to(conversationId).emit('message_deleted', {
            messageId,
            conversationId,
            deleteFor: 'everyone',
          });
        }
      } catch (error) {
        logger.error('Delete message socket error:', error);
      }
    });

    // ─── Disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      logger.info(`Socket disconnected: ${socket.username} (${reason})`);

      // Clear typing timers
      typingTimers.forEach((timer) => clearTimeout(timer));
      typingTimers.clear();

      // Mark user offline
      await onlineStatus.setOffline(userId);
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      socket.broadcast.emit('user_offline', {
        userId,
        lastSeen: new Date(),
      });
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
}
