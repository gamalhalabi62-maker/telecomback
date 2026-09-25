const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/egyptianLeagueController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/standings', ctrl.getStandings);
router.get('/our-team', ctrl.getOurTeam);
router.get('/matches', ctrl.getMatches);
router.get('/matches/upcoming', ctrl.getUpcomingMatches);
router.get('/matches/live', ctrl.getLiveMatches);
router.get('/matches/finished', ctrl.getFinishedMatches);
router.get('/matches/our-team', ctrl.getOurMatches);
router.get('/matches/:id', ctrl.getMatchById);
router.get('/matches/:id/details', ctrl.getMatchDetails);
router.get('/stats', ctrl.getLeagueStats);

router.get('/admin/sync', protect, adminOnly, ctrl.triggerSync);
router.get('/admin/sync-logs', protect, adminOnly, ctrl.getSyncLogs);
router.get('/admin/api-status', protect, adminOnly, ctrl.checkApiStatus);
router.get('/admin/search-leagues', protect, adminOnly, ctrl.searchLeagues);

module.exports = router;