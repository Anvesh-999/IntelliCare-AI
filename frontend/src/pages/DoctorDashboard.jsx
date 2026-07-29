import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { 
  Calendar, Search, User, ClipboardList, ShieldAlert, Sparkles, 
  Activity, ArrowRight, CheckCircle, Clock, Plus, Trash2, ShieldCheck, Heart 
} from 'lucide-react';

const DoctorDashboard = ({ activeTab }) => {
  const { token, API_BASE } = useContext(AuthContext);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Active Consultation State
  const [activeApp, setActiveApp] = useState(null);
  const [patientProfile, setPatientProfile] = useState(null);
  const [patientTimeline, setPatientTimeline] = useState([]);
  
  // Prescription Lab States
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [prescriptionMeds, setPrescriptionMeds] = useState([]);
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFreq, setMedFreq] = useState('Once daily');
  const [medDuration, setMedDuration] = useState('7 days');
  const [medInst, setMedInst] = useState('');
  
  // Interaction check state
  const [submittingNote, setSubmittingNote] = useState(false);
  const [submittingPrescription, setSubmittingPrescription] = useState(false);
  const [checkingInteractions, setCheckingInteractions] = useState(false);
  const [interactionResult, setInteractionResult] = useState(null);

  const loadAppointments = async () => {
    try {
      const res = await fetch(`${API_BASE}/appointments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAppointments(data.appointments);
      }
    } catch (e) { console.error('Roster load failed:', e); }
  };

  const loadPatients = async () => {
    try {
      const res = await fetch(`${API_BASE}/doctors/patients?query=${searchQuery}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPatients(data.patients);
      }
    } catch (e) { console.error('Patients search failed:', e); }
  };

  useEffect(() => {
    if (token) {
      loadAppointments();
      loadPatients();
    }
  }, [token]);

  // Load details when a patient is selected for active consultation
  const handleSelectPatient = async (app) => {
    setActiveApp(app);
    setDiagnosis('');
    setNotes('');
    setPrescriptionMeds([]);
    setInteractionResult(null);

    const patId = app.patient?._id || app._id; // Handles directory select or roster select
    try {
      // 1. Fetch Profile
      const profileRes = await fetch(`${API_BASE}/patients/profile?patientId=${patId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const profileData = await profileRes.json();
      if (profileData.success) {
        setPatientProfile(profileData.patient);
      }

      // 2. Fetch Timeline
      const timelineRes = await fetch(`${API_BASE}/patients/timeline?patientId=${patId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const timelineData = await timelineRes.json();
      if (timelineData.success) {
        setPatientTimeline(timelineData.timeline);
      }
    } catch (e) { console.error('Patient details fetch failed:', e); }
  };

  // Add medicine item to the script builder
  const handleAddMedToPrescription = () => {
    if (!medName) return;
    const newMed = {
      name: medName,
      dosage: medDosage || '500mg',
      frequency: medFreq,
      duration: medDuration,
      instructions: medInst || 'Take with water'
    };
    
    const updated = [...prescriptionMeds, newMed];
    setPrescriptionMeds(updated);
    
    // Reset inputs
    setMedName('');
    setMedDosage('');
    setMedInst('');
    
    // Trigger interaction check on the updated list
    checkInteractions(updated);
  };

  const handleRemoveMedFromPrescription = (index) => {
    const updated = prescriptionMeds.filter((_, i) => i !== index);
    setPrescriptionMeds(updated);
    checkInteractions(updated);
  };

  // Check drug interactions via AI Service
  const checkInteractions = async (medsList) => {
    if (medsList.length < 2) {
      setInteractionResult(null);
      return;
    }
    setCheckingInteractions(true);
    try {
      const AI_BASE_URL = window.location.origin.includes('3000') ? 'http://localhost:8000/ai' : '/ai';
      const drugNames = medsList.map(m => m.name);
      
      const res = await fetch(`${AI_BASE_URL}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicines: drugNames })
      });
      const data = await res.json();
      if (data.success) {
        setInteractionResult(data);
      }
    } catch (err) {
      console.warn('AI interactions check offline.');
    }
    setCheckingInteractions(false);
  };

  // Submit clinical consult notes & diagnosis
  const handleSubmitConsult = async (e) => {
    e.preventDefault();
    if (!patientProfile || !diagnosis) return;

    setSubmittingNote(true);
    try {
      const res = await fetch(`${API_BASE}/doctors/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          appointmentId: activeApp?._id,
          patientId: patientProfile._id,
          diagnosis,
          notes
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Clinical notes and diagnosis recorded.');
        
        // If we also built a prescription, submit that now!
        if (prescriptionMeds.length > 0) {
          await submitPrescription();
        }

        // Reset
        setActiveApp(null);
        setPatientProfile(null);
        setPatientTimeline([]);
        loadAppointments();
      }
    } catch (e) { console.error(e); }
    setSubmittingNote(false);
  };

  const submitPrescription = async () => {
    setSubmittingPrescription(true);
    try {
      const res = await fetch(`${API_BASE}/doctors/prescribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          appointmentId: activeApp?._id,
          patientId: patientProfile._id,
          medicines: prescriptionMeds
        })
      });
      const data = await res.json();
      if (data.success) {
        console.log('[Doctor] Prescription saved successfully');
      }
    } catch (e) { console.error('Prescription save failed:', e); }
    setSubmittingPrescription(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Active Consultation Panel Modal Overlay if patient is selected */}
      {patientProfile && (
        <div className="fixed inset-0 bg-darkbg-950/80 backdrop-blur-sm z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div className="glass-panel w-full max-w-5xl border-white/10 p-6 flex flex-col md:flex-row gap-6 max-h-[90vh] overflow-y-auto custom-scrollbar animate-fade-in relative">
            <button
              onClick={() => { setPatientProfile(null); setActiveApp(null); }}
              className="absolute top-4 right-4 text-xs bg-white/5 border border-white/10 px-2 py-1 hover:bg-white/10 rounded-lg text-slate-300"
            >
              Close Consult
            </button>

            {/* Left side: Patient Bio & History */}
            <div className="flex-1 flex flex-col gap-4 border-r border-white/5 pr-4 md:max-w-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-display font-bold text-sm text-white">
                  {patientProfile.user?.name ? patientProfile.user.name[0] : 'P'}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-200">{patientProfile.user?.name}</h4>
                  <span className="text-[10px] text-slate-400 block">DOB: {patientProfile.dateOfBirth ? new Date(patientProfile.dateOfBirth).toLocaleDateString() : 'N/A'} • {patientProfile.gender}</span>
                </div>
              </div>

              {/* Physical Parameters */}
              <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/5">
                <div className="text-center">
                  <span className="text-[9px] text-slate-500 block uppercase">Weight</span>
                  <span className="font-bold text-xs text-slate-300">{patientProfile.weight || 78} kg</span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] text-slate-500 block uppercase">Height</span>
                  <span className="font-bold text-xs text-slate-300">{patientProfile.height || 180} cm</span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] text-slate-500 block uppercase">Blood Group</span>
                  <span className="font-bold text-xs text-medical-mint">{patientProfile.bloodGroup || 'O+'}</span>
                </div>
              </div>

              {/* Patient Timeline summary */}
              <div>
                <h5 className="font-bold text-xs text-slate-300 mb-2">Previous Records Timeline</h5>
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                  {patientTimeline.map(evt => (
                    <div key={evt.id} className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-[11px] leading-relaxed">
                      <div className="flex justify-between items-center text-[9px] text-slate-500 mb-1">
                        <span>{evt.date}</span>
                        <span className="uppercase text-medical-mint">{evt.type}</span>
                      </div>
                      <span className="font-bold text-slate-300 block">{evt.title}</span>
                      <p className="text-slate-400 mt-0.5">{evt.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right side: Clinical notes & Prescription Lab */}
            <div className="flex-[2] flex flex-col gap-4">
              <div className="flex items-center gap-2 text-medical-mint font-display font-semibold text-sm">
                <Sparkles className="w-4 h-4 animate-pulse-slow" />
                Active Diagnostic & Clinical Generator
              </div>

              <form onSubmit={handleSubmitConsult} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Primary Diagnosis</label>
                    <input
                      type="text"
                      placeholder="e.g. Hypertension stage 1, Bronchitis"
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      required
                      className="w-full bg-darkbg-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-medical-teal"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Clinical Consult Notes</label>
                    <textarea
                      placeholder="Enter clinical observations or recommendations..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows="2"
                      className="w-full bg-darkbg-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-medical-teal resize-none"
                    />
                  </div>
                </div>

                {/* Prescription Script Builder Panel */}
                <div className="border-t border-white/5 pt-4">
                  <h5 className="font-bold text-xs text-slate-300 mb-2">Prescription Script Builder</h5>
                  
                  {/* Item inputs row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2.5">
                    <input
                      type="text"
                      placeholder="Drug Name (e.g. Lisinopril)"
                      value={medName}
                      onChange={(e) => setMedName(e.target.value)}
                      className="bg-darkbg-950/80 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Dosage (e.g. 10mg, 500mg)"
                      value={medDosage}
                      onChange={(e) => setMedDosage(e.target.value)}
                      className="bg-darkbg-950/80 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <select
                        value={medFreq}
                        onChange={(e) => setMedFreq(e.target.value)}
                        className="bg-darkbg-950/80 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none flex-1"
                      >
                        <option value="Once daily">Once daily</option>
                        <option value="Twice daily">Twice daily</option>
                        <option value="Three times daily">Three times daily</option>
                        <option value="Every 6 hours">Every 6 hours</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleAddMedToPrescription}
                        className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg border border-emerald-500/30"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Active drugs queued */}
                  {prescriptionMeds.length > 0 && (
                    <div className="flex flex-col gap-1.5 mb-4">
                      {prescriptionMeds.map((m, index) => (
                        <div key={index} className="flex justify-between items-center text-xs p-2 rounded bg-white/5 border border-white/5">
                          <div>
                            <span className="font-semibold text-slate-200">{m.name}</span> - {m.dosage} ({m.frequency}, {m.duration})
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveMedFromPrescription(index)}
                            className="p-1 text-rose-400 hover:bg-rose-500/10 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI Interaction Check Warning Box */}
                  {checkingInteractions && (
                    <div className="text-[10px] text-slate-400 animate-pulse flex items-center gap-1.5 mb-2.5">
                      <Clock className="w-3.5 h-3.5 text-medical-mint" /> Scanning script for interaction warnings...
                    </div>
                  )}

                  {interactionResult && (
                    <div className={`p-3 rounded-xl border text-[11px] leading-relaxed mb-4 ${
                      interactionResult.has_interactions 
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' 
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold mb-1">
                        {interactionResult.has_interactions ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                        <span>AI Drug Interaction Checker Result</span>
                      </div>
                      <p>{interactionResult.summary}</p>
                      {interactionResult.interactions && interactionResult.interactions.length > 0 && (
                        <div className="mt-2 pl-3 border-l border-rose-500/30 flex flex-col gap-1.5">
                          {interactionResult.interactions.map((it, idx) => (
                            <div key={idx}>
                              <span className="font-semibold">Conflict: {it.drugs.join(' + ')} ({it.severity})</span>
                              <p className="text-[10px] text-slate-400">{it.explanation}</p>
                              <p className="text-[10px] text-rose-400 mt-0.5">Advice: {it.advice}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submittingNote}
                  className="w-full py-2.5 bg-gradient-to-r from-medical-teal to-medical-mint text-white font-bold text-xs rounded-xl shadow-lg"
                >
                  {submittingNote ? 'Saving Records...' : 'Finalize Consult and Script'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 1. Today's Consult Roster Tab */}
      {activeTab === 'appointments' && (
        <div className="glass-panel p-6 border-white/5 max-w-4xl mx-auto flex flex-col gap-4">
          <h3 className="text-base font-bold font-display text-slate-100 mb-2 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-medical-mint" />
            Today's Consult Roster
          </h3>

          <div className="flex flex-col gap-4">
            {appointments.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No patients scheduled for consultations today.</p>
            ) : (
              appointments.map(app => (
                <div key={app._id} className="glass-panel p-4 border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-display font-bold text-sm shrink-0">
                      {app.patient?.user?.name ? app.patient.user.name[0] : 'P'}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-200">{app.patient?.user?.name || 'John Patient'}</h4>
                      <p className="text-xs text-slate-400">Gender: {app.patient?.gender} • DOB: {app.patient?.dateOfBirth ? new Date(app.patient.dateOfBirth).toLocaleDateString() : 'N/A'}</p>
                      <p className="text-xs text-slate-500 mt-1 italic">Reason: {app.symptoms || 'General Checkup'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] text-slate-500 font-medium block">Scheduled Slot</span>
                      <span className="font-bold text-xs text-slate-300 block">{app.timeslot}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${
                        app.status === 'scheduled' 
                          ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' 
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {app.status}
                      </span>
                      {app.status === 'scheduled' && (
                        <button
                          onClick={() => handleSelectPatient(app)}
                          className="px-4 py-2 bg-gradient-to-r from-medical-teal to-medical-mint text-white text-xs font-bold rounded-xl flex items-center gap-1 shrink-0"
                        >
                          <span>Open Consult</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. Patient Search Tab */}
      {activeTab === 'patients' && (
        <div className="glass-panel p-6 border-white/5 max-w-4xl mx-auto flex flex-col gap-4">
          <h3 className="text-base font-bold font-display text-slate-100 mb-2">Hospital Patient Directory</h3>
          
          <form onSubmit={(e) => { e.preventDefault(); loadPatients(); }} className="flex gap-2">
            <input
              type="text"
              placeholder="Search patients by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-darkbg-950/80 border border-white/10 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-medical-teal"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-gradient-to-r from-medical-teal to-medical-mint text-white font-bold text-xs rounded-xl hover:opacity-95"
            >
              Search
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {patients.length === 0 ? (
              <p className="col-span-2 text-xs text-slate-500 py-6 text-center">No patients found</p>
            ) : (
              patients.map(p => (
                <div key={p._id} className="glass-panel p-4 border-white/5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                      {p.user?.name ? p.user.name[0] : 'P'}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-200">{p.user?.name}</h4>
                      <span className="text-[10px] text-slate-400 block">{p.user?.email} • {p.gender}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectPatient(p)}
                    className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 rounded-xl transition-all"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorDashboard;
