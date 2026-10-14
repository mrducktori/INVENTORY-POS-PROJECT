import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Dashboard from '../dashboard/Dashboard';
import { useLogin } from './useLogin';
import locPic from '../../assets/images/loc_pic.png';
import PageLoader from './PageLoader/PageLoader';

function LoginPage() {
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const {
    form,
    user,
    error,
    handleChange,
    handleSubmit,
    isLocked,
    countdown,
    attemptsLeft
  } = useLogin();

  // If already logged in, redirect to dashboard or render it
  if (user) {
    navigate('/dashboard');
    return null;
  }
  
  if (isInitialLoading) return <PageLoader />;

  const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  return (
    <div className="w-full h-screen bg-cover bg-center bg-fixed font-sans" style={{ backgroundImage: `url(${locPic})` }}>
      <div className="w-full h-full bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
        <div className="bg-[#121212] border border-[#2a2a2a] rounded-xl p-8 w-[90%] max-w-[400px] shadow-2xl text-white">
          <form onSubmit={handleSubmit}>
            <button 
              type="button"
              className="text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer mb-6 hover:text-white transition-colors inline-block m-0 bg-transparent border-none" 
              onClick={() => navigate('/')}
            >
              ← Back to Home
            </button>
            
            <div className="mb-8">
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2">Secure Access</div>
              <h2 className="text-2xl font-bold m-0 mb-1">Welcome back</h2>
              <p className="text-sm text-gray-400 m-0">Sign in to access the dashboard</p>
            </div>

            {/* Lockout Banner */}
            {isLocked && (
              <div className="flex gap-3 bg-[#332200] border border-[#ffaa00] text-[#ffaa00] p-4 rounded-lg mb-6">
                <span className="flex items-center justify-center pt-0.5">
                  <svg className="w-5 h-5 text-[#ffaa00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </span>
                <div>
                  <strong className="block text-sm mb-1 text-white">Account Temporarily Locked</strong>
                  <p className="text-xs m-0 text-white/80">Too many failed attempts. Please wait:</p>
                  <div className="font-mono text-sm font-bold mt-1">{fmt(countdown)}</div>
                </div>
              </div>
            )}

            {/* Error / Attempts Warning */}
            {!isLocked && error && (
              <div className="flex gap-3 bg-[#330000] border border-[#ff3333] text-[#ff3333] p-4 rounded-lg mb-6">
                <span className="flex items-center justify-center pt-0.5">
                  <svg className="w-5 h-5 text-[#ff3333]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </span>
                <div>
                  <strong className="block text-sm mb-1 text-white">Authentication Failed</strong>
                  <p className="text-xs m-0 text-white/80">
                    {error}
                    {attemptsLeft > 0 && attemptsLeft < 3 && (
                      <span className="ml-1 text-[#ff8888]">({attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} left)</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            <div className="mb-5">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Username</label>
              <input type="text" name="username"
                value={form.username}
                onChange={handleChange}
                disabled={isLocked}
                placeholder="Enter username"
                required
                className="w-full bg-[#1a1a1a] border border-[#333] text-white p-3 rounded-lg text-sm focus:outline-none focus:border-white transition-colors disabled:opacity-50"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Password</label>
              <input type="password" name="password"
                value={form.password}
                onChange={handleChange}
                disabled={isLocked}
                placeholder="Enter password"
                required
                className="w-full bg-[#1a1a1a] border border-[#333] text-white p-3 rounded-lg text-sm focus:outline-none focus:border-white transition-colors disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isLocked}
              className="w-full bg-white text-black font-bold uppercase tracking-widest text-xs py-3.5 rounded-lg border-none hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLocked ? `Locked (${fmt(countdown)})` : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
