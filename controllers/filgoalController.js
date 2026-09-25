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

const getNewsById = async (req, res) => {
  try {
    const articleId = Number(req.params.id);
    const news = await FilgoalNews.findOne({ filgoalArticleId: articleId });

    if (!news) {
      return res.status(404).json({ message: 'الخبر غير موجود' });
    }

    res.json({ news });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const scrapeNewsDetails = async (req, res) => {
  const { PlaywrightCrawler } = require('crawlee');
  const cheerio = require('cheerio');

  const articleId = Number(req.params.id);

  try {
    const existing = await FilgoalNews.findOne({ filgoalArticleId: articleId });
    if (existing?.content && existing.content.length > 100) {
      return res.json({ news: existing, cached: true });
    }
  } catch (e) {}

  const ARTICLE_URL = `https://www.filgoal.com/articles/${articleId}`;
  let result = null;

  const crawler = new PlaywrightCrawler({
    launchContext: {
      useChrome: true,
      launchOptions: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    },
    maxRequestsPerCrawl: 1,
    requestHandlerTimeoutSecs: 60,
    navigationTimeoutSecs: 60,
    maxRequestRetries: 1,

    preNavigationHooks: [
      async ({ page }) => {
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'ar-EG,ar;q=0.9,en;q=0.8',
        });
      },
    ],

    async requestHandler({ page, request, log }) {
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
      await page.waitForTimeout(2000);

      const html = await page.content();
      const $ = cheerio.load(html);

      let title = $('h1').first().text().trim() ||
                  $('meta[property="og:title"]').attr('content') || '';

      let imageUrl =
        $('meta[property="og:image"]').attr('content') ||
        $('.article_img img, .main-img img, article img').first().attr('src') || '';
      if (imageUrl && imageUrl.startsWith('//')) imageUrl = `https:${imageUrl}`;

      let content = '';
      const contentSelectors = [
        '.article_body',
        '.article-content',
        '.news-content',
        'article',
        '.content',
        '.body',
      ];
      for (const sel of contentSelectors) {
        const el = $(sel).first();
        if (el.length && el.text().trim().length > 200) {
          content = el.html();
          break;
        }
      }

      if (!content) {
        const paragraphs = [];
        $('p').each((i, p) => {
          const text = $(p).text().trim();
          if (text.length > 30) paragraphs.push(text);
        });
        content = paragraphs.join('\n\n');
      }

      let publishedAt = new Date();
      const dateMeta = $('meta[property="article:published_time"]').attr('content');
      if (dateMeta) publishedAt = new Date(dateMeta);

      let author = '';
      const authorSelectors = ['.author_name', '.author', '[rel="author"]', '.writer'];
      for (const sel of authorSelectors) {
        const el = $(sel).first();
        if (el.length) {
          author = el.text().trim();
          break;
        }
      }

      const tags = [];
      $('.tags a, .article_tags a, [rel="tag"]').each((i, el) => {
        const tag = $(el).text().trim();
        if (tag) tags.push(tag);
      });

      result = {
        title,
        imageUrl,
        content,
        author,
        tags,
        publishedAt,
        url: request.url,
      };

      log.info(`Scraped article ${articleId}: ${title}`);
    },
  });

  try {
    await crawler.run([ARTICLE_URL]);

    if (!result || !result.title) {
      return res.status(404).json({ message: 'فشل جلب تفاصيل الخبر' });
    }

    const news = await FilgoalNews.findOneAndUpdate(
      { filgoalArticleId: articleId },
      {
        $set: {
          title: result.title,
          imageUrl: result.imageUrl,
          content: result.content,
          author: result.author,
          tags: result.tags,
          publishedAt: result.publishedAt,
          url: result.url,
          syncedAt: new Date(),
        },
      },
      { new: true, upsert: true }
    );

    res.json({ news, cached: false });
  } catch (error) {
    console.error('Scrape error:', error);
    res.status(500).json({ message: 'فشل جلب تفاصيل الخبر', error: error.message });
  }
};

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

    const ourTeamInfo = await FilgoalTeam.findOne({ isOurTeam: true });
    const ourStanding = await FilgoalStanding.findOne({ isOurTeam: true });

    const ourTeam = ourStanding
      ? {
          ...ourStanding.toObject(),
          teamLogo: ourTeamInfo?.teamLogo || ourStanding.teamLogo,
          teamUrl: ourTeamInfo?.teamUrl || ourStanding.teamUrl,
        }
      : null;

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
      totalGoals: Math.floor(champStats.totalGoals / 2),
      totalYellowCards: champStats.totalYellowCards,
      totalRedCards: champStats.totalRedCards,
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
  getChampionshipMatches,
  getChampionships,
  getTeams,
  getOurTeam,
  getTeamById,
  getScorers,
  getNews,
  getNewsById,
  scrapeNewsDetails,
  getStats,
  triggerSync,
  getSyncLogs,
};