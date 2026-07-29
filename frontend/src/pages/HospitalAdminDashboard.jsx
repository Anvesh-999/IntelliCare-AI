import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Layers, Activity, User, Bed, LogOut, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';

const HospitalAdminDashboard = ({ activeTab }) => {
  const { token, API_BASE } = useContext(AuthContext);
  
  // Bed States
  const [beds, setBeds] = useState([]);
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [patients, setPatients] = useState([]);
  
  // Allocation states
  const [selectedBed, setSelectedBed] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [allocating, setAllocating] = useState(false);

  const loadBeds = async () => {
    setLoadingBeds(true);
    try {
      const res = await fetch(`${API_BASE}/admin/beds`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setBeds(data.beds);
      }
    } catch (e) { console.error('Beds load failed:', e); }
    setLoadingBeds(false);
  };

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

  useEffect(() => {
    if (token) {
      loadBeds();
      loadPatients();
    }
  }, [token]);

  const handleAllocateBed = async (e) => {
    e.preventDefault();
    if (!selectedBed || !selectedPatientId) return;

    setAllocating(true);
    try {
      const res = await fetch(`${API_BASE}/admin/beds/allocate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bedId: selectedBed._id,
          patientId: selectedPatientId
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Bed ${selectedBed.bedNumber} allocated successfully.`);
        setSelectedBed(null);
        setSelectedPatientId('');
        loadBeds();
      } else {
        alert(data.message || 'Allocation failed');
      }
    } catch (e) { console.error(e); }
    setAllocating(false);
  };

  const handleReleaseBed = async (id) => {
    if (!window.confirm('Are you sure you want to release this bed? (It will transition to cleaning)')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/beds/${id}/release`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        alert('Bed released. Current state: cleaning.');
        loadBeds();
      }
    } catch (e) { console.error(e); }
  };

  // Analytics Chart Data
  const revenueData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    datasets: [
      {
        label: 'Hospital Revenue ($)',
        data: [12000, 19000, 32000, 5000, 20000, 30000, 45000],
        backgroundColor: 'rgba(13, 148, 136, 0.6)',
        borderColor: '#0d9488',
        borderWidth: 1
      }
    ]
  };

  const departmentData = {
    labels: ['Cardiology', 'Pediatrics', 'Emergency', 'General Medicine', 'Neurology'],
    datasets: [
      {
        data: [35, 20, 25, 45, 15],
        backgroundColor: [
          '#6366f1',
          '#10b981',
          '#f43f5e',
          '#0d9488',
          '#f59e0b'
        ],
        borderWidth: 0
      }
    ]
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Bed Allocation Modal overlay */}
      {selectedBed && (
        <div className="fixed inset-0 bg-darkbg-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md border-white/10 p-6 animate-fade-in">
            <h3 className="text-base font-bold font-display text-slate-100 mb-4">Allocate Bed: {selectedBed.bedNumber}</h3>
            
            <form onSubmit={handleAllocateBed} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase">Select Admitting Patient</label>
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

              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBed(null)}
                  className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-xl text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={allocating}
                  className="px-4 py-2 bg-gradient-to-r from-medical-teal to-medical-mint text-white font-bold text-xs rounded-xl shadow-lg"
                >
                  {allocating ? 'Allocating...' : 'Confirm Admission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. Bed Manager Layout Grid Tab */}
      {activeTab === 'beds' && (
        <div className="glass-panel p-6 border-white/5 max-w-5xl mx-auto flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="text-base font-bold font-display text-slate-100 flex items-center gap-2">
                <Bed className="w-5 h-5 text-medical-mint" />
                Live Ward Bed Tracker
              </h3>
              <span className="text-[10px] text-slate-400 block mt-0.5">Click any bed to allocate patients or vacate.</span>
            </div>
            
            <button 
              onClick={loadBeds}
              className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-slate-400"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Color Key Guide */}
          <div className="flex flex-wrap gap-4 text-[10px] font-semibold text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/30"></span> Vacant</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-500/20 border border-rose-500/30"></span> Occupied</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500/20 border border-amber-500/30"></span> Cleaning</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
            {loadingBeds ? (
              <div className="col-span-full py-8 text-center text-xs text-slate-500">Loading live inventory status...</div>
            ) : beds.length === 0 ? (
              <p className="col-span-full text-xs text-slate-500 text-center py-6">No beds seeded in collection.</p>
            ) : (
              beds.map(b => {
                let statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20';
                if (b.status === 'occupied') statusColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20';
                if (b.status === 'cleaning') statusColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20';
                
                return (
                  <div
                    key={b._id}
                    onClick={() => {
                      if (b.status === 'vacant') setSelectedBed(b);
                      else if (b.status === 'occupied') handleReleaseBed(b._id);
                      else if (b.status === 'cleaning') {
                        if (confirm('Mark bed as cleaned and vacant?')) {
                          // Simple mock clean update
                          loadBeds();
                        }
                      }
                    }}
                    className={`p-4 rounded-xl border flex flex-col justify-between h-28 cursor-pointer transition-all duration-200 hover:scale-[1.03] ${statusColor}`}
                  >
                    <div>
                      <span className="font-display font-bold text-sm block">{b.bedNumber}</span>
                      <span className="text-[9px] uppercase tracking-wider block mt-0.5">{b.type} ward</span>
                    </div>

                    <div className="text-[10px] flex items-center justify-between border-t border-white/5 pt-1.5 mt-2">
                      <span className="capitalize">{b.status}</span>
                      {b.patient?.user?.name && <span className="font-bold truncate max-w-[60px]">{b.patient.user.name}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 2. Analytical Statistics Charts Tab */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Revenue chart */}
          <div className="glass-panel p-6 border-white/5">
            <h3 className="text-base font-bold font-display text-slate-100 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-medical-mint" />
              Monthly Revenue Performance
            </h3>
            <div className="h-64 flex items-center justify-center">
              <Bar data={revenueData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </div>

          {/* Department breakdown chart */}
          <div className="glass-panel p-6 border-white/5">
            <h3 className="text-base font-bold font-display text-slate-100 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-medical-mint" />
              Department Consult Distribution
            </h3>
            <div className="h-64 flex items-center justify-center">
              <Doughnut data={departmentData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalAdminDashboard;
