import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Heart, Mail, Lock, Eye, EyeOff, Sparkles, AlertCircle } from 'lucide-react';

const Login = ({ onNavigate }) => {
  const { login, register, loginWithGoogleMock, error, user } = useContext(AuthContext);
  
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Handle redirect if user becomes logged in
  useEffect(() => {
    if (user) {
      onNavigate('dashboard');
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || (isRegister && !name)) return;

    setSubmitting(true);
    let success = false;
    if (isRegister) {
      success = await register(name, email, password);
    } else {
      success = await login(email, password);
    }
    setSubmitting(false);
    if (success) {
      onNavigate('dashboard');
    }
  };

  const handleGoogleMock = async () => {
    setSubmitting(true);
    // Simulate google credentials
    const success = await loginWithGoogleMock(
      'google.reviewer@intellicare.com', 
      'Google Reviewer', 
      'google-oauth-id-123456789'
    );
    setSubmitting(false);
    if (success) {
      onNavigate('dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-darkbg-950 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-medical-teal/5 blur-[80px] animate-pulse-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-medical-indigo/5 blur-[80px] animate-pulse-slow"></div>

      <div className="w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-2 mb-8 cursor-pointer" onClick={() => onNavigate('landing')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-medical-teal to-medical-mint flex items-center justify-center shadow-lg shadow-medical-teal/20">
            <Heart className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-display font-extrabold text-2xl text-slate-100 tracking-tight">IntelliCare AI</h1>
          <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold -mt-1">Access Gateway</p>
        </div>

        {/* Auth Card */}
        <div className="glass-panel p-8 border-white/10 shadow-2xl relative">
          <h2 className="text-xl font-bold font-display text-slate-100 mb-6 text-center">
            {isRegister ? 'Create Patient Account' : 'Sign In to Portal'}
          </h2>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {isRegister && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Enter name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-darkbg-950/80 border border-white/10 focus:border-medical-teal rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-darkbg-950/80 border border-white/10 focus:border-medical-teal rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none transition-all placeholder:text-slate-600"
                />
                <Mail className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                {!isRegister && (
                  <button 
                    type="button" 
                    onClick={() => alert('Demo Mode: Click "Developer Demo Console" at bottom right corner to login instantly!')}
                    className="text-[10px] text-medical-mint font-semibold hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-darkbg-950/80 border border-white/10 focus:border-medical-teal rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-200 focus:outline-none transition-all placeholder:text-slate-600"
                />
                <Lock className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full py-2.5 bg-gradient-to-r from-medical-teal to-medical-mint text-white font-bold text-sm rounded-xl shadow-lg shadow-medical-teal/20 transition-all hover:opacity-95 flex items-center justify-center gap-2"
            >
              {submitting ? 'Authenticating...' : isRegister ? 'Register Account' : 'Verify & Enter'}
            </button>
          </form>

          {/* Social Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <span className="relative bg-darkbg-900 px-3 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
              Or Connect Securely With
            </span>
          </div>

          {/* Google OAuth Mock */}
          <button
            onClick={handleGoogleMock}
            disabled={submitting}
            className="w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.25.61 4.46 1.64l2.427-2.427C17.3 1.62 14.93 1 12.24 1 6.58 1 2 5.58 2 11.24s4.58 10.24 10.24 10.24c5.92 0 10.17-4.16 10.17-10.33 0-.61-.05-1.12-.17-1.61H12.24z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Account Swap Link */}
          <div className="mt-6 text-center">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-xs text-slate-400 hover:text-medical-mint font-medium transition-colors"
            >
              {isRegister ? 'Already have an account? Sign In' : 'New Patient? Create secure account'}
            </button>
          </div>
        </div>

        {/* Demo Account Indicator */}
        <div className="mt-4 text-center">
          <p className="text-[11px] text-slate-500 leading-normal">
            Evaluating options? Find the floating <Sparkles className="w-3.5 h-3.5 inline text-medical-mint mx-0.5" /> **Developer Demo Console** bubble at the bottom right corner to log in instantly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
