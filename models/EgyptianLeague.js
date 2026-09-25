const mongoose = require('mongoose');

const standingSchema = new mongoose.Schema({
  rank: { type: Number, required: true },
  teamId: { type: Number, index: true },
  teamName: { type: String, required: true },
  teamLogo: { type: String, default: '' },
  played: { type: Number, default: 0 },
  won: { type: Number, default: 0 },
  drawn: { type: Number, default: 0 },
  lost: { type: Number, default: 0 },
  goalsFor: { type: Number, default: 0 },
  goalsAgainst: { type: Number, default: 0 },
  goalDifference: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  form: { type: String, default: '' },
  description: { type: String, default: '' },
  group: { type: String, default: '' },
  isOurTeam: { type: Boolean, default: false },
}, { timestamps: true });

standingSchema.index({ rank: 1 });
standingSchema.index({ group: 1, rank: 1 });

const matchSchema = new mongoose.Schema({
  fixtureId: { type: Number, required: true, unique: true, index: true },
  matchday: { type: Number, default: 0 },
  round: { type: String, default: '' },
  homeTeam: {
    id: Number,
    name: String,
    logo: String,
  },
  awayTeam: {
    id: Number,
    name: String,
    logo: String,
  },
  homeScore: { type: Number, default: null },
  awayScore: { type: Number, default: null },
  halftimeScore: {
    home: { type: Number, default: null },
    away: { type: Number, default: null },
  },
  date: { type: Date, required: true, index: true },
  status: {
    short: String,
    long: String,
    elapsed: Number,
  },
  venue: {
    name: String,
    city: String,
  },
  league: {
    id: Number,
    name: String,
    logo: String,
    country: String,
    season: Number,
  },
  events: [{
    minute: Number,
    extraMinute: Number,
    type: String,
    detail: String,
    player: String,
    assist: String,
    team: String,
    teamId: Number,
  }],
  lineups: {
    home: {
      coach: String,
      formation: String,
      startXI: [{
        id: Number,
        name: String,
        number: Number,
        pos: String,
      }],
    },
    away: {
      coach: String,
      formation: String,
      startXI: [{
        id: Number,
        name: String,
        number: Number,
        pos: String,
      }],
    },
  },
  statistics: [{
    team: String,
    teamId: Number,
    stats: [{
      type: String,
      value: mongoose.Schema.Types.Mixed,
    }],
  }],
  isOurTeam: { type: Boolean, default: false },
  syncedAt: { type: Date, default: Date.now },
}, { timestamps: true });

matchSchema.index({ date: -1 });
matchSchema.index({ 'status.short': 1 });
matchSchema.index({ matchday: 1 });

const newsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  imageUrl: { type: String, default: '' },
  source: { type: String, default: '' },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const syncLogSchema = new mongoose.Schema({
  syncType: { type: String, enum: ['standings', 'fixtures', 'full'], required: true },
  status: { type: String, enum: ['success', 'error'], required: true },
  message: { type: String, default: '' },
  itemsSynced: { type: Number, default: 0 },
  apiCallsUsed: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
}, { timestamps: true });

const EgyptianLeagueStanding = mongoose.model('EgyptianLeagueStanding', standingSchema);
const EgyptianLeagueMatch = mongoose.model('EgyptianLeagueMatch', matchSchema);
const EgyptianLeagueNews = mongoose.model('EgyptianLeagueNews', newsSchema);
const EgyptianLeagueSyncLog = mongoose.model('EgyptianLeagueSyncLog', syncLogSchema);

module.exports = {
  EgyptianLeagueStanding,
  EgyptianLeagueMatch,
  EgyptianLeagueNews,
  EgyptianLeagueSyncLog,
};