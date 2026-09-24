const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  fullMembershipNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },
  companyNumber: {
    type: String,
    required: true,
    trim: true,
  },
  membershipNumber: {
    type: String,
    required: true,
    trim: true,
  },
  membershipType: {
    type: String,
    enum: ['working', 'retired'],
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  phone: {
    type: String,
    default: '',
    trim: true,
  },
  address: {
    type: String,
    default: '',
    trim: true,
  },
  gender: {
    type: String,
    enum: ['male', 'female', ''],
    default: '',
  },
  committeeName: {
    type: String,
    default: '',
    trim: true,
  },
  committeeNumber: {
    type: String,
    default: '',
    trim: true,
  },
  hasVoted: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

memberSchema.index({ name: 'text', phone: 'text' });
memberSchema.index({ companyNumber: 1, membershipNumber: 1 });
memberSchema.index({ committeeNumber: 1 });

module.exports = mongoose.model('Member', memberSchema);