const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/filgoalController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ═══════════════════════════════════════════════════════════
//  STANDINGS
// ═══════════════════════════════════════════════════════════
router.get('/standings', ctrl.getStandings);

// ═══════════════════════════════════════════════════════════
//  MATCHES
// ═══════════════════════════════════════════════════════════
router.get('/matches', ctrl.getMatches);
router.get('/matches/upcoming', ctrl.getUpcomingMatches);
router.get('/matches/live', ctrl.getLiveMatches);
router.get('/matches/finished', ctrl.getFinishedMatches);
router.get('/matches/our-team', ctrl.getOurMatches);
router.get('/matches/:id', ctrl.getMatchById);

// ✅ مباريات البطولة المحددة
router.get('/championship-matches', ctrl.getChampionshipMatches);
router.get('/championships', ctrl.getChampionships);

// ═══════════════════════════════════════════════════════════
//  TEAMS
// ═══════════════════════════════════════════════════════════
router.get('/teams', ctrl.getTeams);
router.get('/teams/our-team', ctrl.getOurTeam);
router.get('/teams/:teamId', ctrl.getTeamById);

// ═══════════════════════════════════════════════════════════
//  SCORERS
// ═══════════════════════════════════════════════════════════
router.get('/scorers', ctrl.getScorers);

// ═══════════════════════════════════════════════════════════
//  NEWS
// ═══════════════════════════════════════════════════════════
router.get('/news', ctrl.getNews);

// ═══════════════════════════════════════════════════════════
//  STATS
// ═══════════════════════════════════════════════════════════
router.get('/stats', ctrl.getStats);

// ═══════════════════════════════════════════════════════════
//  SYNC (Admin only)
// ═══════════════════════════════════════════════════════════
router.post('/sync', protect, adminOnly, ctrl.triggerSync);
router.get('/sync-logs', protect, adminOnly, ctrl.getSyncLogs);

module.exports = router;