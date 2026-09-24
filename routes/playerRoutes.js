const express = require('express');
const router = express.Router();
const {
  getPlayers,
  getPlayerById,
  getPlayersByPosition,
  getTeamStats,
  createPlayer,
  updatePlayer,
  deletePlayer,
} = require('../controllers/playerController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/by-position', getPlayersByPosition);
router.get('/stats', getTeamStats);

router.get('/', getPlayers);
router.get('/:id', getPlayerById);

router.post('/', protect, adminOnly, createPlayer);
router.put('/:id', protect, adminOnly, updatePlayer);
router.delete('/:id', protect, adminOnly, deletePlayer);

module.exports = router;