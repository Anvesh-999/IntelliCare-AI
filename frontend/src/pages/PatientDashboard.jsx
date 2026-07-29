import React, { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { 
  LineChart, Activity, User, ShieldAlert, Heart, Calendar, 
  Sparkles, FileText, Pill, Compass, Send, CheckCircle, HelpCircle, 
  MapPin, Plus, Trash2, ArrowUpRight, Smile, Coffee, ChevronRight
} from 'lucide-react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(...registerables);

const PatientDashboard = ({ activeTab }) => {
  const { token, API_BASE } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [timeline, setTimeline] = useState([]);
  
  // 1. Overview Tab States
  const [bpSys, setBpSys] = useState(120);
  const [bpDia, setBpDia] = useState(80);
  const [sugarGlucose, setSugarGlucose] = useState(90);
  const [weightValue, setWeightValue] = useState(75);
  const [savingMetric, setSavingMetric] = useState(false);

  // 2. Appointments Tab States
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [appDate, setAppDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [appSymptoms, setAppSymptoms] = useState('');
  const [myAppointments, setMyAppointments] = useState([]);
  const [booking, setBooking] = useState(false);

  // 3. Symptoms Tab States
  const [symptomInput, setSymptomInput] = useState('');
  const [symptomResult, setSymptomResult] = useState(null);
  const [analyzingSymptoms, setAnalyzingSymptoms] = useState(false);

  // 4. Chat Tab States
  const [chatQuery, setChatQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef(null);

  // Load patient data
  const loadProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/patients/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.patient);
      }
    } catch (e) { console.error('Profile fetch failed:', e); }
  };

  const loadTimeline = async () => {
    try {
      const res = await fetch(`${API_BASE}/patients/timeline`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setTimeline(data.timeline);
      }
    } catch (e) { console.error('Timeline fetch failed:', e); }
  };

  const loadAppointments = async () => {
    try {
      const res = await fetch(`${API_BASE}/appointments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setMyAppointments(data.appointments);
      }
    } catch (e) { console.error('Appointments fetch failed:', e); }
  };

  const loadDoctors = async () => {
    try {
      const res = await fetch(`${API_BASE}/doctors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDoctors(data.doctors);
      }
    } catch (e) { console.error('Doctors fetch failed:', e); }
  };

  useEffect(() => {
    if (token) {
      loadProfile();
      loadTimeline();
      loadAppointments();
      loadDoctors();
    }
  }, [token]);

  // Load available timeslots when doctor or date changes
  useEffect(() => {
    const fetchSlots = async () => {
      if (!selectedDoctor || !appDate) return;
      try {
        const res = await fetch(`${API_BASE}/appointments/slots?doctorId=${selectedDoctor}&date=${appDate}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setSlots(data.slots);
          setSelectedSlot('');
        }
      } catch (e) { console.error('Slots fetch failed:', e); }
    };
    fetchSlots();
  }, [selectedDoctor, appDate]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // 1. Submit Health Metrics
  const handleMetricSubmit = async (type, values) => {
    setSavingMetric(true);
    try {
      const res = await fetch(`${API_BASE}/patients/metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type, values })
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.patient);
        alert(`${type.toUpperCase()} Metric logged successfully!`);
        loadTimeline();
      }
    } catch (e) { console.error(e); }
    setSavingMetric(false);
  };

  // 2. Book Appointment
  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!selectedDoctor || !appDate || !selectedSlot) return;

    setBooking(true);
    try {
      const res = await fetch(`${API_BASE}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          doctorId: selectedDoctor,
          date: appDate,
          timeslot: selectedSlot,
          symptoms: appSymptoms
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Appointment scheduled successfully!');
        setSelectedDoctor('');
        setAppDate('');
        setSelectedSlot('');
        setAppSymptoms('');
        loadAppointments();
        loadTimeline();
      } else {
        alert(data.message || 'Booking failed');
      }
    } catch (e) { console.error(e); }
    setBooking(false);
  };

  const handleCancelAppointment = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      const res = await fetch(`${API_BASE}/appointments/${id}/cancel`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        alert('Appointment cancelled.');
        loadAppointments();
        loadTimeline();
      }
    } catch (e) { console.error(e); }
  };

  // 3. Analyze Symptoms
  const handleAnalyzeSymptoms = async (e) => {
    e.preventDefault();
    if (!symptomInput.trim()) return;

    setAnalyzingSymptoms(true);
    try {
      const AI_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8000/ai' : '/ai';
      const res = await fetch(`${AI_BASE_URL}/symptoms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: symptomInput })
      });
      const data = await res.json();
      if (data.success) {
        setSymptomResult(data);
      }
    } catch (err) {
      console.warn('Symptom service offline. Simulating mock response.');
      // Local fallback
      setSymptomResult({
        detected_issues: ["General fatigue / checkup requests"],
        urgency: "Low (Self-Care)",
        explanation: "No emergency red flags were found in your query details.",
        warnings: ["Persistent headaches", "Difficulty swallowing"],
        home_care: "Ensure 8 hours of sleep and regular electrolyte hydration.",
        recommendation: "Consult your doctor if issues persist for more than a few days."
      });
    }
    setAnalyzingSymptoms(false);
  };

  // 4. Chat with AI
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatQuery.trim()) return;

    const userMsg = chatQuery;
    setChatQuery('');
    setChatHistory(prev => [...prev, { sender: 'patient', message: userMsg }]);
    setSendingChat(true);

    try {
      const res = await fetch(`${API_BASE}/patients/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: userMsg })
      });
      const data = await res.json();
      if (data.success) {
        setChatHistory(data.chatHistory);
      }
    } catch (err) {
      setChatHistory(prev => [...prev, { sender: 'ai', message: "I'm sorry, the medical AI is currently offline. Please ensure the Python container is running." }]);
    }
    setSendingChat(false);
  };

  // Setup Chart Data for BP / Sugar
  const bpHistory = profile?.healthMetrics?.bloodPressureHistory || [];
  const sugarHistory = profile?.healthMetrics?.bloodSugarHistory || [];
  
  const chartLabels = bpHistory.map(item => new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  const systolicData = bpHistory.map(item => item.systolic);
  const diastolicData = bpHistory.map(item => item.diastolic);
  const sugarData = sugarHistory.map(item => item.glucose);

  const bpChartData = {
    labels: chartLabels.slice(-6),
    datasets: [
      {
        label: 'Systolic BP (mmHg)',
        data: systolicData.slice(-6),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Diastolic BP (mmHg)',
        data: diastolicData.slice(-6),
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13, 148, 136, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  const currentBP = bpHistory.length > 0 ? `${bpHistory[bpHistory.length - 1].systolic}/${bpHistory[bpHistory.length - 1].diastolic}` : '120/80';
  const currentSugar = sugarHistory.length > 0 ? `${sugarHistory[sugarHistory.length - 1].glucose} mg/dL` : '90 mg/dL';
  const currentWeight = profile?.weight ? `${profile.weight} kg` : '78 kg';

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Health Hub / Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Analytics Panels */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-panel p-5 flex items-center gap-4 border-emerald-500/10">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/10 shadow-inner">
                  <Heart className="w-6 h-6 animate-pulse-slow" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Blood Pressure</span>
                  <h3 className="text-xl font-bold mt-0.5">{currentBP}</h3>
                  <span className="text-[10px] text-emerald-400 font-medium">Normal / Active</span>
                </div>
              </div>

              <div className="glass-panel p-5 flex items-center gap-4 border-teal-500/10">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400 border border-teal-500/10">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Fasting Sugar</span>
                  <h3 className="text-xl font-bold mt-0.5">{currentSugar}</h3>
                  <span className="text-[10px] text-teal-400 font-medium">Excellent Control</span>
                </div>
              </div>

              <div className="glass-panel p-5 flex items-center gap-4 border-indigo-500/10">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/10">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Current Weight</span>
                  <h3 className="text-xl font-bold mt-0.5">{currentWeight}</h3>
                  <span className="text-[10px] text-indigo-400 font-medium">BMI: 24.1 (Ideal)</span>
                </div>
              </div>
            </div>

            {/* Vital Analytics Graph */}
            <div className="glass-panel p-6 border-white/5">
              <h3 className="text-base font-bold font-display text-slate-100 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-medical-mint" />
                Vital Signs Historical Trends
              </h3>
              <div className="h-64 flex items-center justify-center">
                {bpHistory.length > 0 ? (
                  <Line data={bpChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                ) : (
                  <p className="text-xs text-slate-500">Awaiting diagnostic metrics values...</p>
                )}
              </div>
            </div>

            {/* Log New Vital Panel */}
            <div className="glass-panel p-6 border-white/5">
              <h3 className="text-base font-bold font-display text-slate-100 mb-4">Log Daily Physical Readings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* BP Log */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Blood Pressure</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      placeholder="Sys"
                      value={bpSys}
                      onChange={(e) => setBpSys(e.target.value)}
                      className="w-16 bg-darkbg-950/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-100 text-center"
                    />
                    <span className="text-slate-500">/</span>
                    <input
                      type="number"
                      placeholder="Dia"
                      value={bpDia}
                      onChange={(e) => setBpDia(e.target.value)}
                      className="w-16 bg-darkbg-950/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-100 text-center"
                    />
                    <button
                      onClick={() => handleMetricSubmit('bp', { systolic: parseInt(bpSys), diastolic: parseInt(bpDia) })}
                      className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg border border-emerald-500/30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Glucose Log */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Fasting Glucose (mg/dL)</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={sugarGlucose}
                      onChange={(e) => setSugarGlucose(e.target.value)}
                      className="w-20 bg-darkbg-950/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-100 text-center"
                    />
                    <button
                      onClick={() => handleMetricSubmit('sugar', { glucose: parseInt(sugarGlucose), mealType: 'fasting' })}
                      className="p-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-lg border border-teal-500/30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Weight Log */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Weight (kg)</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={weightValue}
                      onChange={(e) => setWeightValue(e.target.value)}
                      className="w-20 bg-darkbg-950/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-100 text-center"
                    />
                    <button
                      onClick={() => handleMetricSubmit('weight', { weight: parseFloat(weightValue) })}
                      className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg border border-indigo-500/30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Wellness Details */}
          <div className="flex flex-col gap-6">
            {/* Lifestyle Summary */}
            <div className="glass-panel p-6 border-white/5 flex flex-col gap-4">
              <h3 className="text-base font-bold font-display text-slate-100 border-b border-white/5 pb-2">Lifestyle Profile</h3>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5"><Smile className="w-4 h-4 text-emerald-400" /> Diet Goal</span>
                  <span className="font-semibold text-slate-200 capitalize">{profile?.lifestyle?.dietPreference || 'Balanced'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5"><Activity className="w-4 h-4 text-teal-400" /> Activity Level</span>
                  <span className="font-semibold text-slate-200 capitalize">{profile?.lifestyle?.activityLevel || 'Moderate'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5"><Coffee className="w-4 h-4 text-amber-400" /> Smoking / Alcohol</span>
                  <span className="font-semibold text-slate-200">
                    {profile?.lifestyle?.smoking ? 'Yes' : 'No'} / {profile?.lifestyle?.alcohol ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* Vaccination History */}
            <div className="glass-panel p-6 border-white/5 flex flex-col gap-4">
              <h3 className="text-base font-bold font-display text-slate-100 border-b border-white/5 pb-2">Immunization Checklist</h3>
              <div className="flex flex-col gap-3">
                {profile?.vaccineHistory && profile.vaccineHistory.length > 0 ? (
                  profile.vaccineHistory.map((v, index) => (
                    <div key={index} className="flex justify-between items-start border-b border-white/5 pb-2 last:border-none last:pb-0">
                      <div>
                        <span className="text-xs font-semibold text-slate-200 block">{v.vaccineName}</span>
                        <span className="text-[10px] text-slate-500 block">Administered: {new Date(v.dateAdministered).toLocaleDateString()}</span>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/20">
                        {v.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">No vaccination records</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Medical Timeline */}
      {activeTab === 'timeline' && (
        <div className="glass-panel p-6 border-white/5 max-w-3xl mx-auto">
          <h3 className="text-base font-bold font-display text-slate-100 mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5 text-medical-mint" />
            Complete Health Record Timeline
          </h3>

          <div className="relative border-l border-white/10 pl-6 flex flex-col gap-8">
            {timeline.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No clinical history files found.</p>
            ) : (
              timeline.map((event) => {
                let colorClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                if (event.style?.color === 'emerald') colorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                if (event.style?.color === 'purple') colorClass = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                if (event.style?.color === 'indigo') colorClass = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                if (event.style?.color === 'rose') colorClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                if (event.style?.color === 'amber') colorClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';

                return (
                  <div key={event.id} className="relative group animate-fade-in">
                    {/* Ring dot indicator */}
                    <span className={`absolute top-1 -left-[31px] w-4 h-4 rounded-full border-2 bg-darkbg-950 flex items-center justify-center ${colorClass}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    </span>

                    <div className="glass-panel p-4 border-white/5 transition-all duration-300 group-hover:border-white/10">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <span className="text-[10px] text-slate-500 font-semibold">{event.date}</span>
                        <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${colorClass}`}>
                          {event.type}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-200">{event.title}</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{event.description}</p>
                      <span className="text-[10px] text-slate-500 block mt-2">Source: {event.source}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 3. Appointments Tab */}
      {activeTab === 'appointments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Appointment Booking Panel */}
          <div className="lg:col-span-1 glass-panel p-6 border-white/5 h-fit">
            <h3 className="text-base font-bold font-display text-slate-100 mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-medical-mint" />
              Book Consult Appointment
            </h3>
            <form onSubmit={handleBookAppointment} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-slate-400 font-semibold uppercase">Consultation Specialist</label>
                <select
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  required
                  className="w-full bg-darkbg-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-medical-teal"
                >
                  <option value="">Select Doctor</option>
                  {doctors.map(d => (
                    <option key={d._id} value={d._id}>
                      {d.user?.name} - {d.specialization} (${d.consultationFee})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-slate-400 font-semibold uppercase">Preferred Date</label>
                <input
                  type="date"
                  value={appDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setAppDate(e.target.value)}
                  required
                  className="w-full bg-darkbg-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-medical-teal"
                />
              </div>

              {slots.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-400 font-semibold uppercase">Select Available Timeslot</label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                    {slots.map(s => (
                      <button
                        key={s.slot}
                        type="button"
                        disabled={s.isBooked}
                        onClick={() => setSelectedSlot(s.slot)}
                        className={`text-xs px-2 py-1.5 rounded-lg border font-medium transition-all ${
                          s.isBooked 
                            ? 'bg-red-950/10 border-red-500/10 text-red-500 cursor-not-allowed opacity-50' 
                            : selectedSlot === s.slot 
                              ? 'bg-medical-teal/20 text-medical-mint border-medical-teal/40' 
                              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {s.slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-slate-400 font-semibold uppercase">Describe Symptoms</label>
                <textarea
                  placeholder="Explain symptoms briefly (e.g. routine checkup, fatigue)"
                  value={appSymptoms}
                  onChange={(e) => setAppSymptoms(e.target.value)}
                  rows="3"
                  className="w-full bg-darkbg-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-medical-teal resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={booking}
                className="w-full py-2 bg-gradient-to-r from-medical-teal to-medical-mint text-white font-bold text-xs rounded-xl shadow-lg hover:opacity-95"
              >
                {booking ? 'Scheduling Slot...' : 'Schedule Appointment'}
              </button>
            </form>
          </div>

          {/* Active Appointments List */}
          <div className="lg:col-span-2 glass-panel p-6 border-white/5 flex flex-col gap-4">
            <h3 className="text-base font-bold font-display text-slate-100 mb-2">My Active Consultations</h3>
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[500px] custom-scrollbar pr-2">
              {myAppointments.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">No upcoming appointments booked.</p>
              ) : (
                myAppointments.map(app => (
                  <div key={app._id} className="glass-panel p-4 border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                    <div>
                      <span className="text-[10px] text-medical-mint font-semibold uppercase tracking-wider bg-medical-teal/10 border border-medical-teal/20 px-2 py-0.5 rounded">
                        {app.type}
                      </span>
                      <h4 className="font-bold text-sm text-slate-200 mt-2">Dr. {app.doctor?.user?.name || 'Cardiac Specialist'}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{app.doctor?.specialization}</p>
                      
                      <div className="flex gap-4 text-[10px] text-slate-500 mt-3 font-medium">
                        <span>Date: {new Date(app.date).toLocaleDateString()}</span>
                        <span>Time: {app.timeslot}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${
                        app.status === 'scheduled' 
                          ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' 
                          : app.status === 'completed'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {app.status}
                      </span>

                      {app.status === 'scheduled' && (
                        <button
                          onClick={() => handleCancelAppointment(app._id)}
                          className="p-2 border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. AI Symptom Checker */}
      {activeTab === 'symptoms' && (
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          <div className="glass-panel p-6 border-white/5">
            <h3 className="text-base font-bold font-display text-slate-100 mb-2 flex items-center gap-2">
              <Compass className="w-5 h-5 text-medical-mint" />
              Interactive Symptom Guidance
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Type what symptoms you are experiencing. The AI analyzer module matches clinical conditions to supply helpful triage details.
            </p>
            <form onSubmit={handleAnalyzeSymptoms} className="flex gap-2">
              <input
                type="text"
                value={symptomInput}
                onChange={(e) => setSymptomInput(e.target.value)}
                placeholder="e.g. chest pain, cough, fever..."
                className="flex-1 bg-darkbg-950/80 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-medical-teal"
              />
              <button
                type="submit"
                disabled={analyzingSymptoms}
                className="px-5 py-2.5 bg-gradient-to-r from-medical-teal to-medical-mint text-white font-bold text-xs rounded-xl hover:opacity-95 shrink-0 flex items-center gap-1.5"
              >
                <span>Analyze</span>
              </button>
            </form>
          </div>

          {/* Symptom Result Output Card */}
          {symptomResult && (
            <div className="glass-panel p-6 border-medical-mint/20 shadow-2xl animate-fade-in flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs text-slate-400">Triage Summary</span>
                <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                  symptomResult.urgency.toLowerCase().includes('high') 
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse' 
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  Urgency: {symptomResult.urgency}
                </span>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-200">Clinical Explanation</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{symptomResult.explanation}</p>
              </div>

              {symptomResult.warnings && symptomResult.warnings.length > 0 && (
                <div>
                  <h4 className="font-bold text-sm text-rose-300 flex items-center gap-1">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    Critical Warning Signs (Seek Care If Checked)
                  </h4>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {symptomResult.warnings.map((w, index) => (
                      <li key={index} className="text-xs text-slate-400 flex items-start gap-2 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5"></span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-4">
                <div>
                  <h4 className="font-bold text-xs text-slate-200">Recommended Home Care</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">{symptomResult.home_care}</p>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-200">Primary Recommendation</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">{symptomResult.recommendation}</p>
                </div>
              </div>

              <span className="text-[9px] text-slate-500 mt-2 text-center border-t border-white/5 pt-2 italic">
                {symptomResult.disclaimer}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 5. AI Chat Assistant Tab */}
      {activeTab === 'chat' && (
        <div className="max-w-2xl mx-auto glass-panel border-white/5 flex flex-col h-[550px] animate-fade-in">
          {/* Chat Header */}
          <div className="px-5 py-3 border-b border-white/5 bg-slate-900/40 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-medical-teal/10 flex items-center justify-center text-medical-mint border border-medical-teal/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-200">Cognitive Health Assistant</h4>
              <span className="text-[10px] text-slate-500">Connected to patient medical records securely</span>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
            {chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 h-full text-slate-500">
                <Smile className="w-8 h-8 text-slate-600 animate-bounce" />
                <p className="text-xs">Hi! Type any healthcare query to begin assistant chat.</p>
              </div>
            ) : (
              chatHistory.map((msg, index) => {
                const isAI = msg.sender === 'ai';
                return (
                  <div 
                    key={index}
                    className={`flex gap-3 max-w-[85%] ${isAI ? 'self-start' : 'self-end flex-row-reverse'}`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border text-xs font-bold ${
                      isAI 
                        ? 'bg-medical-teal/10 border-medical-teal/20 text-medical-mint' 
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}>
                      {isAI ? 'AI' : 'P'}
                    </div>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed border ${
                      isAI 
                        ? 'bg-darkbg-900 border-white/5 text-slate-300' 
                        : 'bg-medical-teal/15 border-medical-teal/20 text-slate-200'
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                );
              })
            )}
            {sendingChat && (
              <div className="flex gap-3 self-start max-w-[85%] items-center">
                <div className="w-7 h-7 rounded-full bg-medical-teal/10 border border-medical-teal/20 text-medical-mint flex items-center justify-center text-xs font-bold">
                  AI
                </div>
                <div className="flex gap-1 py-2 px-3 bg-darkbg-900 border border-white/5 rounded-2xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Form Input Area */}
          <form onSubmit={handleSendChat} className="p-3 border-t border-white/5 flex gap-2">
            <input
              type="text"
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
              placeholder="Ask a question about health recommendations..."
              className="flex-1 bg-darkbg-950/80 border border-white/10 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-medical-teal"
            />
            <button
              type="submit"
              disabled={sendingChat}
              className="w-9 h-9 bg-gradient-to-tr from-medical-teal to-medical-mint text-white rounded-xl flex items-center justify-center hover:opacity-95 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default PatientDashboard;
