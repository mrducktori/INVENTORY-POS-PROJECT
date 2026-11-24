import React, { useState } from 'react';
import InfoTip from '../../../../components/shared/InfoTip';

const CANCELLATION_REASONS = [
  'Supplier failed to deliver / Order is overdue',
  'Supplier out of stock / unable to fulfill',
  'Duplicate order placed in error',
  'Store requirements changed / items not needed',
  'Found alternative supplier / lower price',
  'Pricing or payment terms disagreement',
  'Other'
];

const CancelPOModal = ({ po, onClose, onConfirm, loading = false }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  if (!po) return null;

  const poRef = po.id ? po.id.substring(0, 8).toUpperCase() : '';
  const supplierName = po.suppliers?.name || 'Unknown Supplier';
  const totalAmount = Number(po.total_amount || 0).toFixed(2);
  const itemsCount = po.purchase_order_items?.length || 0;

  const isFormValid = selectedReason.trim().length > 0 && 
    (selectedReason !== 'Other' || additionalNotes.trim().length > 0) &&
    acknowledged;

  const handleConfirm = (e) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    const finalReason = selectedReason === 'Other'
      ? `Other: ${additionalNotes.trim()}`
      : (additionalNotes.trim() ? `${selectedReason} - ${additionalNotes.trim()}` : selectedReason);

    onConfirm(po.id, finalReason);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[9999] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]"    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-zinc-200 max-h-[calc(100vh-5rem)] md:max-h-[calc(100vh-6rem)] animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-zinc-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="m-0 text-base font-bold tracking-wide">Cancel Purchase Order #{poRef}</h2>
              <p className="m-0 text-xs text-zinc-400 font-medium">Explicit verification and reason required</p>
            </div>
          </div>
          <button 
            type="button"
            className="text-zinc-400 hover:text-white transition-colors bg-transparent border-none text-xl leading-none cursor-pointer p-0" 
            onClick={onClose}
            disabled={loading}
           aria-label="Close"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <form onSubmit={handleConfirm} className="p-6 flex flex-col gap-4.5">
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <span>Order Details</span>
              <span className="text-zinc-900 font-bold">{po.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-zinc-800">{supplierName}</span>
              <span className="text-base font-black text-zinc-900">₱{totalAmount}</span>
            </div>
            <div className="text-xs text-zinc-600 font-medium">
              {itemsCount} line item{itemsCount === 1 ? '' : 's'} will be voided.
            </div>
          </div>

          <div className="px-3.5 py-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-900">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
              <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Irreversible Action: Permanently voids this order</span>
            </div>
            <InfoTip text="Cancelling voids this purchase order permanently. Stock will not be added to inventory and supplier tracking will cease." />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
              Reason for Cancellation <span className="text-rose-600">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-zinc-300 rounded-xl text-sm font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all cursor-pointer"
              required
            >
              <option value="">Select a reason...</option>
              {CANCELLATION_REASONS.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
              Additional Notes {selectedReason === 'Other' && <span className="text-rose-600">*</span>}
            </label>
            <textarea
              rows={2}
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder={selectedReason === 'Other' ? 'Please specify reason for cancellation...' : 'Optional details for audit log...'}
              className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-xl text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all resize-none"
              required={selectedReason === 'Other'}
            />
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-100/70 border border-zinc-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer"
            />
            <span className="text-xs font-semibold text-zinc-700 leading-snug">
              I confirm that I want to void and permanently cancel this purchase order.
            </span>
          </label>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Keep Purchase Order
            </button>
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs ${
                isFormValid && !loading
                  ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-rose-600/20'
                  : 'bg-zinc-200 text-zinc-400 cursor-not-allowed border border-zinc-300'
              }`}
            >
              {loading ? 'Voiding...' : 'Void & Cancel Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CancelPOModal;
