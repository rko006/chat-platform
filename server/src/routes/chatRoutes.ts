import { Router } from 'express';
import {
  getConversations,
  createOrGetConversation,
  createGroup,
  getConversationById,
  togglePin,
  toggleArchive,
  addGroupMembers,
  leaveGroup,
} from '../controllers/chatController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getConversations);
router.post('/direct', createOrGetConversation);
router.post('/group', createGroup);
router.get('/:conversationId', getConversationById);
router.patch('/:conversationId/pin', togglePin);
router.patch('/:conversationId/archive', toggleArchive);
router.post('/:conversationId/members', addGroupMembers);
router.delete('/:conversationId/leave', leaveGroup);

export default router;
