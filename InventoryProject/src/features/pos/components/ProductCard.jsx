import React from 'react';

const ProductCard = ({ product, stockSummary, onClick, onViewRecipe }) => {
  const treatsAsDirect = product.track_stock || product.has_recipe === false;
  const fallbackTotal = treatsAsDirect
    ? Math.max(0, Math.floor(parseFloat(product.stock_quantity) || 0))
    : (product.max_orderable ?? (product.is_available === false ? 0 : 1));

  const totalPossible = stockSummary?.totalPossible ?? fallbackTotal;
  const remainingOrderable = stockSummary?.remainingOrderable ?? fallbackTotal;
  const isAllInCart = remainingOrderable <= 0 && totalPossible > 0;
  const isUnavailable = remainingOrderable <= 0;
  const isDirectOut = treatsAsDirect && totalPossible <= 0;

  const lowThreshold = treatsAsDirect
    ? Math.max(5, Number(product.low_stock_threshold) || 5)
    : 5;
  const isLow = remainingOrderable > 0 && remainingOrderable <= lowThreshold;

  const topBarClass = isAllInCart
    ? 'bg-amber-500'
    : isUnavailable
      ? 'bg-red-600'
      : isLow
        ? 'bg-amber-400'
        : 'bg-gray-900';

  const availabilityTextClass = isAllInCart
    ? 'text-amber-700'
    : isUnavailable
      ? 'text-red-600'
      : isLow
        ? 'text-amber-600'
        : 'text-gray-500';

  return (
    <div
      className={`relative bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col transition-all duration-200 shadow-sm hover:shadow-md ${
        isUnavailable ? 'opacity-65 grayscale select-none' : 'hover:-translate-y-1'
      }`}
    >
      <div
        className={`absolute top-0 left-0 right-0 h-1 z-10 ${topBarClass}`}
        title={
          isAllInCart
            ? 'All available stock is in cart or ongoing orders'
            : isUnavailable
              ? isDirectOut
                ? 'Out of stock'
                : 'Insufficient ingredients'
              : `${remainingOrderable} available`
        }
      />

      <div className="flex-1 p-5 pb-3 flex flex-col">
        <h4 className="m-0 text-sm md:text-base font-bold text-gray-900 leading-tight mb-1">
          {product.name}
        </h4>
        <p className="m-0 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
          {product.category}
        </p>

        <div className="mt-auto flex items-baseline justify-between gap-2">
          <p className="m-0 text-base font-extrabold text-gray-900 tabular-nums">
            ₱{product.price?.toFixed(2)}
          </p>
          <span className={`text-xs font-semibold tabular-nums ${availabilityTextClass}`}>
            {remainingOrderable} available
          </span>
        </div>

        {isUnavailable && (
          <p
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white px-3 py-1.5 rounded text-xs md:text-sm font-bold uppercase tracking-wider whitespace-nowrap shadow-md z-20 ${
              isAllInCart ? 'bg-amber-600/95' : 'bg-red-600/90'
            }`}
          >
            {isAllInCart ? 'LIMIT REACHED' : isDirectOut ? 'OUT OF STOCK' : 'UNAVAILABLE'}
          </p>
        )}
      </div>

      <div className="flex border-t border-gray-100 bg-gray-50/50 mt-auto">
        <button
          type="button"
          className="flex-1 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-r border-gray-100 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer bg-transparent"
          onClick={(e) => {
            e.stopPropagation();
            onViewRecipe(product);
          }}
          title="View Recipe & Stock"
        >
          Info
        </button>
        <button
          type="button"
          className="flex-1 py-3 text-[11px] font-bold uppercase tracking-wider bg-white text-gray-900 hover:bg-gray-900 hover:text-white transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer border-none"
          disabled={isUnavailable}
          onClick={() => onClick(product)}
        >
          {isAllInCart ? 'Max' : isUnavailable ? 'N/A' : '+ Add'}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
