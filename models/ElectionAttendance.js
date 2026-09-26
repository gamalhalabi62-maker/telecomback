const mongoose = require('mongoose');

const electionAttendanceSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true,
    unique: true,
    index: true,
  },
  fullMembershipNumber: {
    type: String,
    required: true,
    index: true,
  },
  companyNumber: {
    type: String,
    default: '',
    trim: true,
    index: true,
  },
  membershipType: {
    type: String,
    enum: ['working', 'retired'],
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    default: '',
    trim: true,
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
  willAttend: {
    type: Boolean,
    required: true,
    index: true,
  },
  ipAddress: {
    type: String,
    default: '',
  },
  userAgent: {
    type: String,
    default: '',
  },
}, { timestamps: true });

electionAttendanceSchema.index({ willAttend: 1, createdAt: -1 });
electionAttendanceSchema.index({ committeeNumber: 1, willAttend: 1 });

module.exports = mongoose.model('ElectionAttendance', electionAttendanceSchema);