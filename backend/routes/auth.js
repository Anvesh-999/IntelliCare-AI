const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Patient = require('../models/Patient');
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'intellicare_super_secret_key_2026_jwt_token_auth';

// Helper: Generate Token
const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '1d' });
};

// @route   POST /api/auth/register
// @desc    Register a new patient
// @access  Public
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    let userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    // Create User
    const user = new User({
      name,
      email,
      password,
      role: 'patient',
      isVerified: true // Set true for demo convenience
    });
    await user.save();

    // Create corresponding Patient profile
    const patient = new Patient({
      user: user._id,
      lifestyle: {
        dietPreference: 'balanced',
        activityLevel: 'moderate'
      }
    });
    await patient.save();

    // Log Action
    await AuditLog.create({
      user: user._id,
      email: user.email,
      role: user.role,
      action: 'USER_REGISTER',
      details: `User registered successfully as patient: ${user.name}`
    });

    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

// @route   GET /api/auth/seed
// @desc    Trigger database seeding if empty
// @access  Public
router.get('/seed', async (req, res) => {
  try {
    const connectDB = require('../config/db');
    if (connectDB.seedData) {
      await connectDB.seedData();
      return res.json({ success: true, message: 'Database seeded successfully with demo users' });
    }
    res.json({ success: true, message: 'Database ready' });
  } catch (err) {
    console.error('[Seed Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    // Non-blocking Audit Logging
    try {
      await AuditLog.create({
        user: user._id,
        email: user.email,
        role: user.role,
        action: 'LOGIN_SUCCESS',
        details: `User logged in: ${user.email}`
      });
    } catch (auditErr) {
      console.warn('[AuditLog Warning]', auditErr.message);
    }

    res.json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('[Auth Login Error]', err);
    res.status(500).json({ success: false, message: err.message || 'Server error during login' });
  }
});

// @route   POST /api/auth/google
// @desc    Mock Google OAuth Login
// @access  Public
router.post('/google', async (req, res) => {
  const { email, name, googleId } = req.body;
  if (!email || !name) {
    return res.status(400).json({ success: false, message: 'OAuth details missing' });
  }

  try {
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create a random password
      const tempPass = Math.random().toString(36).slice(-10);
      user = new User({
        name,
        email,
        password: tempPass,
        role: 'patient',
        isVerified: true
      });
      await user.save();

      const patient = new Patient({
        user: user._id
      });
      await patient.save();

      await AuditLog.create({
        user: user._id,
        email: user.email,
        role: user.role,
        action: 'GOOGLE_REGISTER_SUCCESS',
        details: `New patient registered via Google OAuth: ${email}`
      });
    } else {
      await AuditLog.create({
        user: user._id,
        email: user.email,
        role: user.role,
        action: 'GOOGLE_LOGIN_SUCCESS',
        details: `User logged in via Google OAuth: ${email}`
      });
    }

    res.json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'OAuth processing error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current logged in user details
// @access  Private
router.get('/me', protect, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
});

module.exports = router;
