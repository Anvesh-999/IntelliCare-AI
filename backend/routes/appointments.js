const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/auth');

// @route   GET /api/appointments
// @desc    List appointments relative to user role
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let appointments;
    
    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ user: req.user._id });
      if (!patient) return res.json({ success: true, appointments: [] });
      
      appointments = await Appointment.find({ patient: patient._id })
        .populate('doctor', 'user specialization department')
        .populate({ path: 'doctor', populate: { path: 'user', select: 'name' } })
        .sort({ date: 1 });
    } else if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ user: req.user._id });
      if (!doctor) return res.json({ success: true, appointments: [] });
      
      appointments = await Appointment.find({ doctor: doctor._id })
        .populate('patient', 'user phone dateOfBirth gender')
        .populate({ path: 'patient', populate: { path: 'user', select: 'name email' } })
        .sort({ date: 1 });
    } else {
      // Admins and Hospital staff see all appointments
      appointments = await Appointment.find({})
        .populate('patient', 'user')
        .populate({ path: 'patient', populate: { path: 'user', select: 'name' } })
        .populate('doctor', 'user department')
        .populate({ path: 'doctor', populate: { path: 'user', select: 'name' } })
        .sort({ date: -1 });
    }

    res.json({ success: true, appointments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error listing appointments' });
  }
});

// @route   POST /api/appointments
// @desc    Book a new appointment
// @access  Private (Patient only)
router.post('/', protect, async (req, res) => {
  const { doctorId, date, timeslot, symptoms, type } = req.body;
  
  if (!doctorId || !date || !timeslot) {
    return res.status(400).json({ success: false, message: 'Doctor, date, and timeslot are required' });
  }

  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient profile required to book appointment' });
    }

    const doctor = await Doctor.findById(doctorId).populate('user', 'name');
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Check if slot already booked for the doctor on that date
    const parsedDate = new Date(date);
    parsedDate.setUTCHours(0, 0, 0, 0);

    const isBooked = await Appointment.findOne({
      doctor: doctorId,
      date: parsedDate,
      timeslot,
      status: 'scheduled'
    });

    if (isBooked) {
      return res.status(400).json({ success: false, message: 'Timeslot is already booked. Please choose another.' });
    }

    const appointment = new Appointment({
      patient: patient._id,
      doctor: doctorId,
      date: parsedDate,
      timeslot,
      symptoms,
      type: type || 'Consultation'
    });

    await appointment.save();

    // Log Action
    await AuditLog.create({
      user: req.user._id,
      email: req.user.email,
      role: req.user.role,
      action: 'APPOINTMENT_BOOKED',
      details: `Appointment booked with Dr. ${doctor.user.name} on ${date} at ${timeslot}`
    });

    res.status(201).json({ success: true, appointment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error booking appointment' });
  }
});

// @route   PUT /api/appointments/:id/cancel
// @desc    Cancel an appointment
// @access  Private (Patient or Doctor)
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Enforce that only the booked patient or assigned doctor can cancel
    let authorized = false;
    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ user: req.user._id });
      if (patient && appointment.patient.toString() === patient._id.toString()) {
        authorized = true;
      }
    } else if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ user: req.user._id });
      if (doctor && appointment.doctor.toString() === doctor._id.toString()) {
        authorized = true;
      }
    } else if (['admin', 'hospital_admin'].includes(req.user.role)) {
      authorized = true;
    }

    if (!authorized) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this appointment' });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    // Log Action
    await AuditLog.create({
      user: req.user._id,
      email: req.user.email,
      role: req.user.role,
      action: 'APPOINTMENT_CANCELLED',
      details: `Appointment ID: ${appointment._id} cancelled.`
    });

    res.json({ success: true, appointment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error cancelling appointment' });
  }
});

// @route   GET /api/appointments/slots
// @desc    Get open timeslots for a doctor on a specific date
// @access  Private
router.get('/slots', protect, async (req, res) => {
  const { doctorId, date } = req.query;
  if (!doctorId || !date) {
    return res.status(400).json({ success: false, message: 'Doctor and Date are required' });
  }

  try {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    // Format date
    const queryDate = new Date(date);
    queryDate.setUTCHours(0, 0, 0, 0);

    // Default daily schedule slots
    const standardSlots = [
      '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
      '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
      '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
      '04:00 PM', '04:30 PM'
    ];

    // Find already booked appointments for this date
    const bookedAppointments = await Appointment.find({
      doctor: doctorId,
      date: queryDate,
      status: 'scheduled'
    });

    const bookedSlots = bookedAppointments.map(a => a.timeslot);
    
    // Filter available slots
    const availableSlots = standardSlots.map(slot => ({
      slot,
      isBooked: bookedSlots.includes(slot)
    }));

    res.json({ success: true, slots: availableSlots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error fetching available slots' });
  }
});

module.exports = router;
