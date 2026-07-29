import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { 
  Heart, Activity, Calendar, FileText, ClipboardList, MessageSquare, 
  Layers, Package, Shield, Settings, LogOut, Search, UserCheck
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useContext(AuthContext);

  const getLinks = () => {
    switch (user?.role) {
      case 'patient':
        return [
          { id: 'overview', name: 'Health Hub', icon: Activity },
          { id: 'timeline', name: 'Medical Timeline', icon: FileText },
          { id: 'appointments', name: 'Appointments', icon: Calendar },
          { id: 'symptoms', name: 'Symptom Checker', icon: ClipboardList },
          { id: 'chat', name: 'AI Chat Assistant', icon: MessageSquare },
        ];
      case 'doctor':
        return [
          { id: 'appointments', name: 'Today\'s Roster', icon: Calendar },
          { id: 'patients', name: 'Patient Search', icon: Search },
          { id: 'prescribe', name: 'Prescription Lab', icon: ClipboardList },
        ];
      case 'hospital_admin':
        return [
          { id: 'beds', name: 'Bed Occupancy', icon: Layers },
          { id: 'analytics', name: 'Hospital Stats', icon: Activity },
        ];
      case 'laboratory':
        return [
          { id: 'upload', name: 'Upload Diagnostics', icon: FileText },
          { id: 'verify', name: 'Report Verification', icon: UserCheck },
        ];
      case 'pharmacy':
        return [
          { id: 'prescriptions', name: 'Dispense Queue', icon: ClipboardList },
          { id: 'inventory', name: 'Inventory Manager', icon: Package },
        ];
      case 'admin':
        return [
          { id: 'users', name: 'User Directory', icon: UserCheck },
          { id: 'logs', name: 'Security Audit Logs', icon: Shield },
        ];
      default:
        return [];
    }
  };

  const links = getLinks();

  return (
    <aside className="w-64 bg-darkbg-900 border-r border-white/5 flex flex-col justify-between shrink-0 h-screen sticky top-0">
      <div className="flex flex-col gap-6 py-6 px-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-medical-teal to-medical-mint flex items-center justify-center shadow-lg shadow-medical-teal/20">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-display font-bold text-lg text-slate-100 block tracking-tight">IntelliCare AI</span>
            <span className="text-[10px] text-medical-mint font-semibold uppercase tracking-wider block -mt-1">Care Engine 1.0</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 mt-4">
          <span className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Navigation</span>
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => setActiveTab(link.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? 'bg-medical-teal/10 text-medical-mint border border-medical-teal/20 shadow-md shadow-medical-teal/5' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-medical-mint' : 'text-slate-400'}`} />
                <span>{link.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-white/5 flex flex-col gap-3">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-white/10 font-bold font-display text-sm text-slate-200">
            {user?.name ? user.name[0] : 'U'}
          </div>
          <div className="overflow-hidden">
            <span className="text-sm font-semibold text-slate-200 block truncate leading-none">{user?.name || 'Guest User'}</span>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block truncate mt-0.5">{user?.role?.replace('_', ' ')}</span>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/10 border border-transparent hover:border-rose-500/10 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
