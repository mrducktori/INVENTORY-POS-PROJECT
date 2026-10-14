import React from 'react';

const ProductCard = ({ product, onClick, onViewRecipe }) => {
  const getStockStatus = () => {
    if (!product.track_stock) return 'recipe-based';
    if (product.stock_quantity <= 0) return 'out';
    if (product.stock_quantity <= product.low_stock_threshold) return 'critical';
    if (product.stock_quantity <= product.low_stock_threshold * 1.5) return 'warning';
    return 'normal';
  };

  const status = getStockStatus();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow relative group">
      <div className={`absolute top-0 left-0 w-full h-1 ${status === 'out' ? 'bg-red-500' : status === 'critical' ? 'bg-orange-500' : status === 'warning' ? 'bg-yellow-400' : status === 'normal' ? 'bg-green-500' : 'bg-gray-300'}`} title={status === 'recipe-based' ? 'Recipe based' : `${product.stock_quantity} in stock`}></div>
      <div className="p-4 flex-1 flex flex-col pt-5">
        <h4 className="font-semibold text-gray-900 m-0 leading-tight">{product.name}</h4>
        <p className="text-xs text-gray-500 mt-1 mb-2">{product.category}</p>
        <p className="font-bold text-gray-900 mt-auto">₱{product.price?.toFixed(2)}</p>
      </div>
      <div className="flex border-t border-gray-100">
        <button
          className="flex-1 py-2.5 text-xs font-medium text-gray-600 bg-white hover:text-gray-900 hover:bg-gray-50 transition-colors border-r border-gray-100 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onViewRecipe(product); }}
          title="View Ingredients"
        >
          Info
        </button>
        <button className="flex-1 py-2.5 text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => onClick(product)}>
          + Add
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
