const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  email: String,
  role: String,
  action: {
    type: String,
    required: true // e.g. 'LOGIN_SUCCESS', 'APPOINTMENT_BOOKED', 'PRESCRIPTION_GENERATED', 'ROLE_CHANGED'
  },
  details: String,
  ipAddress: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
