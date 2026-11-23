import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../utils/forecastUtils';
import { INPUT_LIMITS, clampNumberInput } from '../../../utils/validationUtils';
import { doesItemMatchSupplier } from '../hooks/useDemandForecasting';

const ForecastCreatePOModal = ({
  isOpen,
  onClose,
  suppliers,
  poTargetSupplierId,
  setPoTargetSupplierId,
  poExpectedDate,
  setPoExpectedDate,
  poPoolItems = [],
  poItems,
  poNotes,
  setPoNotes,
  submittingPO,
  onUpdateQty,
  onRemoveItem,
  poTotal,
  onConfirmSubmit,
}) => {
  const sourceItems = poPoolItems.length > 0 ? poPoolItems : poItems;

  const supplierOptions = useMemo(() => {
    const withCounts = suppliers.map((sup) => ({
      ...sup,
      matchCount: sourceItems.filter((item) => doesItemMatchSupplier(item, sup.id)).length,
    }));
    const matched = withCounts.filter((sup) => sup.matchCount > 0);
    return matched.length > 0 ? matched : withCounts;
  }, [sourceItems, suppliers]);

  if (!isOpen) return null;

  const isMultiSupplierPool = supplierOptions.length > 1 && sourceItems.length > poItems.length;

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
                {supplierOptions.map((sup) => {
                  const isSelected = String(poTargetSupplierId) === String(sup.id);
                  const showCount = sourceItems.length > 1 && sup.matchCount > 0;
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
                      {sup.name}{showCount ? ` (${sup.matchCount})` : ''}
                    </button>
                  );
                })}
              </div>
              {isMultiSupplierPool && (
                <p className="mt-1.5 mb-0 text-[11px] font-medium text-zinc-500">
                  Showing {poItems.length} of {sourceItems.length}{' '}
                  {poNotes?.toLowerCase().includes('critical') ? 'critical items' : 'items'} for the
                  selected supplier. Switch suppliers above or submit to proceed to the next supplier.
                </p>
              )}
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
                {poItems.map((item, idx) => {
                  const notInSupplierCatalog =
                    Boolean(poTargetSupplierId) &&
                    (item.available_suppliers || []).length > 0 &&
                    !(item.available_suppliers || []).some(
                      (s) => String(s.supplier_id) === String(poTargetSupplierId)
                    );

                  return (
                    <tr key={item.ingredient_id}>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-900">{item.name}</div>
                        <div className="text-xs text-zinc-400">
                          1 &times; {item.purchase_unit} ={' '}
                          {Number(item.conversion_factor || 1).toLocaleString()} {item.unit}
                        </div>
                        {notInSupplierCatalog && (
                          <div className="text-[11px] font-medium text-amber-700 mt-0.5">
                            Not in selected supplier&apos;s catalog
                          </div>
                        )}
                      </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={INPUT_LIMITS.PO_QTY_MIN}
                          max={INPUT_LIMITS.PO_QTY_MAX}
                          value={item.quantity}
                          onChange={(e) => {
                            const parsed = parseInt(e.target.value, 10);
                            const clamped = Number.isFinite(parsed)
                              ? clampNumberInput(parsed, INPUT_LIMITS.PO_QTY_MIN, INPUT_LIMITS.PO_QTY_MAX)
                              : INPUT_LIMITS.PO_QTY_MIN;
                            onUpdateQty(idx, clamped);
                          }}
                          className="w-20 px-2 py-1 border border-zinc-300 rounded-md text-sm font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900"
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
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Notes
            </label>
            <input
              type="text"
              maxLength={INPUT_LIMITS.DESC_MAX_LEN}
              value={poNotes}
              onChange={(e) => setPoNotes(e.target.value.slice(0, INPUT_LIMITS.DESC_MAX_LEN))}
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
