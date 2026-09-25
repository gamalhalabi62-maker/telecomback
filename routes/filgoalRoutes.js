const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/filgoalController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/standings', ctrl.getStandings);
router.get('/matches', ctrl.getMatches);
router.get('/matches/upcoming', ctrl.getUpcomingMatches);
router.get('/matches/live', ctrl.getLiveMatches);
router.get('/matches/finished', ctrl.getFinishedMatches);
router.get('/matches/our-team', ctrl.getOurMatches);
router.get('/matches/:id', ctrl.getMatchById);
router.get('/news', ctrl.getNews);
router.get('/stats', ctrl.getStats);

router.post('/sync', protect, adminOnly, ctrl.triggerSync);
router.get('/sync-logs', protect, adminOnly, ctrl.getSyncLogs);

module.exports = router;