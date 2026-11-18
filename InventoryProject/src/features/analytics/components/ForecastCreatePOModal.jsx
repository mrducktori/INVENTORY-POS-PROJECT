import React from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../utils/forecastUtils';

const ForecastCreatePOModal = ({
  isOpen,
  onClose,
  suppliers,
  poTargetSupplierId,
  setPoTargetSupplierId,
  poExpectedDate,
  setPoExpectedDate,
  poItems,
  poNotes,
  setPoNotes,
  submittingPO,
  onUpdateQty,
  onRemoveItem,
  poTotal,
  onConfirmSubmit,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 p-4 bg-black/60 backdrop-blur-xs animate-[modalBackdropFadeIn_0.2s_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[calc(100vh-5rem)] animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="m-0 text-base sm:text-lg font-bold tracking-tight">Create Purchase Order</h3>
            <p className="m-0 text-xs text-zinc-400 mt-0.5">
              Review quantities and assign a supplier
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer bg-transparent border-none inline-flex items-center justify-center"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Supplier *
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 border border-zinc-200 rounded-lg bg-zinc-50/60">
                {suppliers.map((sup) => {
                  const isSelected = String(poTargetSupplierId) === String(sup.id);
                  return (
                    <button
                      key={sup.id}
                      type="button"
                      onClick={() => setPoTargetSupplierId(sup.id)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-zinc-900 text-white shadow-2xs'
                          : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
                      }`}
                    >
                      {sup.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={poExpectedDate}
                onChange={(e) => setPoExpectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 font-medium focus:outline-none focus:border-zinc-900"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold">
                  <th className="py-2.5 px-4">Material</th>
                  <th className="py-2.5 px-4 w-32">Order Qty</th>
                  <th className="py-2.5 px-4 text-right">Unit Cost</th>
                  <th className="py-2.5 px-4 text-right">Subtotal</th>
                  <th className="py-2.5 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {poItems.map((item, idx) => (
                  <tr key={item.ingredient_id}>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-zinc-900">{item.name}</div>
                      <div className="text-xs text-zinc-400">
                        1 {item.purchase_unit} = {item.conversion_factor} {item.unit}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => onUpdateQty(idx, e.target.value)}
                          className="w-16 px-2 py-1 border border-zinc-300 rounded-md text-sm font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900"
                        />
                        <span className="text-xs text-zinc-500">{item.purchase_unit}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-600">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-900">
                      {formatCurrency(item.quantity * item.unit_price)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {poItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveItem(idx)}
                          className="text-zinc-400 hover:text-red-600 p-1 cursor-pointer bg-transparent border-none inline-flex items-center justify-center"
                          title="Remove"
                          aria-label="Remove item"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Notes
            </label>
            <input
              type="text"
              value={poNotes}
              onChange={(e) => setPoNotes(e.target.value)}
              placeholder="Optional delivery instructions..."
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
            />
          </div>

          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-zinc-600">Estimated Total</span>
            <span className="text-xl font-bold text-zinc-900 font-mono">
              {formatCurrency(poTotal)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submittingPO}
            className="px-4 py-2 border border-zinc-300 rounded-lg text-xs sm:text-sm font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmSubmit}
            disabled={submittingPO || poItems.length === 0}
            className="px-5 py-2 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold disabled:opacity-50 cursor-pointer"
          >
            {submittingPO ? 'Creating...' : 'Create Purchase Order'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ForecastCreatePOModal;
