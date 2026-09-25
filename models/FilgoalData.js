const mongoose = require('mongoose');

const standingSchema = new mongoose.Schema({
  group: { type: String, required: true, index: true },
  rank: { type: Number, required: true },
  teamName: { type: String, required: true },
  filgoalTeamId: { type: Number, index: true },
  teamLogo: { type: String, default: '' },
  teamUrl: { type: String, default: '' },
  played: { type: Number, default: 0 },
  homePlayed: { type: Number, default: 0 },
  awayPlayed: { type: Number, default: 0 },
  won: { type: Number, default: 0 },
  drawn: { type: Number, default: 0 },
  lost: { type: Number, default: 0 },
  goalsFor: { type: Number, default: 0 },
  goalsAgainst: { type: Number, default: 0 },
  goalDifference: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  yellowCards: { type: Number, default: 0 },
  redCards: { type: Number, default: 0 },
  isOurTeam: { type: Boolean, default: false, index: true },
  syncedAt: { type: Date, default: Date.now },
}, { timestamps: true });

standingSchema.index({ group: 1, rank: 1 });
standingSchema.index({ group: 1, teamName: 1 }, { unique: true });

const matchSchema = new mongoose.Schema({
  filgoalMatchId: { type: Number, unique: true, index: true },
  homeTeam: { type: String, required: true },
  awayTeam: { type: String, required: true },
  homeTeamId: { type: Number, index: true },
  awayTeamId: { type: Number, index: true },
  homeTeamLogo: { type: String, default: '' },
  awayTeamLogo: { type: String, default: '' },
  homeScore: { type: Number, default: null },
  awayScore: { type: Number, default: null },
  date: { type: Date, required: true, index: true },
  championship: { type: String, default: '' },
  championshipId: { type: Number, default: null, index: true },
  week: { type: Number, default: null },
  round: { type: String, default: '' },
  status: {
    type: String,
    enum: ['upcoming', 'live', 'finished', 'postponed', 'cancelled'],
    default: 'upcoming',
    index: true,
  },
  matchStatusText: { type: String, default: '' },
  filgoalUrl: { type: String, default: '' },
  isOurTeam: { type: Boolean, default: false, index: true },
  syncedAt: { type: Date, default: Date.now },
}, { timestamps: true });

matchSchema.index({ date: -1 });
matchSchema.index({ status: 1, date: -1 });
matchSchema.index({ championshipId: 1, date: -1 });

const teamSchema = new mongoose.Schema({
  filgoalTeamId: { type: Number, required: true, unique: true, index: true },
  teamName: { type: String, required: true },
  teamLogo: { type: String, default: '' },
  teamUrl: { type: String, default: '' },
  championshipId: { type: Number, default: 1668, index: true },
  isOurTeam: { type: Boolean, default: false, index: true },
  syncedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const newsSchema = new mongoose.Schema({
  filgoalArticleId: { type: Number, unique: true, index: true },
  title: { type: String, required: true },
  imageUrl: { type: String, default: '' },
  url: { type: String, required: true },
  content: { type: String, default: '' },
  author: { type: String, default: '' },
  tags: { type: [String], default: [] },
  publishedAt: { type: Date, default: Date.now },
  category: { type: String, default: 'general' },
  syncedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const scorerSchema = new mongoose.Schema({
  filgoalPlayerId: { type: Number, index: true },
  playerName: { type: String, required: true },
  teamName: { type: String, required: true },
  teamId: { type: Number, index: true },
  goals: { type: Number, default: 0 },
  playerUrl: { type: String, default: '' },
  championshipId: { type: Number, default: 1668, index: true },
  syncedAt: { type: Date, default: Date.now },
}, { timestamps: true });

scorerSchema.index({ playerName: 1, teamName: 1 }, { unique: true });

const syncLogSchema = new mongoose.Schema({
  status: { type: String, enum: ['success', 'error'], required: true },
  standingsCount: { type: Number, default: 0 },
  matchesCount: { type: Number, default: 0 },
  newsCount: { type: Number, default: 0 },
  teamsCount: { type: Number, default: 0 },
  scorersCount: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  error: { type: String, default: '' },
}, { timestamps: true });

module.exports = {
  FilgoalStanding: mongoose.model('FilgoalStanding', standingSchema),
  FilgoalMatch: mongoose.model('FilgoalMatch', matchSchema),
  FilgoalNews: mongoose.model('FilgoalNews', newsSchema),
  FilgoalTeam: mongoose.model('FilgoalTeam', teamSchema),
  FilgoalScorer: mongoose.model('FilgoalScorer', scorerSchema),
  FilgoalSyncLog: mongoose.model('FilgoalSyncLog', syncLogSchema),
};