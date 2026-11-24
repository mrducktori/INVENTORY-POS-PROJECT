import React, { useState } from 'react';
import { CATEGORIES } from '../../../../utils/constants';
import ProductOptionsEditor from './ProductOptionsEditor';

const AddProductFormSection = ({
  formData,
  categories,
  allIngredients = [],
  uploading,
  onInputChange,
  onImageUpload,
  onAddFormSize,
  onRemoveFormSize,
  onUpdateFormSize,
  onAddFormAddOn,
  onRemoveFormAddOn,
  onSubmit
}) => {
  const [showOptionsEditor, setShowOptionsEditor] = useState(false);
  const categoryOptions =
    Array.isArray(categories) && categories.length > 0
      ? categories
      : CATEGORIES.filter((c) => c !== 'OTHERS');

  const sizeCount = formData.sizes?.length || 0;
  const addOnCount = formData.add_ons?.length || 0;

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden flex-1 max-w-2xl">
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 ">
        <h2 className="m-0 text-lg md:text-xl font-bold text-gray-900 tracking-tight">Add New Product</h2>
      </div>
      <div className="p-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Product Name</label>
            <input type="text" maxLength={100} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors" name="name" value={formData.name} onChange={onInputChange} required />
          </div>

          <div className="flex flex-col sm:flex-row gap-5">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Category</label>
              <select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors cursor-pointer" name="category" value={formData.category} onChange={onInputChange} required>
                <option value="">Select Category</option>
                {categoryOptions.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Price (₱)</label>
              <input type="number" step="0.01" min="0.01" max="100000" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors" name="price" value={formData.price} onChange={onInputChange} required />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Product Image</label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onImageUpload(e, false)}
                disabled={uploading}
                className="text-sm md:text-base text-gray-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border file:border-gray-300 file:text-xs md:file:text-sm file:font-bold file:bg-gray-100 file:text-gray-800 hover:file:bg-gray-200 cursor-pointer"
              />
              {uploading && <span className="text-sm text-blue-600 font-bold animate-pulse">Uploading...</span>}
            </div>
            {formData.image_url && !uploading && (
              <div className="mt-2">
                <img src={formData.image_url} alt="Preview" className="w-16 h-16 object-cover rounded-lg shadow-sm border border-gray-200" />
              </div>
            )}
          </div>

          <div className="flex items-start gap-4 p-4 bg-gray-50 border border-gray-100 rounded-xl mt-2">
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input type="checkbox" className="sr-only peer" name="track_stock" checked={formData.track_stock} onChange={onInputChange} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
            </label>
            <div className="flex flex-col">
              <span className="text-sm md:text-base font-bold text-gray-900">Direct Stock Tracking</span>
              <span className="text-xs md:text-sm text-gray-600 mt-1 font-medium">Enable for resellable items like pastries, drinks, etc. rather than recipe-based assembly.</span>
            </div>
          </div>

          {formData.track_stock && (
            <div className="flex flex-col sm:flex-row gap-5 p-4 bg-orange-50/50 border border-orange-100 rounded-xl">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Initial Stock Level</label>
                <input type="number" value="0" disabled className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm md:text-base text-gray-500 cursor-not-allowed" />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Low Stock Alert at</label>
                <input type="number" className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm md:text-base font-semibold focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors" name="low_stock_threshold" value={formData.low_stock_threshold} onChange={onInputChange} min="0" max="1000000" required />
              </div>
            </div>
          )}

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOptionsEditor((prev) => !prev)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left border-none cursor-pointer transition-colors"
            >
              <div>
                <span className="block text-xs md:text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Cup Sizes & Add-ons
                </span>
                <span className="block text-[11px] text-gray-500 font-medium mt-0.5">
                  {sizeCount} size(s), {addOnCount} add-on(s) {formData.category ? `• Auto-filled from ${formData.category}` : '• Select a category to auto-fill defaults'}
                </span>
              </div>
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                {showOptionsEditor ? 'Hide' : 'Configure'}
              </span>
            </button>
            {showOptionsEditor && (
              <div className="p-3 bg-white border-t border-gray-200">
                <ProductOptionsEditor
                  allIngredients={allIngredients}
                  sizes={formData.sizes || []}
                  onAddSize={onAddFormSize}
                  onRemoveSize={onRemoveFormSize}
                  onUpdateSize={onUpdateFormSize}
                  addOns={formData.add_ons || []}
                  onAddAddOn={onAddFormAddOn}
                  onRemoveAddOn={onRemoveFormAddOn}
                  compact
                />
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100 mt-2">
            <button type="submit" className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm md:text-base font-bold uppercase tracking-wider hover:bg-black hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer">Add Product</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProductFormSection;
