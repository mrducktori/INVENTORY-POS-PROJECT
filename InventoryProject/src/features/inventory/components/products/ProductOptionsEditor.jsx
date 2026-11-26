import React, { useState } from 'react';
import SearchableIngredientSelect from '../../../../components/shared/SearchableIngredientSelect';
import { isBaseSize } from '../../hooks/sizeUtils';

const RemoveIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SizeOfferToggles = ({ sizes = [], hiddenSizes = [], onChange, categoryName }) => {
  const visibleCount = sizes.filter((s) => !hiddenSizes.includes(s.name)).length;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
      <h4 className="m-0 text-sm font-extrabold text-gray-900 uppercase tracking-wider">Offered in</h4>
      {sizes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {sizes.map((sz, idx) => {
            const on = !hiddenSizes.includes(sz.name);
            const isLast = on && visibleCount <= 1;
            return (
              <button
                key={`${sz.name}-${idx}`}
                type="button"
                disabled={isLast}
                title={isLast ? 'At least one size must stay on' : undefined}
                onClick={() => onChange(on ? [...hiddenSizes, sz.name] : hiddenSizes.filter((n) => n !== sz.name))}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-300 line-through hover:bg-gray-100'}`}
              >
                {sz.name}
                {isBaseSize(sizes, idx) && <span className="ml-1.5 text-[10px] uppercase opacity-80">Base</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-500 italic m-0">No sizes in this category.</p>
      )}
      <p className="text-[11px] text-gray-500 m-0">
        Sizes come from the {categoryName || 'selected'} category. Edit them in Manage Categories.
      </p>
    </div>
  );
};

const ProductOptionsEditor = ({
  allIngredients = [],
  sizes = [],
  onAddSize,
  onRemoveSize,
  onUpdateSize,
  addOns = [],
  onAddAddOn,
  onRemoveAddOn,
  onSetBaseSize,
  hideSizes = false
}) => {
  const [newSize, setNewSize] = useState({
    name: '',
    price_add: '',
    ingredient_id: '',
    lid_ingredient_id: '',
    straw_ingredient_id: '',
    recipe_multiplier: '1',
    dine_in_no_cup: false
  });

  const [newAddOn, setNewAddOn] = useState({
    name: '',
    price: '',
    ingredient_id: '',
    quantity: '',
    unit: ''
  });

  const [editingSizeIdx, setEditingSizeIdx] = useState(null);

  const hasBase = sizes.some((s) => s.is_base);
  const getIngName = (id) => {
    if (!id) return '-';
    return allIngredients.find((ing) => ing.id === id)?.name || '-';
  };

  const handleCreateSize = () => {
    if (!newSize.name.trim()) return;
    const ok = onAddSize({
      ...newSize,
      name: newSize.name.trim(),
      price_add: newSize.price_add === '' ? 0 : newSize.price_add,
      recipe_multiplier: newSize.recipe_multiplier === '' ? 1 : newSize.recipe_multiplier,
      dine_in_no_cup: Boolean(newSize.dine_in_no_cup)
    });
    if (ok !== false) {
      setNewSize({
        name: '',
        price_add: '',
        ingredient_id: '',
        lid_ingredient_id: '',
        straw_ingredient_id: '',
        recipe_multiplier: '1',
        dine_in_no_cup: false
      });
    }
  };

  const handleCreateAddOn = () => {
    if (!newAddOn.name.trim()) return;
    const ok = onAddAddOn({
      ...newAddOn,
      name: newAddOn.name.trim(),
      price: newAddOn.price === '' ? 0 : newAddOn.price,
      quantity: newAddOn.quantity === '' ? 0 : newAddOn.quantity
    });
    if (ok !== false) {
      setNewAddOn({ name: '', price: '', ingredient_id: '', quantity: '', unit: '' });
    }
  };

  return (
    <div className={`grid grid-cols-1 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200`}>
      {!hideSizes && (
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="m-0 text-sm font-extrabold text-gray-900 uppercase tracking-wider">Cup Sizes</h4>
          <span className="text-[11px] font-bold text-gray-500">{sizes.length} configured</span>
        </div>

        {sizes.length > 0 ? (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
            {sizes.map((sz, idx) => {
              const isEditing = editingSizeIdx === idx && typeof onUpdateSize === 'function';
              return (
                <div key={`${sz.name}-${idx}`} className="p-2.5 bg-white hover:bg-gray-50/60">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs md:text-sm font-bold text-gray-900">{sz.name}</span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          +₱{Number(sz.price_add || 0).toFixed(2)}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                          ×{Number(sz.recipe_multiplier) > 0 ? sz.recipe_multiplier : 1}
                        </span>
                        {typeof onSetBaseSize === 'function' && (sz.is_base || (!hasBase && idx === 0)) && (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                            Base
                          </span>
                        )}
                        {sz.dine_in_no_cup && (
                          <span className="text-[10px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">
                            Dine-In: No Cup
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>Cup: <strong className="text-gray-700">{getIngName(sz.ingredient_id)}</strong></span>
                        {sz.lid_ingredient_id && (
                          <span>Lid: <strong className="text-gray-700">{getIngName(sz.lid_ingredient_id)}</strong></span>
                        )}
                        {sz.straw_ingredient_id && (
                          <span>Straw: <strong className="text-gray-700">{getIngName(sz.straw_ingredient_id)}</strong></span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {typeof onSetBaseSize === 'function' && !(sz.is_base || (!hasBase && idx === 0)) && (
                        <button
                          type="button"
                          onClick={() => onSetBaseSize(idx)}
                          className="px-2 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded cursor-pointer border-none"
                        >
                          Set as base
                        </button>
                      )}
                      {typeof onUpdateSize === 'function' && (
                        <button
                          type="button"
                          onClick={() => setEditingSizeIdx(isEditing ? null : idx)}
                          className="px-2 py-1 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer border-none"
                        >
                          {isEditing ? 'Done' : 'Edit'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (editingSizeIdx === idx) setEditingSizeIdx(null);
                          onRemoveSize(idx);
                        }}
                        className="text-gray-400 hover:text-red-600 transition-colors bg-transparent border-none cursor-pointer p-1"
                        aria-label={`Remove size ${sz.name}`}
                      >
                        <RemoveIcon />
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-2.5 pt-2.5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Price Add (₱)</label>
                        <input
                          type="number"
                          min="0"
                          max="50000"
                          step="0.01"
                          value={sz.price_add ?? 0}
                          onChange={(e) => onUpdateSize(idx, { price_add: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                          className="px-2.5 py-1.5 border border-gray-300 rounded text-xs font-semibold bg-white"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Recipe Multiplier (0.1 - 10)</label>
                        <input
                          type="number"
                          min="0.1"
                          max="10"
                          step="0.05"
                          value={sz.recipe_multiplier ?? 1}
                          onChange={(e) => onUpdateSize(idx, { recipe_multiplier: e.target.value === '' ? 1 : parseFloat(e.target.value) || 1 })}
                          className="px-2.5 py-1.5 border border-gray-300 rounded text-xs font-semibold bg-white"
                        />
                      </div>
                      <div className="flex flex-col gap-1 sm:col-span-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Cup Material</label>
                        <SearchableIngredientSelect
                          ingredients={allIngredients}
                          value={sz.ingredient_id || ''}
                          onChange={(id) => onUpdateSize(idx, { ingredient_id: id })}
                          placeholder="Search cup material..."
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Lid Material (Take-Out)</label>
                        <SearchableIngredientSelect
                          ingredients={allIngredients}
                          value={sz.lid_ingredient_id || ''}
                          onChange={(id) => onUpdateSize(idx, { lid_ingredient_id: id })}
                          placeholder="Optional lid..."
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Straw Material (Take-Out)</label>
                        <SearchableIngredientSelect
                          ingredients={allIngredients}
                          value={sz.straw_ingredient_id || ''}
                          onChange={(id) => onUpdateSize(idx, { straw_ingredient_id: id })}
                          placeholder="Optional straw..."
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 sm:col-span-2 cursor-pointer select-none pt-1">
                        <input
                          type="checkbox"
                          checked={Boolean(sz.dine_in_no_cup)}
                          onChange={(e) => onUpdateSize(idx, { dine_in_no_cup: e.target.checked })}
                          className="w-3.5 h-3.5 accent-gray-900"
                        />
                        <span>Skip cup deduction on Dine-In (glassware used)</span>
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic m-0">No cup sizes configured yet.</p>
        )}

        <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="flex flex-col gap-1"><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Size</label><input
              type="text"
              maxLength={40}
              placeholder="e.g. 16 oz"
              value={newSize.name}
              onChange={(e) => setNewSize({ ...newSize, name: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:border-gray-900"
            /></div>
            <div className="flex flex-col gap-1"><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Extra price (₱)</label><input
              type="number"
              min="0"
              max="50000"
              step="0.01"
              placeholder="0"
              value={newSize.price_add}
              onChange={(e) => setNewSize({ ...newSize, price_add: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:border-gray-900"
            /></div>
            <div className="flex flex-col gap-1"><label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Recipe multiplier</label><input
              type="number"
              min="0.1"
              max="10"
              step="0.05"
              placeholder="1"
              value={newSize.recipe_multiplier}
              onChange={(e) => setNewSize({ ...newSize, recipe_multiplier: e.target.value })}
              title="Fallback recipe multiplier (0.1 - 10)"
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:border-gray-900"
            /></div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Cup Material (Optional)</label>
            <SearchableIngredientSelect
              ingredients={allIngredients}
              value={newSize.ingredient_id}
              onChange={(id) => setNewSize({ ...newSize, ingredient_id: id })}
              placeholder="Search cup material..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Lid (Take-Out / Delivery)</label>
              <SearchableIngredientSelect
                ingredients={allIngredients}
                value={newSize.lid_ingredient_id}
                onChange={(id) => setNewSize({ ...newSize, lid_ingredient_id: id })}
                placeholder="Optional lid..."
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Straw (Take-Out / Delivery)</label>
              <SearchableIngredientSelect
                ingredients={allIngredients}
                value={newSize.straw_ingredient_id}
                onChange={(id) => setNewSize({ ...newSize, straw_ingredient_id: id })}
                placeholder="Optional straw..."
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={Boolean(newSize.dine_in_no_cup)}
              onChange={(e) => setNewSize({ ...newSize, dine_in_no_cup: e.target.checked })}
              className="w-3.5 h-3.5 accent-gray-900"
            />
            <span>Skip cup deduction on Dine-In</span>
          </label>

          <button
            type="button"
            onClick={handleCreateSize}
            className="w-full py-2 bg-white border border-gray-300 text-gray-800 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Add Cup Size
          </button>
        </div>
      </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="m-0 text-sm font-extrabold text-gray-900 uppercase tracking-wider">Add-ons</h4>
          <span className="text-[11px] font-bold text-gray-500">{addOns.length} configured</span>
        </div>

        {addOns.length > 0 ? (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
            {addOns.map((ao, idx) => (
              <div key={`${ao.name}-${idx}`} className="p-2.5 flex items-center justify-between gap-2 bg-white hover:bg-gray-50/60">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs md:text-sm font-bold text-gray-900">{ao.name}</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      +₱{Number(ao.price || 0).toFixed(2)}
                    </span>
                  </div>
                  {ao.ingredient_id && (
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Deducts {ao.quantity || 0} {ao.unit || ''} of <strong className="text-gray-700">{getIngName(ao.ingredient_id)}</strong>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveAddOn(idx)}
                  className="text-gray-400 hover:text-red-600 transition-colors bg-transparent border-none cursor-pointer p-1"
                  aria-label={`Remove add-on ${ao.name}`}
                >
                  <RemoveIcon />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic m-0">No add-ons configured yet.</p>
        )}

        <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 mt-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              maxLength={40}
              placeholder="Add-on Name (e.g. Pearl)"
              value={newAddOn.name}
              onChange={(e) => setNewAddOn({ ...newAddOn, name: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:border-gray-900"
            />
            <input
              type="number"
              min="0"
              max="50000"
              step="0.01"
              placeholder="Price (₱)"
              value={newAddOn.price}
              onChange={(e) => setNewAddOn({ ...newAddOn, price: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:border-gray-900"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Material Used (Optional)</label>
            <SearchableIngredientSelect
              ingredients={allIngredients}
              value={newAddOn.ingredient_id}
              onChange={(id, ing) => setNewAddOn({
                ...newAddOn,
                ingredient_id: id,
                unit: (ing?.unit || '').toUpperCase()
              })}
              placeholder="Search material used..."
            />
          </div>

          {newAddOn.ingredient_id && (
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="0"
                max="100000"
                step="any"
                placeholder="Qty Used"
                value={newAddOn.quantity}
                onChange={(e) => setNewAddOn({ ...newAddOn, quantity: e.target.value })}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:border-gray-900"
              />
              <span className="px-3 py-1.5 bg-gray-200 rounded-lg text-xs font-bold text-gray-800">
                {newAddOn.unit || 'UNIT'}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleCreateAddOn}
            className="w-full py-2 bg-white border border-gray-300 text-gray-800 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Add Add-on
          </button>
        </div>
      </div>
    </div>
  );
};

export { SizeOfferToggles };
export default ProductOptionsEditor;
