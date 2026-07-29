import React, { useState, useContext, useEffect } from 'react';
import { AuthProvider, AuthContext } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DemoWidget from './components/Common/DemoWidget';

const AppContent = () => {
  const [currentPage, setCurrentPage] = useState('landing');
  const { user } = useContext(AuthContext);

  // Automatically navigate to dashboard if user logs in
  useEffect(() => {
    if (user) {
      setCurrentPage('dashboard');
    } else {
      setCurrentPage('landing');
    }
  }, [user]);

  const renderPage = () => {
    switch (currentPage) {
      case 'landing':
        return <LandingPage onNavigate={setCurrentPage} />;
      case 'login':
        return <Login onNavigate={setCurrentPage} />;
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      default:
        return <LandingPage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-darkbg-950 text-slate-100 selection:bg-medical-teal selection:text-white font-sans antialiased">
      {renderPage()}
      {/* Globally render Floating Demo switch console */}
      <DemoWidget />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
