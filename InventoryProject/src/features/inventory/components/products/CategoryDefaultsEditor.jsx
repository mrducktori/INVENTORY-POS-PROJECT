import React from 'react';
import SearchableIngredientSelect from '../../../../components/shared/SearchableIngredientSelect';

const RemoveButton = ({ onClick, label }) => (
  <button
    type="button"
    className="text-gray-400 hover:text-red-600 transition-colors bg-transparent border-none cursor-pointer p-0"
    onClick={onClick}
    aria-label={label}
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
);

const CategoryDefaultsEditor = ({
  allIngredients,
  editSizes,
  newSize,
  onNewSizeChange,
  onAddSize,
  onRemoveSize,
  editAddOns,
  newAddOn,
  onNewAddOnChange,
  onAddAddOn,
  onRemoveAddOn
}) => {
  return (
    <div className="flex flex-col xl:flex-row gap-5 bg-gray-50 p-4 rounded-xl border border-gray-100">
      {/* SIZES CONFIGURATION */}
      <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <h3 className="m-0 text-base font-black text-gray-900 mb-3 tracking-tight">Default Sizes</h3>
        {editSizes.length > 0 ? (
          <div className="overflow-x-auto mb-4 border border-gray-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200">
                  <th className="px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Size Name</th>
                  <th className="px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Price Add (₱)</th>
                  <th className="px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Cup Mat.</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editSizes.map((sz, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2 text-xs md:text-sm font-bold text-gray-900">{sz.name}</td>
                    <td className="px-3 py-2 text-xs md:text-sm font-bold text-gray-800">+{sz.price_add}</td>
                    <td className="px-3 py-2 text-xs md:text-sm text-gray-700 font-medium whitespace-normal break-words">
                      {allIngredients.find((ing) => ing.id === sz.ingredient_id)?.name || '-'}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <RemoveButton onClick={() => onRemoveSize(i)} label="Remove size" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs md:text-sm text-gray-500 italic mb-4">No default sizes.</p>
        )}

        <div className="flex flex-col gap-2.5 p-3.5 bg-gray-50 rounded-lg border border-gray-200">
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs md:text-sm font-medium focus:outline-none focus:border-gray-900 bg-white"
            placeholder="Size Name (e.g., 16 oz)"
            value={newSize.name}
            onChange={(e) => onNewSizeChange({ ...newSize, name: e.target.value })}
          />
          <input
            type="number"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs md:text-sm font-medium focus:outline-none focus:border-gray-900 bg-white"
            placeholder="Price Increase (₱)"
            value={newSize.price_add}
            onChange={(e) => onNewSizeChange({ ...newSize, price_add: e.target.value })}
            min="0"
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Cup Material (Optional)</label>
            <SearchableIngredientSelect
              ingredients={allIngredients}
              value={newSize.ingredient_id}
              onChange={(id) => onNewSizeChange({ ...newSize, ingredient_id: id })}
              placeholder="Search cup material (e.g. 16 oz cups)..."
            />
          </div>

          <button
            type="button"
            className="w-full py-2 bg-white border border-gray-300 text-gray-800 text-xs md:text-sm font-bold uppercase tracking-wider rounded-lg hover:bg-gray-100 transition-colors mt-1 cursor-pointer"
            onClick={onAddSize}
          >
            Add Default Size
          </button>
        </div>
      </div>

      {/* ADD-ONS CONFIGURATION */}
      <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <h3 className="m-0 text-base font-black text-gray-900 mb-3 tracking-tight">Default Add-ons</h3>
        {editAddOns.length > 0 ? (
          <div className="overflow-x-auto mb-4 border border-gray-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200">
                  <th className="px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Add-on</th>
                  <th className="px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Price (₱)</th>
                  <th className="px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Mat. Used</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editAddOns.map((ao, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2 text-xs md:text-sm font-bold text-gray-900">{ao.name}</td>
                    <td className="px-3 py-2 text-xs md:text-sm font-bold text-gray-800">+{ao.price}</td>
                    <td className="px-3 py-2 text-xs md:text-sm text-gray-700 font-medium whitespace-normal break-words">
                      {ao.quantity}{ao.unit} {allIngredients.find((ing) => ing.id === ao.ingredient_id)?.name || '-'}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <RemoveButton onClick={() => onRemoveAddOn(i)} label="Remove add-on" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs md:text-sm text-gray-500 italic mb-4">No default add-ons.</p>
        )}

        <div className="flex flex-col gap-2.5 p-3.5 bg-gray-50 rounded-lg border border-gray-200">
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs md:text-sm font-medium focus:outline-none focus:border-gray-900 bg-white"
            placeholder="Add-on Name (e.g., Pearl)"
            value={newAddOn.name}
            onChange={(e) => onNewAddOnChange({ ...newAddOn, name: e.target.value })}
          />
          <input
            type="number"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs md:text-sm font-medium focus:outline-none focus:border-gray-900 bg-white"
            placeholder="Price (₱)"
            value={newAddOn.price}
            onChange={(e) => onNewAddOnChange({ ...newAddOn, price: e.target.value })}
            min="0"
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Inventory Material Used (Optional)</label>
            <SearchableIngredientSelect
              ingredients={allIngredients}
              value={newAddOn.ingredient_id}
              onChange={(id, ing) => {
                onNewAddOnChange({
                  ...newAddOn,
                  ingredient_id: id,
                  unit: (ing?.unit || '').toUpperCase()
                });
              }}
              placeholder="Search material used (e.g. Tapioca, Syrup)..."
            />
          </div>

          {newAddOn.ingredient_id && (
            <div className="flex gap-2 items-center">
              <input
                type="number"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs md:text-sm font-medium focus:outline-none focus:border-gray-900 bg-white"
                placeholder="Qty Used"
                value={newAddOn.quantity}
                onChange={(e) => onNewAddOnChange({ ...newAddOn, quantity: e.target.value })}
                min="0"
              />
              <span className="flex items-center justify-center px-3.5 py-2 bg-gray-200 rounded-lg text-xs md:text-sm font-bold text-gray-800">
                {newAddOn.unit}
              </span>
            </div>
          )}
          <button
            type="button"
            className="w-full py-2 bg-white border border-gray-300 text-gray-800 text-xs md:text-sm font-bold uppercase tracking-wider rounded-lg hover:bg-gray-100 transition-colors mt-1 cursor-pointer"
            onClick={onAddAddOn}
          >
            Add Default Add-on
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryDefaultsEditor;
