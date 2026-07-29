import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { FileText, ClipboardList, ShieldAlert, Sparkles, User, Upload, ArrowRight, CheckCircle, RefreshCw } from 'lucide-react';

const LaboratoryDashboard = ({ activeTab }) => {
  const { token, API_BASE } = useContext(AuthContext);
  
  // States
  const [patients, setPatients] = useState([]);
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  
  // Upload state
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [reportName, setReportName] = useState('');
  const [reportType, setReportType] = useState('blood_report');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const loadPatients = async () => {
    try {
      const res = await fetch(`${API_BASE}/doctors/patients`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPatients(data.patients);
      }
    } catch (e) { console.error(e); }
  };

  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const res = await fetch(`${API_BASE}/reports`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setReports(data.reports);
      }
    } catch (e) { console.error('Reports load failed:', e); }
    setLoadingReports(false);
  };

  useEffect(() => {
    if (token) {
      loadPatients();
      loadReports();
    }
  }, [token]);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatientId || !reportName) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('patientId', selectedPatientId);
      formData.append('reportName', reportName);
      formData.append('reportType', reportType);
      if (file) {
        formData.append('reportFile', file);
      }

      const res = await fetch(`${API_BASE}/reports/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await res.json();
      if (data.success) {
        alert('Diagnostic report uploaded and AI Summary calculated!');
        setReportName('');
        setSelectedPatientId('');
        setFile(null);
        loadReports();
      } else {
        alert(data.message || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
    }
    setUploading(false);
  };

  const handleVerifyReport = async (id, status) => {
    try {
      const res = await fetch(`${API_BASE}/reports/${id}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Report marked as ${status}.`);
        loadReports();
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Upload Diagnostics Tab */}
      {activeTab === 'upload' && (
        <div className="glass-panel p-6 border-white/5 max-w-xl mx-auto flex flex-col gap-4 animate-fade-in w-full">
          <h3 className="text-base font-bold font-display text-slate-100 mb-2 flex items-center gap-2">
            <Upload className="w-5 h-5 text-medical-mint" />
            Diagnostic Upload Terminal
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-2">
            Compile lab records for diagnostic checks. The AI summarizer module will automatically translate metrics to simple patient summaries.
          </p>

          <form onSubmit={handleUploadSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Select Target Patient</label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                required
                className="w-full bg-darkbg-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-medical-teal"
              >
                <option value="">Select Patient</option>
                {patients.map(p => (
                  <option key={p._id} value={p._id}>
                    {p.user?.name} ({p.gender})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Report Title</label>
              <input
                type="text"
                placeholder="e.g. CBC Hemogram Panel, Lipid Profile"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                required
                className="w-full bg-darkbg-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-medical-teal"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full bg-darkbg-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-medical-teal"
              >
                <option value="blood_report">Blood Report Panel</option>
                <option value="scan">Radiological Scan (MRI/X-Ray)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Attach PDF/Image file</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full bg-darkbg-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-medical-teal file:bg-medical-teal/20 file:text-medical-mint file:border-none file:text-[10px] file:font-semibold file:px-2 file:py-1 file:rounded-md file:mr-3"
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="mt-2 w-full py-2 bg-gradient-to-r from-medical-teal to-medical-mint text-white font-bold text-xs rounded-xl shadow-lg hover:opacity-95"
            >
              {uploading ? 'Processing File & Running AI...' : 'Upload & Trigger AI Summary'}
            </button>
          </form>
        </div>
      )}

      {/* 2. Verification Queue Tab */}
      {activeTab === 'verify' && (
        <div className="glass-panel p-6 border-white/5 max-w-4xl mx-auto flex flex-col gap-4 animate-fade-in w-full">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h3 className="text-base font-bold font-display text-slate-100 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-medical-mint" />
              Document Verification pipeline
            </h3>
            <button 
              onClick={loadReports}
              className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-slate-400"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {reports.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No reports in the verification queue.</p>
            ) : (
              reports.map(r => (
                <div key={r._id} className="glass-panel p-4 border-white/5 flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-200">{r.reportName}</h4>
                      <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${
                        r.status === 'verified' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : r.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {r.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-1">Patient Profile ID: {r.patient?.user?.name || 'Assigned Patient'}</span>
                    
                    {r.aiSummary && r.aiSummary.summary && (
                      <div className="mt-3 bg-white/5 p-3 rounded-lg border border-white/5 text-[11px] leading-relaxed">
                        <span className="font-bold text-slate-300 block mb-0.5"><Sparkles className="w-3.5 h-3.5 text-medical-mint inline mr-1" /> AI Translated Summary:</span>
                        <p className="text-slate-400">{r.aiSummary.summary}</p>
                        {r.aiSummary.anomalies && r.aiSummary.anomalies.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {r.aiSummary.anomalies.map((a, idx) => (
                              <span key={idx} className="text-[9px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20 px-1.5 py-0.5 rounded">
                                Alert: {a}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
                    {r.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleVerifyReport(r._id, 'rejected')}
                          className="px-3 py-1.5 border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold rounded-xl"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleVerifyReport(r._id, 'verified')}
                          className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold rounded-xl"
                        >
                          Approve Verification
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LaboratoryDashboard;
