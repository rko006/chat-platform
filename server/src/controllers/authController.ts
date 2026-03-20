import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User';
import { cache } from '../config/redis';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/authMiddleware';

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET as string,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET as string),
    { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as any }
  );

  return { accessToken, refreshToken };
};

// ─── Register ────────────────────────────────────────────────────────────────
export const register = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers and underscores'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase and number'),

  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { username, email, password } = req.body;

      // Check if user exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      });

      if (existingUser) {
        const field = existingUser.email === email ? 'email' : 'username';
        res.status(409).json({ error: `This ${field} is already taken` });
        return;
      }

      // Create user
      const user = new User({ username, email, password });
      await user.save();

      const { accessToken, refreshToken } = generateTokens(user._id.toString());

      // Cache refresh token
      await cache.set(`refresh:${user._id}`, refreshToken, 30 * 24 * 3600);

      logger.info(`New user registered: ${username} (${email})`);

      res.status(201).json({
        message: 'Account created successfully',
        user: user.toPublicJSON(),
        accessToken,
        refreshToken,
      });
    } catch (error) {
      logger.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  },
];

// ─── Login ───────────────────────────────────────────────────────────────────
export const login = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password is required'),

  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { email, password } = req.body;

      const user = await User.findOne({ email }).select('+password');

      if (!user || !(await user.comparePassword(password))) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Update last seen
      await User.findByIdAndUpdate(user._id, {
        isOnline: true,
        lastSeen: new Date(),
      });

      const { accessToken, refreshToken } = generateTokens(user._id.toString());
      await cache.set(`refresh:${user._id}`, refreshToken, 30 * 24 * 3600);

      logger.info(`User logged in: ${user.username}`);

      res.json({
        message: 'Login successful',
        user: user.toPublicJSON(),
        accessToken,
        refreshToken,
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  },
];

// ─── Logout ──────────────────────────────────────────────────────────────────
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.userId) {
      await cache.del(`refresh:${req.userId}`);
      await User.findByIdAndUpdate(req.userId, {
        isOnline: false,
        lastSeen: new Date(),
        fcmToken: null,
      });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

// ─── Refresh Token ───────────────────────────────────────────────────────────
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!
    ) as { userId: string };

    const cachedToken = await cache.get<string>(`refresh:${decoded.userId}`);
    if (cachedToken !== refreshToken) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);
    await cache.set(`refresh:${decoded.userId}`, newRefreshToken, 30 * 24 * 3600);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};

// ─── Get Current User ────────────────────────────────────────────────────────
export const getCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: user.toPublicJSON() });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

// ─── Update FCM Token ────────────────────────────────────────────────────────
export const updateFcmToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fcmToken } = req.body;
    await User.findByIdAndUpdate(req.userId, { fcmToken });
    res.json({ message: 'FCM token updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update FCM token' });
  }
};
