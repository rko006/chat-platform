import { Router } from 'express';
import {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  forwardMessage,
  searchMessages,
  markAsSeen,
  togglePinMessage,
} from '../controllers/messageController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/search', searchMessages);
router.get('/:conversationId', getMessages);
router.post('/send', sendMessage);
router.patch('/:messageId', editMessage);
router.delete('/:messageId', deleteMessage);
router.post('/:messageId/react', reactToMessage);
router.post('/:messageId/forward', forwardMessage);
router.post('/conversations/:conversationId/seen', markAsSeen);
router.patch('/:messageId/pin', togglePinMessage);

export default router;
