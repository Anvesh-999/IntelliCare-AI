const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  specialization: {
    type: String,
    required: true
  },
  department: {
    type: String, // e.g., 'Cardiology', 'Pediatrics', 'General Medicine'
    required: true
  },
  experienceYears: Number,
  consultationFee: {
    type: Number,
    default: 500
  },
  shifts: [{
    dayOfWeek: String, // 'Monday', 'Tuesday', etc.
    startTime: String, // '09:00'
    endTime: String    // '17:00'
  }],
  bio: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Doctor', DoctorSchema);
