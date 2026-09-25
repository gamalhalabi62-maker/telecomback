const axios = require('axios');

const apiClient = axios.create({
  baseURL: process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io',
  timeout: 30000,
  headers: {
    'x-apisports-key': process.env.API_FOOTBALL_KEY,
  },
});

let requestCount = 0;
let requestResetTime = Date.now() + 60000;

const trackRequest = () => {
  if (Date.now() > requestResetTime) {
    requestCount = 0;
    requestResetTime = Date.now() + 60000;
  }
  requestCount++;
};

const getRequestCount = () => requestCount;

const fetchFromAPI = async (endpoint, params = {}) => {
  if (!process.env.API_FOOTBALL_KEY) {
    throw new Error('API_FOOTBALL_KEY غير مُعيّن');
  }

  try {
    trackRequest();
    const response = await apiClient.get(endpoint, { params });

    if (response.data.errors && Object.keys(response.data.errors).length > 0) {
      const errors = response.data.errors;
      console.error('❌ API-Football errors:', errors);
      throw new Error(Object.values(errors).join(', ') || 'API error');
    }

    return response.data;
  } catch (error) {
    console.error(`❌ API-Football fetch error [${endpoint}]:`, error.message);
    throw error;
  }
};

const searchLeague = async (country = 'Egypt') => {
  return fetchFromAPI('/leagues', { country });
};

const getStandings = async (leagueId, season) => {
  return fetchFromAPI('/standings', { league: leagueId, season });
};

const getFixtures = async (leagueId, season, extraParams = {}) => {
  return fetchFromAPI('/fixtures', { league: leagueId, season, ...extraParams });
};

const getFixtureById = async (fixtureId) => {
  return fetchFromAPI('/fixtures', { id: fixtureId });
};

const getFixtureEvents = async (fixtureId) => {
  return fetchFromAPI('/fixtures/events', { fixture: fixtureId });
};

const getFixtureStatistics = async (fixtureId) => {
  return fetchFromAPI('/fixtures/statistics', { fixture: fixtureId });
};

const getFixtureLineups = async (fixtureId) => {
  return fetchFromAPI('/fixtures/lineups', { fixture: fixtureId });
};

const getLiveFixtures = async (leagueId) => {
  return fetchFromAPI('/fixtures', { league: leagueId, live: 'all' });
};

const checkApiStatus = async () => {
  return fetchFromAPI('/status');
};

module.exports = {
  fetchFromAPI,
  searchLeague,
  getStandings,
  getFixtures,
  getFixtureById,
  getFixtureEvents,
  getFixtureStatistics,
  getFixtureLineups,
  getLiveFixtures,
  checkApiStatus,
  getRequestCount,
};