import { Router } from 'express';
import {
  searchUsers,
  getUserById,
  updateProfile,
  updateNotificationSettings,
  toggleBlock,
  changePassword,
} from '../controllers/userController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/search', searchUsers);
router.get('/:userId', getUserById);
router.patch('/me/profile', updateProfile);
router.patch('/me/notifications', updateNotificationSettings);
router.patch('/me/password', changePassword);
router.patch('/:targetUserId/block', toggleBlock);

export default router;
