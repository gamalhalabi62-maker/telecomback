const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  opponent: {
    type: String,
    required: [true, 'اسم الفريق المنافس مطلوب'],
    trim: true,
  },
  opponentLogo: {
    type: String,
    default: '',
  },
  competition: {
    type: String,
    required: [true, 'البطولة مطلوبة'],
    enum: ['league', 'cup', 'friendly', 'african', 'arab', 'other'],
    default: 'league',
  },
  competitionName: {
    type: String,
    default: '',
  },
  round: {
    type: String,
    default: '',
  },
  date: {
    type: Date,
    required: [true, 'تاريخ المباراة مطلوب'],
  },
  venue: {
    type: String,
    enum: ['home', 'away', 'neutral'],
    default: 'home',
  },
  stadium: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['upcoming', 'live', 'finished', 'postponed', 'cancelled'],
    default: 'upcoming',
  },
  ourScore: {
    type: Number,
    default: null,
  },
  opponentScore: {
    type: Number,
    default: null,
  },
  minute: {
    type: Number, 
    default: 0,
  },
  events: [{
    minute: Number,
    type: {
      type: String,
      enum: ['goal', 'own_goal', 'penalty', 'yellow_card', 'red_card', 'substitution', 'var'],
    },
    player: String,
    team: {
      type: String,
      enum: ['us', 'opponent'],
    },
    description: String,
  }],
  lineup: {
    type: String,
    default: '',
  },
  notes: {
    type: String,
    default: '',
  },
  views: {
    type: Number,
    default: 0,
  },
  featured: {
    type: Boolean,
    default: false,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

matchSchema.index({ date: -1 });
matchSchema.index({ status: 1, date: 1 });

module.exports = mongoose.model('Match', matchSchema);