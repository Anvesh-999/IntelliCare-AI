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

// @route   POST /api/patients/chat
// @desc    Chat with AI Assistant (secure, context-aware)
// @access  Private (Patient only)
router.post('/chat', protect, checkRole(['patient']), async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ success: false, message: 'Query cannot be empty' });

  try {
    const patient = await Patient.findOne({ user: req.user._id }).populate('user', 'name');
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    // Fetch patient active history context (allergies, medications, active issues)
    const activePrescriptions = await Prescription.find({ patient: patient._id, status: 'active' });
    const medicalRecords = await MedicalRecord.find({ patient: patient._id, type: 'diagnosis' });

    const activeMeds = [];
    activePrescriptions.forEach(p => p.medicines.forEach(m => activeMeds.push(m.name)));
    const diagnoses = medicalRecords.map(r => r.title);

    // Get chat session from database
    let chatSession = await Chat.findOne({ patient: patient._id });
    if (!chatSession) {
      chatSession = new Chat({ patient: patient._id, messages: [] });
    }

    // Call AI Service
    let aiResponseText = "I'm sorry, I am currently unable to connect to the healthcare assistant engine. Please try again later.";
    let disclaimerText = "Disclaimer: This tool is for educational purposes. Consult a physician for diagnosis.";
    
    try {
      const healthProfile = {
        name: req.user.name,
        conditions: diagnoses,
        medications: activeMeds,
        allergies: [] // Optional
      };

      const aiResponse = await axios.post(`${AI_SERVICE_URL}/ai/chat`, {
        query,
        health_profile: healthProfile
      });

      if (aiResponse.data && aiResponse.data.success) {
        aiResponseText = aiResponse.data.response;
        disclaimerText = aiResponse.data.disclaimer;
      }
    } catch (aiErr) {
      console.warn('[AI Service] Chat assistant service unreachable: ', aiErr.message);
    }

    // Save history
    chatSession.messages.push({ sender: 'patient', message: query });
    chatSession.messages.push({ sender: 'ai', message: aiResponseText });
    chatSession.updatedAt = Date.now();
    await chatSession.save();

    res.json({
      success: true,
      response: aiResponseText,
      disclaimer: disclaimerText,
      chatHistory: chatSession.messages
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error processing AI assistant query' });
  }
});

// @route   GET /api/patients/chat-history
// @desc    Get AI Chat History
// @access  Private (Patient only)
router.get('/chat-history', protect, checkRole(['patient']), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const chatSession = await Chat.findOne({ patient: patient._id });
    const messages = chatSession ? chatSession.messages : [];
    res.json({ success: true, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error fetching chat history' });
  }
});

module.exports = router;
