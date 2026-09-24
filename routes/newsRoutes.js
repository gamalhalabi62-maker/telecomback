const express = require('express');
const router = express.Router();
const {
  getNews,
  getNewsById,
  createNews,
  updateNews,
  deleteNews,
  getBreakingNews,
  getFeaturedNews,
  getPopularNews,
  getStats,
} = require('../controllers/newsController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/breaking', getBreakingNews);
router.get('/featured', getFeaturedNews);
router.get('/popular', getPopularNews);
router.get('/stats', getStats);

router.get('/', getNews);
router.get('/:id', getNewsById);

router.post('/', protect, adminOnly, createNews);
router.put('/:id', protect, adminOnly, updateNews);
router.delete('/:id', protect, adminOnly, deleteNews);

module.exports = router;