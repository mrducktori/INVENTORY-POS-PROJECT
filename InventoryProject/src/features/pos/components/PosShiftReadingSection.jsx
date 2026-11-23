import React, { useState, useEffect, useCallback } from 'react';
import {
  getCurrentShift,
  openShift,
  getXReading,
  closeShiftZReading,
  getShiftHistory
} from '../../../api/posApi';
import { formatReceiptDateTime, printShiftReading } from '../../../utils/receiptPrint';
import { round2, formatPeso } from '../../../utils/money';

const PosShiftReadingSection = ({ user }) => {
  const [currentShift, setCurrentShift] = useState(null);
  const [xReading, setXReading] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openingCash, setOpeningCash] = useState('0');
  const [openNotes, setOpenNotes] = useState('');
  const [openingSubmitting, setOpeningSubmitting] = useState(false);

  const [actualCashCounted, setActualCashCounted] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closingSubmitting, setClosingSubmitting] = useState(false);
  const [lastZReading, setLastZReading] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadShiftState = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [curRes, readRes, histRes] = await Promise.all([
        getCurrentShift().catch(() => null),
        getXReading().catch(() => null),
        getShiftHistory().catch(() => ({ shifts: [] }))
      ]);

      const active = curRes?.shift !== undefined ? curRes.shift : curRes;
      setCurrentShift(active && active.status === 'OPEN' ? active : null);

      const reading = readRes?.reading || readRes || null;
      setXReading(reading);

      const histList = Array.isArray(histRes)
        ? histRes
        : (histRes?.shifts || histRes?.data || []);
      setHistory(histList);
    } catch (err) {
      setError(err?.message || 'Failed to load shift details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShiftState();
  }, [loadShiftState]);

  const handleOpenShift = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const cash = parseFloat(openingCash);
    if (Number.isNaN(cash) || cash < 0 || cash > 1000000) {
      setError('Opening cash must be between ₱0.00 and ₱1,000,000.');
      return;
    }

    setOpeningSubmitting(true);
    try {
      await openShift({
        opening_cash: round2(cash),
        notes: openNotes.trim()
      });
      setSuccess('Register shift opened successfully.');
      setOpenNotes('');
      setLastZReading(null);
      await loadShiftState();
    } catch (err) {
      setError(err?.message || 'Failed to open shift.');
    } finally {
      setOpeningSubmitting(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!currentShift) return;
    setError('');
    setSuccess('');

    const counted = parseFloat(actualCashCounted);
    if (Number.isNaN(counted) || counted < 0 || counted > 1000000) {
      setError('Actual cash counted must be between ₱0.00 and ₱1,000,000.');
      return;
    }

    setClosingSubmitting(true);
    try {
      const res = await closeShiftZReading({
        shift_id: currentShift.id,
        actual_cash_counted: round2(counted),
        notes: closeNotes.trim()
      });
      const zReport = res?.summary ? { ...res, ...res.summary } : (res?.z_reading || res?.reading || res?.shift || res);
      setLastZReading(zReport);
      setActualCashCounted('');
      setCloseNotes('');
      setSuccess('Shift closed and Z-Reading recorded.');
      await loadShiftState();
    } catch (err) {
      setError(err?.message || 'Failed to close shift.');
    } finally {
      setClosingSubmitting(false);
    }
  };

  const expectedDrawerCash = Number(xReading?.expected_drawer_cash ?? 0);
  const hasExpected = xReading?.expected_drawer_cash != null;
  const actualNum = parseFloat(actualCashCounted);
  const hasActualPreview = hasExpected && actualCashCounted !== '' && !Number.isNaN(actualNum);
  const shortOverPreview = hasActualPreview ? round2(actualNum - expectedDrawerCash) : null;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="m-0 text-base font-bold text-gray-900">Shift Management & Cash Drawer (X/Z Reading)</h3>
          <p className="m-0 text-xs text-gray-500 mt-0.5">
            Track live drawer totals, print interim X-Readings, and reconcile closing Z-Readings.
          </p>
        </div>
        <button
          type="button"
          onClick={loadShiftState}
          disabled={loading}
          className="px-3.5 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 cursor-pointer"
        >
          {loading ? 'Refreshing...' : 'Refresh Readings'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
          {success}
        </div>
      )}

      {lastZReading && (
        <div className="p-4 bg-white border-2 border-gray-900 rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 text-xs">
            <div className="font-bold text-gray-900 uppercase tracking-wider">Latest Z-Reading Summary</div>
            <div className="text-gray-600">
              Expected Drawer: <strong className="font-mono text-gray-900">{formatPeso(lastZReading.expected_drawer_cash)}</strong> | Counted:{' '}
              <strong className="font-mono text-gray-900">{formatPeso(lastZReading.actual_cash_counted)}</strong> | Short/Over:{' '}
              <strong
                className={`font-mono ${
                  Number(lastZReading.short_over || 0) < 0 ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                {Number(lastZReading.short_over || 0) >= 0 ? '+' : ''}
                {formatPeso(lastZReading.short_over)}
              </strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => printShiftReading(lastZReading, lastZReading, { title: 'Z-READING REPORT' })}
            className="px-3.5 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-bold cursor-pointer"
          >
            Print Z-Reading
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Live X-Reading Breakdown */}
        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-xl shadow-xs p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Live Interim Report</div>
              <h4 className="m-0 text-base font-bold text-gray-900">X-Reading Breakdown</h4>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase border ${
                  currentShift
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                {currentShift ? 'Shift Open' : 'No Open Shift'}
              </span>
              {xReading && (
                <button
                  type="button"
                  onClick={() => printShiftReading(xReading, currentShift, { title: 'X-READING REPORT' })}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-800 cursor-pointer"
                >
                  Print X-Reading
                </button>
              )}
            </div>
          </div>

          {currentShift && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-wrap justify-between gap-2 text-xs text-gray-600">
              <span>
                Cashier: <strong className="text-gray-900">{currentShift.cashier_name || currentShift.opened_by_name || user?.name || 'Staff'}</strong>
              </span>
              <span>
                Opened: <strong className="text-gray-900">{formatReceiptDateTime(currentShift.opened_at)}</strong>
              </span>
              <span>
                Opening Float: <strong className="font-mono text-gray-900">{formatPeso(currentShift.opening_cash)}</strong>
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Cash Sales', val: xReading?.cash_sales },
              { label: 'GCash', val: xReading?.gcash_sales },
              { label: 'Maya', val: xReading?.maya_sales },
              { label: 'Card', val: xReading?.card_sales },
              { label: 'QRPH', val: xReading?.qrph_sales },
              { label: 'Discounts', val: xReading?.total_discounts }
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{item.label}</div>
                <div className="text-sm font-bold font-mono text-gray-900 mt-1">{formatPeso(item.val)}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200">
              <div className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Voided / Refunded</div>
              <div className="text-sm font-bold text-red-800 mt-1 font-mono">
                {Number(xReading?.voided_count || 0)} txns ({formatPeso(xReading?.voided_amount)})
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-gray-900 text-white">
              <div className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">Expected Drawer Cash</div>
              <div className="text-lg font-extrabold font-mono mt-1">{hasExpected ? formatPeso(expectedDrawerCash) : '—'}</div>
            </div>
          </div>
        </div>

        {/* Right: Open Shift OR Close Shift Z-Reading */}
        <div className="lg:col-span-5 bg-white border border-gray-200 rounded-xl shadow-xs p-5 space-y-4">
          {!currentShift ? (
            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
                <h4 className="m-0 text-sm font-bold text-gray-900">Open Register Shift</h4>
                <p className="m-0 text-xs text-gray-500 mt-0.5">
                  Record the starting cash float before taking register payments.
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Opening Cash Float (₱)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base font-mono font-bold focus:outline-none focus:ring-2 focus:ring-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Shift Notes (Optional)
                </label>
                <input
                  type="text"
                  maxLength={300}
                  placeholder="Morning counter float..."
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <button
                type="submit"
                disabled={openingSubmitting}
                className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50"
              >
                {openingSubmitting ? 'Opening Shift...' : 'Open Shift'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCloseShift} className="space-y-4">
              <div>
                <h4 className="m-0 text-sm font-bold text-gray-900">Close Shift (Z-Reading)</h4>
                <p className="m-0 text-xs text-gray-500 mt-0.5">
                  Count physical cash in the drawer to compute Short / Over and close this shift.
                </p>
              </div>

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex justify-between items-center text-xs">
                <span className="font-semibold text-gray-600">Expected Drawer Cash</span>
                <span className="font-mono font-bold text-gray-900 text-sm">{hasExpected ? formatPeso(expectedDrawerCash) : '—'}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Actual Cash Counted (₱)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  placeholder="0.00"
                  value={actualCashCounted}
                  onChange={(e) => setActualCashCounted(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base font-mono font-bold focus:outline-none focus:ring-2 focus:ring-gray-900"
                  required
                />
              </div>

              {hasActualPreview && (
                <div
                  className={`p-3 rounded-xl border flex justify-between items-center text-xs font-bold ${
                    shortOverPreview < -0.01
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : shortOverPreview > 0.01
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <span>Live Short / Over Preview</span>
                  <span className="font-mono text-sm">
                    {shortOverPreview >= 0 ? '+' : ''}
                    {formatPeso(shortOverPreview)}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Closing Notes (Optional)
                </label>
                <input
                  type="text"
                  maxLength={300}
                  placeholder="Drawer reconciled by..."
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <button
                type="submit"
                disabled={closingSubmitting}
                className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50"
              >
                {closingSubmitting ? 'Closing Shift...' : 'Close Shift & Generate Z-Reading'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Shift History Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-200">
          <h4 className="m-0 text-sm font-bold text-gray-900">Shift History</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Cashier</th>
                <th className="py-2.5 px-4 font-semibold">Opened At</th>
                <th className="py-2.5 px-4 font-semibold">Closed At</th>
                <th className="py-2.5 px-4 font-semibold text-right">Opening Cash</th>
                <th className="py-2.5 px-4 font-semibold text-right">Expected</th>
                <th className="py-2.5 px-4 font-semibold text-right">Counted</th>
                <th className="py-2.5 px-4 font-semibold text-right">Short / Over</th>
                <th className="py-2.5 px-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    No recorded shifts yet.
                  </td>
                </tr>
              ) : (
                history.map((s) => {
                  const shortOver = s.short_over !== undefined && s.short_over !== null ? Number(s.short_over) : null;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-semibold text-gray-900">{s.cashier_name || s.opened_by_name || 'Staff'}</td>
                      <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap">{formatReceiptDateTime(s.opened_at)}</td>
                      <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap">
                        {s.closed_at ? formatReceiptDateTime(s.closed_at) : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">{formatPeso(s.opening_cash)}</td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {s.expected_drawer_cash !== undefined && s.expected_drawer_cash !== null
                          ? formatPeso(s.expected_drawer_cash)
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {s.actual_cash_counted !== undefined && s.actual_cash_counted !== null
                          ? formatPeso(s.actual_cash_counted)
                          : '—'}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono font-bold ${
                          shortOver === null
                            ? 'text-gray-400'
                            : shortOver < -0.01
                            ? 'text-red-600'
                            : shortOver > 0.01
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {shortOver === null ? '—' : `${shortOver >= 0 ? '+' : ''}${formatPeso(shortOver)}`}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            s.status === 'OPEN'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {s.status || 'CLOSED'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PosShiftReadingSection;
