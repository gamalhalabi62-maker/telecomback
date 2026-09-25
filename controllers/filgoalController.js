const axios = require('axios');
const cheerio = require('cheerio');
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
  const articleId = Number(req.params.id);

  try {
    const existing = await FilgoalNews.findOne({ filgoalArticleId: articleId });
    if (existing?.content && existing.content.length > 100 && existing.content.length < 20000) {
      return res.json({ news: existing, cached: true });
    }
  } catch (e) {}

  const ARTICLE_URL = `https://www.filgoal.com/articles/${articleId}`;

  try {
    const response = await axios.get(ARTICLE_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ar-EG,ar;q=0.9,en;q=0.8',
      },
      timeout: 30000,
      maxRedirects: 5,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    let title =
      $('h1').first().text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      $('title').text().trim() ||
      '';

    let imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('.article_img img, .main-img img, article img').first().attr('src') ||
      '';
    if (imageUrl && imageUrl.startsWith('//')) imageUrl = `https:${imageUrl}`;

    let content = '';
    const contentSelectors = [
      '.article_body',
      '.article-content',
      '.news-content',
      '.article_details',
      '.news_details',
      'article',
    ];

    let $content = null;
    for (const sel of contentSelectors) {
      const el = $(sel).first();
      if (el.length && el.text().trim().length > 200) {
        $content = el;
        break;
      }
    }

    if ($content) {
      $content.find(
        'script, style, iframe, .ad, .ads, .advertisement, .social, .share, .tags, .related, .related-news, .more-news, .most-read, .matches, .match-slider, .tab-links, .sidebar, .comments, .newsletter, .most_watched, .also_read, .also-read, .news_block, .breaking, .rate_mn, .grid-item, nav, footer, header, aside, button'
      ).remove();

      $content.find('[class*="related"], [class*="share"], [class*="most"], [class*="also"], [class*="recommend"], [class*="promo"], [class*="ad-"], [id*="ad-"]').remove();

      const paragraphs = [];
      $content.find('p, h2, h3, h4, blockquote, ul, ol, img, iframe').each((i, el) => {
        const tag = el.tagName.toLowerCase();
        const $el = $(el);

        if (tag === 'img') {
          const src = $el.attr('src') || $el.attr('data-src') || '';
          const alt = $el.attr('alt') || '';
          if (src && src.startsWith('http')) {
            paragraphs.push(`<img src="${src}" alt="${alt}" />`);
          }
          return;
        }

        if (tag === 'iframe') {
          const src = $el.attr('src') || '';
          if (src) paragraphs.push(`<iframe src="${src}" allowfullscreen></iframe>`);
          return;
        }

        const text = $el.text().trim();
        if (text.length < 20) return;

        if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
          paragraphs.push(`<${tag}>${text}</${tag}>`);
        } else if (tag === 'blockquote') {
          paragraphs.push(`<blockquote>${text}</blockquote>`);
        } else if (tag === 'ul' || tag === 'ol') {
          paragraphs.push(`<${tag}>${$el.html()}</${tag}>`);
        } else {
          paragraphs.push(`<p>${text}</p>`);
        }
      });

      content = paragraphs.join('\n');
    }

    if (!content || content.length < 100) {
      const paragraphs = [];
      $('p').each((i, p) => {
        const text = $(p).text().trim();
        if (text.length > 40 && !text.includes('نرشح لكم') && !text.includes('الأكثر مشاهدة') && !text.includes('أخبار ذات صلة')) {
          paragraphs.push(`<p>${text}</p>`);
        }
      });
      content = paragraphs.slice(0, 20).join('\n');
    }

    let publishedAt = new Date();
    const dateMeta = $('meta[property="article:published_time"]').attr('content');
    if (dateMeta) publishedAt = new Date(dateMeta);

    let author = '';
    const authorSelectors = [
      '.author_name',
      '.author',
      '[rel="author"]',
      '.writer',
      '.article_author',
    ];
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
      if (tag && tag.length < 30) tags.push(tag);
    });

    if (!title) {
      return res.status(404).json({ message: 'فشل جلب تفاصيل الخبر' });
    }

    const news = await FilgoalNews.findOneAndUpdate(
      { filgoalArticleId: articleId },
      {
        $set: {
          title,
          imageUrl,
          content,
          author,
          tags: tags.slice(0, 5),
          publishedAt,
          url: ARTICLE_URL,
          syncedAt: new Date(),
        },
      },
      { new: true, upsert: true }
    );

    res.json({ news, cached: false });
  } catch (error) {
    console.error('Scrape error:', error.message);
    res.status(500).json({
      message: 'فشل جلب تفاصيل الخبر',
      error: error.message,
    });
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