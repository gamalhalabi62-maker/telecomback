const {
  FilgoalStanding,
  FilgoalMatch,
  FilgoalNews,
  FilgoalSyncLog,
} = require('../models/FilgoalData');
const { runScraper } = require('../scripts/scrapeFilGoal');


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


const getMatches = async (req, res) => {
  try {
    const { status, limit = 100, ourTeam } = req.query;
    const query = {};
    if (status) query.status = status;
    if (ourTeam === 'true') query.isOurTeam = true;

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
    const { limit = 10 } = req.query;
    const matches = await FilgoalMatch.find({
      status: 'upcoming',
      date: { $gte: new Date() },
    })
      .sort({ date: 1 })
      .limit(Number(limit));

    res.json({ matches });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getLiveMatches = async (req, res) => {
  try {
    const matches = await FilgoalMatch.find({ status: 'live' }).sort({ date: -1 });
    res.json({ matches });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getFinishedMatches = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const matches = await FilgoalMatch.find({ status: 'finished' })
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

const getStats = async (req, res) => {
  try {
    const totalStandings = await FilgoalStanding.countDocuments();
    const totalMatches = await FilgoalMatch.countDocuments();
    const upcoming = await FilgoalMatch.countDocuments({ status: 'upcoming' });
    const live = await FilgoalMatch.countDocuments({ status: 'live' });
    const finished = await FilgoalMatch.countDocuments({ status: 'finished' });
    const totalNews = await FilgoalNews.countDocuments();
    const ourTeam = await FilgoalStanding.findOne({ isOurTeam: true });

    const lastSync = await FilgoalSyncLog.findOne({ status: 'success' }).sort({
      createdAt: -1,
    });

    res.json({
      totalStandings,
      totalMatches,
      upcoming,
      live,
      finished,
      totalNews,
      ourTeam,
      lastSync: lastSync?.createdAt || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


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
  getStandings,
  getMatches,
  getUpcomingMatches,
  getLiveMatches,
  getFinishedMatches,
  getOurMatches,
  getMatchById,
  getNews,
  getStats,
  triggerSync,
  getSyncLogs,
};