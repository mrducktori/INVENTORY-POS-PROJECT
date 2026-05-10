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
  const isUnavailable = product.is_available === false;

  return (
    <div className={`pos-card ${isUnavailable ? 'unavailable' : ''}`}>
      <div className={`stock-indicator ${status}`} title={isUnavailable ? 'Insufficient Ingredients' : (status === 'recipe-based' ? 'Recipe based' : `${product.stock_quantity} in stock`)}></div>
      <div className="card-content" onClick={() => !isUnavailable && onClick(product)}>
        <h4>{product.name}</h4>
        <p className="category">{product.category}</p>
        <p className="price">₱{product.price?.toFixed(2)}</p>
        {isUnavailable && <p className="out-of-stock-label">UNAVAILABLE</p>}
      </div>
      <div className="pos-card-footer">
        <button
          className="info-btn"
          onClick={(e) => { e.stopPropagation(); onViewRecipe(product); }}
          title="View Ingredients"
        >
          Info
        </button>
        <button className="add-btn" disabled={isUnavailable} onClick={() => onClick(product)}>
          {isUnavailable ? 'N/A' : '+ Add'}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
