import React from 'react';
import ProductOptionsEditor from './ProductOptionsEditor';

const CategoryDefaultsEditor = ({
  allIngredients = [],
  prepStation = 'BARISTA',
  onPrepStationChange,
  editSizes = [],
  onAddSize,
  onRemoveSize,
  onUpdateSize,
  editAddOns = [],
  onAddAddOn,
  onRemoveAddOn,
  onSetBaseSize
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="block text-xs font-extrabold text-gray-900 uppercase tracking-wider">
            Order Queue / KDS Prep Station
          </span>
          <span className="block text-xs text-gray-500 font-medium mt-0.5">
            Routes orders containing items in this category to the right screen.
          </span>
        </div>

        <div className="inline-flex p-1 bg-white border border-gray-200 rounded-xl gap-1 shrink-0">
          {[
            { id: 'BARISTA', label: 'Barista Station (Drinks)' },
            { id: 'KITCHEN', label: 'Kitchen Station (Food & Pastries)' }
          ].map((opt) => {
            const active = prepStation === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onPrepStationChange?.(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border-none ${
                  active
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <ProductOptionsEditor
        allIngredients={allIngredients}
        sizes={editSizes}
        onAddSize={onAddSize}
        onRemoveSize={onRemoveSize}
        onUpdateSize={onUpdateSize}
        addOns={editAddOns}
        onAddAddOn={onAddAddOn}
        onRemoveAddOn={onRemoveAddOn}
        onSetBaseSize={onSetBaseSize}
      />
    </div>
  );
};

export default CategoryDefaultsEditor;
