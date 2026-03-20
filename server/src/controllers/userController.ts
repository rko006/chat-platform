import { Response } from 'express';
import { User } from '../models/User';
import { cache } from '../config/redis';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/authMiddleware';

// ─── Search users ────────────────────────────────────────────────────────────
export const searchUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { q } = req.query;

    if (!q || (q as string).length < 2) {
      res.status(400).json({ error: 'Search query too short' });
      return;
    }

    const users = await User.find({
      _id: { $ne: userId },
      $or: [
        { username: { $regex: q as string, $options: 'i' } },
        { email: { $regex: q as string, $options: 'i' } },
      ],
    })
      .select('username email profilePicture bio isOnline lastSeen')
      .limit(20)
      .lean();

    res.json({ users });
  } catch (error) {
    logger.error('Search users error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

// ─── Get user by ID ──────────────────────────────────────────────────────────
export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.userId)
      .select('username email profilePicture bio isOnline lastSeen createdAt');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

// ─── Update profile ──────────────────────────────────────────────────────────
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { username, bio, profilePicture } = req.body;

    const updates: any = {};
    if (username) updates.username = username.trim();
    if (bio !== undefined) updates.bio = bio.trim();
    if (profilePicture) updates.profilePicture = profilePicture;

    // Check username uniqueness
    if (username) {
      const existing = await User.findOne({ username: updates.username, _id: { $ne: userId } });
      if (existing) {
        res.status(409).json({ error: 'Username already taken' });
        return;
      }
    }

    const user = await User.findByIdAndUpdate(userId, updates, { new: true })
      .select('-password -fcmToken');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await cache.del(`user:${userId}`);

    res.json({ user });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// ─── Update notification settings ───────────────────────────────────────────
export const updateNotificationSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { messages, sounds, preview } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        'notificationSettings.messages': messages,
        'notificationSettings.sounds': sounds,
        'notificationSettings.preview': preview,
      },
      { new: true }
    ).select('notificationSettings');

    res.json({ settings: user?.notificationSettings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

// ─── Block/Unblock user ──────────────────────────────────────────────────────
export const toggleBlock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { targetUserId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isBlocked = user.blockedUsers.some(id => id.toString() === targetUserId);
    if (isBlocked) {
      user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== targetUserId);
    } else {
      user.blockedUsers.push(require('mongoose').Types.ObjectId(targetUserId));
    }

    await user.save();
    res.json({ blocked: !isBlocked });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle block' });
  }
};

// ─── Change password ─────────────────────────────────────────────────────────
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId).select('+password');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
};
