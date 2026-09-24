const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderName: {
    type: String,
    required: true,
  },
  senderEmail: {
    type: String,
    required: true,
  },
  senderPhone: {
    type: String,
    default: '',
  },
  subject: {
    type: String,
    required: [true, 'الموضوع مطلوب'],
    enum: ['inquiry', 'complaint', 'suggestion', 'membership', 'sponsorship', 'other'],
    default: 'inquiry',
  },
  subjectText: {
    type: String,
    default: '',
  },
  content: {
    type: String,
    required: [true, 'الرسالة مطلوبة'],
    minlength: [10, 'الرسالة قصيرة جداً'],
    maxlength: [2000, 'الرسالة طويلة جداً'],
  },
  status: {
    type: String,
    enum: ['new', 'read', 'replied', 'archived'],
    default: 'new',
  },
  adminNotes: {
    type: String,
    default: '',
  },
  repliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  repliedAt: {
    type: Date,
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
}, { timestamps: true });

messageSchema.index({ status: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);