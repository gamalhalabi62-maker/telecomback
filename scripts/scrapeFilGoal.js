const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { PlaywrightCrawler } = require('crawlee');
const cheerio = require('cheerio');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const {
  FilgoalStanding,
  FilgoalMatch,
  FilgoalNews,
  FilgoalTeam,
  FilgoalScorer,
  FilgoalSyncLog,
} = require('../models/FilgoalData');

// ============================================
// Constants
// ============================================
const BASE_URL = 'https://www.filgoal.com';
const FILGOAL_URL = `${BASE_URL}/championships/1668/`;
const STANDINGS_URL = `${BASE_URL}/championships/1668/standings/دوري-المحترفين-المصري`;
const SCORERS_URL = `${BASE_URL}/championships/1668/scorers/دوري-المحترفين-المصري`;

const CHAMPIONSHIP_NAME = 'دوري المحترفين المصري';
const CHAMPIONSHIP_ID = 1668;
const OUR_TEAM_KEYWORDS = ['الاتصالات', 'المصرية للاتصالات', 'telecom', 'we'];

// ============================================
// Helpers
// ============================================
const isOurTeam = (name) => {
  if (!name) return false;
  const lower = name.toLowerCase();
  return OUR_TEAM_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
};

const normalizeUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url}`;
};

const detectStatus = (statusText, homeScore, awayScore, matchDate) => {
  const t = (statusText || '').trim();

  if (t.includes('مباشر') || t.includes('الشوط') || t.includes('استراحة')) {
    return 'live';
  }
  if (t.includes('انتهت') || t.includes('نهاية المباراة')) {
    return 'finished';
  }
  if (t.includes('مؤجل') || t.includes('ملغ') || t.includes('تأجل')) {
    return 'postponed';
  }

  if (matchDate) {
    const matchTime = new Date(matchDate).getTime();
    const now = Date.now();
    const diffHours = (now - matchTime) / (1000 * 60 * 60);

    if (matchTime > now) return 'upcoming';
    if (diffHours >= 0 && diffHours < 3 && homeScore === null) return 'live';
    if (diffHours >= 3) return 'finished';
  }

  if (homeScore !== null && awayScore !== null) return 'finished';
  return 'upcoming';
};

const getPageType = (url) => {
  const decoded = decodeURIComponent(url);
  if (decoded.includes('/standings/')) return 'standings';
  if (decoded.includes('/scorers/')) return 'scorers';
  if (decoded.includes('/matches/')) return 'matches';
  if (decoded.match(/\/championships\/1668\/?$/)) return 'overview';
  return 'unknown';
};

// ============================================
// 1. Extract Standings (الترتيب الكامل)
// ============================================
const extractStandings = ($, log = console) => {
  const results = [];
  const seen = new Set();

  $('.fg_tbl').each((tableIdx, table) => {
    const $table = $(table);

    if ($table.hasClass('hidden')) return;
    if ($table.closest('.hidden').length > 0) return;

    const teams = $table.find('.fg_rw.active');
    if (teams.length === 0) return;

    let groupTitle = CHAMPIONSHIP_NAME;
    const $parentBlock = $table.closest('.mc-block');
    if ($parentBlock.length) {
      const titleText = $parentBlock.find('h6 span').first().text().trim();
      if (titleText) groupTitle = titleText;
    }
    groupTitle = groupTitle.replace(/\s+/g, ' ').trim();

    log.info(`📋 Table ${tableIdx + 1}: "${groupTitle}" (${teams.length} teams)`);

    teams.each((rowIdx, row) => {
      const $row = $(row);
      const cells = $row.find('.fg_cl');

      if (cells.length < 11) return;

      const rank = parseInt($(cells[0]).text().trim(), 10);

      const teamLink = $(cells[1]).find('a').first();
      const teamName = teamLink.text().trim().replace(/\s+/g, ' ');
      const teamUrl = teamLink.attr('href') || '';
      const teamIdMatch = teamUrl.match(/\/Teams\/(\d+)/i);
      const filgoalTeamId = teamIdMatch ? parseInt(teamIdMatch[1], 10) : null;
      const teamLogo = $(cells[1]).find('img').attr('data-src') ||
                       $(cells[1]).find('img').attr('src') || '';

      const played = parseInt($(cells[2]).text().trim(), 10) || 0;
      const homePlayed = parseInt($(cells[3]).text().trim(), 10) || 0;
      const awayPlayed = parseInt($(cells[4]).text().trim(), 10) || 0;
      const won = parseInt($(cells[5]).text().trim(), 10) || 0;
      const lost = parseInt($(cells[6]).text().trim(), 10) || 0;
      const drawn = parseInt($(cells[7]).text().trim(), 10) || 0;
      const goalsFor = parseInt($(cells[8]).text().trim(), 10) || 0;
      const goalsAgainst = parseInt($(cells[9]).text().trim(), 10) || 0;
      const points = parseInt($(cells[10]).text().trim(), 10) || 0;

      let yellowCards = 0;
      let redCards = 0;
      const $details = $row.find('.fg_cl.dtls');
      if ($details.length) {
        const detailsText = $details.text();
        const ycMatch = detailsText.match(/بطاقات صفراء\s*:\s*(\d+)/);
        const rcMatch = detailsText.match(/بطاقات حمراء\s*:\s*(\d+)/);
        if (ycMatch) yellowCards = parseInt(ycMatch[1], 10);
        if (rcMatch) redCards = parseInt(rcMatch[1], 10);
      }

      const uniqueKey = `${groupTitle}|${teamName}`;
      if (seen.has(uniqueKey)) return;
      seen.add(uniqueKey);

      if (teamName && !isNaN(rank)) {
        results.push({
          group: groupTitle,
          rank,
          teamName,
          filgoalTeamId,
          teamLogo: normalizeUrl(teamLogo),
          teamUrl: normalizeUrl(teamUrl),
          played,
          homePlayed,
          awayPlayed,
          won,
          drawn,
          lost,
          goalsFor,
          goalsAgainst,
          goalDifference: goalsFor - goalsAgainst,
          points,
          yellowCards,
          redCards,
          isOurTeam: isOurTeam(teamName),
          syncedAt: new Date(),
        });
      }
    });
  });

  return results;
};

// ============================================
// 2. Extract Teams
// ============================================
const extractTeams = ($, log = console) => {
  const teams = [];
  const seen = new Set();

  $('.fg_team_slider li a').each((i, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const teamName = $el.find('b').text().trim();
    const logo = $el.find('img').attr('data-src') || $el.find('img').attr('src') || '';

    const idMatch = href.match(/\/teams\/(\d+)/i);
    const filgoalTeamId = idMatch ? parseInt(idMatch[1], 10) : null;

    if (teamName && filgoalTeamId && !seen.has(filgoalTeamId)) {
      seen.add(filgoalTeamId);
      teams.push({
        filgoalTeamId,
        teamName,
        teamLogo: normalizeUrl(logo),
        teamUrl: normalizeUrl(href),
        championshipId: CHAMPIONSHIP_ID,
        isOurTeam: isOurTeam(teamName),
        syncedAt: new Date(),
      });
    }
  });

  log.info(`👥 Teams extracted: ${teams.length}`);
  return teams;
};

// ============================================
// 3. Extract Scorers (محسّن - multiple selectors)
// ============================================
const extractScorers = ($, log = console) => {
  const scorers = [];
  const seen = new Set();

  const selectors = [
    '.boxlist li',
    '.scorers-list li',
    '.mc-block .boxlist li',
    '[class*="scorer"] li',
  ];

  for (const selector of selectors) {
    const items = $(selector);
    if (items.length === 0) continue;

    items.each((i, item) => {
      try {
        const $item = $(item);
        const links = $item.find('.f a, .player a');

        let playerName = '';
        let playerUrl = '';
        let teamName = '';
        let teamUrl = '';
        let goals = 0;

        if (links.length >= 3) {
          playerName = links.eq(1).text().trim();
          playerUrl = links.eq(1).attr('href') || '';
          teamName = links.eq(2).text().trim();
          teamUrl = links.eq(2).attr('href') || '';
        }

        if (!playerName) {
          playerName = $item.find('h6, strong, .player-name').first().text().trim();
        }
        if (!teamName) {
          teamName = $item.find('.team-name, .team').first().text().trim();
        }

        const goalsText = $item.find('.s b, .goals, [class*="goal"]').first().text().trim();
        goals = parseInt(goalsText, 10) || 0;

        const playerIdMatch = playerUrl.match(/\/players\/(\d+)/i);
        const filgoalPlayerId = playerIdMatch ? parseInt(playerIdMatch[1], 10) : null;

        const teamIdMatch = teamUrl.match(/\/teams\/(\d+)/i);
        const teamId = teamIdMatch ? parseInt(teamIdMatch[1], 10) : null;

        const uniqueKey = `${playerName}|${teamName}`;
        if (playerName && !seen.has(uniqueKey)) {
          seen.add(uniqueKey);
          scorers.push({
            filgoalPlayerId,
            playerName,
            teamName,
            teamId,
            goals,
            playerUrl: normalizeUrl(playerUrl),
            championshipId: CHAMPIONSHIP_ID,
            syncedAt: new Date(),
          });
        }
      } catch (e) {
        // ignore
      }
    });
  }

  log.info(`⚽ Scorers extracted: ${scorers.length}`);
  return scorers;
};

// ============================================
// 4. Extract Matches from sportsEngineData (بدون فلترة)
// ============================================
const extractMatchesFromSportsEngine = ($, log = console) => {
  const matches = [];
  const seen = new Set();
  const scripts = $('script').toArray();

  for (const script of scripts) {
    const content = $(script).html() || '';

    if (!content.includes('sportsEngineData')) continue;
    if (!content.includes('todayMatches')) continue;

    const match = content.match(/sportsEngineData\.todayMatches\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) continue;

    try {
      const parsed = JSON.parse(match[1]);
      log.info(`📊 sportsEngineData.todayMatches: ${parsed.length} matches total`);

      parsed.forEach((m) => {
        if (!m || !m.Id) return;
        if (seen.has(m.Id)) return;
        // ✅ لا فلترة - خذ كل المباريات

        seen.add(m.Id);

        const statusText = m.CurrentMatchStatus?.MatchStatusName || '';
        const matchDate = new Date(m.Date);

        matches.push({
          filgoalMatchId: m.Id,
          homeTeam: (m.HomeTeamName || '').trim(),
          awayTeam: (m.AwayTeamName || '').trim(),
          homeTeamId: m.HomeTeamId || null,
          awayTeamId: m.AwayTeamId || null,
          homeTeamLogo: normalizeUrl(m.HomeTeamLogoUrl || ''),
          awayTeamLogo: normalizeUrl(m.AwayTeamLogoUrl || ''),
          homeScore: m.HomeScore ?? null,
          awayScore: m.AwayScore ?? null,
          date: matchDate,
          championship: m.ChampionshipName || '',
          championshipId: m.ChampionshipId || null,
          week: m.Week || null,
          round: m.WeekOrRound || '',
          status: detectStatus(statusText, m.HomeScore, m.AwayScore, matchDate),
          matchStatusText: statusText,
          filgoalUrl: `${BASE_URL}/matches/${m.Id}`,
          isOurTeam: isOurTeam(m.HomeTeamName) || isOurTeam(m.AwayTeamName),
          syncedAt: new Date(),
        });
      });
    } catch (e) {
      log.warning(`⚠️ Failed to parse sportsEngineData: ${e.message}`);
    }
  }

  return matches;
};

// ============================================
// 5. Extract Matches from HTML
// ============================================
const extractMatchesFromHtml = ($, log = console) => {
  const matches = [];
  const seen = new Set();

  $('.mc-block').each((blockIdx, block) => {
    const $block = $(block);
    const title = $block.find('h6 span').first().text().trim();

    if (!title.includes('مواعيد') && !title.includes('نتائج')) return;

    $block.find('.cin_cntnr').each((i, container) => {
      const $container = $(container);
      const link = $container.find('a').first().attr('href') || '';

      const idMatch = link.match(/\/matches\/(\d+)/i);
      if (!idMatch) return;

      const matchId = parseInt(idMatch[1], 10);
      if (seen.has(matchId)) return;
      seen.add(matchId);

      const homeTeam = $container.find('.f strong').first().text().trim();
      const awayTeam = $container.find('.s strong').first().text().trim();
      const homeScoreText = $container.find('.f b').first().text().trim();
      const awayScoreText = $container.find('.s b').first().text().trim();

      const homeScore = homeScoreText === '-' ? null : parseInt(homeScoreText, 10);
      const awayScore = awayScoreText === '-' ? null : parseInt(awayScoreText, 10);

      const statusText = $container.find('.status').first().text().trim();
      const dateText = $container.find('.match-aux span').last().text().trim();

      let matchDate = new Date();
      const dateMatch = dateText.match(/(\d{2})-(\d{2})-(\d{4})\s*-\s*(\d{2}):(\d{2})/);
      if (dateMatch) {
        const [, day, month, year, hour, minute] = dateMatch;
        matchDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
      }

      matches.push({
        filgoalMatchId: matchId,
        homeTeam,
        awayTeam,
        homeTeamId: null,
        awayTeamId: null,
        homeTeamLogo: normalizeUrl($container.find('.f img').attr('data-src') || ''),
        awayTeamLogo: normalizeUrl($container.find('.s img').attr('data-src') || ''),
        homeScore: isNaN(homeScore) ? null : homeScore,
        awayScore: isNaN(awayScore) ? null : awayScore,
        date: matchDate,
        championship: CHAMPIONSHIP_NAME,
        championshipId: CHAMPIONSHIP_ID,
        week: null,
        round: '',
        status: detectStatus(statusText, homeScore, awayScore, matchDate),
        matchStatusText: statusText,
        filgoalUrl: `${BASE_URL}/matches/${matchId}`,
        isOurTeam: isOurTeam(homeTeam) || isOurTeam(awayTeam),
        syncedAt: new Date(),
      });
    });
  });

  log.info(`📅 Matches from HTML: ${matches.length}`);
  return matches;
};

// ============================================
// 6. Extract News
// ============================================
const extractNews = ($) => {
  const news = [];
  const seen = new Set();

  $('.mcitem').each((i, item) => {
    try {
      const linkEl = $(item).find('.body a').first();
      const imgEl = $(item).find('.img img').first();

      const url = linkEl.attr('href') || '';
      const title = linkEl.text().trim().replace(/\s+/g, ' ');
      const imageUrl = imgEl.attr('data-src') || imgEl.attr('src') || '';

      if (!title || !url) return;

      const idMatch = url.match(/\/articles\/(\d+)/);
      const articleId = idMatch ? parseInt(idMatch[1], 10) : null;

      if (articleId && !seen.has(articleId)) {
        seen.add(articleId);
        news.push({
          filgoalArticleId: articleId,
          title,
          imageUrl: normalizeUrl(imageUrl),
          url: normalizeUrl(url),
          publishedAt: new Date(),
          category: 'professional-league',
          syncedAt: new Date(),
        });
      }
    } catch (e) {
      // ignore
    }
  });

  return news;
};

// ============================================
// 7. Save Functions
// ============================================
const saveStandings = async (standings) => {
  if (standings.length === 0) return 0;
  await FilgoalStanding.deleteMany({});
  await FilgoalStanding.insertMany(standings);
  return standings.length;
};

const saveTeams = async (teams) => {
  if (teams.length === 0) return 0;
  const ops = teams.map((t) => ({
    updateOne: {
      filter: { filgoalTeamId: t.filgoalTeamId },
      update: { $set: t },
      upsert: true,
    },
  }));
  await FilgoalTeam.bulkWrite(ops);
  return teams.length;
};

const saveMatches = async (matches) => {
  if (matches.length === 0) return 0;
  const ops = matches.map((m) => ({
    updateOne: {
      filter: { filgoalMatchId: m.filgoalMatchId },
      update: { $set: m },
      upsert: true,
    },
  }));
  await FilgoalMatch.bulkWrite(ops);
  return matches.length;
};

const saveNews = async (news) => {
  if (news.length === 0) return 0;
  const ops = news.map((n) => ({
    updateOne: {
      filter: { filgoalArticleId: n.filgoalArticleId },
      update: { $set: n },
      upsert: true,
    },
  }));
  await FilgoalNews.bulkWrite(ops);
  return news.length;
};

const saveScorers = async (scorers) => {
  if (scorers.length === 0) return 0;
  const ops = scorers.map((s) => ({
    updateOne: {
      filter: { playerName: s.playerName, teamName: s.teamName },
      update: { $set: s },
      upsert: true,
    },
  }));
  await FilgoalScorer.bulkWrite(ops);
  return scorers.length;
};

// ============================================
// 8. Merge Matches (deduplicate)
// ============================================
const mergeMatches = (...matchArrays) => {
  const map = new Map();
  matchArrays.flat().forEach((m) => {
    if (!m || !m.filgoalMatchId) return;
    const existing = map.get(m.filgoalMatchId);
    if (!existing) {
      map.set(m.filgoalMatchId, m);
    } else {
      const merged = { ...existing };
      Object.keys(m).forEach((key) => {
        if (m[key] !== null && m[key] !== undefined && m[key] !== '' && m[key] !== 0) {
          if (!merged[key] || merged[key] === null || merged[key] === '' || merged[key] === 0) {
            merged[key] = m[key];
          }
        }
      });
      map.set(m.filgoalMatchId, merged);
    }
  });
  return Array.from(map.values());
};

// ============================================
// 9. Main Scraper
// ============================================
const runScraper = async () => {
  const startTime = Date.now();
  const stats = {
    standingsCount: 0,
    matchesCount: 0,
    newsCount: 0,
    teamsCount: 0,
    scorersCount: 0,
  };

  // ✅ اجمع كل المباريات من كل الصفحات هنا
  const allMatchesMap = new Map();

  const crawler = new PlaywrightCrawler({
    launchContext: {
      useChrome: true,
      launchOptions: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
        ],
      },
    },
    maxRequestsPerCrawl: 3,
    requestHandlerTimeoutSecs: 300,
    navigationTimeoutSecs: 120,
    maxRequestRetries: 2,

    preNavigationHooks: [
      async ({ page }) => {
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'ar-EG,ar;q=0.9,en;q=0.8',
        });
        await page.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
      },
    ],

    async requestHandler({ page, request, log }) {
      const pageType = getPageType(request.url);
      log.info(`🌐 [${pageType}] Fetching ${request.url}...`);

      await page.waitForLoadState('domcontentloaded', { timeout: 60000 });

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1000);

      const html = await page.content();
      const $ = cheerio.load(html);

      log.info(`📄 [${pageType}] HTML length: ${html.length} chars`);

      // استخراج البيانات
      const teams = extractTeams($, log);
      const matchesFromEngine = extractMatchesFromSportsEngine($, log);
      const matchesFromHtml = extractMatchesFromHtml($, log);
      const matches = mergeMatches(matchesFromEngine, matchesFromHtml);
      const standings = extractStandings($, log);
      const news = extractNews($);
      const scorers = extractScorers($, log);

      log.info(`📊 [${pageType}] Standings: ${standings.length}`);
      log.info(`⚽ [${pageType}] Matches: ${matches.length}`);
      log.info(`📰 [${pageType}] News: ${news.length}`);
      log.info(`👥 [${pageType}] Teams: ${teams.length}`);
      log.info(`🎯 [${pageType}] Scorers: ${scorers.length}`);

      // ✅ اجمع المباريات من كل الصفحات (بدون تكرار)
      matches.forEach((m) => {
        if (!allMatchesMap.has(m.filgoalMatchId)) {
          allMatchesMap.set(m.filgoalMatchId, m);
        } else {
          // ادمج البيانات
          const existing = allMatchesMap.get(m.filgoalMatchId);
          Object.keys(m).forEach((key) => {
            if (m[key] !== null && m[key] !== undefined && m[key] !== '' && m[key] !== 0) {
              if (!existing[key] || existing[key] === null || existing[key] === '' || existing[key] === 0) {
                existing[key] = m[key];
              }
            }
          });
        }
      });

      // الحفظ حسب نوع الصفحة
      if (pageType === 'standings' && standings.length > 0) {
        stats.standingsCount = await saveStandings(standings);
        log.info(`✅ [standings] Saved ${stats.standingsCount} standings`);
      }

      if (teams.length > 0) {
        stats.teamsCount = await saveTeams(teams);
      }

      if (pageType === 'overview' && news.length > 0) {
        stats.newsCount = await saveNews(news);
      }

      if (scorers.length > 0) {
        stats.scorersCount = await saveScorers(scorers);
      }
    },

    failedRequestHandler({ request, log }) {
      log.error(`❌ Failed: ${request.url}`);
    },
  });

  try {
    await crawler.run([FILGOAL_URL, STANDINGS_URL, SCORERS_URL]);

    // ✅ احفظ كل المباريات المجمعة
    if (allMatchesMap.size > 0) {
      const allMatches = Array.from(allMatchesMap.values());
      stats.matchesCount = await saveMatches(allMatches);
      console.log(`✅ Saved ${stats.matchesCount} total matches from all pages`);
    }

    await FilgoalSyncLog.create({
      status: 'success',
      ...stats,
      duration: Date.now() - startTime,
    });

    console.log(`✅ Sync completed in ${Date.now() - startTime}ms`);
    console.log(`📊 Stats:`, stats);
    return { success: true, ...stats };
  } catch (error) {
    await FilgoalSyncLog.create({
      status: 'error',
      ...stats,
      duration: Date.now() - startTime,
      error: error.message,
    });

    console.error('❌ Sync failed:', error.message);
    return { success: false, error: error.message, ...stats };
  }
};

// ============================================
// Entry Point
// ============================================
if (require.main === module) {
  (async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ MongoDB connected');

      await runScraper();

      await mongoose.disconnect();
      process.exit(0);
    } catch (error) {
      console.error('❌ Fatal:', error);
      process.exit(1);
    }
  })();
}

module.exports = { runScraper };