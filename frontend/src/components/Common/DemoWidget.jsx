import React, { useContext, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { Shield, Sparkles, User, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';

const DemoWidget = () => {
  const { user, quickLogin, logout } = useContext(AuthContext);
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const roles = [
    { id: 'patient', name: 'Patient (John)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    { id: 'doctor', name: 'Doctor (Dr. Heart)', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
    { id: 'hospital_admin', name: 'Hospital Admin (Mark)', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    { id: 'laboratory', name: 'Laboratory (Lisa)', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    { id: 'pharmacy', name: 'Pharmacy (Philip)', color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
    { id: 'admin', name: 'Super Admin (System)', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' }
  ];

  const handleQuickLogin = async (roleId) => {
    setSwitching(true);
    await quickLogin(roleId);
    setSwitching(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="glass-panel border-medical-teal/30 shadow-2xl transition-all duration-300 overflow-hidden">
        {/* Widget Header */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between gap-3 px-4 py-3 w-64 bg-slate-900/80 hover:bg-slate-900 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-medical-mint animate-pulse-slow" />
            <span className="font-display font-semibold text-sm text-slate-200">Developer Demo Console</span>
          </div>
          {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
        </button>

        {/* Roles List */}
        {isOpen && (
          <div className="p-4 bg-darkbg-950/90 flex flex-col gap-2 max-h-96 overflow-y-auto custom-scrollbar border-t border-white/5">
            <p className="text-[11px] text-slate-400 mb-1 leading-relaxed">
              Use this widget to quickly switch roles and verify specific dashboard permissions and AI functions:
            </p>
            
            {switching ? (
              <div className="flex items-center justify-center py-6 gap-2 text-slate-300 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-medical-mint" />
                Switching accounts...
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => handleQuickLogin(role.id)}
                      className={`text-left text-xs px-3 py-2 rounded-lg border font-medium transition-all duration-200 hover:scale-[1.02] flex items-center justify-between ${
                        user?.role === role.id 
                          ? `${role.color} border-white/40 ring-1 ring-white/20 glow-border-teal` 
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <span>{role.name}</span>
                      {user?.role === role.id && <span className="w-1.5 h-1.5 rounded-full bg-medical-mint shadow-lg shadow-medical-mint"></span>}
                    </button>
                  ))}
                </div>

                {user && (
                  <button
                    onClick={logout}
                    className="mt-2 text-center text-xs text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 bg-rose-950/10 hover:bg-rose-950/20 py-1.5 rounded-lg transition-colors"
                  >
                    Logout Current Session
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DemoWidget;
