const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const Report = require('../models/Report');
const Patient = require('../models/Patient');
const MedicalRecord = require('../models/MedicalRecord');
const AuditLog = require('../models/AuditLog');
const { protect, checkRole } = require('../middleware/auth');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Multer memory storage configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image files and PDFs are allowed!'), false);
    }
  }
});

// @route   GET /api/reports
// @desc    Get reports list based on user role
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let reports;
    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ user: req.user._id });
      if (!patient) return res.json({ success: true, reports: [] });
      reports = await Report.find({ patient: patient._id }).sort({ uploadDate: -1 });
    } else {
      // Labs, Doctors, and Admins see all reports
      reports = await Report.find({}).populate('patient', 'user').populate({ path: 'patient', populate: { path: 'user', select: 'name' } }).sort({ uploadDate: -1 });
    }
    res.json({ success: true, reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error listing reports' });
  }
});

// @route   POST /api/reports/upload
// @desc    Upload diagnostic medical report / prescription image
// @access  Private (Patient, Laboratory, or Doctor)
router.post('/upload', protect, upload.single('reportFile'), async (req, res) => {
  const { patientId, reportName, reportType } = req.body;
  
  if (!reportName || !reportType) {
    return res.status(400).json({ success: false, message: 'Report name and type are required' });
  }

  try {
    let targetPatientId;
    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ user: req.user._id });
      if (!patient) return res.status(404).json({ success: false, message: 'Patient profile not found' });
      targetPatientId = patient._id;
    } else {
      if (!patientId) return res.status(400).json({ success: false, message: 'Patient ID is required for staff uploads' });
      targetPatientId = patientId;
    }

    // Set file details
    const fileUrl = req.file ? `/uploads/${Date.now()}_${req.file.originalname}` : '/uploads/mock_report.pdf';
    
    // Simulate raw text extraction depending on filename/type
    let dummyReportText = "Lipid Panel:\nCholesterol: 240 mg/dL (High)\nHDL: 35 mg/dL (Low)\nLDL: 155 mg/dL (High)\nTriglycerides: 180 mg/dL (High)";
    if (reportType === 'blood_report') {
      dummyReportText = "Complete Blood Count (CBC):\nHemoglobin: 11.2 g/dL (Low)\nWBC: 12.5 x10^3/uL (High)\nPlatelets: 250 x10^3/uL\nRBC: 3.8 x10^6/uL (Low)";
    } else if (reportType === 'prescription') {
      dummyReportText = "PRESCRIPTION DETAILS:\nAmoxicillin 500mg, Take 1 tablet TID for 7 days.\nIbuprofen 400mg, Take 1 tablet every 6 hours as needed for pain.";
    }

    // Call AI Service for report translation/summarization
    let aiSummary = {
      summary: "Stable blood parameters.",
      anomalies: [],
      findings: [{ panel: "General Health", explanation: "All metrics normal." }],
      recommendations: ["Continue daily wellness habits."]
    };

    try {
      if (reportType === 'prescription' && req.file) {
        // Mock OCR trigger or forward to python OCR endpoint
        // To construct form-data without external dependency in Node environment:
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', req.file.buffer, req.file.originalname);
        
        const ocrResponse = await axios.post(`${AI_SERVICE_URL}/ai/ocr`, form, {
          headers: form.getHeaders()
        });
        if (ocrResponse.data && ocrResponse.data.success) {
          const meds = ocrResponse.data.medicines;
          const details = meds.map(m => `${m.medicine_name} ${m.dosage} (${m.frequency})`).join('\n');
          aiSummary.summary = `Extracted Prescription: \n${details}`;
          aiSummary.findings = meds.map(m => ({
            panel: 'Prescription OCR',
            metric: m.medicine_name,
            status: 'Extracted',
            explanation: `Dosage: ${m.dosage}, Frequency: ${m.frequency}, Duration: ${m.duration}`
          }));
        }
      } else {
        const summaryResponse = await axios.post(`${AI_SERVICE_URL}/ai/summarize`, {
          report_text: dummyReportText
        });
        if (summaryResponse.data && summaryResponse.data.success) {
          aiSummary = {
            summary: summaryResponse.data.summary,
            anomalies: summaryResponse.data.anomalies,
            findings: summaryResponse.data.findings,
            recommendations: summaryResponse.data.recommendations
          };
        }
      }
    } catch (aiErr) {
      console.warn('[AI Service] Report analysis failed or server offline. Using local mock parsing: ', aiErr.message);
      // Hardcoded local NLP simulator if FastAPI is down
      if (reportType === 'blood_report') {
        aiSummary = {
          summary: "Your CBC shows mild anemia (low Hemoglobin) and a slightly elevated White Blood Cell count, which may indicate a mild inflammation or infection.",
          anomalies: ["Low Hemoglobin", "Elevated White Blood Cells"],
          findings: [
            { panel: "Complete Blood Count (CBC)", metric: "Hemoglobin", status: "Low", explanation: "Hemoglobin carries oxygen. Low levels cause fatigue." },
            { panel: "Complete Blood Count (CBC)", metric: "White Blood Cells", status: "High", explanation: "Active in fighting infections." }
          ],
          recommendations: ["Increase iron intake with dark leafy greens and red meats.", "Get plenty of rest and hydrate."]
        };
      }
    }

    const report = new Report({
      patient: targetPatientId,
      uploadedBy: req.user._id,
      reportName,
      reportType,
      fileUrl,
      status: req.user.role === 'laboratory' ? 'verified' : 'pending',
      verifiedBy: req.user.role === 'laboratory' ? req.user._id : null,
      verificationDate: req.user.role === 'laboratory' ? Date.now() : null,
      rawText: dummyReportText,
      aiSummary
    });

    await report.save();

    // Create a corresponding timeline record instantly
    const record = new MedicalRecord({
      patient: targetPatientId,
      type: 'report',
      date: Date.now(),
      title: reportName,
      description: `Uploaded new ${reportType.replace('_', ' ')}. AI Summary Alert: ${aiSummary.anomalies?.join(', ') || 'Normal'}.`,
      source: req.user.role === 'laboratory' ? 'Laboratory' : 'Patient Upload',
      metadata: {
        fileUrl,
        reportId: report._id.toString(),
        status: report.status
      }
    });
    await record.save();

    // Log Action
    await AuditLog.create({
      user: req.user._id,
      email: req.user.email,
      role: req.user.role,
      action: 'REPORT_UPLOADED',
      details: `Report '${reportName}' uploaded for Patient ID: ${targetPatientId}`
    });

    res.status(201).json({ success: true, report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error uploading report file' });
  }
});

// @route   PUT /api/reports/:id/verify
// @desc    Verify/Approve diagnostic report by lab tech
// @access  Private (Laboratory only)
router.put('/:id/verify', protect, checkRole(['laboratory', 'admin']), async (req, res) => {
  const { status } = req.body; // 'verified', 'rejected'
  
  if (!['verified', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid verification status' });
  }

  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    report.status = status;
    report.verifiedBy = req.user._id;
    report.verificationDate = Date.now();
    await report.save();

    // Update timeline metadata
    await MedicalRecord.findOneAndUpdate(
      { 'metadata.reportId': report._id.toString() },
      { 
        description: `Verified ${report.reportType.replace('_', ' ')}. Status: ${status}.`,
        'metadata.status': status 
      }
    );

    // Log Action
    await AuditLog.create({
      user: req.user._id,
      email: req.user.email,
      role: req.user.role,
      action: 'REPORT_VERIFIED',
      details: `Report ID: ${report._id} verified as '${status}'`
    });

    res.json({ success: true, report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error verifying report' });
  }
});

module.exports = router;
