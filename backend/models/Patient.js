const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dateOfBirth: Date,
  gender: String,
  phone: String,
  bloodGroup: String,
  height: Number, // in cm
  weight: Number, // in kg
  emergencyContact: {
    name: String,
    relation: String,
    phone: String
  },
  insurance: {
    provider: String,
    policyNumber: String,
    validTill: Date
  },
  vaccineHistory: [{
    vaccineName: String,
    dateAdministered: Date,
    status: String // 'scheduled', 'completed'
  }],
  lifestyle: {
    dietPreference: { type: String, default: 'balanced' }, // 'vegetarian', 'keto', 'low carb', 'balanced'
    activityLevel: { type: String, default: 'moderate' }, // 'sedentary', 'moderate', 'active'
    smoking: { type: Boolean, default: false },
    alcohol: { type: Boolean, default: false }
  },
  healthMetrics: {
    bloodPressureHistory: [{
      systolic: Number,
      diastolic: Number,
      date: { type: Date, default: Date.now }
    }],
    bloodSugarHistory: [{
      glucose: Number, // mg/dL
      type: { type: String, default: 'fasting' },
      date: { type: Date, default: Date.now }
    }],
    weightHistory: [{
      value: Number,
      date: { type: Date, default: Date.now }
    }]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Patient', PatientSchema);
