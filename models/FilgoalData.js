const mongoose = require('mongoose');

const standingSchema = new mongoose.Schema({
  group: { type: String, required: true, index: true },
  rank: { type: Number, required: true },
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
  isOurTeam: { type: Boolean, default: false },
  syncedAt: { type: Date, default: Date.now },
}, { timestamps: true });

standingSchema.index({ group: 1, rank: 1 });

const matchSchema = new mongoose.Schema({
  filgoalMatchId: { type: Number, unique: true, index: true },
  homeTeam: { type: String, required: true },
  awayTeam: { type: String, required: true },
  homeTeamLogo: { type: String, default: '' },
  awayTeamLogo: { type: String, default: '' },
  homeScore: { type: Number, default: null },
  awayScore: { type: Number, default: null },
  date: { type: Date, required: true, index: true },
  championship: { type: String, default: '' },
  championshipId: { type: Number, default: null },
  round: { type: String, default: '' },
  status: {
    type: String,
    enum: ['upcoming', 'live', 'finished', 'postponed'],
    default: 'upcoming',
    index: true,
  },
  matchStatusText: { type: String, default: '' },
  filgoalUrl: { type: String, default: '' },
  isOurTeam: { type: Boolean, default: false },
  syncedAt: { type: Date, default: Date.now },
}, { timestamps: true });

matchSchema.index({ date: -1 });
matchSchema.index({ status: 1, date: -1 });

const newsSchema = new mongoose.Schema({
  filgoalArticleId: { type: Number, unique: true, index: true },
  title: { type: String, required: true },
  imageUrl: { type: String, default: '' },
  url: { type: String, required: true },
  publishedAt: { type: Date, default: Date.now },
  category: { type: String, default: 'general' },
  syncedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const syncLogSchema = new mongoose.Schema({
  status: { type: String, enum: ['success', 'error'], required: true },
  standingsCount: { type: Number, default: 0 },
  matchesCount: { type: Number, default: 0 },
  newsCount: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  error: { type: String, default: '' },
}, { timestamps: true });

module.exports = {
  FilgoalStanding: mongoose.model('FilgoalStanding', standingSchema),
  FilgoalMatch: mongoose.model('FilgoalMatch', matchSchema),
  FilgoalNews: mongoose.model('FilgoalNews', newsSchema),
  FilgoalSyncLog: mongoose.model('FilgoalSyncLog', syncLogSchema),
};