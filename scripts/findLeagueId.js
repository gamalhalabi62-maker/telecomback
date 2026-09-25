const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const apiFootball = require('../services/apiFootballService');

const run = async () => {
  try {
    console.log('🔍 Searching for Egyptian leagues...\n');
    const data = await apiFootball.searchLeague('Egypt');

    const leagues = data.response || [];
    leagues.forEach((item) => {
      console.log(`ID: ${item.league.id}`);
      console.log(`  Name: ${item.league.name}`);
      console.log(`  Type: ${item.league.type}`);
      console.log(`  Country: ${item.country.name}`);
      console.log(`  Seasons: ${item.seasons?.slice(-5).map((s) => s.year).join(', ')}`);
      console.log('---');
    });

    console.log(`\n📊 Total: ${leagues.length} leagues found`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

run();