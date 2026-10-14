import { useState, useEffect, useRef } from 'react';
import { loginUser, saveUser, getCurrentUser } from '../../api/authApi.js';

const MAX_ATTEMPTS   = 3;
const LOCK_MS        = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY    = 'login_lockout';

// ── localStorage helpers ──────────────────────────────────────────────────────
function getRecord(username) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return all[username.toLowerCase()] || { attempts: 0, lockedUntil: null };
  } catch { return { attempts: 0, lockedUntil: null }; }
}

function saveRecord(username, record) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    all[username.toLowerCase()] = record;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

function clearRecord(username) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    delete all[username.toLowerCase()];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

function secondsLeft(record) {
  if (!record.lockedUntil) return 0;
  return Math.max(0, Math.ceil((record.lockedUntil - Date.now()) / 1000));
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useLogin = () => {
  const [form, setForm]         = useState({ username: '', password: '' });
  const [user, setUser]         = useState(getCurrentUser());
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [isMenuZoomed, setIsMenuZoomed] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const timerRef = useRef(null);

  const isLocked = countdown > 0;

  // Tick countdown once per second
  useEffect(() => {
    if (countdown <= 0) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [countdown]);

  const toggleModal = () => {
    // When opening, sync countdown from localStorage for the typed username
    setFormOpen(f => !f);
  };
  const toggleZoom = () => setIsMenuZoomed(z => !z);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));

    // Live-sync lockout state when username field changes
    if (name === 'username' && value.trim()) {
      const rec = getRecord(value.trim());
      const secs = secondsLeft(rec);
      setCountdown(secs);
      setAttemptsLeft(secs > 0 ? 0 : MAX_ATTEMPTS - rec.attempts);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const username = form.username.trim();
    if (!username) return;

    // Check local lockout before hitting the server
    const rec = getRecord(username);
    const secs = secondsLeft(rec);
    if (secs > 0) { setCountdown(secs); return; }

    setError('');
    setLoading(true);
    
    // Artificial delay so login doesn't feel instantly abrupt
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      const data = await loginUser(username, form.password);
      clearRecord(username);
      setCountdown(0);
      setAttemptsLeft(MAX_ATTEMPTS);
      saveUser(data);
      setUser(data);
    } catch (err) {
      // Increment local attempt counter
      const fresh = getRecord(username);
      // Reset if previous lock expired
      if (fresh.lockedUntil && fresh.lockedUntil <= Date.now()) {
        fresh.attempts = 0; fresh.lockedUntil = null;
      }
      fresh.attempts = (fresh.attempts || 0) + 1;
      const remaining = MAX_ATTEMPTS - fresh.attempts;

      if (fresh.attempts >= MAX_ATTEMPTS) {
        fresh.lockedUntil = Date.now() + LOCK_MS;
        saveRecord(username, fresh);
        setCountdown(Math.ceil(LOCK_MS / 1000));
        setAttemptsLeft(0);
        setError('');
      } else {
        saveRecord(username, fresh);
        setAttemptsLeft(remaining);
        setError(err.message || 'Invalid username or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    form, user, error, loading, formOpen, isMenuZoomed,
    isLocked, countdown, attemptsLeft,
    toggleModal, toggleZoom, handleChange, handleSubmit
  };
};
