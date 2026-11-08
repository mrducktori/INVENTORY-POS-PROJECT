import React, { useState, useMemo } from 'react';
import SharedConfirmModal from '../../../components/shared/ConfirmModal';

const DISCOUNT_OPTIONS = [
  { id: 'NONE', label: 'No Discount', rate: 0, badge: '0%' },
  { id: 'SENIOR', label: 'Senior Citizen', rate: 0.20, badge: '20% OFF' },
  { id: 'PWD', label: 'PWD', rate: 0.20, badge: '20% OFF' },
  { id: 'STUDENT', label: 'Student / Promo', rate: 0.10, badge: '10% OFF' },
  { id: 'STAFF', label: 'Employee / Staff', rate: 0.15, badge: '15% OFF' },
  { id: 'CUSTOM', label: 'Custom', rate: null, badge: 'Custom' },
];

const PaymentModal = ({ order, onConfirm, onClose }) => {
  const [method, setMethod] = useState('CASH');
  const [discountType, setDiscountType] = useState('NONE');
  const [customMode, setCustomMode] = useState('PERCENT'); // 'PERCENT' | 'AMOUNT'
  const [customValue, setCustomValue] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const subtotal = parseFloat(order.total) || 0;

  const { discountAmount, discountLabel, finalTotal } = useMemo(() => {
    const selected = DISCOUNT_OPTIONS.find((d) => d.id === discountType) || DISCOUNT_OPTIONS[0];
    let disc = 0;
    let label = '';

    if (discountType === 'NONE') {
      disc = 0;
      label = '';
    } else if (discountType === 'CUSTOM') {
      const val = Math.max(0, parseFloat(customValue) || 0);
      if (customMode === 'PERCENT') {
        const pct = Math.min(100, val);
        disc = subtotal * (pct / 100);
        label = pct > 0 ? `Custom (${pct}%)` : '';
      } else {
        disc = Math.min(subtotal, val);
        label = disc > 0 ? `Custom (-₱${disc.toFixed(2)})` : '';
      }
    } else if (selected.rate) {
      disc = subtotal * selected.rate;
      label = `${selected.label} (${Math.round(selected.rate * 100)}%)`;
    }

    const roundedDisc = Math.round(disc * 100) / 100;
    const netTotal = Math.max(0, Math.round((subtotal - roundedDisc) * 100) / 100);

    return {
      discountAmount: roundedDisc,
      discountLabel: label,
      finalTotal: netTotal,
    };
  }, [subtotal, discountType, customMode, customValue]);

  // Sensible upper limit for cash received: order total + ₱5,000, capped at ₱50,000 (absolute limit ₱100,000)
  const maxCashAllowed = Math.min(100000, Math.max(finalTotal + 5000, 50000));
  const received = parseFloat(amountReceived) || 0;
  const change = (method === 'CASH' && received >= finalTotal) ? received - finalTotal : 0;

  // Preset cash bill buttons (filtered to >= finalTotal or exact)
  const quickPresets = [
    { label: `Exact (₱${finalTotal.toFixed(2)})`, val: finalTotal },
    { label: '₱100', val: 100 },
    { label: '₱200', val: 200 },
    { label: '₱500', val: 500 },
    { label: '₱1,000', val: 1000 }
  ].filter((p, idx, arr) => (p.val >= finalTotal || Math.abs(p.val - finalTotal) < 0.01) && arr.findIndex(x => Math.abs(x.val - p.val) < 0.01) === idx);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (method === 'CASH') {
      const receivedNum = parseFloat(amountReceived);
      if (isNaN(receivedNum) || receivedNum < finalTotal) {
        setError(`Amount received must be at least ₱${finalTotal.toFixed(2)}.`);
        return;
      }
      if (receivedNum > maxCashAllowed) {
        setError(`Amount received cannot exceed ₱${maxCashAllowed.toLocaleString()} (illogical cash tender).`);
        return;
      }
    }

    if (method === 'GCASH' && !reference.trim()) {
      setError("Please enter GCash transaction reference.");
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: 'Confirm Payment',
      message: 'Are you sure you want to complete this payment?',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setSubmitting(true);
        try {
          await onConfirm({
            method,
            amountReceived: method === 'CASH' ? parseFloat(amountReceived) : finalTotal,
            change: method === 'CASH' ? change : 0,
            reference: method === 'GCASH' ? reference : '',
            discountType,
            discountLabel,
            discountAmount,
            finalTotal,
          });
        } catch (err) {
          setSubmitting(false);
          setError("Payment failed: " + (err.message || "Please try again."));
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[9999] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]" onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[calc(100vh-5rem)] md:max-h-[calc(100vh-6rem)] animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]" onClick={e => e.stopPropagation()}>
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="m-0 text-xl font-bold tracking-wide">Complete Payment</h2>
          <button className="text-gray-400 hover:text-white transition-colors bg-transparent border-none text-2xl leading-none cursor-pointer p-0" onClick={onClose} disabled={submitting} aria-label="Close"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-6 overflow-y-auto space-y-5 max-h-[70vh]">
            {error && <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm font-bold shadow-sm">{error}</div>}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/80 flex flex-col gap-1.5">
              {discountAmount > 0 && (
                <>
                  <div className="flex justify-between items-center text-xs sm:text-sm text-gray-500 font-medium">
                    <span>Subtotal</span>
                    <span className="font-mono font-semibold text-gray-700">₱{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm text-emerald-700 font-semibold">
                    <span>Discount ({discountLabel})</span>
                    <span className="font-mono font-bold">-₱{discountAmount.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-200 my-1" />
                </>
              )}
              <div className="flex flex-col items-center justify-center pt-0.5">
                <span className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider block">Total Amount Due</span>
                <h1 className="m-0 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight font-mono">₱{finalTotal.toFixed(2)}</h1>
              </div>
            </div>

            {/* Discount Selection */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Discount Option
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DISCOUNT_OPTIONS.map((opt) => {
                  const isSelected = discountType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setDiscountType(opt.id);
                        setError('');
                      }}
                      className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-gray-900 text-white border-gray-900 shadow-xs'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xs font-bold leading-tight truncate">{opt.label}</span>
                      <span
                        className={`text-[10px] font-semibold mt-0.5 ${
                          isSelected ? 'text-emerald-300' : 'text-gray-400'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              {discountType === 'CUSTOM' && (
                <div className="mt-2.5 flex items-center gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                  <div className="inline-flex rounded-lg bg-gray-200/80 p-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCustomMode('PERCENT')}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                        customMode === 'PERCENT' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomMode('AMOUNT')}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                        customMode === 'AMOUNT' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600'
                      }`}
                    >
                      ₱
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={customMode === 'PERCENT' ? 100 : subtotal}
                    step="0.01"
                    placeholder={customMode === 'PERCENT' ? 'Enter % (e.g. 15)' : 'Enter ₱ amount'}
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm font-semibold bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
                  />
                </div>
              )}
            </div>

            <div className="flex bg-gray-100 rounded-lg p-1">
              <button 
                type="button"
                className={`flex-1 py-2.5 text-sm md:text-base font-bold uppercase tracking-wider rounded-md transition-all ${method === 'CASH' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                onClick={() => setMethod('CASH')}
                disabled={submitting}
              >
                CASH
              </button>
              <button 
                type="button"
                className={`flex-1 py-2.5 text-sm md:text-base font-bold uppercase tracking-wider rounded-md transition-all ${method === 'GCASH' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                onClick={() => setMethod('GCASH')}
                disabled={submitting}
              >
                GCASH
              </button>
            </div>

            {method === 'CASH' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-sm md:text-base font-semibold text-gray-600 uppercase tracking-wider">Amount Received</label>
                    <span className="text-xs text-gray-400 font-medium">Max: ₱{maxCashAllowed.toLocaleString()}</span>
                  </div>

                  {/* Quick Preset Buttons */}
                  {quickPresets.length > 0 && (
                    <div className="flex flex-wrap gap-2 my-1">
                      {quickPresets.map(preset => (
                        <button
                          key={preset.label}
                          type="button"
                          className="px-3.5 py-1.5 text-xs md:text-sm font-bold rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-gray-900 shadow-sm transition-colors cursor-pointer"
                          onClick={() => {
                            setAmountReceived(preset.val.toString());
                            setError('');
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <input 
                    type="number" 
                    step="0.01" 
                    min={finalTotal}
                    max={maxCashAllowed}
                    autoFocus
                    placeholder="0.00"
                    value={amountReceived}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== '' && parseFloat(val) > maxCashAllowed) {
                        setError(`Amount cannot exceed ₱${maxCashAllowed.toLocaleString()} (illogical cash tender).`);
                        return;
                      }
                      setError('');
                      setAmountReceived(val);
                    }}
                    required
                    disabled={submitting}
                    className="w-full px-4 py-3 text-xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all disabled:bg-gray-100"
                  />
                </div>
                <div className="flex justify-between items-center px-4 py-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">Change</span>
                  <div className={`text-2xl md:text-3xl font-black ${change > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    ₱{change.toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {method === 'GCASH' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm md:text-base font-semibold text-gray-600 uppercase tracking-wider">Transaction Reference Number</label>
                  <input 
                    type="text" 
                    autoFocus
                    placeholder="Enter Reference #"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    required
                    disabled={submitting}
                    className="w-full px-4 py-3 text-base font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all disabled:bg-gray-100"
                  />
                </div>
                <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm md:text-base font-medium border border-blue-100 flex items-center justify-center text-center">
                    Ensure payment is confirmed on GCash app before proceeding.
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
            <button 
              type="button" 
              className="flex-1 py-3 bg-white border border-gray-300 rounded-xl text-sm md:text-base font-bold text-gray-600 uppercase tracking-wider hover:bg-gray-50 transition-colors disabled:opacity-50" 
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-[2] py-3 bg-green-600 border border-transparent rounded-xl text-sm md:text-base font-bold text-white uppercase tracking-wider hover:bg-green-700 hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={submitting}
            >
              {submitting ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </div>
      <SharedConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default PaymentModal;
