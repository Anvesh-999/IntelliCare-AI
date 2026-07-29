const express = require('express');
const router = express.Router();
const axios = require('axios');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const MedicalRecord = require('../models/MedicalRecord');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const AuditLog = require('../models/AuditLog');
const { protect, checkRole } = require('../middleware/auth');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// @route   GET /api/doctors
// @desc    List all doctors for patient review
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const doctors = await Doctor.find({}).populate('user', 'name email');
    res.json({ success: true, doctors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error fetching doctors list' });
  }
});

// @route   GET /api/doctors/patients
// @desc    Search and list patients in the hospital system
// @access  Private (Doctors and Hospital Admin)
router.get('/patients', protect, checkRole(['doctor', 'hospital_admin', 'laboratory', 'admin']), async (req, res) => {
  const searchQuery = req.query.query || '';
  
  try {
    // If empty query, list all patients
    let patients;
    if (!searchQuery) {
      patients = await Patient.find({}).populate('user', 'name email');
    } else {
      // Find matching users
      const matchingUsers = await User.find({
        name: { $regex: searchQuery, $options: 'i' },
        role: 'patient'
      }).select('_id');
      
      const userIds = matchingUsers.map(u => u._id);
      patients = await Patient.find({ user: { $in: userIds } }).populate('user', 'name email');
    }

    res.json({ success: true, patients });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error searching patients' });
  }
});

// @route   POST /api/doctors/notes
// @desc    Save clinical consult notes and diagnoses
// @access  Private (Doctor only)
router.post('/notes', protect, checkRole(['doctor']), async (req, res) => {
  const { appointmentId, patientId, diagnosis, notes } = req.body;

  if (!patientId || !diagnosis) {
    return res.status(400).json({ success: false, message: 'Patient and Diagnosis are required' });
  }

  try {
    const doctor = await Doctor.findOne({ user: req.user._id }).populate('user', 'name');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    // 1. Create a timeline record
    const record = new MedicalRecord({
      patient: patientId,
      type: 'diagnosis',
      title: diagnosis,
      description: notes,
      source: `Dr. ${doctor.user.name}`
    });
    await record.save();

    // 2. If appointmentId provided, link clinical notes and update status to completed
    if (appointmentId) {
      await Appointment.findByIdAndUpdate(appointmentId, {
        status: 'completed',
        clinicalNotes: notes
      });
    }

    // Log Action
    await AuditLog.create({
      user: req.user._id,
      email: req.user.email,
      role: req.user.role,
      action: 'CLINICAL_NOTE_ADDED',
      details: `Notes and diagnosis '${diagnosis}' added for Patient ID: ${patientId}`
    });

    res.json({ success: true, record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error saving clinical notes' });
  }
});

// @route   POST /api/doctors/prescribe
// @desc    Generate a patient prescription, checks drug interactions via AI Service
// @access  Private (Doctor only)
router.post('/prescribe', protect, checkRole(['doctor']), async (req, res) => {
  const { appointmentId, patientId, medicines } = req.body;
  // medicines should be [{ name, dosage, frequency, duration, instructions }]

  if (!patientId || !medicines || medicines.length === 0) {
    return res.status(400).json({ success: false, message: 'Patient and medicines list are required' });
  }

  try {
    const doctor = await Doctor.findOne({ user: req.user._id }).populate('user', 'name');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    // Initialize prescription schema values
    let hasInteractions = false;
    let interactionSummary = "No interactions checked.";
    let interactionDetails = [];

    // Trigger AI Drug Interaction check endpoint
    try {
      const drugNames = medicines.map(m => m.name);
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/ai/interactions`, { medicines: drugNames });
      
      if (aiResponse.data && aiResponse.data.success) {
        hasInteractions = aiResponse.data.has_interactions;
        interactionSummary = aiResponse.data.summary;
        interactionDetails = aiResponse.data.interactions;
      }
    } catch (aiErr) {
      console.warn('[AI Service] Drug interaction checker offline. Proceeding with blank check.', aiErr.message);
    }

    // Create prescription
    const prescription = new Prescription({
      appointment: appointmentId || null,
      patient: patientId,
      doctor: doctor._id,
      medicines,
      interactionCheck: {
        checked: true,
        hasInteractions,
        summary: interactionSummary,
        details: interactionDetails
      }
    });
    await prescription.save();

    // Create timeline timeline event
    const medSummary = medicines.map(m => `${m.name} ${m.dosage} (${m.frequency})`).join(', ');
    const record = new MedicalRecord({
      patient: patientId,
      type: 'prescription',
      title: 'New Prescription Issued',
      description: `Prescribed: ${medSummary}. Check results: ${interactionSummary}`,
      source: `Dr. ${doctor.user.name}`,
      metadata: {
        prescriptionId: prescription._id.toString()
      }
    });
    await record.save();

    // Log Action
    await AuditLog.create({
      user: req.user._id,
      email: req.user.email,
      role: req.user.role,
      action: 'PRESCRIPTION_GENERATED',
      details: `Prescription generated for Patient ID: ${patientId}. Interaction Risk: ${hasInteractions}`
    });

    res.json({ success: true, prescription });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error prescribing medicines' });
  }
});

module.exports = router;
