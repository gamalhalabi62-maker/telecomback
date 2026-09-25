const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const sync = require('../services/egyptianLeagueSync');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const type = process.argv[2] || 'full';

    console.log(`🔄 Sync type: ${type}\n`);

    let result;
    if (type === 'standings') result = await sync.syncStandings();
    else if (type === 'fixtures') result = await sync.syncFixtures();
    else if (type === 'live') result = await sync.syncLiveFixtures();
    else result = await sync.fullSync();

    console.log('\n📊 Result:', JSON.stringify(result, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Sync error:', error);
    process.exit(1);
  }
};

run();