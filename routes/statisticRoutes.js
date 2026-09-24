const express = require('express');
const router = express.Router();
const {
  getStatistics,
  getStatisticById,
  createStatistic,
  updateStatistic,
  deleteStatistic,
} = require('../controllers/statisticController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/', getStatistics);
router.get('/:id', getStatisticById);

router.post('/', protect, adminOnly, createStatistic);
router.put('/:id', protect, adminOnly, updateStatistic);
router.delete('/:id', protect, adminOnly, deleteStatistic);

module.exports = router;