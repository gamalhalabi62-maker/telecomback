const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم اللاعب مطلوب'],
    trim: true,
  },
  number: {
    type: Number,
    required: [true, 'رقم القميص مطلوب'],
    min: 1,
    max: 99,
  },
  position: {
    type: String,
    required: [true, 'المركز مطلوب'],
    enum: ['goalkeeper', 'defender', 'midfielder', 'forward'],
  },
  nationality: {
    type: String,
    default: 'مصري',
  },
  birthDate: {
    type: Date,
  },
  height: {
    type: Number, 
  },
  weight: {
    type: Number, 
  },
  imageUrl: {
    type: String,
    default: '',
  },
  bio: {
    type: String,
    default: '',
  },
  stats: {
    appearances: { type: Number, default: 0 },
    goals: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    yellowCards: { type: Number, default: 0 },
    redCards: { type: Number, default: 0 },
  },
  isCaptain: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  joinDate: {
    type: Date,
    default: Date.now,
  },
  order: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

module.exports = mongoose.model('Player', playerSchema);