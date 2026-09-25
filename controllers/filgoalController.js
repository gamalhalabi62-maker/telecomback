const {
  FilgoalStanding,
  FilgoalMatch,
  FilgoalNews,
  FilgoalTeam,
  FilgoalScorer,
  FilgoalSyncLog,
} = require('../models/FilgoalData');
const { runScraper } = require('../scripts/scrapeFilGoal');

const CHAMPIONSHIP_ID = 1668;
const CHAMPIONSHIP_NAME = 'دوري المحترفين المصري';

// ═══════════════════════════════════════════════════════════
//  STANDINGS
// ═══════════════════════════════════════════════════════════
const getStandings = async (req, res) => {
  try {
    const { group } = req.query;
    const query = {};
    if (group) query.group = group;

    const standings = await FilgoalStanding.find(query).sort({ group: 1, rank: 1 });
    const groups = await FilgoalStanding.distinct('group');
    const ourTeam = await FilgoalStanding.findOne({ isOurTeam: true });

    res.json({ standings, groups, ourTeam });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
//  MATCHES
// ═══════════════════════════════════════════════════════════
const getMatches = async (req, res) => {
  try {
    const { status, limit = 100, ourTeam, championshipId } = req.query;
    const query = {};
    if (status) query.status = status;
    if (ourTeam === 'true') query.isOurTeam = true;
    if (championshipId) query.championshipId = Number(championshipId);

    const matches = await FilgoalMatch.find(query)
      .sort({ date: -1 })
      .limit(Number(limit));

    res.json({ matches, total: matches.length });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getUpcomingMatches = async (req, res) => {
  try {
    const { limit = 20, championshipId } = req.query;
    const query = { status: { $in: ['upcoming', 'live'] } };
    if (championshipId) query.championshipId = Number(championshipId);

    const matches = await FilgoalMatch.find(query)
      .sort({ date: 1 })
      .limit(Number(limit));

    res.json({ matches });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getLiveMatches = async (req, res) => {
  try {
    const { championshipId } = req.query;
    const query = { status: 'live' };
    if (championshipId) query.championshipId = Number(championshipId);

    const matches = await FilgoalMatch.find(query).sort({ date: -1 });
    res.json({ matches });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getFinishedMatches = async (req, res) => {
  try {
    const { limit = 30, championshipId } = req.query;
    const query = { status: 'finished' };
    if (championshipId) query.championshipId = Number(championshipId);

    const matches = await FilgoalMatch.find(query)
      .sort({ date: -1 })
      .limit(Number(limit));

    res.json({ matches });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getOurMatches = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const matches = await FilgoalMatch.find({ isOurTeam: true })
      .sort({ date: -1 })
      .limit(Number(limit));

    res.json({ matches });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getMatchById = async (req, res) => {
  try {
    const match = await FilgoalMatch.findOne({
      filgoalMatchId: Number(req.params.id),
    });

    if (!match) return res.status(404).json({ message: 'المباراة غير موجودة' });
    res.json(match);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

// ✅ مباريات دوري المحترفين فقط
const getChampionshipMatches = async (req, res) => {
  try {
    const { championshipId = CHAMPIONSHIP_ID, status, limit = 50 } = req.query;
    const query = { championshipId: Number(championshipId) };
    if (status) query.status = status;

    const matches = await FilgoalMatch.find(query)
      .sort({ date: -1 })
      .limit(Number(limit));

    res.json({ matches, total: matches.length });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

// ✅ كل البطولات المتاحة (للفلترة)
const getChampionships = async (req, res) => {
  try {
    const championships = await FilgoalMatch.aggregate([
      {
        $group: {
          _id: '$championshipId',
          name: { $first: '$championship' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json({ championships });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
//  TEAMS
// ═══════════════════════════════════════════════════════════
const getTeams = async (req, res) => {
  try {
    const { championshipId = CHAMPIONSHIP_ID } = req.query;
    const teams = await FilgoalTeam.find({
      championshipId: Number(championshipId),
    }).sort({ teamName: 1 });

    res.json({ teams, total: teams.length });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getOurTeam = async (req, res) => {
  try {
    const team = await FilgoalTeam.findOne({ isOurTeam: true });
    const standing = await FilgoalStanding.findOne({ isOurTeam: true });

    res.json({ team, standing });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getTeamById = async (req, res) => {
  try {
    const teamId = Number(req.params.teamId);

    const team = await FilgoalTeam.findOne({ filgoalTeamId: teamId });
    const standing = await FilgoalStanding.findOne({ filgoalTeamId: teamId });

    const upcomingMatches = await FilgoalMatch.find({
      status: { $in: ['upcoming', 'live'] },
      $or: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    }).sort({ date: 1 }).limit(10);

    const finishedMatches = await FilgoalMatch.find({
      status: 'finished',
      $or: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    }).sort({ date: -1 }).limit(10);

    const scorers = await FilgoalScorer.find({ teamId }).sort({ goals: -1 });

    res.json({
      team,
      standing,
      upcomingMatches,
      finishedMatches,
      scorers,
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
//  SCORERS
// ═══════════════════════════════════════════════════════════
const getScorers = async (req, res) => {
  try {
    const { limit = 20, championshipId = CHAMPIONSHIP_ID } = req.query;
    const scorers = await FilgoalScorer.find({
      championshipId: Number(championshipId),
    })
      .sort({ goals: -1 })
      .limit(Number(limit));

    res.json({ scorers, total: scorers.length });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
//  NEWS
// ═══════════════════════════════════════════════════════════
const getNews = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const news = await FilgoalNews.find({})
      .sort({ publishedAt: -1 })
      .limit(Number(limit));

    res.json({ news, total: news.length });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
//  STATS
// ═══════════════════════════════════════════════════════════
const getStats = async (req, res) => {
  try {
    const { championshipId = CHAMPIONSHIP_ID } = req.query;
    const champId = Number(championshipId);

    const totalStandings = await FilgoalStanding.countDocuments();
    const totalTeams = await FilgoalTeam.countDocuments({
      championshipId: champId,
    });
    const totalScorers = await FilgoalScorer.countDocuments({
      championshipId: champId,
    });

    // ✅ مباريات البطولة المحددة فقط
    const championshipMatches = await FilgoalMatch.countDocuments({
      championshipId: champId,
    });

    const upcoming = await FilgoalMatch.countDocuments({
      status: 'upcoming',
      championshipId: champId,
    });
    const live = await FilgoalMatch.countDocuments({
      status: 'live',
      championshipId: champId,
    });
    const finished = await FilgoalMatch.countDocuments({
      status: 'finished',
      championshipId: champId,
    });

    const totalNews = await FilgoalNews.countDocuments();

    // ✅ ourTeam من FilgoalTeam + FilgoalStanding
    const ourTeamInfo = await FilgoalTeam.findOne({ isOurTeam: true });
    const ourStanding = await FilgoalStanding.findOne({ isOurTeam: true });

    const ourTeam = ourStanding
      ? {
          ...ourStanding.toObject(),
          teamLogo: ourTeamInfo?.teamLogo || ourStanding.teamLogo,
          teamUrl: ourTeamInfo?.teamUrl || ourStanding.teamUrl,
        }
      : null;

    // ✅ إحصائيات البطولة (أهداف، بطاقات)
    const standingsAgg = await FilgoalStanding.aggregate([
      { $match: { group: { $exists: true } } },
      {
        $group: {
          _id: null,
          totalGoals: { $sum: '$goalsFor' },
          totalYellowCards: { $sum: '$yellowCards' },
          totalRedCards: { $sum: '$redCards' },
        },
      },
    ]);

    const champStats = standingsAgg[0] || {
      totalGoals: 0,
      totalYellowCards: 0,
      totalRedCards: 0,
    };

    const lastSync = await FilgoalSyncLog.findOne({ status: 'success' }).sort({
      createdAt: -1,
    });

    res.json({
      totalStandings,
      totalMatches: championshipMatches,
      totalTeams,
      totalScorers,
      upcoming,
      live,
      finished,
      totalNews,
      totalGoals: Math.floor(champStats.totalGoals / 2), // كل هدف محسوب مرتين (له لكل فريق)
      totalYellowCards: champStats.totalYellowCards,
      totalRedCards: champStats.totalRedCards,
      ourTeam,
      lastSync: lastSync?.createdAt || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
//  SYNC
// ═══════════════════════════════════════════════════════════
const triggerSync = async (req, res) => {
  try {
    const result = await runScraper();
    res.json({ message: 'تمت المزامنة', result });
  } catch (error) {
    res.status(500).json({ message: 'فشل المزامنة', error: error.message });
  }
};

const getSyncLogs = async (req, res) => {
  try {
    const logs = await FilgoalSyncLog.find({})
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ logs });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

module.exports = {
  // Standings
  getStandings,
  // Matches
  getMatches,
  getUpcomingMatches,
  getLiveMatches,
  getFinishedMatches,
  getOurMatches,
  getMatchById,
  getChampionshipMatches,
  getChampionships,
  // Teams
  getTeams,
  getOurTeam,
  getTeamById,
  // Scorers
  getScorers,
  // News
  getNews,
  // Stats
  getStats,
  // Sync
  triggerSync,
  getSyncLogs,
};