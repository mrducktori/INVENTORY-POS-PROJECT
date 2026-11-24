import React, { useState } from 'react';
import { getManilaDateOnly, formatDisplayDate, isDatePast, getDaysOverdue } from '../../../../utils/dateUtils';
import InfoTip from '../../../../components/shared/InfoTip';

const RESCHEDULE_REASONS = [
  'Supplier notified of delay in transit / logistics',
  'Agreed new schedule directly with vendor',
  'Store requested postponed delivery',
  'Inclement weather / regional delivery issue',
  'Other'
];

const ReschedulePOModal = ({ po, onClose, onSubmit, loading = false }) => {
  const today = getManilaDateOnly();
  const currentExpected = po?.expected_date ? po.expected_date.split('T')[0] : '';
  const isOverdue = po ? (po.is_overdue || isDatePast(currentExpected)) : false;
  const daysOverdue = po?.days_overdue || getDaysOverdue(currentExpected);

  const [newDate, setNewDate] = useState('');
  const [selectedReason, setSelectedReason] = useState(RESCHEDULE_REASONS[0]);
  const [notes, setNotes] = useState('');

  if (!po) return null;

  const poRef = po.id ? po.id.substring(0, 8).toUpperCase() : '';
  const supplierName = po.suppliers?.name || 'Unknown Supplier';

  const isFormValid = Boolean(newDate && newDate >= today);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    const finalReason = selectedReason === 'Other'
      ? (notes.trim() ? `Other: ${notes.trim()}` : 'Rescheduled')
      : (notes.trim() ? `${selectedReason} - ${notes.trim()}` : selectedReason);

    onSubmit(po.id, newDate, finalReason);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[9999] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]"    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-zinc-200 max-h-[calc(100vh-5rem)] md:max-h-[calc(100vh-6rem)] animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-zinc-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="m-0 text-base font-bold tracking-wide">Reschedule Delivery • PO #{poRef}</h2>
              <p className="m-0 text-xs text-zinc-400 font-medium">Update expected delivery date and resolve overdue status</p>
            </div>
          </div>
          <button 
            type="button"
            className="text-zinc-400 hover:text-white transition-colors bg-transparent border-none text-xl leading-none cursor-pointer p-0" 
            onClick={onClose}
            disabled={loading}
           aria-label="Close"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4.5">
          {/* Current Status Box */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <span>Supplier & Current Schedule</span>
              <span className="text-zinc-800 font-bold">{po.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-zinc-800">{supplierName}</span>
              <span className="text-xs font-semibold text-zinc-600">
                Current: {currentExpected ? formatDisplayDate(currentExpected) : 'No date set'}
              </span>
            </div>
            {isOverdue && (
              <div className="mt-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span>Past Due ({daysOverdue} day{daysOverdue === 1 ? '' : 's'} late)</span>
                </div>
                <InfoTip text="Rescheduling will set a new target date and clear the overdue alert." />
              </div>
            )}
          </div>

          {/* New Expected Delivery Date Picker */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
              New Expected Delivery Date <span className="text-rose-600">*</span>
            </label>
            <input
              type="date"
              min={today}
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-zinc-300 rounded-xl text-sm font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all cursor-pointer"
              required
            />
          </div>

          {/* Reschedule Reason Selector */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
              Reason for Rescheduling
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-zinc-300 rounded-xl text-sm font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all cursor-pointer"
            >
              {RESCHEDULE_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Notes / Details */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
              Additional Details (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Vendor called: shipment arrives Friday morning..."
              className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-xl text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs ${
                isFormValid && !loading
                  ? 'bg-zinc-900 hover:bg-black text-white cursor-pointer'
                  : 'bg-zinc-200 text-zinc-400 cursor-not-allowed border border-zinc-300'
              }`}
            >
              {loading ? 'Updating Date...' : 'Save New Delivery Date'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReschedulePOModal;
