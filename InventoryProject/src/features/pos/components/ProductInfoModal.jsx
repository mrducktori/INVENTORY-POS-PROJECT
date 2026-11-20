import React from "react";
import { createPortal } from "react-dom";
import { formatQuantity } from "../../../utils/productUtils";

const ProductInfoModal = ({ product, stockSummary, loading, onClose, onAddToOrder }) => {
  if (!product) return null;

  const summary = stockSummary || {
    mode: "direct",
    totalPossible: Math.max(0, Math.floor(parseFloat(product.stock_quantity) || 0)),
    remainingOrderable: Math.max(0, Math.floor(parseFloat(product.stock_quantity) || 0)),
    reservedQty: 0,
    limitingIngredients: [],
    limitedByCups: false,
    recipeBreakdown: [],
    sizeAvailability: []
  };

  const {
    mode,
    totalPossible,
    remainingOrderable,
    reservedQty,
    limitingIngredients,
    limitedByCups,
    recipeBreakdown,
    sizeAvailability
  } = summary;

  const isAllInCart = remainingOrderable <= 0 && totalPossible > 0;
  const isOutOfStock = remainingOrderable <= 0 && totalPossible <= 0;
  const lowThreshold = product.track_stock
    ? Math.max(5, Number(product.low_stock_threshold) || 5)
    : 5;
  const isLowStock = remainingOrderable > 0 && remainingOrderable <= lowThreshold;

  const statusBadge = isAllInCart
    ? { label: "Limit Reached", classes: "bg-amber-100 text-amber-800 border-amber-200" }
    : isOutOfStock
      ? { label: "Out of Stock", classes: "bg-red-100 text-red-700 border-red-200" }
      : isLowStock
        ? { label: "Low Stock", classes: "bg-amber-50 text-amber-700 border-amber-200" }
        : { label: "In Stock", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" };

  const cupTrackedSizes = (sizeAvailability || []).filter((s) => Boolean(s.ingredientId));
  const unitLabel = mode === "recipe" ? (remainingOrderable === 1 ? "serving" : "servings") : "in stock";

  const limitingText = (() => {
    if (mode !== "recipe") return "";
    if (limitedByCups) return "Limited by cup stock";
    if (limitingIngredients && limitingIngredients.length > 0) {
      const details = limitingIngredients
        .map((l) => (l.isMissing ? `${l.name}` : `${l.name} (${l.maxFromRemaining} max)`))
        .join(", ");
      return `Limited by: ${details}`;
    }
    return "";
  })();

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[99990] p-4 flex justify-center items-center animate-[modalBackdropFadeIn_0.2s_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[calc(100vh-3rem)] animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <div className="min-w-0 pr-4">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {product.category || "Menu Item"}
            </span>
            <h3 className="m-0 text-lg md:text-xl font-bold tracking-wide truncate">
              {product.name}
            </h3>
          </div>
          <button
            type="button"
            className="text-gray-400 hover:text-white transition-colors bg-transparent border-none leading-none cursor-pointer p-1"
            onClick={onClose}
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 scrollbar-thin scrollbar-thumb-gray-200">
          {loading ? (
            <div className="py-4 space-y-3 animate-pulse">
              <div className="h-20 bg-gray-100 rounded-xl w-full" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
            </div>
          ) : (
            <>
              {/* Availability Summary Card */}
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/80 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 block">
                      Available to Order
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span
                        className={`text-3xl font-extrabold font-mono tabular-nums tracking-tight ${
                          remainingOrderable <= 0
                            ? "text-red-600"
                            : isLowStock
                              ? "text-amber-600"
                              : "text-gray-900"
                        }`}
                      >
                        {remainingOrderable}
                      </span>
                      <span className="text-sm font-semibold text-gray-600">{unitLabel}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${statusBadge.classes}`}
                  >
                    {statusBadge.label}
                  </span>
                </div>

                {reservedQty > 0 && (
                  <p className="m-0 text-xs font-medium text-gray-600">
                    {totalPossible} in stock · {reservedQty} reserved in cart/orders
                  </p>
                )}

                {limitingText && (
                  <p className="m-0 text-xs font-medium text-gray-600 pt-1 border-t border-gray-200/80">
                    {limitingText}
                  </p>
                )}
              </div>

              {/* Recipe Breakdown or Direct-Stock Note */}
              {mode === "recipe" ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="m-0 text-sm font-bold text-gray-900">Recipe Ingredients</h4>
                      <span className="text-xs font-medium text-gray-500">Per 1 serving</span>
                    </div>

                    <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden bg-white">
                      {recipeBreakdown.map((item, idx) => {
                        const maxLabel = item.isMissing
                          ? "0 max"
                          : Number.isFinite(item.maxFromRemaining)
                            ? `${item.maxFromRemaining} max`
                            : "Unlimited";

                        const maxBadgeClass =
                          item.isMissing || item.maxFromRemaining <= 0
                            ? "bg-red-50 text-red-700 border-red-200"
                            : item.isLimiting && item.maxFromRemaining <= 5
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : item.isLimiting
                                ? "bg-gray-100 text-gray-800 border-gray-300"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200";

                        return (
                          <div
                            key={item.id || `${item.ingredientId}-${idx}`}
                            className="px-4 py-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-gray-900 truncate">
                                  {item.name}
                                </span>
                                {item.isMissing && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-red-100 text-red-700 border border-red-200">
                                    Missing
                                  </span>
                                )}
                                {!item.isMissing && item.isLimiting && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-amber-50 text-amber-700 border border-amber-200">
                                    Limiting
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                                <span className="font-semibold text-gray-700">
                                  {item.quantityUsed} {item.recipeUnit}
                                </span>
                                {!item.isMissing && (
                                  <span>
                                    · {formatQuantity(item.remainingStock, item.stockUnit)} remaining
                                    {item.reservedStock > 0
                                      ? ` (${formatQuantity(item.reservedStock, item.stockUnit)} reserved)`
                                      : ""}
                                  </span>
                                )}
                              </div>
                            </div>

                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono tabular-nums border shrink-0 ${maxBadgeClass}`}
                            >
                              {maxLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {cupTrackedSizes.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="m-0 text-sm font-bold text-gray-900">Cup Stock by Size</h4>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {cupTrackedSizes.map((sz) => (
                          <div
                            key={sz.name}
                            className={`px-3 py-2 rounded-xl border text-xs flex flex-col gap-0.5 ${
                              sz.maxForSizeRemaining <= 0
                                ? "bg-red-50/70 border-red-200 text-red-700"
                                : "bg-white border-gray-200 text-gray-800"
                            }`}
                          >
                            <span className="font-bold truncate">{sz.name}</span>
                            <span className="font-mono tabular-nums font-semibold">
                              {sz.maxForSizeRemaining <= 0
                                ? "Out of stock"
                                : `${sz.maxForSizeRemaining} available`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-gray-200 bg-white text-center text-sm text-gray-600 font-medium">
                  Direct-stock item tracked by unit count (no recipe ingredients).
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
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
