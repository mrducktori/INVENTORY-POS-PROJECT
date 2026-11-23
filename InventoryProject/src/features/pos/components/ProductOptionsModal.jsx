import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  MAX_LINE_QTY,
  MAX_ADDON_QTY,
  resolveRecipeQuantityForSize,
  isSweetenerIngredient,
  getSugarScaleFactor
} from "../utils/posStockUtils";

const DEFAULT_SIZES = ["12 oz", "16 oz", "22 oz"];
const DEFAULT_ADDONS = ["Pearl", "Nata", "Jelly", "Pudding", "Extra Sugar", "Extra Ice"];
const SUGAR_LEVELS = ["0%", "25%", "50%", "75%", "100%"];
const ICE_LEVELS = ["No Ice", "Less Ice", "Normal Ice", "Extra Ice"];

const ProductOptionsModal = ({
  selectedProduct,
  editingCartItemId,
  productOptions,
  setProductOptions,
  optionsAvailability,
  optionsStock,
  productRecipes = [],
  ingredientsMap = {},
  onUpdateAddOnQty,
  onConfirm,
  onClose
}) => {
  const [limitHint, setLimitHint] = useState("");
  const [qtyInput, setQtyInput] = useState(null);

  if (!selectedProduct) return null;

  const maxLineQty = optionsStock?.maxLineQty ?? MAX_LINE_QTY;
  const stockMax = optionsStock?.stockMax ?? MAX_LINE_QTY;
  const sizeAvailability = optionsStock?.sizeAvailability || [];
  const addonMaxMap = optionsStock?.addonMaxMap || {};

  const sizesList =
    selectedProduct.sizes?.length > 0
      ? selectedProduct.sizes.map((s) => s.name)
      : DEFAULT_SIZES;

  const addonsToList =
    selectedProduct.add_ons?.length > 0
      ? selectedProduct.add_ons.map((a) => a.name)
      : DEFAULT_ADDONS;

  const availabilityLabel =
    stockMax > MAX_LINE_QTY
      ? `Available: ${stockMax} (max ${MAX_LINE_QTY})`
      : `Available: ${maxLineQty}`;

  const handleQtyInputChange = (e) => {
    const raw = e.target.value;
    if (raw === "") {
      setQtyInput("");
      return;
    }

    const val = parseInt(raw, 10);
    if (isNaN(val)) return;

    if (val > maxLineQty) {
      const clamped = Math.max(1, maxLineQty);
      setLimitHint(`Maximum available quantity is ${maxLineQty}.`);
      setProductOptions((p) => ({ ...p, qty: clamped }));
      setQtyInput(String(clamped));
      return;
    }

    setLimitHint("");
    const safeVal = Math.max(1, val);
    setQtyInput(raw);
    setProductOptions((p) => ({
      ...p,
      qty: safeVal
    }));
  };

  const handleQtyBlur = () => {
    const upper = Math.max(1, maxLineQty);
    const val = parseInt(qtyInput ?? String(productOptions.qty ?? 1), 10);
    if (isNaN(val) || val < 1) {
      setProductOptions((p) => ({ ...p, qty: 1 }));
      setLimitHint("");
    } else if (val > upper) {
      setProductOptions((p) => ({ ...p, qty: upper }));
      setLimitHint(`Maximum available quantity is ${maxLineQty}.`);
    }
    setQtyInput(null);
  };

  const displayUnitPrice = (() => {
    let price = parseFloat(selectedProduct.price) || 0;
    if (optionsAvailability.hasSizes) {
      if (selectedProduct.sizes && selectedProduct.sizes.length > 0) {
        const sz = selectedProduct.sizes.find((s) => s.name === productOptions.cupSize);
        if (sz) price += parseFloat(sz.price_add || 0);
      } else {
        if (productOptions.cupSize === "16 oz") price += 10;
        if (productOptions.cupSize === "22 oz") price += 20;
      }
    }
    if (optionsAvailability.hasAddOns) {
      Object.entries(productOptions.addOns || {}).forEach(([addonName, customerQty]) => {
        if (selectedProduct.add_ons && selectedProduct.add_ons.length > 0) {
          const ao = selectedProduct.add_ons.find((a) => a.name === addonName);
          if (ao) price += parseFloat(ao.price || 0) * (Number(customerQty) || 0);
        }
      });
    }
    return price;
  })();

  const isConfirmDisabled =
    maxLineQty <= 0 || productOptions.qty < 1 || productOptions.qty > maxLineQty;

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
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
          <h3 className="m-0 text-lg md:text-xl font-bold tracking-wide">
            {editingCartItemId ? "Edit:" : "Customize:"} {selectedProduct.name}
          </h3>
          <button
            type="button"
            className="text-gray-400 hover:text-white transition-colors bg-transparent border-none leading-none cursor-pointer p-0"
            onClick={onClose}
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[65vh] scrollbar-thin scrollbar-thumb-gray-200">
          {/* Quantity */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-gray-800">Quantity</label>
              <span
                className={`text-xs font-medium tabular-nums ${
                  maxLineQty <= 0 ? "text-red-600" : "text-gray-500"
                }`}
              >
                {availabilityLabel}
              </span>
            </div>
            <div className="flex items-center gap-1 border-2 border-gray-300 rounded-xl overflow-hidden w-40">
              <button
                type="button"
                className="flex-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold text-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-none"
                onClick={() => {
                  setQtyInput(null);
                  setLimitHint("");
                  setProductOptions((p) => ({ ...p, qty: Math.max(1, p.qty - 1) }));
                }}
                disabled={productOptions.qty <= 1}
              >
                −
              </button>
              <input
                type="number"
                min="1"
                max={Math.max(1, maxLineQty)}
                className="w-16 text-center text-gray-900 font-bold text-lg border-none focus:outline-none bg-white p-0 tabular-nums"
                value={qtyInput !== null ? qtyInput : String(productOptions.qty ?? 1)}
                onFocus={() => setQtyInput(String(productOptions.qty ?? 1))}
                onChange={handleQtyInputChange}
                onBlur={handleQtyBlur}
              />
              <button
                type="button"
                className="flex-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold text-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-none"
                onClick={() => {
                  setQtyInput(null);
                  setLimitHint("");
                  setProductOptions((p) => ({
                    ...p,
                    qty: Math.min(maxLineQty, p.qty + 1)
                  }));
                }}
                disabled={productOptions.qty >= maxLineQty || maxLineQty <= 0}
              >
                +
              </button>
            </div>
            {(limitHint || maxLineQty === 0) && (
              <p className="mt-1.5 mb-0 text-xs font-semibold text-red-600">
                {maxLineQty === 0
                  ? `No available stock remaining${optionsStock?.limitingName ? ` (limited by ${optionsStock.limitingName})` : ""}.`
                  : limitHint}
              </p>
            )}
          </div>

          {/* Cup Size - Config-driven */}
          {optionsAvailability.hasSizes && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-800 mb-2">Cup Size</label>
              <div className="flex gap-2 flex-wrap">
                {sizesList.map((size) => {
                  const sizeInfo = sizeAvailability.find((s) => s.name === size);
                  const hasCupLimit = Boolean(sizeInfo?.ingredientId);
                  const isSizeOut = (hasCupLimit && (sizeInfo?.cupRemaining ?? 0) <= 0) || (sizeInfo?.maxForSizeRemaining ?? 1) <= 0;
                  const isSelected = productOptions.cupSize === size;

                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={isSizeOut}
                      title={hasCupLimit ? `${sizeInfo.cupRemaining} cups left` : undefined}
                      className={`px-4 py-2 text-sm font-semibold rounded-xl border transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                        isSelected
                          ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                      }`}
                      onClick={() => {
                        setQtyInput(null);
                        setLimitHint("");
                        setProductOptions((p) => ({ ...p, cupSize: size }));
                      }}
                    >
                      {isSizeOut ? `${size} (Out)` : size}
                    </button>
                  );
                })}
              </div>

              {productRecipes.length > 0 && (() => {
                const selectedSizeObj = selectedProduct.sizes?.find((s) => s.name === productOptions.cupSize) || null;
                const usageEntries = productRecipes
                  .map((r) => {
                    const ing = ingredientsMap[r.ingredient_id];
                    const baseResolved = resolveRecipeQuantityForSize(r, productOptions.cupSize, selectedSizeObj);
                    const scaled = isSweetenerIngredient(ing)
                      ? baseResolved * getSugarScaleFactor(productOptions.modifiers)
                      : baseResolved;
                    const rounded = Math.round(scaled * 1000) / 1000;
                    if (rounded <= 0) return null;
                    const unit = (r.recipe_unit || ing?.unit || "").toUpperCase();
                    return `${ing?.name || "Ingredient"} ${rounded}${unit ? ` ${unit}` : ""}`;
                  })
                  .filter(Boolean);
                if (usageEntries.length === 0) return null;
                return (
                  <div className="mt-2.5 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-[11px] font-medium text-zinc-600">
                    <span className="font-bold text-zinc-800">Recipe ({productOptions.cupSize}): </span>
                    {usageEntries.slice(0, 4).join(" • ")}
                    {usageEntries.length > 4 ? ` • +${usageEntries.length - 4} more` : ""}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Modifiers (Sugar & Ice Level) */}
          {(optionsAvailability.hasSizes || optionsAvailability.hasAddOns) && (
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Sugar Level</label>
                <div className="flex gap-2 flex-wrap">
                  {SUGAR_LEVELS.map((level) => {
                    const active = (productOptions.modifiers?.sugar_level || "100%") === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() =>
                          setProductOptions((p) => ({
                            ...p,
                            modifiers: { ...(p.modifiers || {}), sugar_level: level }
                          }))
                        }
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          active
                            ? "bg-gray-900 text-white border-gray-900 shadow-xs"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                        }`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Ice Level</label>
                <div className="flex gap-2 flex-wrap">
                  {ICE_LEVELS.map((level) => {
                    const active = (productOptions.modifiers?.ice_level || "Normal Ice") === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() =>
                          setProductOptions((p) => ({
                            ...p,
                            modifiers: { ...(p.modifiers || {}), ice_level: level }
                          }))
                        }
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          active
                            ? "bg-gray-900 text-white border-gray-900 shadow-xs"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                        }`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Add-ons - Config-driven */}
          {optionsAvailability.hasAddOns && (
            <div className="mb-2">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-gray-800">Add-ons</label>
                <span className="text-xs text-gray-500 font-medium">
                  Max {MAX_ADDON_QTY} per add-on
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {addonsToList.map((addon) => {
                  const currentQty = productOptions.addOns[addon] || 0;
                  const maxAo = addonMaxMap[addon] ?? MAX_ADDON_QTY;
                  const isAddonOut = maxAo === 0 && currentQty === 0;

                  return (
                    <div
                      key={addon}
                      className={`flex flex-col p-3 rounded-xl border-2 transition-colors ${
                        isAddonOut
                          ? "bg-gray-50 border-gray-200 opacity-60"
                          : currentQty > 0
                            ? "bg-indigo-50/60 border-indigo-400"
                            : "bg-white border-gray-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <span className="text-sm font-bold text-gray-900 truncate">{addon}</span>
                        {isAddonOut && (
                          <span className="text-xs text-gray-400 shrink-0">Out</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <button
                          type="button"
                          className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center font-bold text-gray-700 hover:bg-gray-100 transition-colors text-base disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          onClick={() => onUpdateAddOnQty(addon, currentQty - 1)}
                          disabled={currentQty <= 0}
                        >
                          -
                        </button>
                        <span className="font-bold text-gray-900 text-base w-7 text-center font-mono tabular-nums">
                          {currentQty}
                        </span>
                        <button
                          type="button"
                          className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center font-bold text-gray-700 hover:bg-gray-100 transition-colors text-base disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          onClick={() => onUpdateAddOnQty(addon, currentQty + 1)}
                          disabled={currentQty >= maxAo}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            type="button"
            className="flex-1 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-2 py-2.5 bg-gray-900 rounded-xl text-sm font-semibold text-white hover:bg-black transition-all cursor-pointer border-none disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
            onClick={onConfirm}
            disabled={isConfirmDisabled}
          >
            {`${editingCartItemId ? "Update Item" : "Add to Transaction"} (₱${(
              displayUnitPrice * productOptions.qty
            ).toFixed(2)})`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProductOptionsModal;
