import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Dashboard from '../dashboard/Dashboard';
import { useLogin } from './hooks/useLogin';
import { getCmsImage } from '../../api/cmsApi';

const DEFAULT_HERO_IMAGE = 'https://zngerymqycuxpxdmfftj.supabase.co/storage/v1/object/public/cms-images/public/landing_hero-0.8481000269201046.jpg';

function LoginPage() {
  const [sessionNotice] = useState(() => {
    try {
      const expiredMsg = sessionStorage.getItem('session_expired_msg');
      if (!expiredMsg) return '';
      try {
        return JSON.parse(expiredMsg);
      } catch {
        return { title: 'Session Timed Out', message: expiredMsg };
      }
    } catch {
      return '';
    }
  });
  const [bgImage, setBgImage] = useState(DEFAULT_HERO_IMAGE);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      sessionStorage.removeItem('session_expired_msg');
    } catch {
      // ignore storage errors
    }

    getCmsImage('landing_hero', DEFAULT_HERO_IMAGE).then(setBgImage);
  }, []);

  const {
    form,
    user,
    error,
    handleChange,
    handleSubmit,
    isLocked,
    countdown,
    attemptsLeft,
    loading
  } = useLogin();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  if (user) return null;

  const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  return (
    <div className="w-full h-screen bg-cover bg-center bg-fixed font-sans" style={{ backgroundImage: `url(${bgImage})` }}>
      <div className="w-full h-full bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
        <div className="bg-[#121212] border border-[#2a2a2a] rounded-xl p-8 w-[90%] max-w-[400px] shadow-2xl text-white">
          <form onSubmit={handleSubmit}>
            <button 
              type="button"
              className="text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer mb-6 hover:text-white transition-colors inline-block m-0 bg-transparent border-none" 
              onClick={() => navigate('/')}
            >
              <span className="inline-flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Back to Home</span>
            </button>
            
            <div className="flex items-center gap-3.5 mb-6 pb-6 border-b border-zinc-800/80">
              <img 
                src="/favicon.svg" 
                alt="CofTea Logo" 
                className="w-11 h-11 rounded-xl object-contain bg-white p-1 border border-white/20 shrink-0 shadow-md" 
              />
              <div>
                <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest">COF/TEA CAFE</div>
                <div className="text-xs text-amber-300 font-bold tracking-wide">Staff &amp; Admin Console</div>
              </div>
            </div>

            <div className="mb-8">
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2">Secure Access</div>
              <h2 className="text-2xl font-bold m-0 mb-1">Welcome back</h2>
              <p className="text-sm text-gray-400 m-0">Sign in to access the dashboard</p>
            </div>

            {sessionNotice && !isLocked && !error && (
              <div className="flex gap-3 bg-[#132338] border border-[#38bdf8] text-[#7dd3fc] p-4 rounded-lg mb-6 shadow-lg">
                <span className="flex items-center justify-center pt-0.5">
                  <svg className="w-5 h-5 text-[#38bdf8]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
                <div>
                  <strong className="block text-sm mb-1 text-white">{sessionNotice.title || 'Session Notice'}</strong>
                  <p className="text-xs m-0 text-white/90">{sessionNotice.message || sessionNotice}</p>
                </div>
              </div>
            )}

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
                disabled={isLocked || loading}
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
                disabled={isLocked || loading}
                placeholder="Enter password"
                required
                className="w-full bg-[#1a1a1a] border border-[#333] text-white p-3 rounded-lg text-sm focus:outline-none focus:border-white transition-colors disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isLocked || loading}
              className="w-full bg-white text-black font-bold uppercase tracking-widest text-xs py-3.5 rounded-lg border-none hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isLocked ? `Locked (${fmt(countdown)})` : loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
