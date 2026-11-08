import React, { useState } from 'react';
import { formatDisplayDateTime } from '../../../utils/dateUtils';
import InfoTip from '../../../components/shared/InfoTip';

const ReceivePOModal = ({ po, onClose, onSubmit }) => {
  const [items, setItems] = useState(
    po.purchase_order_items.map(item => ({
      ...item,
      received_now: Math.max(1, (item.quantity || 1) - (item.quantity_received || 0))
    }))
  );
  const [saving, setSaving] = useState(false);
  const [isReviewStep, setIsReviewStep] = useState(false);

  const handleQuantityChange = (id, val) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, received_now: parseInt(val) || 0 } : item));
  };
  
  const setMaxQuantity = (id, fullQuantity) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, received_now: fullQuantity } : item));
  };

  // Determine items to receive
  const itemsToSubmit = items
    .filter(item => item.received_now > 0)
    .map(item => ({ ...item, quantity_received_now: item.received_now }));

  const isComplete = items.every(item => item.is_received || (item.quantity_received + (item.received_now || 0)) >= item.quantity);
  const newStatus = isComplete ? 'Received' : 'Partial';

  const handleProceedToReview = (e) => {
    e.preventDefault();
    if (itemsToSubmit.length === 0) return;
    setIsReviewStep(true);
  };

  const handleFinalSubmit = async () => {
    setSaving(true);
    try {
      await onSubmit(po.id, newStatus, itemsToSubmit);
    } finally {
      setSaving(false);
    }
  };

  const poRef = po.id ? po.id.substring(0, 8).toUpperCase() : '';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-[modalBackdropFadeIn_0.2s_ease-out]" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-zinc-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="m-0 text-base md:text-lg font-bold tracking-wide">
                Receive Stock • PO #{poRef}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="m-0 text-xs text-zinc-400 font-medium">
                  {isReviewStep ? 'Verify stock additions' : 'Enter received quantities'}
                </p>
                <InfoTip text={`Verify delivered counts from ${po.suppliers?.name || 'the supplier'}. Quantities less than ordered will mark the order as Partial.`} />
              </div>
            </div>
          </div>
          <button className="text-zinc-400 hover:text-white transition-colors bg-transparent border-none text-xl leading-none cursor-pointer p-0" onClick={onClose} disabled={saving} aria-label="Close"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        {/* Form Body */}
        {!isReviewStep ? (
          <form onSubmit={handleProceedToReview} className="flex flex-col overflow-hidden min-h-0 flex-1">
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                {items.map(item => {
                  const maxRemaining = Math.max(0, item.quantity - (item.quantity_received || 0));
                  const isFullyReceivedAlready = item.is_received || item.quantity_received >= item.quantity;

                  return (
                    <div key={item.id} className={`flex flex-col md:flex-row md:items-center gap-4 p-4 border rounded-xl transition-all ${isFullyReceivedAlready ? 'bg-zinc-50 border-zinc-200 opacity-70' : 'bg-white border-zinc-200 hover:border-zinc-300 shadow-2xs'}`}>
                      <div className="flex-1">
                        <div className="text-sm md:text-base font-bold text-zinc-900">{item.ingredients?.name}</div>
                        <div className="text-xs font-semibold text-zinc-500 mt-0.5">
                          Ordered: {item.quantity} {item.purchase_unit} • Previously Received: {item.quantity_received || 0}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isFullyReceivedAlready ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                            Fully Received
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center border border-zinc-300 rounded-lg overflow-hidden bg-white shadow-xs focus-within:ring-2 focus-within:ring-zinc-900 focus-within:border-transparent transition-all">
                              <input
                                type="number"
                                min="0"
                                max={maxRemaining}
                                step="1"
                                className="w-20 px-3 py-2 text-sm md:text-base font-bold text-zinc-900 text-center border-none focus:outline-none"
                                value={item.received_now === 0 ? '' : item.received_now}
                                onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                placeholder="0"
                              />
                              <div className="px-3 py-2 bg-zinc-50 border-l border-zinc-200 text-xs md:text-sm font-semibold text-zinc-700">
                                {item.purchase_unit}
                              </div>
                              <button
                                type="button"
                                className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 border-l border-zinc-200 text-xs font-bold text-zinc-700 transition-colors uppercase tracking-wider cursor-pointer"
                                onClick={() => setMaxQuantity(item.id, maxRemaining)}
                              >
                                Max
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-3 shrink-0">
              <button type="button" className="px-5 py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-100 transition-colors cursor-pointer" onClick={onClose} disabled={saving}>Cancel</button>
              <button 
                type="submit" 
                disabled={itemsToSubmit.length === 0}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs ${
                  itemsToSubmit.length > 0 
                    ? 'bg-zinc-900 hover:bg-black text-white cursor-pointer' 
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed border border-zinc-300'
                }`}
              >
                Review Receipt ({itemsToSubmit.length} items) →
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: Friction Review & Impact Summary */
          <div className="flex flex-col overflow-hidden min-h-0 flex-1">
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              {/* Status Outcome Banner */}
              <div className={`px-4 py-3 rounded-xl border flex items-center justify-between ${
                newStatus === 'Received'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div className="flex items-center gap-2">
                  {newStatus === 'Received' ? (
                    <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {newStatus === 'Received' ? 'Full Order Received' : 'Partial Delivery'}
                  </span>
                  <InfoTip text={newStatus === 'Received'
                    ? 'All ordered items are fully accounted for. PO status will be set to Received.'
                    : 'Some items remain unreceived. PO status will be set to Partial until fulfilled.'
                  } />
                </div>
                <span className="text-xs font-semibold text-zinc-500">
                  {itemsToSubmit.length} item{itemsToSubmit.length === 1 ? '' : 's'} updating
                </span>
              </div>

              {/* Inventory Stock Additions Breakdown */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 text-xs font-bold text-zinc-600 uppercase tracking-wider">
                  Live Stock Additions
                </div>
                <div className="divide-y divide-zinc-200">
                  {itemsToSubmit.map(item => {
                    const conv = Number(item.conversion_factor || 1);
                    const baseUnits = Number(item.quantity_received_now) * conv;
                    const remainingAfter = item.quantity - (item.quantity_received + item.quantity_received_now);

                    return (
                      <div key={item.id} className="p-3.5 flex items-center justify-between text-xs md:text-sm">
                        <div>
                          <div className="font-bold text-zinc-900">{item.ingredients?.name}</div>
                          <div className="text-zinc-500 font-medium">
                            Receiving: {item.quantity_received_now} {item.purchase_unit}
                            {conv > 1 && ` (+${baseUnits.toLocaleString()} ${item.ingredients?.unit || 'base units'})`}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-black text-emerald-800 bg-emerald-100 border border-emerald-300">
                            +{item.quantity_received_now} {item.purchase_unit}
                          </span>
                          {remainingAfter > 0 && (
                            <div className="text-[11px] text-amber-700 font-semibold mt-0.5">
                              {remainingAfter} {item.purchase_unit} pending
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50 flex justify-between items-center gap-3 shrink-0">
              <button 
                type="button" 
                className="px-4 py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-100 transition-colors cursor-pointer" 
                onClick={() => setIsReviewStep(false)}
                disabled={saving}
              >
                ← Back to Edit
              </button>
              <button 
                type="button" 
                onClick={handleFinalSubmit}
                disabled={saving}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
              >
                {saving ? 'Committing Stock...' : 'Verify & Add to Inventory Stock'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceivePOModal;
