// scripts/scrapeFilGoal.js
const { PlaywrightCrawler } = require('crawlee');
const cheerio = require('cheerio');

const FILGOAL_CHAMPIONSHIP_URL = 'https://www.filgoal.com/championships/1576/';

const crawler = new PlaywrightCrawler({
    async requestHandler({ page, request, log }) {
        log.info(`Processing ${request.url}...`);

        // انتظر حتى يتم تحميل العناصر الأساسية
        await page.waitForSelector('.fg_tbl');

        const html = await page.content();
        const $ = cheerio.load(html);

        // --- 1. استخراج جداول الترتيب ---
        const standings = [];
        $('.fg_tbl').each((tableIndex, table) => {
            const groupName = $(table).find('h3').text().trim() || `المجموعة ${tableIndex + 1}`;
            const teams = [];

            $(table).find('.fg_rw.active').each((rowIndex, row) => {
                const rank = $(row).find('.fg_cl.t1').text().trim();
                const teamName = $(row).find('.fg_cl.t2').text().trim();
                const played = $(row).find('.fg_cl.t3').eq(0).text().trim();
                const points = $(row).find('.fg_cl.t3').last().text().trim();
                
                if (rank && teamName) {
                    teams.push({
                        rank: parseInt(rank, 10),
                        teamName,
                        played: parseInt(played, 10),
                        points: parseInt(points, 10),
                    });
                }
            });

            standings.push({
                group: groupName,
                teams,
            });
        });

        log.info(`Extracted ${standings.length} standings groups.`);

        // --- 2. استخراج نتائج المباريات من كود JavaScript ---
        // نبحث عن السكريبت الذي يحتوي على viewModelData
        const scriptContent = $('script:contains("viewModelData")').html();
        let matchesData = [];

        if (scriptContent) {
            // استخدام Regex لاستخراج كائن JSON
            const jsonMatch = scriptContent.match(/viewModelData = (\[.*?\]);/s);
            if (jsonMatch && jsonMatch[1]) {
                try {
                    const parsedData = JSON.parse(jsonMatch[1]);
                    // استخراج المباريات من كل يوم
                    parsedData.forEach(day => {
                        day.Matches.forEach(match => {
                            matchesData.push({
                                id: match.Id,
                                date: match.Date,
                                homeTeam: match.HomeTeamName,
                                awayTeam: match.AwayTeamName,
                                homeScore: match.HomeScore,
                                awayScore: match.AwayScore,
                                championship: match.ChampionshipName,
                                status: match.CurrentMatchStatus.MatchStatusName,
                            });
                        });
                    });
                } catch (e) {
                    log.error('Failed to parse matches JSON from viewModelData:', e);
                }
            }
        }

        log.info(`Extracted ${matchesData.length} matches.`);
        
        // --- 3. طباعة النتائج ---
        console.log('\n===== Standings =====');
        console.log(JSON.stringify(standings, null, 2));
        console.log('\n===== Matches =====');
        console.log(JSON.stringify(matchesData, null, 2));
    },
    maxRequestsPerCrawl: 1,
});

crawler.run([FILGOAL_CHAMPIONSHIP_URL]);