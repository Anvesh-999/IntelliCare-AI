const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');
const Prescription = require('../models/Prescription');
const AuditLog = require('../models/AuditLog');
const { protect, checkRole } = require('../middleware/auth');

// @route   GET /api/inventory
// @desc    List pharmacy medicines inventory
// @access  Private (Pharmacy, Doctor, Admin)
router.get('/', protect, async (req, res) => {
  const searchQuery = req.query.query || '';
  try {
    let medicines;
    if (searchQuery) {
      medicines = await Medicine.find({
        name: { $regex: searchQuery, $options: 'i' }
      }).sort({ name: 1 });
    } else {
      medicines = await Medicine.find({}).sort({ name: 1 });
    }
    res.json({ success: true, medicines });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error listing inventory' });
  }
});

// @route   POST /api/inventory
// @desc    Create/Add a new medicine to inventory
// @access  Private (Pharmacy or Admin)
router.post('/', protect, checkRole(['pharmacy', 'admin']), async (req, res) => {
  const { name, dosageForm, stockQuantity, price, expiryDate, location } = req.body;
  if (!name || !price) {
    return res.status(400).json({ success: false, message: 'Medicine name and price are required' });
  }

  try {
    let medicine = await Medicine.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (medicine) {
      return res.status(400).json({ success: false, message: 'Medicine already exists in inventory. Update stock instead.' });
    }

    let status = 'instock';
    if (stockQuantity <= 0) status = 'outofstock';
    else if (stockQuantity <= 20) status = 'lowstock';

    medicine = new Medicine({
      name,
      dosageForm,
      stockQuantity,
      price,
      expiryDate,
      location,
      status
    });

    await medicine.save();

    await AuditLog.create({
      user: req.user._id,
      email: req.user.email,
      role: req.user.role,
      action: 'MEDICINE_ADDED',
      details: `Added new medicine to inventory: ${name} (${stockQuantity} units)`
    });

    res.status(201).json({ success: true, medicine });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error adding medicine' });
  }
});

// @route   PUT /api/inventory/:id
// @desc    Update medicine stock or price
// @access  Private (Pharmacy or Admin)
router.put('/:id', protect, checkRole(['pharmacy', 'admin']), async (req, res) => {
  const { stockQuantity, price, location } = req.body;

  try {
    let medicine = await Medicine.findById(req.params.id);
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found' });

    if (stockQuantity !== undefined) {
      medicine.stockQuantity = stockQuantity;
      if (stockQuantity <= 0) medicine.status = 'outofstock';
      else if (stockQuantity <= 20) medicine.status = 'lowstock';
      else medicine.status = 'instock';
    }
    if (price !== undefined) medicine.price = price;
    if (location !== undefined) medicine.location = location;

    await medicine.save();

    await AuditLog.create({
      user: req.user._id,
      email: req.user.email,
      role: req.user.role,
      action: 'MEDICINE_UPDATED',
      details: `Updated medicine: ${medicine.name}. New stock: ${medicine.stockQuantity}`
    });

    res.json({ success: true, medicine });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error updating medicine' });
  }
});

// @route   GET /api/inventory/prescriptions
// @desc    List all prescriptions for patient pickup verification
// @access  Private (Pharmacy, Doctor, Admin)
router.get('/prescriptions', protect, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({})
      .populate('patient', 'user phone')
      .populate({ path: 'patient', populate: { path: 'user', select: 'name' } })
      .populate('doctor', 'user specialization')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name' } })
      .sort({ date: -1 });
    
    res.json({ success: true, prescriptions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error fetching prescriptions queue' });
  }
});

// @route   PUT /api/inventory/prescriptions/:id/fill
// @desc    Mark a prescription as filled / picked up, reduces medicine stock accordingly
// @access  Private (Pharmacy only)
router.put('/prescriptions/:id/fill', protect, checkRole(['pharmacy']), async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) return res.status(404).json({ success: false, message: 'Prescription not found' });

    if (prescription.status === 'filled') {
      return res.status(400).json({ success: false, message: 'Prescription has already been filled' });
    }

    // Deduct stock for each medicine in the prescription if available
    for (const item of prescription.medicines) {
      // Find matching medicine in inventory
      const medicine = await Medicine.findOne({ name: { $regex: new RegExp(`^${item.name}$`, 'i') } });
      if (medicine) {
        // Simple regex to parse numbers in dosage instructions (e.g. '30 tablets' or just deduce a standard deduction of 10)
        let deductCount = 10;
        const durationMatch = item.duration.match(/(\d+)/);
        const freqMatch = item.frequency.toLowerCase();
        
        if (durationMatch) {
          const days = parseInt(durationMatch[1]);
          let perDay = 1;
          if (freqMatch.includes('twice') || freqMatch.includes('bid')) perDay = 2;
          else if (freqMatch.includes('three') || freqMatch.includes('tid')) perDay = 3;
          else if (freqMatch.includes('four') || freqMatch.includes('qid')) perDay = 4;
          deductCount = days * perDay;
        }

        medicine.stockQuantity = Math.max(0, medicine.stockQuantity - deductCount);
        if (medicine.stockQuantity <= 0) medicine.status = 'outofstock';
        else if (medicine.stockQuantity <= 20) medicine.status = 'lowstock';
        await medicine.save();
      }
    }

    prescription.status = 'filled';
    await prescription.save();

    await AuditLog.create({
      user: req.user._id,
      email: req.user.email,
      role: req.user.role,
      action: 'PRESCRIPTION_FILLED',
      details: `Prescription ID: ${prescription._id} marked as filled and dispensed.`
    });

    res.json({ success: true, prescription });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error filling prescription' });
  }
});

module.exports = router;
