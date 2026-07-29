const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Bed = require('../models/Bed');
const Patient = require('../models/Patient');
const AuditLog = require('../models/AuditLog');
const { protect, checkRole } = require('../middleware/auth');

// @route   GET /api/admin/logs
// @desc    Get system audit logs
// @access  Private (Admins only)
router.get('/logs', protect, checkRole(['admin', 'hospital_admin']), async (req, res) => {
  try {
    const logs = await AuditLog.find({}).sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error fetching audit logs' });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users in the platform
// @access  Private (Admins only)
router.get('/users', protect, checkRole(['admin', 'hospital_admin']), async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error fetching users list' });
  }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Update a user's role
// @access  Private (Admin only)
router.put('/users/:id/role', protect, checkRole(['admin']), async (req, res) => {
  const { role } = req.body;
  if (!['patient', 'doctor', 'hospital_admin', 'laboratory', 'pharmacy', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid user role' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.role = role;
    await user.save();

    await AuditLog.create({
      user: req.user._id,
      email: req.user.email,
      role: req.user.role,
      action: 'USER_ROLE_CHANGED',
      details: `Changed role of user ${user.email} to '${role}'`
    });

    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error updating user role' });
  }
});

// @route   GET /api/admin/beds
// @desc    Get all hospital beds and occupancy
// @access  Private (Hospital Admin, Doctor, Admin)
router.get('/beds', protect, async (req, res) => {
  try {
    const beds = await Bed.find({}).populate('patient', 'user').populate({ path: 'patient', populate: { path: 'user', select: 'name' } });
    res.json({ success: true, beds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error fetching beds status' });
  }
});

// @route   POST /api/admin/beds/allocate
// @desc    Allocate a bed to a patient
// @access  Private (Hospital Admin, Admin)
router.post('/beds/allocate', protect, checkRole(['hospital_admin', 'admin']), async (req, res) => {
  const { bedId, patientId } = req.body;
  if (!bedId || !patientId) {
    return res.status(400).json({ success: false, message: 'Bed ID and Patient ID are required' });
  }

  try {
    const bed = await Bed.findById(bedId);
    if (!bed) return res.status(404).json({ success: false, message: 'Bed not found' });

    if (bed.status !== 'vacant') {
      return res.status(400).json({ success: false, message: `Bed is currently ${bed.status}` });
    }

    const patient = await Patient.findById(patientId).populate('user', 'name');
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    // Release patient from any currently held bed first
    await Bed.updateMany({ patient: patientId }, { status: 'vacant', patient: null, allocatedAt: null });

    bed.status = 'occupied';
    bed.patient = patientId;
    bed.allocatedAt = Date.now();
    await bed.save();

    await AuditLog.create({
      user: req.user._id,
      email: req.user.email,
      role: req.user.role,
      action: 'BED_ALLOCATED',
      details: `Bed ${bed.bedNumber} allocated to Patient: ${patient.user.name}`
    });

    res.json({ success: true, bed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error allocating bed' });
  }
});

// @route   PUT /api/admin/beds/:id/release
// @desc    Release / Vacate a bed
// @access  Private (Hospital Admin, Admin)
router.put('/beds/:id/release', protect, checkRole(['hospital_admin', 'admin']), async (req, res) => {
  try {
    const bed = await Bed.findById(req.params.id);
    if (!bed) return res.status(404).json({ success: false, message: 'Bed not found' });

    bed.status = 'cleaning'; // Transition to cleaning
    bed.patient = null;
    bed.allocatedAt = null;
    await bed.save();

    await AuditLog.create({
      user: req.user._id,
      email: req.user.email,
      role: req.user.role,
      action: 'BED_RELEASED',
      details: `Bed ${bed.bedNumber} released. Current state: cleaning.`
    });

    res.json({ success: true, bed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error releasing bed' });
  }
});

module.exports = router;
