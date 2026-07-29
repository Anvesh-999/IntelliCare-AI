import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Package, ClipboardList, Plus, Search, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';

const PharmacyDashboard = ({ activeTab }) => {
  const { token, API_BASE } = useContext(AuthContext);
  
  // States
  const [prescriptions, setPrescriptions] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [loadingPre, setLoadingPre] = useState(false);
  
  // Add Inventory form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedForm, setNewMedForm] = useState('Tablet');
  const [newMedQty, setNewMedQty] = useState(100);
  const [newMedPrice, setNewMedPrice] = useState(10.0);
  const [newMedLoc, setNewMedLoc] = useState('');
  const [addingInv, setAddingInv] = useState(false);

  const loadPrescriptions = async () => {
    setLoadingPre(true);
    try {
      const res = await fetch(`${API_BASE}/inventory/prescriptions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPrescriptions(data.prescriptions);
      }
    } catch (e) { console.error('Prescriptions load failed:', e); }
    setLoadingPre(false);
  };

  const loadInventory = async () => {
    setLoadingInv(true);
    try {
      const res = await fetch(`${API_BASE}/inventory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setInventory(data.medicines);
      }
    } catch (e) { console.error('Inventory load failed:', e); }
    setLoadingInv(false);
  };

  useEffect(() => {
    if (token) {
      loadPrescriptions();
      loadInventory();
    }
  }, [token]);

  const handleFillPrescription = async (id) => {
    if (!window.confirm('Dispense medications and fill prescription? Stock counts will adjust.')) return;
    try {
      const res = await fetch(`${API_BASE}/inventory/prescriptions/${id}/fill`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        alert('Prescription marked as filled and stock adjusted!');
        loadPrescriptions();
        loadInventory();
      } else {
        alert(data.message || 'Dispense failed');
      }
    } catch (e) { console.error(e); }
  };

  const handleAddMedicine = async (e) => {
    e.preventDefault();
    if (!newMedName || newMedPrice <= 0) return;

    setAddingInv(true);
    try {
      const res = await fetch(`${API_BASE}/inventory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newMedName,
          dosageForm: newMedForm,
          stockQuantity: newMedQty,
          price: newMedPrice,
          location: newMedLoc
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Medicine added to inventory!');
        setShowAddForm(false);
        setNewMedName('');
        setNewMedQty(100);
        setNewMedPrice(10.0);
        setNewMedLoc('');
        loadInventory();
      } else {
        alert(data.message || 'Add failed');
      }
    } catch (e) { console.error(e); }
    setAddingInv(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Add Inventory Modal Overlay */}
      {showAddForm && (
        <div className="fixed inset-0 bg-darkbg-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md border-white/10 p-6 animate-fade-in">
            <h3 className="text-base font-bold font-display text-slate-100 mb-4">Add Medicine Stock</h3>
            
            <form onSubmit={handleAddMedicine} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase">Chemical Name</label>
                <input
                  type="text"
                  placeholder="e.g. Atorvastatin"
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  required
                  className="w-full bg-darkbg-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-medical-teal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Form</label>
                  <select
                    value={newMedForm}
                    onChange={(e) => setNewMedForm(e.target.value)}
                    className="w-full bg-darkbg-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-medical-teal"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Inhaler">Inhaler</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newMedPrice}
                    onChange={(e) => setNewMedPrice(e.target.value)}
                    required
                    className="w-full bg-darkbg-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-medical-teal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Initial Quantity</label>
                  <input
                    type="number"
                    value={newMedQty}
                    onChange={(e) => setNewMedQty(e.target.value)}
                    required
                    className="w-full bg-darkbg-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-medical-teal"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase">Shelf Location</label>
                  <input
                    type="text"
                    placeholder="Rack A-12"
                    value={newMedLoc}
                    onChange={(e) => setNewMedLoc(e.target.value)}
                    className="w-full bg-darkbg-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-medical-teal"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-xl text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingInv}
                  className="px-4 py-2 bg-gradient-to-r from-medical-teal to-medical-mint text-white font-bold text-xs rounded-xl shadow-lg"
                >
                  {addingInv ? 'Saving Medicine...' : 'Add Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. Dispense Queue Tab */}
      {activeTab === 'prescriptions' && (
        <div className="glass-panel p-6 border-white/5 max-w-4xl mx-auto flex flex-col gap-4 animate-fade-in w-full">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h3 className="text-base font-bold font-display text-slate-100 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-medical-mint" />
              Patient Dispense Queue
            </h3>
            <button 
              onClick={loadPrescriptions}
              className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-slate-400"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {prescriptions.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No prescriptions waiting for pickup.</p>
            ) : (
              prescriptions.map(p => (
                <div key={p._id} className="glass-panel p-4 border-white/5 flex flex-col sm:flex-row justify-between gap-4 animate-fade-in">
                  <div>
                    <h4 className="font-bold text-sm text-slate-200">Patient: {p.patient?.user?.name || 'Standard Patient'}</h4>
                    <span className="text-[10px] text-slate-500 block">Issued by: Dr. {p.doctor?.user?.name} on {new Date(p.date).toLocaleDateString()}</span>
                    
                    {/* Medicines List */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.medicines.map((m, idx) => (
                        <span key={idx} className="text-xs bg-white/5 border border-white/5 px-2.5 py-1 rounded-xl text-slate-300">
                          {m.name} - {m.dosage} ({m.frequency})
                        </span>
                      ))}
                    </div>

                    {p.interactionCheck && p.interactionCheck.checked && p.interactionCheck.hasInteractions && (
                      <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg w-fit">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>AI Warning: Contains potential drug interactions! Double-check with pharmacist.</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded border uppercase mr-2 ${
                      p.status === 'filled' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                    }`}>
                      {p.status}
                    </span>

                    {p.status !== 'filled' && (
                      <button
                        onClick={() => handleFillPrescription(p._id)}
                        className="px-4 py-2 bg-gradient-to-r from-medical-teal to-medical-mint text-white text-xs font-bold rounded-xl shadow-md"
                      >
                        Dispense & Fill
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. Inventory Manager Tab */}
      {activeTab === 'inventory' && (
        <div className="glass-panel p-6 border-white/5 max-w-4xl mx-auto flex flex-col gap-4 animate-fade-in w-full">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <h3 className="text-base font-bold font-display text-slate-100 flex items-center gap-2">
              <Package className="w-5 h-5 text-medical-mint" />
              Medication Stock Registry
            </h3>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setShowAddForm(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-medical-teal to-medical-mint text-white text-xs font-bold rounded-xl flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Medicine
              </button>
              <button 
                onClick={loadInventory}
                className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-slate-400"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table display */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-slate-400">
                  <th className="py-2.5 font-bold uppercase text-[10px]">Name</th>
                  <th className="py-2.5 font-bold uppercase text-[10px]">Form</th>
                  <th className="py-2.5 font-bold uppercase text-[10px]">Stock</th>
                  <th className="py-2.5 font-bold uppercase text-[10px]">Price</th>
                  <th className="py-2.5 font-bold uppercase text-[10px]">Rack Location</th>
                  <th className="py-2.5 font-bold uppercase text-[10px] text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingInv ? (
                  <tr><td colSpan="6" className="py-8 text-center text-slate-500">Loading catalog stocks...</td></tr>
                ) : inventory.length === 0 ? (
                  <tr><td colSpan="6" className="py-8 text-center text-slate-500">No stocks seeded in database</td></tr>
                ) : (
                  inventory.map(med => {
                    let statusClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                    if (med.status === 'lowstock') statusClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                    if (med.status === 'outofstock') statusClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';

                    return (
                      <tr key={med._id} className="border-b border-white/5 last:border-none hover:bg-white/5 transition-colors">
                        <td className="py-3 font-semibold text-slate-200">{med.name}</td>
                        <td className="py-3 text-slate-400">{med.dosageForm}</td>
                        <td className="py-3 font-bold text-slate-300">{med.stockQuantity} units</td>
                        <td className="py-3 text-slate-400">${med.price.toFixed(2)}</td>
                        <td className="py-3 text-slate-400">{med.location || 'N/A'}</td>
                        <td className="py-3 text-right">
                          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${statusClass}`}>
                            {med.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PharmacyDashboard;
