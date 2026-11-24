import { formatQty, formatCurrency } from '../../../analytics/utils/forecastUtils';
import React, { useState, useEffect } from 'react';
import { formatDisplayDate, getManilaDateOnly, addDaysManila } from '../../../../utils/dateUtils';

const SupplierReviewPOModal = ({ isOpen, onClose, order, onSubmit }) => {
  const [itemsState, setItemsState] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (order && order.purchase_order_items) {
      const initial = {};
      order.purchase_order_items.forEach((item) => {
        initial[item.id] = {
          item_id: item.id,
          status: 'AVAILABLE', // 'AVAILABLE' | 'PROPOSED_DATE' | 'UNAVAILABLE'
          proposed_date: '',
          reason: ''
        };
      });
      setItemsState(initial);
      setError('');
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const items = order.purchase_order_items || [];

  const handleStatusChange = (itemId, newStatus) => {
    setItemsState((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        status: newStatus,
        // Reset inputs if returning to available
        proposed_date: newStatus === 'PROPOSED_DATE' ? (prev[itemId]?.proposed_date || '') : '',
        reason: newStatus === 'AVAILABLE' ? '' : (prev[itemId]?.reason || '')
      }
    }));
  };

  const handleInputChange = (itemId, field, value) => {
    setItemsState((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleMarkAllAvailable = () => {
    const updated = {};
    items.forEach((item) => {
      updated[item.id] = {
        item_id: item.id,
        status: 'AVAILABLE',
        proposed_date: '',
        reason: ''
      };
    });
    setItemsState(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const payloadItems = [];
    for (const item of items) {
      const state = itemsState[item.id];
      if (!state) continue;

      if (state.status === 'PROPOSED_DATE') {
        if (!state.proposed_date) {
          setError(`Please specify a proposed delivery date for "${item.ingredients?.name || 'Item'}".`);
          return;
        }
      } else if (state.status === 'UNAVAILABLE') {
        if (!state.reason?.trim()) {
          setError(`Please provide a reason why "${item.ingredients?.name || 'Item'}" is unavailable.`);
          return;
        }
      }

      payloadItems.push({
        item_id: item.id,
        status: state.status,
        proposed_date: state.proposed_date || null,
        reason: state.reason?.trim() || null
      });
    }

    try {
      setIsSubmitting(true);
      await onSubmit(order.id, payloadItems);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit response.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableCount = Object.values(itemsState).filter((s) => s.status === 'AVAILABLE').length;
  const proposedCount = Object.values(itemsState).filter((s) => s.status === 'PROPOSED_DATE').length;
  const unavailableCount = Object.values(itemsState).filter((s) => s.status === 'UNAVAILABLE').length;

  // Tomorrow for min date on proposal
  const minDateStr = addDaysManila(getManilaDateOnly(), 1);

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 p-4 animate-[modalBackdropFadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[calc(100vh-5rem)] md:max-h-[calc(100vh-6rem)] flex flex-col border border-gray-200 animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]">
        <div className="p-6 border-b border-gray-100 flex items-start justify-between bg-zinc-900 text-white rounded-t-2xl shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Review Purchase Order</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-white/20 text-white">
                #{order.id.substring(0, 8).toUpperCase()}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold m-0 text-white tracking-tight">
              Confirm Product Availability
            </h2>
            <p className="text-xs text-zinc-300 mt-1 mb-0">
              Requested delivery date by shop:{' '}
              <span className="font-bold text-white underline">{formatDisplayDate(order.expected_date)}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
           aria-label="Close"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="px-6 py-3 bg-zinc-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-zinc-500 uppercase tracking-wider">Summary:</span>
            <span className="px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {availableCount} Available
            </span>
            {proposedCount > 0 && (
              <span className="px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-200">
                {proposedCount} Proposed Date
              </span>
            )}
            {unavailableCount > 0 && (
              <span className="px-2.5 py-1 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-200">
                {unavailableCount} Unavailable
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleMarkAllAvailable}
            className="font-bold text-zinc-700 hover:text-black hover:underline cursor-pointer flex items-center gap-1"
          >
            Mark All Available
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <p className="text-xs text-zinc-500 m-0">
              For any item you cannot deliver on the requested date, you can propose a new delivery date or declare it unavailable with a reason.
            </p>

            {items.map((item, index) => {
              const state = itemsState[item.id] || { status: 'AVAILABLE' };
              const isAvailable = state.status === 'AVAILABLE';
              const isProposed = state.status === 'PROPOSED_DATE';
              const isUnavailable = state.status === 'UNAVAILABLE';

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isAvailable
                      ? 'bg-white border-zinc-200'
                      : isProposed
                      ? 'bg-amber-50/50 border-amber-300'
                      : 'bg-rose-50/50 border-rose-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-zinc-400">#{index + 1}</span>
                        <h4 className="text-sm font-extrabold text-zinc-900 m-0">
                          {item.ingredients?.name || 'Ingredient Item'}
                        </h4>
                      </div>
                      <span className="text-xs text-zinc-500 font-medium">
                        Ordered: <strong className="text-zinc-800">{formatQty(item.quantity)} × {item.purchase_unit}</strong> • {formatCurrency(item.unit_price)} each • Total: <strong>{formatCurrency(item.subtotal)}</strong>
                      </span>
                    </div>

                    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.id, 'AVAILABLE')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          isAvailable
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-zinc-600 hover:text-black'
                        }`}
                      >
                        Available
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.id, 'PROPOSED_DATE')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          isProposed
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-zinc-600 hover:text-black'
                        }`}
                      >
                        Propose Date
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.id, 'UNAVAILABLE')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          isUnavailable
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-zinc-600 hover:text-black'
                        }`}
                      >
                        Unavailable
                      </button>
                    </div>
                  </div>

                  {isProposed && (
                    <div className="mt-3 pt-3 border-t border-amber-200/80 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs animate-in fade-in duration-150">
                      <div>
                        <label className="block font-bold text-amber-900 mb-1">
                          Proposed Delivery Date <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="date"
                          min={minDateStr}
                          value={state.proposed_date || ''}
                          onChange={(e) => handleInputChange(item.id, 'proposed_date', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-amber-900 mb-1">
                          Reason / Note for Proposal
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Awaiting shipment from supplier"
                          value={state.reason || ''}
                          onChange={(e) => handleInputChange(item.id, 'reason', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  {isUnavailable && (
                    <div className="mt-3 pt-3 border-t border-rose-200/80 text-xs animate-in fade-in duration-150">
                      <label className="block font-bold text-rose-900 mb-1">
                        Reason Product is Unavailable <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Out of stock / discontinued by manufacturer"
                        value={state.reason || ''}
                        onChange={(e) => handleInputChange(item.id, 'reason', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                        required
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-4 md:p-6 border-t border-gray-100 bg-white flex items-center justify-between rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-zinc-900 hover:bg-black text-white rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : <span className="inline-flex items-center gap-1.5">Submit Availability Response <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupplierReviewPOModal;
