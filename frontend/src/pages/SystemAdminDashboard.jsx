import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Shield, ShieldAlert, User, Clock, RefreshCw, Terminal, Activity, Server } from 'lucide-react';

const SystemAdminDashboard = ({ activeTab }) => {
  const { token, API_BASE } = useContext(AuthContext);
  
  // States
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (e) { console.error('Users load failed:', e); }
    setLoadingUsers(false);
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`${API_BASE}/admin/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (e) { console.error('Logs load failed:', e); }
    setLoadingLogs(false);
  };

  useEffect(() => {
    if (token) {
      loadUsers();
      loadLogs();
    }
  }, [token]);

  const handleUpdateRole = async (userId, newRole) => {
    if (!confirm(`Are you sure you want to change this user's role to '${newRole}'?`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (data.success) {
        alert('User role updated successfully.');
        loadUsers();
        loadLogs();
      } else {
        alert(data.message || 'Update failed');
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. User Directory Tab */}
      {activeTab === 'users' && (
        <div className="glass-panel p-6 border-white/5 max-w-4xl mx-auto flex flex-col gap-4 animate-fade-in w-full">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <div>
              <h3 className="text-base font-bold font-display text-slate-100 flex items-center gap-2">
                <User className="w-5 h-5 text-medical-mint" />
                Hospital User Accounts Directory
              </h3>
              <span className="text-[10px] text-slate-400 block mt-0.5">Manage employee clearance and system credentials.</span>
            </div>
            
            <button 
              onClick={loadUsers}
              className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-slate-400"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Directory Table */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-slate-400">
                  <th className="py-2.5 font-bold uppercase text-[10px]">Name</th>
                  <th className="py-2.5 font-bold uppercase text-[10px]">Email</th>
                  <th className="py-2.5 font-bold uppercase text-[10px]">Security Clearance Role</th>
                  <th className="py-2.5 font-bold uppercase text-[10px] text-right">Clearance Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr><td colSpan="4" className="py-8 text-center text-slate-500">Loading catalog accounts...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan="4" className="py-8 text-center text-slate-500">No accounts registered in database</td></tr>
                ) : (
                  users.map(u => (
                    <tr key={u._id} className="border-b border-white/5 last:border-none hover:bg-white/5 transition-colors">
                      <td className="py-3 font-semibold text-slate-200">{u.name}</td>
                      <td className="py-3 text-slate-400">{u.email}</td>
                      <td className="py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${
                          u.role === 'admin' 
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                            : u.role === 'doctor'
                              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                              : u.role === 'patient'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u._id, e.target.value)}
                          className="bg-darkbg-950 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none"
                        >
                          <option value="patient">Patient</option>
                          <option value="doctor">Doctor</option>
                          <option value="hospital_admin">Hospital Admin</option>
                          <option value="laboratory">Laboratory</option>
                          <option value="pharmacy">Pharmacy</option>
                          <option value="admin">System Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Security Audit Logs Tab */}
      {activeTab === 'logs' && (
        <div className="glass-panel p-6 border-white/5 max-w-4xl mx-auto flex flex-col gap-4 animate-fade-in w-full">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h3 className="text-base font-bold font-display text-slate-100 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-medical-mint" />
              Real-time System Audit Console
            </h3>
            
            <button 
              onClick={loadLogs}
              className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-slate-400"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Scrolling log container */}
          <div className="bg-darkbg-950 border border-white/10 rounded-xl p-4 font-mono text-[10px] text-slate-400 h-96 overflow-y-auto custom-scrollbar flex flex-col gap-2 shadow-inner">
            <div className="flex items-center gap-2 text-medical-mint font-semibold border-b border-white/5 pb-2 mb-2">
              <Server className="w-3.5 h-3.5" />
              <span>IntelliCare System Audit Logging Active [PORT 5000]</span>
            </div>

            {loadingLogs ? (
              <p className="text-slate-500 py-6 text-center">Tailing log streams...</p>
            ) : logs.length === 0 ? (
              <p className="text-slate-500 py-6 text-center">No security audit logs records</p>
            ) : (
              logs.map(log => (
                <div key={log._id} className="hover:text-slate-200 transition-colors">
                  <span className="text-slate-500">[{new Date(log.timestamp).toISOString()}]</span>{' '}
                  <span className="text-medical-mint font-semibold">{log.action}</span>{' '}
                  <span className="text-slate-500">({log.email || 'SYSTEM'}):</span>{' '}
                  <span className="text-slate-300">{log.details}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemAdminDashboard;
