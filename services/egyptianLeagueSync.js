const {
  EgyptianLeagueStanding,
  EgyptianLeagueMatch,
  EgyptianLeagueSyncLog,
} = require('../models/EgyptianLeague');
const apiFootball = require('./apiFootballService');

const OUR_TEAM_KEYWORDS = ['telecom', 'المصرية للاتصالات', 'مصر للاتصالات'];

const isOurTeam = (teamName) => {
  if (!teamName) return false;
  const lower = teamName.toLowerCase();
  return OUR_TEAM_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
};

const syncStandings = async () => {
  const startTime = Date.now();
  let apiCallsUsed = 0;

  try {
    const leagueId = process.env.API_FOOTBALL_LEAGUE_ID;
    const season = process.env.API_FOOTBALL_SEASON;

    if (!leagueId || !season) {
      throw new Error('API_FOOTBALL_LEAGUE_ID أو API_FOOTBALL_SEASON غير مُعيّن');
    }

    const data = await apiFootball.getStandings(leagueId, season);
    apiCallsUsed++;

    const standingsResponse = data.response?.[0]?.league?.standings || [];
    const allStandings = [];

    standingsResponse.forEach((group, groupIdx) => {
      const groupLabel = group[0]?.group || `Group ${groupIdx + 1}`;
      group.forEach((item) => {
        allStandings.push({
          rank: item.rank,
          teamId: item.team.id,
          teamName: item.team.name,
          teamLogo: item.team.logo,
          played: item.all?.played || 0,
          won: item.all?.win || 0,
          drawn: item.all?.draw || 0,
          lost: item.all?.lose || 0,
          goalsFor: item.all?.goals?.for || 0,
          goalsAgainst: item.all?.goals?.against || 0,
          goalDifference: item.goalsDiff || 0,
          points: item.points || 0,
          form: item.form || '',
          description: item.description || '',
          group: groupLabel,
          isOurTeam: isOurTeam(item.team.name),
        });
      });
    });

    await EgyptianLeagueStanding.deleteMany({});
    if (allStandings.length > 0) {
      await EgyptianLeagueStanding.insertMany(allStandings);
    }

    const duration = Date.now() - startTime;
    await EgyptianLeagueSyncLog.create({
      syncType: 'standings',
      status: 'success',
      message: `تم مزامنة ${allStandings.length} فريق`,
      itemsSynced: allStandings.length,
      apiCallsUsed,
      duration,
    });

    console.log(`✅ Standings synced: ${allStandings.length} teams in ${duration}ms`);
    return { success: true, count: allStandings.length };
  } catch (error) {
    const duration = Date.now() - startTime;
    await EgyptianLeagueSyncLog.create({
      syncType: 'standings',
      status: 'error',
      message: error.message,
      apiCallsUsed,
      duration,
    });
    console.error('❌ syncStandings error:', error.message);
    return { success: false, error: error.message };
  }
};

const syncFixtures = async (options = {}) => {
  const startTime = Date.now();
  let apiCallsUsed = 0;

  try {
    const leagueId = process.env.API_FOOTBALL_LEAGUE_ID;
    const season = process.env.API_FOOTBALL_SEASON;

    if (!leagueId || !season) {
      throw new Error('API_FOOTBALL_LEAGUE_ID أو API_FOOTBALL_SEASON غير مُعيّن');
    }

    const data = await apiFootball.getFixtures(leagueId, season, options);
    apiCallsUsed++;

    const fixtures = data.response || [];
    let created = 0;
    let updated = 0;

    for (const fixture of fixtures) {
      const homeTeamName = fixture.teams?.home?.name || '';
      const awayTeamName = fixture.teams?.away?.name || '';

      const matchData = {
        fixtureId: fixture.fixture.id,
        matchday: fixture.league?.round?.match(/\d+/) ? Number(fixture.league.round.match(/\d+/)[0]) : 0,
        round: fixture.league?.round || '',
        homeTeam: {
          id: fixture.teams?.home?.id,
          name: homeTeamName,
          logo: fixture.teams?.home?.logo || '',
        },
        awayTeam: {
          id: fixture.teams?.away?.id,
          name: awayTeamName,
          logo: fixture.teams?.away?.logo || '',
        },
        homeScore: fixture.goals?.home,
        awayScore: fixture.goals?.away,
        halftimeScore: {
          home: fixture.score?.halftime?.home,
          away: fixture.score?.halftime?.away,
        },
        date: new Date(fixture.fixture.date),
        status: {
          short: fixture.fixture.status?.short || '',
          long: fixture.fixture.status?.long || '',
          elapsed: fixture.fixture.status?.elapsed,
        },
        venue: {
          name: fixture.fixture.venue?.name || '',
          city: fixture.fixture.venue?.city || '',
        },
        league: {
          id: fixture.league?.id,
          name: fixture.league?.name,
          logo: fixture.league?.logo,
          country: fixture.league?.country,
          season: fixture.league?.season,
        },
        isOurTeam: isOurTeam(homeTeamName) || isOurTeam(awayTeamName),
        syncedAt: new Date(),
      };

      const existing = await EgyptianLeagueMatch.findOne({ fixtureId: fixture.fixture.id });
      if (existing) {
        await EgyptianLeagueMatch.updateOne({ _id: existing._id }, { $set: matchData });
        updated++;
      } else {
        await EgyptianLeagueMatch.create(matchData);
        created++;
      }
    }

    const duration = Date.now() - startTime;
    await EgyptianLeagueSyncLog.create({
      syncType: 'fixtures',
      status: 'success',
      message: `Created: ${created}, Updated: ${updated}`,
      itemsSynced: created + updated,
      apiCallsUsed,
      duration,
    });

    console.log(`✅ Fixtures synced: ${created} created, ${updated} updated`);
    return { success: true, created, updated };
  } catch (error) {
    const duration = Date.now() - startTime;
    await EgyptianLeagueSyncLog.create({
      syncType: 'fixtures',
      status: 'error',
      message: error.message,
      apiCallsUsed,
      duration,
    });
    console.error('❌ syncFixtures error:', error.message);
    return { success: false, error: error.message };
  }
};

const syncLiveFixtures = async () => {
  try {
    const leagueId = process.env.API_FOOTBALL_LEAGUE_ID;
    if (!leagueId) {
      throw new Error('API_FOOTBALL_LEAGUE_ID غير مُعيّن');
    }

    const data = await apiFootball.getLiveFixtures(leagueId);
    const fixtures = data.response || [];

    let updated = 0;
    for (const fixture of fixtures) {
      const result = await EgyptianLeagueMatch.updateOne(
        { fixtureId: fixture.fixture.id },
        {
          $set: {
            homeScore: fixture.goals?.home,
            awayScore: fixture.goals?.away,
            'status.short': fixture.fixture.status?.short,
            'status.long': fixture.fixture.status?.long,
            'status.elapsed': fixture.fixture.status?.elapsed,
            syncedAt: new Date(),
          },
        }
      );
      if (result.modifiedCount > 0) updated++;
    }

    console.log(`✅ Live sync: ${updated} matches updated`);
    return { success: true, updated };
  } catch (error) {
    console.error('❌ syncLiveFixtures error:', error.message);
    return { success: false, error: error.message };
  }
};

const syncMatchDetails = async (fixtureId) => {
  try {
    const [eventsData, statsData, lineupsData] = await Promise.all([
      apiFootball.getFixtureEvents(fixtureId),
      apiFootball.getFixtureStatistics(fixtureId),
      apiFootball.getFixtureLineups(fixtureId),
    ]);

    const events = (eventsData.response || []).map((e) => ({
      minute: e.time?.elapsed,
      extraMinute: e.time?.extra,
      type: e.type,
      detail: e.detail,
      player: e.player?.name,
      assist: e.assist?.name,
      team: e.team?.name,
      teamId: e.team?.id,
    }));

    const statistics = (statsData.response || []).map((s) => ({
      team: s.team?.name,
      teamId: s.team?.id,
      stats: (s.statistics || []).map((st) => ({
        type: st.type,
        value: st.value,
      })),
    }));

    const lineups = {
      home: {
        coach: lineupsData.response?.[0]?.coach?.name || '',
        formation: lineupsData.response?.[0]?.formation || '',
        startXI: (lineupsData.response?.[0]?.startXI || []).map((p) => ({
          id: p.player?.id,
          name: p.player?.name,
          number: p.player?.number,
          pos: p.player?.pos,
        })),
      },
      away: {
        coach: lineupsData.response?.[1]?.coach?.name || '',
        formation: lineupsData.response?.[1]?.formation || '',
        startXI: (lineupsData.response?.[1]?.startXI || []).map((p) => ({
          id: p.player?.id,
          name: p.player?.name,
          number: p.player?.number,
          pos: p.player?.pos,
        })),
      },
    };

    await EgyptianLeagueMatch.updateOne(
      { fixtureId },
      { $set: { events, statistics, lineups, syncedAt: new Date() } }
    );

    return { success: true };
  } catch (error) {
    console.error('❌ syncMatchDetails error:', error.message);
    return { success: false, error: error.message };
  }
};

const fullSync = async () => {
  console.log('\n🔄 Starting full sync...');
  const standings = await syncStandings();
  const fixtures = await syncFixtures();
  console.log('✅ Full sync completed\n');
  return { standings, fixtures };
};

module.exports = {
  syncStandings,
  syncFixtures,
  syncLiveFixtures,
  syncMatchDetails,
  fullSync,
  isOurTeam,
};