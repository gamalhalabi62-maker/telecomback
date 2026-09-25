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
  FilgoalSyncLog,
} = require('../models/FilgoalData');

const FILGOAL_URL = 'https://www.filgoal.com/championships/1576/';
const OUR_TEAM_KEYWORDS = ['الاتصالات', 'المصرية للاتصالات', 'telecom'];

const isOurTeam = (name) => {
  if (!name) return false;
  const lower = name.toLowerCase();
  return OUR_TEAM_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
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

    if (matchTime > now) {
      return 'upcoming';
    }

    if (diffHours >= 0 && diffHours < 3 && homeScore === null) {
      return 'live';
    }

    if (diffHours >= 3) {
      return 'finished';
    }
  }

  if (homeScore !== null && awayScore !== null) {
    return 'finished';
  }

  return 'upcoming';
};

const extractStandings = ($) => {
  const tables = [];

  // 1. جمع كل الجداول مع عناوينها وفرقها
  $('.fg_tbl').each((tableIdx, table) => {
    const $table = $(table);
    const teams = $table.find('.fg_rw.active');
    if (teams.length === 0) return;

    // استخرج اسم المجموعة من h3 الأقرب
    let groupTitle = '';
    let $prev = $table;
    for (let i = 0; i < 15; i++) {
      $prev = $prev.prev();
      if (!$prev.length) break;

      if ($prev.is('h3')) {
        groupTitle = $prev.text().trim();
        break;
      }

      const $h3 = $prev.find('h3').first();
      if ($h3.length && !$prev.is('.mc-block')) {
        groupTitle = $h3.text().trim();
        break;
      }
    }

    if (!groupTitle) {
      groupTitle = `المجموعة ${tableIdx + 1}`;
    }

    groupTitle = groupTitle.replace(/\s+/g, ' ').trim();

    // استخرج أسماء الفرق
    const teamNames = [];
    teams.each((rowIdx, row) => {
      const cells = $(row).find('.fg_cl');
      if (cells.length < 11) return;
      const teamName = $(cells[1]).text().trim().replace(/\s+/g, ' ');
      if (teamName) teamNames.push(teamName);
    });

    // اجمع كل الفرق في جدول واحد
    const standings = [];
    teams.each((rowIdx, row) => {
      const cells = $(row).find('.fg_cl');
      if (cells.length < 11) return;

      const rank = parseInt($(cells[0]).text().trim(), 10);
      const teamName = $(cells[1]).text().trim().replace(/\s+/g, ' ');
      const played = parseInt($(cells[2]).text().trim(), 10);
      const won = parseInt($(cells[5]).text().trim(), 10);
      const lost = parseInt($(cells[6]).text().trim(), 10);
      const drawn = parseInt($(cells[7]).text().trim(), 10);
      const goalsFor = parseInt($(cells[8]).text().trim(), 10);
      const goalsAgainst = parseInt($(cells[9]).text().trim(), 10);
      const points = parseInt($(cells[10]).text().trim(), 10);

      if (teamName && !isNaN(rank)) {
        standings.push({
          group: groupTitle,
          rank,
          teamName,
          played: played || 0,
          won: won || 0,
          drawn: drawn || 0,
          lost: lost || 0,
          goalsFor: goalsFor || 0,
          goalsAgainst: goalsAgainst || 0,
          goalDifference: (goalsFor || 0) - (goalsAgainst || 0),
          points: points || 0,
          isOurTeam: isOurTeam(teamName),
          syncedAt: new Date(),
        });
      }
    });

    tables.push({
      tableIdx,
      groupTitle,
      teamCount: teams.length,
      teamNames,
      standings,
    });
  });

  // 2. احذف الجداول المتطابقة (نفس أسماء الفرق)
  const uniqueTables = [];
  const seenSignatures = new Set();

  for (const table of tables) {
    // أنشئ signature من أسماء الفرق مرتبة
    const signature = [...table.teamNames].sort().join('|');

    if (seenSignatures.has(signature)) {
      console.log(`⏭️ Skipping duplicate: "${table.groupTitle}" (${table.teamCount} teams)`);
      continue;
    }

    seenSignatures.add(signature);

    // استبعد أي جدول يحتوي على نفس فرق جدول آخر
    // (كشف الجدول الكلي من 29 فريق)
    const isSuperset = uniqueTables.some((t) => {
      if (t.teamCount >= table.teamCount) return false;
      // هل كل فرق الجدول الصغير موجودة في الجدول الكبير؟
      const smallSet = new Set(t.teamNames);
      const allInBig = t.teamNames.every((n) => table.teamNames.includes(n));
      return allInBig;
    });

    if (isSuperset) {
      console.log(`⏭️ Skipping superset: "${table.groupTitle}" (${table.teamCount} teams)`);
      continue;
    }

    console.log(`📋 Keeping: "${table.groupTitle}" (${table.teamCount} teams)`);
    uniqueTables.push(table);
  }

  // 3. إذا كان الجدول الصغير جزء من الكبير، احذف الكبير
  const finalTables = uniqueTables.filter((table) => {
    // هل هناك جدول أصغر منه يحتوي على مجموعة فرعية من فرقه؟
    return !uniqueTables.some((smaller) => {
      if (smaller.teamCount >= table.teamCount) return false;
      // هل كل فرق الجدول الأصغر موجودة في الجدول الأكبر؟
      const allInBig = smaller.teamNames.every((n) => table.teamNames.includes(n));
      return allInBig;
    });
  });

  // 4. دمج كل الفرق
  const results = [];
  const seen = new Set();

  for (const table of finalTables) {
    console.log(`✅ Using: "${table.groupTitle}" (${table.teamCount} teams)`);
    for (const row of table.standings) {
      const uniqueKey = `${row.group}|${row.teamName}`;
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);
      results.push(row);
    }
  }

  return results;
};

const extractMatches = ($) => {
  const matches = [];
  const scripts = $('script').toArray();

  for (const script of scripts) {
    const content = $(script).html() || '';
    if (!content.includes('viewModelData')) continue;

    const match = content.match(/viewModelData\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) continue;

    try {
      const parsed = JSON.parse(match[1]);
      parsed.forEach((day) => {
        (day.Matches || []).forEach((m) => {
          const statusText = m.CurrentMatchStatus?.MatchStatusName || '';
          const matchDate = new Date(m.Date);

          matches.push({
            filgoalMatchId: m.Id,
            homeTeam: (m.HomeTeamName || '').trim(),
            awayTeam: (m.AwayTeamName || '').trim(),
            homeTeamLogo: m.HomeTeamLogoUrl || '',
            awayTeamLogo: m.AwayTeamLogoUrl || '',
            homeScore: m.HomeScore ?? null,
            awayScore: m.AwayScore ?? null,
            date: matchDate,
            championship: m.ChampionshipName || '',
            championshipId: m.ChampionshipId || null,
            round: m.WeekOrRound || '',
            status: detectStatus(statusText, m.HomeScore, m.AwayScore, matchDate),
            matchStatusText: statusText,
            filgoalUrl: m.Slug
              ? `https://www.filgoal.com/matches/${m.Id}/${m.Slug}`
              : '',
            isOurTeam: isOurTeam(m.HomeTeamName) || isOurTeam(m.AwayTeamName),
            syncedAt: new Date(),
          });
        });
      });
    } catch (e) {
      console.error('⚠️ Failed to parse viewModelData:', e.message);
    }
    break;
  }

  return matches;
};

const extractNews = ($) => {
  const news = [];
  const seen = new Set();

  $('.mcitem').each((i, item) => {
    try {
      const linkEl = $(item).find('.body a').first();
      const titleEl = $(item).find('.body a').first();
      const imgEl = $(item).find('.img img').first();

      const url = linkEl.attr('href') || '';
      const title = titleEl.text().trim().replace(/\s+/g, ' ');
      const imageUrl = imgEl.attr('data-src') || imgEl.attr('src') || '';

      if (!title || !url) return;

      const idMatch = url.match(/\/articles\/(\d+)/);
      const articleId = idMatch ? parseInt(idMatch[1], 10) : null;

      if (articleId && !seen.has(articleId)) {
        seen.add(articleId);
        news.push({
          filgoalArticleId: articleId,
          title,
          imageUrl: imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl,
          url: url.startsWith('http') ? url : `https://www.filgoal.com${url}`,
          publishedAt: new Date(),
          category: 'second-division',
          syncedAt: new Date(),
        });
      }
    } catch (e) {
      // ignore
    }
  });

  return news;
};

const runScraper = async () => {
  const startTime = Date.now();
  let standingsCount = 0;
  let matchesCount = 0;
  let newsCount = 0;

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
    maxRequestsPerCrawl: 1,
    requestHandlerTimeoutSecs: 180,
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
      log.info(`🌐 Fetching ${request.url}...`);

      await page.waitForLoadState('domcontentloaded', { timeout: 60000 });

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await page.waitForTimeout(2000);

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(2000);

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1000);

      const html = await page.content();
      const $ = cheerio.load(html);

      log.info(`📄 HTML length: ${html.length} chars`);

      const standings = extractStandings($);
      const matches = extractMatches($);
      const news = extractNews($);

      log.info(`📊 Standings: ${standings.length}`);
      log.info(`⚽ Matches: ${matches.length}`);
      log.info(`📰 News: ${news.length}`);

      if (standings.length > 0) {
        await FilgoalStanding.deleteMany({});
        await FilgoalStanding.insertMany(standings);
        standingsCount = standings.length;
        log.info(`✅ Saved ${standings.length} standings`);
      }

      if (matches.length > 0) {
        const ops = matches.map((m) => ({
          updateOne: {
            filter: { filgoalMatchId: m.filgoalMatchId },
            update: { $set: m },
            upsert: true,
          },
        }));
        await FilgoalMatch.bulkWrite(ops);
        matchesCount = matches.length;
        log.info(`✅ Saved ${matches.length} matches`);
      }

      if (news.length > 0) {
        const ops = news.map((n) => ({
          updateOne: {
            filter: { filgoalArticleId: n.filgoalArticleId },
            update: { $set: n },
            upsert: true,
          },
        }));
        await FilgoalNews.bulkWrite(ops);
        newsCount = news.length;
        log.info(`✅ Saved ${news.length} news`);
      }
    },

    failedRequestHandler({ request, log }) {
      log.error(`❌ Failed: ${request.url}`);
    },
  });

  try {
    await crawler.run([FILGOAL_URL]);

    await FilgoalSyncLog.create({
      status: 'success',
      standingsCount,
      matchesCount,
      newsCount,
      duration: Date.now() - startTime,
    });

    console.log(`✅ Sync completed in ${Date.now() - startTime}ms`);
    return { success: true, standingsCount, matchesCount, newsCount };
  } catch (error) {
    await FilgoalSyncLog.create({
      status: 'error',
      standingsCount,
      matchesCount,
      newsCount,
      duration: Date.now() - startTime,
      error: error.message,
    });

    console.error('❌ Sync failed:', error.message);
    return { success: false, error: error.message };
  }
};

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