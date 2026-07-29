const mongoose = require('mongoose');

const PrescriptionSchema = new mongoose.Schema({
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  medicines: [{
    name: String,
    dosage: String,
    frequency: String, // e.g. 'Once daily'
    duration: String,  // e.g. '7 days'
    instructions: String
  }],
  status: {
    type: String,
    enum: ['active', 'filled', 'expired'],
    default: 'active'
  },
  interactionCheck: {
    checked: { type: Boolean, default: false },
    hasInteractions: { type: Boolean, default: false },
    summary: String,
    details: [{
      drugs: [String],
      severity: String,
      explanation: String,
      advice: String
    }]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Prescription', PrescriptionSchema);
