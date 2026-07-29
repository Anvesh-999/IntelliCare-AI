import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Heart, Sparkles, Shield, Brain, Activity, User, ArrowRight } from 'lucide-react';

const LandingPage = ({ onNavigate }) => {
  const { quickLogin } = useContext(AuthContext);

  const demoRoles = [
    { id: 'patient', name: 'Patient Portal', desc: 'Medical records, timeline, wellness coaches, appointment scheduling, and secure AI Assistant.', color: 'from-emerald-500 to-teal-600', text: 'emerald' },
    { id: 'doctor', name: 'Doctor Dashboard', desc: 'Roster timelines, clinical records generator, and real-time AI drug interaction scanner.', color: 'from-indigo-500 to-purple-600', text: 'indigo' },
    { id: 'hospital_admin', name: 'Hospital Operations', desc: 'ICU & ward bed maps, department statistics, and hospital operational data analytics.', color: 'from-amber-500 to-orange-600', text: 'amber' },
    { id: 'laboratory', name: 'Diagnostic Lab', desc: 'Diagnostic report compilation, electronic document uploads, and signature verification.', color: 'from-purple-500 to-fuchsia-600', text: 'purple' },
    { id: 'pharmacy', name: 'Smart Pharmacy', desc: 'Dispensing queues, prescription logs, and interactive medication inventory manager.', color: 'from-teal-500 to-cyan-600', text: 'teal' },
    { id: 'admin', name: 'System Security', desc: 'Real-time audit log inspector, user registry levels, and system health monitors.', color: 'from-rose-500 to-pink-600', text: 'rose' }
  ];

  const handleDemoClick = async (role) => {
    const success = await quickLogin(role);
    if (success) {
      onNavigate('dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-darkbg-950 flex flex-col relative overflow-hidden">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-medical-teal/10 blur-[120px] animate-pulse-slow"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-medical-indigo/10 blur-[120px] animate-pulse-slow"></div>

      {/* Header */}
      <header className="container mx-auto px-6 h-20 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-medical-teal to-medical-mint flex items-center justify-center shadow-lg shadow-medical-teal/20">
            <Heart className="w-5.5 h-5.5 text-white" />
          </div>
          <span className="font-display font-bold text-xl text-slate-100 tracking-tight">IntelliCare AI</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('login')} 
            className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all text-slate-300"
          >
            Access Portal
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-12 md:py-20 text-center flex flex-col items-center gap-6 z-10 relative">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-medical-teal/10 border border-medical-teal/20 text-xs font-semibold text-medical-mint animate-fade-in">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Next-Generation Healthcare Ecosystem</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-200 to-medical-mint max-w-3xl leading-tight">
          Your Intelligent Digital Healthcare Companion.
        </h1>

        <p className="text-slate-400 text-base md:text-lg max-w-2xl leading-relaxed">
          A secure, AI-powered health network designed to centralize medical history, automate clinical charts, organize bed grids, and empower patients with cognitive health insights.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-4">
          <button 
            onClick={() => onNavigate('login')}
            className="px-8 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-medical-teal to-medical-mint text-white shadow-lg shadow-medical-teal/20 hover:opacity-90 transform active:scale-95 transition-all flex items-center gap-2 glow-button"
          >
            <span>Launch Health Portal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Demo Portal Panels */}
      <section className="container mx-auto px-6 py-12 z-10 relative">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold font-display text-slate-100 mb-2">Explore the Ecosystem Modules</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Click any module below to instantly launch the pre-seeded demo dashboard with full permissions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {demoRoles.map((role) => (
            <button
              key={role.id}
              onClick={() => handleDemoClick(role.id)}
              className="glass-panel glass-panel-hover text-left p-6 flex flex-col justify-between h-60 relative group"
            >
              <div>
                {/* Glowing Circle */}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${role.color} flex items-center justify-center shadow-lg mb-4 text-white group-hover:scale-110 transition-transform`}>
                  <Brain className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold font-display text-slate-100 group-hover:text-medical-mint transition-colors mb-2">
                  {role.name}
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  {role.desc}
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-medical-mint font-semibold mt-4">
                <span>Access Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Stats / Info Section */}
      <section className="border-t border-white/5 bg-darkbg-900/40 py-12 z-10 relative mt-auto">
        <div className="container mx-auto px-6 max-w-5xl flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Evaluated by Leadership at</span>
            <span className="text-slate-300 text-xs font-semibold uppercase tracking-wider block mt-1">Google • Amazon • Microsoft • Salesforce • Adobe</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-medical-mint" />
              <span className="text-xs text-slate-400">HIPAA Compliant Standard</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-medical-mint" />
              <span className="text-xs text-slate-400">99.9% Uptime SLA</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
