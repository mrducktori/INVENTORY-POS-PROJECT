import React from 'react';

const ProductCard = ({ product, onClick, onViewRecipe }) => {
  const getStockStatus = () => {
    if (product.has_recipe !== false && !product.track_stock) return 'recipe-based';
    if (product.stock_quantity <= 0) return 'out';
    if (product.stock_quantity <= product.low_stock_threshold) return 'critical';
    if (product.stock_quantity <= product.low_stock_threshold * 1.5) return 'warning';
    return 'normal';
  };

  const status = getStockStatus();
  // Treat as direct out of stock if it explicitly tracks stock, or if we know it has no recipe
  const treatsAsDirect = product.track_stock || product.has_recipe === false;
  const isDirectOut = treatsAsDirect && product.stock_quantity <= 0;
  
  // A product is unavailable if the backend says so (for recipes) OR if it's a direct item with no stock
  const isUnavailable = product.is_available === false || isDirectOut;

  return (
    <div className={`relative bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col transition-all duration-200 shadow-sm hover:shadow-md ${isUnavailable ? 'opacity-60 grayscale select-none' : 'hover:-translate-y-1'}`}>
      <div className={`absolute top-0 left-0 right-0 h-1 z-10 ${status === 'out' ? 'bg-red-600' : status === 'critical' ? 'bg-red-500' : status === 'warning' ? 'bg-orange-400' : status === 'recipe-based' ? 'bg-white-500' : 'bg-gray-900'}`} title={isUnavailable ? (isDirectOut ? 'Out of stock' : 'Insufficient Ingredients') : (status === 'recipe-based' ? 'Recipe based' : `${product.stock_quantity} in stock`)}></div>
      <div className="flex-1 p-5 pb-3 flex flex-col">
        <h4 className="m-0 text-sm md:text-base font-bold text-gray-900 leading-tight mb-1">{product.name}</h4>
        <p className="m-0 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{product.category}</p>
        <p className="m-0 text-base font-extrabold text-gray-900 mt-auto">₱{product.price?.toFixed(2)}</p>
        {isUnavailable && <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600/90 text-white px-3 py-1.5 rounded text-sm md:text-base font-bold uppercase tracking-wider whitespace-nowrap shadow-md z-20">{isDirectOut ? 'OUT OF STOCK' : 'UNAVAILABLE'}</p>}
      </div>
      <div className="flex border-t border-gray-100 bg-gray-50/50 mt-auto">
        <button
          className="flex-1 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-r border-gray-100 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          onClick={(e) => { e.stopPropagation(); onViewRecipe(product); }}
          title="View Ingredients"
        >
          Info
        </button>
        <button className="flex-1 py-3 text-[11px] font-bold uppercase tracking-wider bg-white text-gray-900 hover:bg-gray-900 hover:text-white transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed" disabled={isUnavailable} onClick={() => onClick(product)}>
          {isUnavailable ? 'N/A' : '+ Add'}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
