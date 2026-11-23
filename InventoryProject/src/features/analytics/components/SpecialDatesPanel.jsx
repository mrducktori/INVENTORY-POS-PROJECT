import React, { useState, useEffect, useCallback } from 'react';
import { getSpecialDates, createSpecialDate, deleteSpecialDate } from '../../../api/analyticsApi';
import { getCurrentUser } from '../../../utils/authUtils';

const EFFECTS = {
  BUSIER: { label: 'Busier', cls: 'bg-emerald-100 text-emerald-700' },
  SLOWER: { label: 'Slower', cls: 'bg-amber-100 text-amber-700' },
  UNSURE: { label: 'Unsure', cls: 'bg-zinc-100 text-zinc-600' },
};

const fmt = (d) =>
  new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

const range = (r) =>
  !r.end_date || r.end_date === r.start_date ? fmt(r.start_date) : `${fmt(r.start_date)} - ${fmt(r.end_date)}`;

const EMPTY = { label: '', start_date: '', end_date: '', effect: 'BUSIER' };
const inputCls = 'px-2.5 py-1.5 rounded-lg border border-zinc-200 text-sm bg-white';

const SpecialDatesPanel = () => {
  const canEdit = ['Owner', 'Admin'].includes(getCurrentUser()?.role);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await getSpecialDates());
      setLoadError('');
    } catch (e) {
      setLoadError(e.message || 'Could not load special dates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (fn, onOk) => {
    setSaving(true);
    setError('');
    try {
      await fn();
      onOk?.();
      await load();
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    const payload = { label: form.label.trim(), start_date: form.start_date, effect: form.effect };
    if (form.end_date) payload.end_date = form.end_date;
    run(() => createSpecialDate(payload), () => setForm(EMPTY));
  };

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
      <div>
        <h2 className="text-base font-bold text-zinc-900 m-0">Special dates (tell the AI)</h2>
        <p className="text-sm text-zinc-500 mt-1 mb-0">
          Exam weeks, class suspensions, school breaks and events: the AI may adjust forecasts by up to 10%.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 m-0">Loading...</p>
      ) : loadError ? (
        <p className="text-sm text-red-600 m-0">{loadError}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500 m-0">No special dates yet.</p>
      ) : (
        <ul className="list-none p-0 m-0 divide-y divide-zinc-100">
          {rows.map((r) => {
            const past = String(r.end_date || r.start_date).slice(0, 10) < today;
            const eff = EFFECTS[r.effect] || EFFECTS.UNSURE;
            return (
              <li key={r.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2 ${past ? 'opacity-50' : ''}`}>
                <span className="text-sm font-semibold text-zinc-900">{r.label}</span>
                <span className="text-xs text-zinc-500">{range(r)}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${eff.cls}`}>{eff.label}</span>
                {canEdit && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => run(() => deleteSpecialDate(r.id))}
                    className="ml-auto text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50 cursor-pointer bg-transparent border-none"
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 pt-2 border-t border-zinc-100">
          <input required maxLength={80} placeholder="e.g. Midterm exams" aria-label="Label" value={form.label} onChange={set('label')} className={`${inputCls} flex-1 min-w-40`} />
          <label className="text-xs text-zinc-500 flex flex-col gap-0.5">Start
            <input required type="date" value={form.start_date} onChange={set('start_date')} className={inputCls} />
          </label>
          <label className="text-xs text-zinc-500 flex flex-col gap-0.5">End (optional)
            <input type="date" min={form.start_date} value={form.end_date} onChange={set('end_date')} className={inputCls} />
          </label>
          <select aria-label="Effect" value={form.effect} onChange={set('effect')} className={inputCls}>
            <option value="BUSIER">Busier</option>
            <option value="SLOWER">Slower</option>
            <option value="UNSURE">Not sure</option>
          </select>
          <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer border-none">
            {saving ? 'Saving...' : 'Add'}
          </button>
          {error && <p className="basis-full text-sm text-red-600 m-0">{error}</p>}
        </form>
      )}
      {!canEdit && error && <p className="text-sm text-red-600 m-0">{error}</p>}
    </div>
  );
};

export default SpecialDatesPanel;
