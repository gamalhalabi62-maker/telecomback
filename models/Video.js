const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'عنوان الفيديو مطلوب'],
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  videoUrl: {
    type: String,
    required: [true, 'الفيديو مطلوب'],
  },
  thumbnailUrl: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    enum: ['highlights', 'interviews', 'training', 'events', 'general'],
    default: 'general',
  },
  duration: {
    type: Number, 
    default: 0,
  },
  views: {
    type: Number,
    default: 0,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Video', videoSchema);