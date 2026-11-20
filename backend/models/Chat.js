const mongoose = require('mongoose');
const crypto = require('crypto');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ['patient', 'ai', 'system'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  citations: [{
    document_id: String,
    title: String,
    excerpt: String,
    relevance_score: Number
  }],
  tools_called: [{
    tool_name: String,
    success: Boolean,
    execution_time_ms: Number
  }],
  isPersonalRecordUsed: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const ChatSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  conversationId: {
    type: String,
    required: true,
    index: true,
    default: () => `conv-${crypto.randomUUID()}`
  },
  title: {
    type: String,
    default: 'General Healthcare Consultation'
  },
  consentGiven: {
    type: Boolean,
    default: false
  },
  consentDate: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day session retention
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  messages: [MessageSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for patient isolation and fast thread retrieval
ChatSchema.index({ patient: 1, conversationId: 1 });
ChatSchema.index({ patient: 1, isActive: 1, updatedAt: -1 });

// Method to verify if session has expired
ChatSchema.methods.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

// Method to extend session expiration
ChatSchema.methods.renewSession = function(days = 30) {
  this.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  this.updatedAt = new Date();
};

module.exports = mongoose.model('Chat', ChatSchema);
