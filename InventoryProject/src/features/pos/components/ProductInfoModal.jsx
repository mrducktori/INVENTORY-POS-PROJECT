import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../../../components/shared/useFocusTrap";
import { formatQuantity } from "../../../utils/productUtils";

const ProductInfoModal = ({ product, stockSummary, loading, onClose, onAddToOrder }) => {
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, Boolean(product), onClose);

  if (!product) return null;

  const summary = stockSummary || {
    mode: "direct",
    totalPossible: Math.max(0, Math.floor(parseFloat(product.stock_quantity) || 0)),
    remainingOrderable: Math.max(0, Math.floor(parseFloat(product.stock_quantity) || 0)),
    reservedQty: 0,
    limitedByCups: false,
    recipeBreakdown: [],
    sizeAvailability: []
  };

  const {
    mode,
    totalPossible,
    remainingOrderable,
    reservedQty,
    limitedByCups,
    recipeBreakdown,
    sizeAvailability
  } = summary;

  const isAllInCart = remainingOrderable <= 0 && totalPossible > 0;
  const isOutOfStock = remainingOrderable <= 0 && totalPossible <= 0;

  const cupTrackedSizes = (sizeAvailability || []).filter((s) => Boolean(s.ingredientId));
  const unitLabel =
    mode === "recipe" ? (remainingOrderable === 1 ? "serving" : "servings") : "in stock";

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[99990] p-4 flex justify-center items-center animate-[modalBackdropFadeIn_0.2s_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-info-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[calc(100vh-3rem)] animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <h3 id="product-info-title" className="m-0 text-lg md:text-xl font-bold tracking-wide truncate pr-4">
            Ingredients: {product.name}
          </h3>
          <button
            type="button"
            className="text-gray-400 hover:text-white transition-colors bg-transparent border-none leading-none cursor-pointer p-0"
            onClick={onClose}
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-gray-200">
          {loading ? (
            <div className="py-4 space-y-3 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
            </div>
          ) : (
            <>
              <div className="pb-4 border-b border-gray-200">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-gray-500">Available to order</span>
                  <span
                    className={`text-lg font-bold tabular-nums ${
                      remainingOrderable <= 0 ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {remainingOrderable} {unitLabel}
                  </span>
                </div>
                {reservedQty > 0 && (
                  <p className="m-0 mt-1 text-xs text-gray-500">
                    {totalPossible} in stock, {reservedQty} reserved in cart/orders
                  </p>
                )}
                {mode === "recipe" && limitedByCups && (
                  <p className="m-0 mt-1 text-xs text-gray-500">Limited by cup stock</p>
                )}
              </div>

              {mode === "recipe" ? (
                <div className="space-y-3">
                  <div>
                    <h4 className="m-0 mb-2 text-xs font-semibold text-gray-500">
                      Recipe (per serving)
                    </h4>
                    <div className="divide-y divide-gray-100">
                      {recipeBreakdown.map((item, idx) => {
                        const maxLabel = item.isMissing
                          ? "0 max"
                          : Number.isFinite(item.maxFromRemaining)
                            ? `${item.maxFromRemaining} max`
                            : "Unlimited";

                        const maxTextClass =
                          item.isMissing || item.maxFromRemaining <= 0
                            ? "text-red-600 font-semibold"
                            : item.isLimiting
                              ? "text-gray-900 font-semibold"
                              : "text-gray-500";

                        return (
                          <div
                            key={item.id || `${item.ingredientId}-${idx}`}
                            className="py-2.5 flex items-baseline justify-between gap-4"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900 truncate">
                                {item.name}
                              </div>
                              <div
                                className={`text-xs mt-0.5 ${
                                  item.isMissing ? "text-red-600" : "text-gray-500"
                                }`}
                              >
                                {item.isMissing
                                  ? `${item.quantityUsed} ${item.recipeUnit} · Missing ingredient`
                                  : `${item.quantityUsed} ${item.recipeUnit} · ${formatQuantity(
                                      item.remainingStock,
                                      item.stockUnit
                                    )} in stock`}
                              </div>
                            </div>

                            <span className={`text-xs tabular-nums shrink-0 ${maxTextClass}`}>
                              {maxLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {cupTrackedSizes.length > 0 && (
                    <div className="pt-3 border-t border-gray-200">
                      <h4 className="m-0 mb-2 text-xs font-semibold text-gray-500">
                        By cup size
                      </h4>
                      <div className="divide-y divide-gray-100">
                        {cupTrackedSizes.map((sz) => (
                          <div
                            key={sz.name}
                            className="py-2 flex items-baseline justify-between gap-4"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900">{sz.name}</div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {sz.cupRemaining} {sz.cupRemaining === 1 ? "cup" : "cups"} in stock
                              </div>
                            </div>
                            <span
                              className={`text-xs tabular-nums shrink-0 ${
                                sz.maxForSizeRemaining <= 0
                                  ? "text-red-600 font-semibold"
                                  : "text-gray-500"
                              }`}
                            >
                              {sz.maxForSizeRemaining} max
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="m-0 py-2 text-sm text-gray-500">
                  Direct-stock item (no recipe ingredients).
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 shrink-0">
          <button
            type="button"
            className="flex-1 py-3 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-700 uppercase tracking-wider hover:bg-gray-100 transition-colors cursor-pointer"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="flex-1 py-3 bg-gray-900 border border-transparent rounded-xl text-sm font-bold text-white uppercase tracking-wider hover:bg-black hover:shadow-md transition-all cursor-pointer disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed"
            onClick={() => onAddToOrder(product)}
            disabled={remainingOrderable <= 0}
          >
            {isAllInCart ? "All in Cart" : isOutOfStock ? "Unavailable" : "+ Add to Order"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProductInfoModal;