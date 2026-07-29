import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Common/Sidebar';
import Navbar from '../components/Common/Navbar';

// Sub-Dashboard Pages
import PatientDashboard from './PatientDashboard';
import DoctorDashboard from './DoctorDashboard';
import HospitalAdminDashboard from './HospitalAdminDashboard';
import LaboratoryDashboard from './LaboratoryDashboard';
import PharmacyDashboard from './PharmacyDashboard';
import SystemAdminDashboard from './SystemAdminDashboard';

const Dashboard = ({ onNavigate }) => {
  const { user, token } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('');

  // Protect Dashboard: redirect to login if no token
  useEffect(() => {
    if (!token) {
      onNavigate('login');
    }
  }, [token]);

  // Set default tab when user role changes
  useEffect(() => {
    if (user?.role) {
      const defaultTabs = {
        patient: 'overview',
        doctor: 'appointments',
        hospital_admin: 'beds',
        laboratory: 'upload',
        pharmacy: 'prescriptions',
        admin: 'users'
      };
      setActiveTab(defaultTabs[user.role] || 'overview');
    }
  }, [user]);

  const renderContent = () => {
    if (!user) return null;

    switch (user.role) {
      case 'patient':
        return <PatientDashboard activeTab={activeTab} />;
      case 'doctor':
        return <DoctorDashboard activeTab={activeTab} />;
      case 'hospital_admin':
        return <HospitalAdminDashboard activeTab={activeTab} />;
      case 'laboratory':
        return <LaboratoryDashboard activeTab={activeTab} />;
      case 'pharmacy':
        return <PharmacyDashboard activeTab={activeTab} />;
      case 'admin':
        return <SystemAdminDashboard activeTab={activeTab} />;
      default:
        return (
          <div className="p-8 text-center text-slate-400">
            Unauthorized role or unknown portal profile.
          </div>
        );
    }
  };

  return (
    <div className="flex bg-darkbg-950 min-h-screen text-slate-100 relative">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar activeTab={activeTab} />
        
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-darkbg-950">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
