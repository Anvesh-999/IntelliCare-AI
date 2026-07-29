const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportName: {
    type: String,
    required: true
  },
  reportType: {
    type: String, // 'blood_report', 'scan', 'prescription'
    required: true
  },
  fileUrl: String,
  uploadDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationDate: Date,
  rawText: String,
  aiSummary: {
    summary: String,
    anomalies: [String],
    findings: [{
      panel: String,
      metric: String,
      status: String,
      explanation: String
    }],
    recommendations: [String]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Report', ReportSchema);
