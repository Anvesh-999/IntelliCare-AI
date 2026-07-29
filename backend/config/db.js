const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Models
const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Medicine = require('../models/Medicine');
const Bed = require('../models/Bed');
const Appointment = require('../models/Appointment');
const MedicalRecord = require('../models/MedicalRecord');

const seedData = async () => {
  console.log('[Seed] Seeding database with demo data...');

  // 1. Clear existing collection elements
  await User.deleteMany({});
  await Patient.deleteMany({});
  await Doctor.deleteMany({});
  await Medicine.deleteMany({});
  await Bed.deleteMany({});
  await Appointment.deleteMany({});
  await MedicalRecord.deleteMany({});

  // 2. Create standard users
  const defaultPassword = 'password123';
  
  const usersToCreate = [
    { name: 'John Patient', email: 'patient@intellicare.com', role: 'patient' },
    { name: 'Dr. Sarah Heart', email: 'doctor@intellicare.com', role: 'doctor' },
    { name: 'Mark Admin', email: 'hadmin@intellicare.com', role: 'hospital_admin' },
    { name: 'Lisa Labtech', email: 'lab@intellicare.com', role: 'laboratory' },
    { name: 'Philip Pharmacist', email: 'pharmacy@intellicare.com', role: 'pharmacy' },
    { name: 'Super Admin', email: 'admin@intellicare.com', role: 'admin' }
  ];

  const createdUsers = {};
  for (const item of usersToCreate) {
    const user = new User({
      name: item.name,
      email: item.email,
      password: defaultPassword, // Will be hashed by mongoose pre-save hook
      role: item.role,
      isVerified: true
    });
    await user.save();
    createdUsers[item.role] = user;
    console.log(`[Seed] Created User: ${item.email} (Role: ${item.role})`);
  }

  // 3. Create Doctor Profile
  const doctorUser = createdUsers['doctor'];
  const doctorProfile = new Doctor({
    user: doctorUser._id,
    specialization: 'Cardiology & Internal Medicine',
    department: 'Cardiology',
    experienceYears: 12,
    consultationFee: 750,
    bio: 'Senior Cardiologist specializing in preventive heart care, hypertension management, and non-invasive diagnostics.',
    shifts: [
      { dayOfWeek: 'Monday', startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 'Friday', startTime: '13:00', endTime: '17:00' }
    ]
  });
  await doctorProfile.save();
  console.log('[Seed] Created Doctor Profile');

  // 4. Create Patient Profile with detailed metrics
  const patientUser = createdUsers['patient'];
  const patientProfile = new Patient({
    user: patientUser._id,
    dateOfBirth: new Date('1985-05-15'),
    gender: 'Male',
    phone: '+1 555-0199',
    bloodGroup: 'O+',
    height: 180,
    weight: 78,
    emergencyContact: {
      name: 'Emma Patient',
      relation: 'Spouse',
      phone: '+1 555-0188'
    },
    insurance: {
      provider: 'IntelliHealth Insurance',
      policyNumber: 'IH-88726-AX',
      validTill: new Date('2028-12-31')
    },
    vaccineHistory: [
      { vaccineName: 'COVID-19 Booster', dateAdministered: new Date('2025-09-10'), status: 'completed' },
      { vaccineName: 'Influenza Annual', dateAdministered: new Date('2025-10-05'), status: 'completed' }
    ],
    lifestyle: {
      dietPreference: 'balanced',
      activityLevel: 'moderate',
      smoking: false,
      alcohol: true
    },
    healthMetrics: {
      bloodPressureHistory: [
        { systolic: 128, diastolic: 82, date: new Date('2026-06-10T10:00:00Z') },
        { systolic: 124, diastolic: 80, date: new Date('2026-06-25T11:00:00Z') },
        { systolic: 120, diastolic: 78, date: new Date('2026-07-10T09:30:00Z') }
      ],
      bloodSugarHistory: [
        { glucose: 95, type: 'fasting', date: new Date('2026-06-10T08:00:00Z') },
        { glucose: 98, type: 'fasting', date: new Date('2026-06-25T08:00:00Z') },
        { glucose: 92, type: 'fasting', date: new Date('2026-07-10T08:00:00Z') }
      ],
      weightHistory: [
        { value: 80.2, date: new Date('2026-06-10T08:00:00Z') },
        { value: 79.1, date: new Date('2026-06-25T08:00:00Z') },
        { value: 78.0, date: new Date('2026-07-10T08:00:00Z') }
      ]
    }
  });
  await patientProfile.save();
  console.log('[Seed] Created Patient Profile');

  // 5. Create basic Medical records (for Patient's Timeline)
  const records = [
    {
      patient: patientProfile._id,
      type: 'diagnosis',
      date: new Date('2026-05-10'),
      title: 'Mild Essential Hypertension',
      description: 'Diagnosed following standard BP tracking values. Recommended lifestyle modifications.',
      source: 'Dr. Sarah Heart'
    },
    {
      patient: patientProfile._id,
      type: 'prescription',
      date: new Date('2026-05-10'),
      title: 'Lisinopril 10mg Prescription',
      description: 'Prescribed once daily in the morning for blood pressure management.',
      source: 'Dr. Sarah Heart',
      metadata: {
        medicines: 'Lisinopril 10mg (once daily, 30 days)'
      }
    },
    {
      patient: patientProfile._id,
      type: 'report',
      date: new Date('2026-06-10'),
      title: 'Annual Blood Work Panel',
      description: 'Standard lipid and blood count profile.',
      source: 'Central Diagnostic Lab',
      metadata: {
        fileUrl: '/uploads/report_template.pdf',
        status: 'verified'
      }
    }
  ];

  for (const r of records) {
    const record = new MedicalRecord(r);
    await record.save();
  }
  console.log('[Seed] Created Patient Timeline Events');

  // 6. Create standard appointments
  const appointment = new Appointment({
    patient: patientProfile._id,
    doctor: doctorProfile._id,
    date: new Date(), // Today
    timeslot: '10:00 AM',
    status: 'scheduled',
    type: 'Consultation',
    symptoms: 'Mild fatigue, seeking blood pressure check follow-up.'
  });
  await appointment.save();
  console.log('[Seed] Created Today\'s Appointment');

  // 7. Seed beds for hospital management
  const beds = [
    { bedNumber: 'ICU-101', type: 'icu', ward: 'Critical Care block', status: 'vacant' },
    { bedNumber: 'ICU-102', type: 'icu', ward: 'Critical Care block', status: 'occupied', patient: patientProfile._id, allocatedAt: new Date() },
    { bedNumber: 'GEN-201', type: 'general', ward: 'Ward B', status: 'vacant' },
    { bedNumber: 'GEN-202', type: 'general', ward: 'Ward B', status: 'vacant' },
    { bedNumber: 'GEN-203', type: 'general', ward: 'Ward B', status: 'cleaning' },
    { bedNumber: 'PED-301', type: 'pediatric', ward: 'Pediatric Wing', status: 'vacant' },
    { bedNumber: 'EMR-401', type: 'emergency', ward: 'ER Response', status: 'vacant' }
  ];

  for (const b of beds) {
    const bed = new Bed(b);
    await bed.save();
  }
  console.log('[Seed] Seeded Hospital Beds');

  // 8. Seed Pharmacy inventory
  const medicines = [
    { name: 'Lisinopril', dosageForm: 'Tablet', stockQuantity: 240, price: 12.0, expiryDate: new Date('2028-09-01'), status: 'instock' },
    { name: 'Metformin', dosageForm: 'Tablet', stockQuantity: 450, price: 18.5, expiryDate: new Date('2027-12-01'), status: 'instock' },
    { name: 'Amoxicillin', dosageForm: 'Capsule', stockQuantity: 120, price: 22.0, expiryDate: new Date('2026-11-30'), status: 'instock' },
    { name: 'Ibuprofen', dosageForm: 'Tablet', stockQuantity: 800, price: 5.5, expiryDate: new Date('2028-03-15'), status: 'instock' },
    { name: 'Aspirin', dosageForm: 'Tablet', stockQuantity: 15, price: 4.0, expiryDate: new Date('2027-01-01'), status: 'lowstock' },
    { name: 'Warfarin', dosageForm: 'Tablet', stockQuantity: 90, price: 32.0, expiryDate: new Date('2028-05-12'), status: 'instock' },
    { name: 'Sildenafil', dosageForm: 'Tablet', stockQuantity: 0, price: 45.0, expiryDate: new Date('2026-12-31'), status: 'outofstock' }
  ];

  for (const m of medicines) {
    const med = new Medicine(m);
    await med.save();
  }
  console.log('[Seed] Seeded Pharmacy Inventory');
  console.log('[Seed] Database seeding completed successfully.');
};

const connectDB = async () => {
  let mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/intellicare';
  
  // Ensure database name is explicitly specified in Atlas connection strings
  if (mongoUri.includes('mongodb.net/?') && !mongoUri.includes('mongodb.net/intellicare')) {
    mongoUri = mongoUri.replace('mongodb.net/?', 'mongodb.net/intellicare?');
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('[MongoDB] Connected successfully to database');

    // Auto-seed if the User collection is completely empty
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await seedData();
    }
  } catch (err) {
    console.error(`[MongoDB] Connection error: ${err.message}`);
    console.warn('[MongoDB] Please check MONGO_URI username, password, and Atlas Database Access settings.');
  }
};

// Check if run directly from command line (e.g. node config/db.js --seed)
if (require.main === module) {
  const runDirectSeed = async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/intellicare';
    await mongoose.connect(mongoUri);
    await seedData();
    await mongoose.disconnect();
    process.exit(0);
  };
  runDirectSeed();
}

connectDB.seedData = seedData;
module.exports = connectDB;
