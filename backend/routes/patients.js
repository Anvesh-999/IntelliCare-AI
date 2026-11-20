const express = require('express');
const router = express.Router();
const axios = require('axios');
const Patient = require('../models/Patient');
const MedicalRecord = require('../models/MedicalRecord');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const Report = require('../models/Report');
const Chat = require('../models/Chat');
const { protect, checkRole } = require('../middleware/auth');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// @route   GET /api/patients/profile
// @desc    Get patient profile details
// @access  Private (Patient only or Doctors/Admins)
router.get('/profile', protect, async (req, res) => {
  try {
    let queryUserId = req.user._id;
    
    // If user is doctor or admin, they might pass a patientId parameter
    if (['doctor', 'hospital_admin', 'admin', 'laboratory'].includes(req.user.role) && req.query.patientId) {
      const patient = await Patient.findById(req.query.patientId).populate('user', 'name email role');
      if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
      return res.json({ success: true, patient });
    }

    const patient = await Patient.findOne({ user: queryUserId }).populate('user', 'name email role');
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }
    res.json({ success: true, patient });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error fetching profile' });
  }
});

// @route   PUT /api/patients/profile
// @desc    Update patient profile demographics
// @access  Private (Patient only)
router.put('/profile', protect, checkRole(['patient']), async (req, res) => {
  const { dateOfBirth, gender, phone, bloodGroup, height, weight, emergencyContact, lifestyle } = req.body;
  
  try {
    let patient = await Patient.findOne({ user: req.user._id });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    // Update fields
    if (dateOfBirth) patient.dateOfBirth = dateOfBirth;
    if (gender) patient.gender = gender;
    if (phone) patient.phone = phone;
    if (bloodGroup) patient.bloodGroup = bloodGroup;
    if (height) patient.height = height;
    if (weight) {
      patient.weight = weight;
      patient.healthMetrics.weightHistory.push({ value: weight });
    }
    if (emergencyContact) patient.emergencyContact = emergencyContact;
    if (lifestyle) patient.lifestyle = { ...patient.lifestyle, ...lifestyle };

    await patient.save();
    res.json({ success: true, patient });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
});

// @route   POST /api/patients/metrics
// @desc    Record patient health metrics (BP, glucose, weight)
// @access  Private (Patient only)
router.post('/metrics', protect, checkRole(['patient']), async (req, res) => {
  const { type, values } = req.body; // type: 'bp', 'sugar', 'weight'
  
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient profile not found' });

    if (type === 'bp') {
      const { systolic, diastolic } = values;
      patient.healthMetrics.bloodPressureHistory.push({ systolic, diastolic });
    } else if (type === 'sugar') {
      const { glucose, mealType } = values; // mealType: 'fasting', 'post_prandial'
      patient.healthMetrics.bloodSugarHistory.push({ glucose, type: mealType });
    } else if (type === 'weight') {
      const { weight } = values;
      patient.weight = weight;
      patient.healthMetrics.weightHistory.push({ value: weight });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid metric type' });
    }

    await patient.save();
    res.json({ success: true, patient });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error saving metrics' });
  }
});

// @route   GET /api/patients/timeline
// @desc    Generate Patient Medical Timeline
// @access  Private (Patient or Doctor/Admins)
router.get('/timeline', protect, async (req, res) => {
  try {
    let patientId = req.query.patientId;
    
    // Find the correct patient profile ID
    let patient;
    if (req.user.role === 'patient') {
      patient = await Patient.findOne({ user: req.user._id });
    } else if (patientId) {
      patient = await Patient.findById(patientId);
    }

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    // Collect all records from MongoDB
    const appointments = await Appointment.find({ patient: patient._id }).populate('doctor', 'user specialization department').populate({ path: 'doctor', populate: { path: 'user', select: 'name' } });
    const prescriptions = await Prescription.find({ patient: patient._id }).populate('doctor', 'user').populate({ path: 'doctor', populate: { path: 'user', select: 'name' } });
    const reports = await Report.find({ patient: patient._id });
    const clinicalRecords = await MedicalRecord.find({ patient: patient._id });

    // Format all events into a unified format for the AI Service
    const rawEvents = [];

    // Map Appointments
    appointments.forEach(app => {
      rawEvents.push({
        id: app._id,
        type: 'appointment',
        date: app.date,
        title: `Appointment with ${app.doctor?.user?.name || 'Doctor'}`,
        description: `Scheduled at ${app.timeslot}. Status: ${app.status}. Type: ${app.type}. Reason: ${app.symptoms || 'General Checkup'}`,
        source: 'Hospital'
      });
    });

    // Map Prescriptions
    prescriptions.forEach(p => {
      const medList = p.medicines.map(m => `${m.name} ${m.dosage} (${m.frequency})`).join(', ');
      rawEvents.push({
        id: p._id,
        type: 'prescription',
        date: p.date,
        title: 'Prescription Issued',
        description: `Medications: ${medList || 'None'}`,
        source: `Dr. ${p.doctor?.user?.name || 'Heart'}`
      });
    });

    // Map Reports
    reports.forEach(r => {
      rawEvents.push({
        id: r._id,
        type: 'report',
        date: r.uploadDate,
        title: r.reportName,
        description: `Type: ${r.reportType.replace('_', ' ')}. Status: ${r.status}.`,
        source: 'Laboratory',
        metadata: {
          fileUrl: r.fileUrl
        }
      });
    });

    // Map Clinical Records (Diagnoses, Notes, etc.)
    clinicalRecords.forEach(c => {
      rawEvents.push({
        id: c._id,
        type: c.type,
        date: c.date,
        title: c.title,
        description: c.description,
        source: c.source
      });
    });

    // Send formatted raw events to Python FastAPI service for sorting/styling
    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/ai/timeline`, { events: rawEvents });
      if (aiResponse.data && aiResponse.data.success) {
        return res.json({ success: true, timeline: aiResponse.data.timeline });
      }
    } catch (aiErr) {
      console.warn('[AI Service] Timeline service unreachable. Falling back to local sorting.');
    }

    // Local sorting fallback if AI service is down
    const sortedTimeline = rawEvents.map(event => {
      let color = 'blue';
      let icon = 'Activity';
      if (event.type === 'prescription') { color = 'emerald'; icon = 'Pill'; }
      else if (event.type === 'report') { color = 'purple'; icon = 'FileText'; }
      else if (event.type === 'appointment') { color = 'indigo'; icon = 'Calendar'; }
      else if (event.type === 'diagnosis') { color = 'rose'; icon = 'ShieldAlert'; }
      else if (event.type === 'clinical_note') { color = 'amber'; icon = 'Clipboard'; }

      const dateStr = new Date(event.date).toISOString().split('T')[0];
      return {
        ...event,
        date: dateStr,
        datetime_iso: new Date(event.date).toISOString(),
        style: { color, icon }
      };
    });
    sortedTimeline.sort((a, b) => new Date(b.datetime_iso) - new Date(a.datetime_iso));

    res.json({ success: true, timeline: sortedTimeline });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error generating timeline' });
  }
});

// @route   GET /api/patients/conversations
// @desc    List all active multi-turn conversation threads for patient
// @access  Private (Patient only)
router.get('/conversations', protect, checkRole(['patient']), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const chats = await Chat.find({ patient: patient._id, isActive: true }).sort({ updatedAt: -1 });
    const summaries = chats.map(c => ({
      conversationId: c.conversationId,
      title: c.title,
      consentGiven: c.consentGiven,
      consentDate: c.consentDate,
      messageCount: c.messages.length,
      lastMessage: c.messages[c.messages.length - 1] || null,
      expiresAt: c.expiresAt,
      isExpired: c.isExpired ? c.isExpired() : false,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt
    }));

    res.json({ success: true, conversations: summaries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error listing conversations' });
  }
});

// @route   GET /api/patients/conversations/:conversationId
// @desc    Get specific conversation thread with multi-turn messages (strict isolation)
// @access  Private (Patient only)
router.get('/conversations/:conversationId', protect, checkRole(['patient']), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const chat = await Chat.findOne({ conversationId: req.params.conversationId, isActive: true });
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Strict cross-patient isolation check
    if (chat.patient.toString() !== patient._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are strictly prohibited from viewing another patient\'s conversation thread.'
      });
    }

    res.json({ success: true, conversation: chat });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error fetching conversation' });
  }
});

// @route   DELETE /api/patients/conversations/:conversationId
// @desc    Delete conversation thread (HIPAA compliance / user privacy)
// @access  Private (Patient only)
router.delete('/conversations/:conversationId', protect, checkRole(['patient']), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const chat = await Chat.findOne({ conversationId: req.params.conversationId });
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Strict cross-patient isolation check
    if (chat.patient.toString() !== patient._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You cannot delete another patient\'s conversation.'
      });
    }

    chat.isActive = false;
    await chat.save();

    res.json({ success: true, message: 'Conversation thread deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error deleting conversation' });
  }
});

// @route   POST /api/patients/chat/consent
// @desc    Explicitly grant or revoke patient consent for medical record inclusion
// @access  Private (Patient only)
router.post('/chat/consent', protect, checkRole(['patient']), async (req, res) => {
  const { conversationId, consentGiven } = req.body;
  if (!conversationId) {
    return res.status(400).json({ success: false, message: 'conversationId is required' });
  }

  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const chat = await Chat.findOne({ conversationId });
    if (!chat) return res.status(404).json({ success: false, message: 'Conversation not found' });

    if (chat.patient.toString() !== patient._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied: Conversation belongs to another patient.' });
    }

    chat.consentGiven = !!consentGiven;
    chat.consentDate = consentGiven ? new Date() : null;
    chat.updatedAt = new Date();
    await chat.save();

    res.json({
      success: true,
      conversationId: chat.conversationId,
      consentGiven: chat.consentGiven,
      consentDate: chat.consentDate
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error updating consent' });
  }
});

// @route   POST /api/patients/chat
// @desc    Chat with AI Assistant (secure, context-aware, multi-turn, consent-gated, RAG support)
// @access  Private (Patient only)
router.post('/chat', protect, checkRole(['patient']), async (req, res) => {
  const { query, message, use_rag, conversation_id, conversationId, consent_given } = req.body;
  const userQuery = (query || message || '').trim();
  if (!userQuery) return res.status(400).json({ success: false, message: 'Query cannot be empty' });

  const targetConvId = conversation_id || conversationId;

  try {
    const patient = await Patient.findOne({ user: req.user._id }).populate('user', 'name');
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    // 1. Resolve or create conversation thread
    let chatSession = null;
    if (targetConvId) {
      chatSession = await Chat.findOne({ conversationId: targetConvId, isActive: true });
      if (chatSession && chatSession.patient.toString() !== patient._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to send messages to another patient\'s conversation thread.'
        });
      }
    }

    if (!chatSession) {
      // Auto-generate topic title from query
      const cleanTitle = userQuery.length > 36 ? userQuery.substring(0, 36) + '...' : userQuery;
      chatSession = new Chat({
        patient: patient._id,
        conversationId: targetConvId || undefined, // Mongoose default will generate conv-uuid
        title: cleanTitle,
        consentGiven: consent_given === true,
        consentDate: consent_given === true ? new Date() : null,
        messages: []
      });
    } else if (consent_given !== undefined) {
      chatSession.consentGiven = !!consent_given;
      if (consent_given) chatSession.consentDate = new Date();
    }

    // 2. Enforce consent gating for personal clinical records
    const hasConsent = chatSession.consentGiven === true;
    let healthProfile = null;

    if (hasConsent) {
      // Fetch patient active history context (allergies, medications, active issues)
      const activePrescriptions = await Prescription.find({ patient: patient._id, status: 'active' });
      const medicalRecords = await MedicalRecord.find({ patient: patient._id, type: 'diagnosis' });

      const activeMeds = [];
      activePrescriptions.forEach(p => p.medicines.forEach(m => activeMeds.push(m.name)));
      const diagnoses = medicalRecords.map(r => r.title);

      healthProfile = {
        name: req.user.name,
        conditions: diagnoses,
        medications: activeMeds,
        allergies: [],
        lifestyle: patient.lifestyle || {}
      };
    }

    // 3. Sliding window context management (send last 10 turns)
    const recentMessages = chatSession.messages.slice(-10);
    const historyPayload = recentMessages.map(m => ({
      role: m.sender === 'patient' ? 'user' : 'assistant',
      content: m.message
    }));

    // 4. Call AI Service
    let aiResponseText = "I'm sorry, I am currently unable to connect to the healthcare assistant engine. Please try again later.";
    let disclaimerText = "Disclaimer: This tool is for educational purposes. Consult a physician for diagnosis.";
    let citations = [];
    let toolsCalled = [];
    
    try {
      const endpoint = use_rag ? `${AI_SERVICE_URL}/ai/rag/chat` : `${AI_SERVICE_URL}/ai/chat`;
      const aiResponse = await axios.post(endpoint, {
        message: userQuery,
        query: userQuery,
        conversation_id: chatSession.conversationId,
        history: historyPayload,
        health_profile: healthProfile,
        consent_given: hasConsent
      });

      if (aiResponse.data && aiResponse.data.success) {
        aiResponseText = aiResponse.data.response || aiResponse.data.message;
        disclaimerText = aiResponse.data.disclaimer;
        citations = aiResponse.data.citations || [];
        toolsCalled = aiResponse.data.tools_called || [];
      }
    } catch (aiErr) {
      console.warn('[AI Service] Chat assistant service unreachable: ', aiErr.message);
    }

    // 5. Append message pair and update session
    chatSession.messages.push({
      sender: 'patient',
      message: userQuery,
      timestamp: new Date()
    });
    chatSession.messages.push({
      sender: 'ai',
      message: aiResponseText,
      timestamp: new Date(),
      citations,
      tools_called: toolsCalled,
      isPersonalRecordUsed: hasConsent
    });

    if (chatSession.renewSession) {
      chatSession.renewSession();
    } else {
      chatSession.updatedAt = new Date();
    }
    await chatSession.save();

    res.json({
      success: true,
      conversationId: chatSession.conversationId,
      conversation_id: chatSession.conversationId,
      title: chatSession.title,
      consentGiven: chatSession.consentGiven,
      response: aiResponseText,
      disclaimer: disclaimerText,
      citations,
      chatHistory: chatSession.messages
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error processing AI assistant query' });
  }
});

// @route   GET /api/patients/chat-history
// @desc    Get AI Chat History (backward compatible: returns most recent active thread)
// @access  Private (Patient only)
router.get('/chat-history', protect, checkRole(['patient']), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const chatSession = await Chat.findOne({ patient: patient._id, isActive: true }).sort({ updatedAt: -1 });
    const messages = chatSession ? chatSession.messages : [];
    res.json({
      success: true,
      conversationId: chatSession ? chatSession.conversationId : null,
      consentGiven: chatSession ? chatSession.consentGiven : false,
      messages
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error fetching chat history' });
  }
});

module.exports = router;
