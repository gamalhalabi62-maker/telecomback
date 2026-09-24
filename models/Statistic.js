const mongoose = require('mongoose');

const statisticSchema = new mongoose.Schema({
  label: {
    type: String,
    required: [true, 'اسم الإحصائية مطلوب'],
    trim: true,
  },
  value: {
    type: Number,
    required: [true, 'القيمة مطلوبة'],
    default: 0,
  },
  suffix: {
    type: String,
    default: '', 
  },
  icon: {
    type: String,
    default: 'trophy', 
    enum: ['trophy', 'users', 'football', 'newspaper', 'star', 'calendar', 'eye', 'medal', 'target', 'award'],
  },
  color: {
    type: String,
    default: 'primary',
    enum: ['primary', 'secondary', 'blue', 'green', 'red', 'orange', 'purple', 'pink', 'cyan', 'indigo'],
  },
  order: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  category: {
    type: String,
    enum: ['general', 'team', 'achievements', 'fans'],
    default: 'general',
  },
}, { timestamps: true });

module.exports = mongoose.model('Statistic', statisticSchema);