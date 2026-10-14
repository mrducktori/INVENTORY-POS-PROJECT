import React, { useState, useEffect } from 'react';
import { getAllProducts } from '../../api/productsApi';
import { getRecipesByProduct } from '../../api/recipesApi';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [recipe, setRecipe] = useState(null);
  const [recipeLoading, setRecipeLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getAllProducts();
      setProducts(data || []);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = async (product) => {
    setSelectedProduct(product);
    try {
      setRecipeLoading(true);
      const data = await getRecipesByProduct(product.id);
      setRecipe(data || []);
    } catch (err) {
      console.error('Failed to load recipe:', err);
      setRecipe([]);
    } finally {
      setRecipeLoading(false);
    }
  };

  const categories = ['ALL', ...new Set(products.map(p => p.category).filter(Boolean))];
  
  const filteredProducts = products.filter(p => {
    const pCat = (p.category || "").toUpperCase();
    const fCat = filter.toUpperCase();
    const matchCat = filter === 'ALL' || pCat === fCat || (fCat === 'PASTRIES' && pCat === 'PASTRY') || (fCat === 'PASTRY' && pCat === 'PASTRIES');
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch && !p.is_archived;
  });

  return (
    <div className="w-full px-6 lg:px-10 py-6 min-h-full space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-zinc-900 text-white tracking-wide">
              Product Catalog
            </span>
            <span className="text-sm font-semibold text-zinc-500">
              {products.filter(p => !p.is_archived).length} Total Menu Items
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 tracking-tight m-0">
            Products & Recipes
          </h1>
          <p className="text-base text-zinc-600 mt-1 mb-0">
            Browse all active cafe products, inventory tracking, and beverage recipes.
          </p>
        </div>

        {/* View Switcher Controls (Table vs Grid) */}
        <div className="flex items-center gap-2 bg-zinc-100 p-1.5 rounded-xl border border-zinc-200 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Table View
          </button>

          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Grid Cards View
          </button>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="bg-white border border-gray-200/90 shadow-xs rounded-2xl overflow-hidden w-full">
        {/* Search & Category Filter Toolbar */}
        <div className="px-6 py-5 border-b border-gray-100 bg-zinc-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="m-0 text-lg font-bold text-zinc-900 tracking-tight">
              Product Catalog
            </h2>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-200 text-zinc-700">
              {filteredProducts.length} Showing
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full sm:w-72 px-4 py-2.5 bg-white border border-zinc-300 rounded-xl text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all shadow-xs"
              />
            </div>

            <select 
              value={filter} 
              onChange={e => setFilter(e.target.value)}
              className="w-full sm:w-52 px-4 py-2.5 bg-white border border-zinc-300 rounded-xl text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all shadow-xs cursor-pointer"
            >
              {categories.map(c => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
              <span className="text-sm font-medium text-zinc-500">Loading catalog...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-20 px-6 flex flex-col items-center justify-center text-center">
              <svg className="w-12 h-12 mb-3 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-base font-bold text-zinc-800 m-0 mb-1">No products found</h3>
              <p className="text-sm text-zinc-500 m-0">Try adjusting your search query or category filter.</p>
            </div>
          ) : viewMode === 'table' ? (
            /* ================= MODE 1: TABLE VIEW ================= */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="px-6 py-4 text-xs font-bold text-zinc-600 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-600 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-600 uppercase tracking-wider text-right">
                      Price
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-600 uppercase tracking-wider text-center">
                      Stock Status
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-600 uppercase tracking-wider text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredProducts.map(product => (
                    <tr key={product.id} className="hover:bg-zinc-50/70 transition-colors">
                      {/* Product Name & Photo */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3.5">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-12 h-12 rounded-xl object-cover border border-zinc-200/90 shadow-2xs shrink-0 bg-zinc-100"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 shrink-0">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-base font-extrabold text-zinc-900 block truncate">
                              {product.name}
                            </span>
                            {product.description && (
                              <span className="text-xs text-zinc-500 line-clamp-1">
                                {product.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-6 py-4 text-sm font-semibold text-zinc-700 uppercase tracking-wide">
                        {product.category}
                      </td>

                      {/* Price */}
                      <td className="px-6 py-4 text-base font-black text-zinc-900 text-right tabular-nums">
                        ₱{parseFloat(product.price).toFixed(2)}
                      </td>

                      {/* Stock Status */}
                      <td className="px-6 py-4 text-center">
                        {product.track_stock ? (
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                            product.stock_quantity <= 0 
                              ? 'bg-rose-50 text-rose-700 border-rose-200' 
                              : product.stock_quantity <= product.low_stock_threshold 
                              ? 'bg-amber-50 text-amber-700 border-amber-200' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {product.stock_quantity} in stock
                          </span>
                        ) : (
                          <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600 border border-zinc-200">
                            Recipe based
                          </span>
                        )}
                      </td>

                      {/* View Recipe Button */}
                      <td className="px-6 py-4 text-right">
                        <button 
                          type="button"
                          onClick={() => handleProductClick(product)}
                          className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                        >
                          View Recipe
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* ================= MODE 2: GRID / CARDS VIEW ================= */
            <div className="p-6 md:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    className="bg-white border border-zinc-200/90 rounded-2xl overflow-hidden shadow-xs hover:border-zinc-400 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Product Card Image Banner */}
                      <div className="relative h-48 w-full bg-zinc-100 overflow-hidden">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
                            <svg className="w-10 h-10 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs font-semibold">No Image</span>
                          </div>
                        )}

                        {/* Category Badge on top of image */}
                        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-black/75 text-white backdrop-blur-xs">
                          {product.category}
                        </span>

                        {/* Stock Tag on image */}
                        <div className="absolute top-3 right-3">
                          {product.track_stock ? (
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider backdrop-blur-xs shadow-xs ${
                              product.stock_quantity <= 0 
                                ? 'bg-rose-500 text-white' 
                                : product.stock_quantity <= product.low_stock_threshold 
                                ? 'bg-amber-500 text-white' 
                                : 'bg-emerald-600 text-white'
                            }`}>
                              {product.stock_quantity} in stock
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-zinc-900/80 text-white backdrop-blur-xs">
                              Recipe based
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-5">
                        <h3 className="text-base font-extrabold text-zinc-900 m-0 mb-1 line-clamp-1" title={product.name}>
                          {product.name}
                        </h3>

                        <div className="text-xl font-black text-zinc-900 tabular-nums">
                          ₱{parseFloat(product.price).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Button */}
                    <div className="p-5 pt-0">
                      <button
                        type="button"
                        onClick={() => handleProductClick(product)}
                        className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                      >
                        View Recipe
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recipe Modal */}
      {selectedProduct && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" 
          onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedProduct(null); }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-[popIn_0.2s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                {selectedProduct.image_url && (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="w-12 h-12 rounded-xl object-cover border border-white/20 shadow-sm"
                  />
                )}
                <div>
                  <span className="text-xs md:text-sm font-bold text-zinc-400 uppercase tracking-wider block">
                    Recipe Breakdown
                  </span>
                  <h3 className="m-0 text-xl md:text-2xl font-black text-white tracking-wide">
                    {selectedProduct.name}
                  </h3>
                </div>
              </div>
              <button 
                type="button"
                className="text-zinc-400 hover:text-white transition-colors bg-transparent border-none text-2xl leading-none cursor-pointer p-1" 
                onClick={() => setSelectedProduct(null)}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-0 overflow-y-auto max-h-[60vh]">
              {recipeLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2">
                  <div className="w-7 h-7 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
                  <span className="text-sm text-zinc-500 font-semibold">Loading recipe items...</span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-100/80 border-b border-zinc-200">
                      <th className="px-6 py-4 text-xs md:text-sm font-bold text-zinc-700 uppercase tracking-wider">
                        Ingredient
                      </th>
                      <th className="px-6 py-4 text-xs md:text-sm font-bold text-zinc-700 uppercase tracking-wider text-right">
                        Quantity Used
                      </th>
                      <th className="px-6 py-4 text-xs md:text-sm font-bold text-zinc-700 uppercase tracking-wider">
                        Unit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {recipe && recipe.length > 0 ? (
                      recipe.map(r => (
                        <tr key={r.id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm md:text-base font-bold text-zinc-900">
                            {r.ingredients?.name}
                          </td>
                          <td className="px-6 py-4 text-sm md:text-base font-bold font-mono text-zinc-900 text-right tabular-nums">
                            {r.quantity_used}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-zinc-700 uppercase">
                            {(r.recipe_unit || r.ingredients?.unit || '').toUpperCase()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="px-6 py-10 text-center text-sm md:text-base font-medium text-zinc-500 italic">
                          No ingredient recipe details configured for this product.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex justify-end">
              <button 
                type="button"
                className="px-6 py-2.5 bg-zinc-900 hover:bg-black text-white rounded-xl text-sm md:text-base font-bold transition-colors cursor-pointer" 
                onClick={() => setSelectedProduct(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
