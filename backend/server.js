const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

// DB and Redis Configs
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');

// Routes
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const doctorRoutes = require('./routes/doctors');
const reportRoutes = require('./routes/reports');
const inventoryRoutes = require('./routes/inventory');
const adminRoutes = require('./routes/admin');

// Initialize Express
const app = express();

// Production-Ready CORS Middleware
const rawOrigins = process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173,https://intelli-care-ai-dalt.vercel.app';
const allowedOrigins = rawOrigins.split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*') || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy: Origin not allowed'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Readiness Check Middleware
app.use('/api', (req, res, next) => {
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState !== 1 && mongoose.connection.readyState !== 2) {
    return res.status(503).json({
      success: false,
      message: 'Database Connection Error: Backend server is unable to connect to MongoDB Atlas. Please verify your MONGO_URI credentials in Render environment variables and ensure 0.0.0.0/0 is allowed in MongoDB Atlas Network Access.'
    });
  }
  next();
});

// Ensure upload directories exist
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`[Server] Created upload directory at: ${uploadDir}`);
}

// Serve static upload files
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/admin', adminRoutes);

// Root Route
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'IntelliCare AI Express Backend is running successfully',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Comprehensive Health Check Route
app.get('/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const isHealthy = isDbConnected || process.env.NODE_ENV !== 'production';
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    service: 'intellicare-backend',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    database: {
      mongodb: isDbConnected ? 'connected' : 'disconnected',
      readyState: mongoose.connection.readyState
    },
    uptime_seconds: Math.floor(process.uptime())
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Error Handler] Caught error: ', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  // Connect Databases
  await connectDB();
  await connectRedis();

  app.listen(PORT, () => {
    console.log(`[Server] Express listening on port ${PORT}...`);
  });
};

startServer().catch(err => {
  console.error('[Server] Critical startup error: ', err.message);
  process.exit(1);
});
