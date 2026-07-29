const mongoose = require('mongoose');

const BedSchema = new mongoose.Schema({
  bedNumber: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['icu', 'general', 'pediatric', 'maternity', 'emergency'],
    default: 'general'
  },
  ward: {
    type: String, // e.g. 'Ward A', 'ICU block'
    required: true
  },
  status: {
    type: String,
    enum: ['vacant', 'occupied', 'cleaning', 'maintenance'],
    default: 'vacant'
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient'
  },
  allocatedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Bed', BedSchema);
