const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'عنوان الخبر مطلوب'],
    trim: true,
  },
  content: {
    type: String,
    required: [true, 'محتوى الخبر مطلوب'],
  },
  excerpt: {
    type: String,
    maxlength: 300,
  },
  mediaType: {
    type: String,
    enum: ['none', 'image', 'video', 'both'],
    default: 'none',
  },
  imageUrl: {
    type: String,
    default: '',
  },
  imagePublicId: {
    type: String,
    default: '',
  },
  videoUrl: {
    type: String,
    default: '',
  },
  videoPublicId: {
    type: String,
    default: '',
  },
  videoThumbnail: {
    type: String,
    default: '',
  },
  videoDuration: {
    type: Number,
    default: 0,
  },
  category: {
    type: String,
    enum: ['football', 'club', 'academy', 'general', 'elections'],
    default: 'general',
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  isBreaking: {
    type: Boolean,
    default: false,
  },
  isUrgent: {
    type: Boolean,
    default: false,
  },
  priority: {
    type: Number,
    default: 0,
  },
  views: {
    type: Number,
    default: 0,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

newsSchema.index({ title: 'text', content: 'text' });
newsSchema.index({ category: 1, createdAt: -1 });
newsSchema.index({ isBreaking: 1, isUrgent: 1, isFeatured: 1 });

module.exports = mongoose.model('News', newsSchema);