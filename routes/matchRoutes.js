const express = require('express');
const router = express.Router();
const {
  getMatches,
  getUpcomingMatches,
  getFinishedMatches,
  getLiveMatches,
  getMatchById,
  getMatchStats,
  createMatch,
  updateMatch,
  updateScore,
  deleteMatch,
} = require('../controllers/matchController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/upcoming', getUpcomingMatches);
router.get('/finished', getFinishedMatches);
router.get('/live', getLiveMatches);
router.get('/stats', getMatchStats);

router.get('/', getMatches);
router.get('/:id', getMatchById);

router.post('/', protect, adminOnly, createMatch);
router.put('/:id', protect, adminOnly, updateMatch);
router.patch('/:id/score', protect, adminOnly, updateScore);
router.delete('/:id', protect, adminOnly, deleteMatch);

module.exports = router;