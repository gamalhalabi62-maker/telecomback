const express = require('express');
const router = express.Router();
const {
  createMessage,
  getMyMessages,
  getAllMessages,
  getMessageById,
  updateMessageStatus,
  deleteMessage,
} = require('../controllers/messageController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.post('/', protect, createMessage);
router.get('/my', protect, getMyMessages);

router.get('/', protect, adminOnly, getAllMessages);
router.put('/:id/status', protect, adminOnly, updateMessageStatus);
router.delete('/:id', protect, adminOnly, deleteMessage);

router.get('/:id', protect, getMessageById);

module.exports = router;