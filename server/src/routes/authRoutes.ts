import { Router } from 'express';
import { register, login, logout, refreshToken, getCurrentUser, updateFcmToken } from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticate, logout);
router.post('/refresh', refreshToken);
router.get('/me', authenticate, getCurrentUser);
router.patch('/fcm-token', authenticate, updateFcmToken);

export default router;
