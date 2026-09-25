const {
  EgyptianLeagueStanding,
  EgyptianLeagueMatch,
  EgyptianLeagueSyncLog,
} = require('../models/EgyptianLeague');
const sync = require('../services/egyptianLeagueSync');
const apiFootball = require('../services/apiFootballService');

const getStandings = async (req, res) => {
  try {
    const { group } = req.query;
    const query = {};
    if (group) query.group = group;

    const standings = await EgyptianLeagueStanding.find(query).sort({ rank: 1 });
    const groups = await EgyptianLeagueStanding.distinct('group');

    res.json({ standings, groups, total: standings.length });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getOurTeam = async (req, res) => {
  try {
    const team = await EgyptianLeagueStanding.findOne({ isOurTeam: true });
    res.json({ team });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getMatches = async (req, res) => {
  try {
    const { status, matchday, limit = 100, ourTeam } = req.query;
    const query = {};

    if (status === 'upcoming') {
      query['status.short'] = { $in: ['NS', 'TBD'] };
      query.date = { $gte: new Date() };
    } else if (status === 'finished') {
      query['status.short'] = { $in: ['FT', 'AET', 'PEN'] };
    } else if (status === 'live') {
      query['status.short'] = { $in: ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'] };
    }

    if (matchday) query.matchday = Number(matchday);
    if (ourTeam === 'true') query.isOurTeam = true;

    const matches = await EgyptianLeagueMatch.find(query)
      .sort({ date: status === 'upcoming' ? 1 : -1 })
      .limit(Number(limit));

    res.json({ matches, total: matches.length });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getUpcomingMatches = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const matches = await EgyptianLeagueMatch.find({
      'status.short': { $in: ['NS', 'TBD'] },
      date: { $gte: new Date() },
    }).sort({ date: 1 }).limit(Number(limit));
    res.json({ matches });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getLiveMatches = async (req, res) => {
  try {
    const matches = await EgyptianLeagueMatch.find({
      'status.short': { $in: ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'] },
    }).sort({ date: -1 });
    res.json({ matches });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getFinishedMatches = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const matches = await EgyptianLeagueMatch.find({
      'status.short': { $in: ['FT', 'AET', 'PEN'] },
    }).sort({ date: -1 }).limit(Number(limit));
    res.json({ matches });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getOurMatches = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const matches = await EgyptianLeagueMatch.find({ isOurTeam: true })
      .sort({ date: -1 })
      .limit(Number(limit));
    res.json({ matches });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getMatchById = async (req, res) => {
  try {
    const match = await EgyptianLeagueMatch.findOne({ fixtureId: Number(req.params.id) });
    if (!match) {
      const alt = await EgyptianLeagueMatch.findById(req.params.id);
      if (!alt) return res.status(404).json({ message: 'المباراة غير موجودة' });
      return res.json(alt);
    }
    res.json(match);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getMatchDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await sync.syncMatchDetails(Number(id));
    if (!result.success) {
      return res.status(500).json({ message: 'فشل جلب تفاصيل المباراة', error: result.error });
    }
    const match = await EgyptianLeagueMatch.findOne({ fixtureId: Number(id) });
    res.json(match);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getLeagueStats = async (req, res) => {
  try {
    const totalTeams = await EgyptianLeagueStanding.countDocuments();
    const ourTeam = await EgyptianLeagueStanding.findOne({ isOurTeam: true });
    const totalMatches = await EgyptianLeagueMatch.countDocuments();
    const finishedMatches = await EgyptianLeagueMatch.countDocuments({
      'status.short': { $in: ['FT', 'AET', 'PEN'] },
    });
    const upcomingMatches = await EgyptianLeagueMatch.countDocuments({
      'status.short': { $in: ['NS', 'TBD'] },
    });
    const liveMatches = await EgyptianLeagueMatch.countDocuments({
      'status.short': { $in: ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'] },
    });

    const lastSync = await EgyptianLeagueSyncLog.findOne({ status: 'success' }).sort({ createdAt: -1 });

    res.json({
      totalTeams,
      ourTeam,
      totalMatches,
      finishedMatches,
      upcomingMatches,
      liveMatches,
      lastSync: lastSync?.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const triggerSync = async (req, res) => {
  try {
    const { type = 'full' } = req.query;

    let result;
    if (type === 'standings') result = await sync.syncStandings();
    else if (type === 'fixtures') result = await sync.syncFixtures();
    else if (type === 'live') result = await sync.syncLiveFixtures();
    else result = await sync.fullSync();

    res.json({ message: 'تم تنفيذ المزامنة', result });
  } catch (error) {
    res.status(500).json({ message: 'فشل المزامنة', error: error.message });
  }
};

const getSyncLogs = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const logs = await EgyptianLeagueSyncLog.find({})
      .sort({ createdAt: -1 })
      .limit(Number(limit));
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const checkApiStatus = async (req, res) => {
  try {
    const data = await apiFootball.checkApiStatus();
    res.json({
      status: 'ok',
      subscription: data.response?.subscription,
      requests: data.response?.requests,
      currentMinuteRequests: apiFootball.getRequestCount(),
    });
  } catch (error) {
    res.status(500).json({ message: 'فشل الاتصال بالـ API', error: error.message });
  }
};

const searchLeagues = async (req, res) => {
  try {
    const { country = 'Egypt' } = req.query;
    const data = await apiFootball.searchLeague(country);
    const leagues = (data.response || []).map((item) => ({
      id: item.league.id,
      name: item.league.name,
      type: item.league.type,
      logo: item.league.logo,
      country: item.country.name,
      seasons: item.seasons?.map((s) => s.year),
    }));
    res.json({ leagues });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

module.exports = {
  getStandings,
  getOurTeam,
  getMatches,
  getUpcomingMatches,
  getLiveMatches,
  getFinishedMatches,
  getOurMatches,
  getMatchById,
  getMatchDetails,
  getLeagueStats,
  triggerSync,
  getSyncLogs,
  checkApiStatus,
  searchLeagues,
};