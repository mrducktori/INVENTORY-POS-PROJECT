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
    <div className="pos-card">
      <div className={`stock-indicator ${status}`} title={status === 'recipe-based' ? 'Recipe based' : `${product.stock_quantity} in stock`}></div>
      <div className="card-content" onClick={() => onClick(product)}>
        <h4>{product.name}</h4>
        <p className="category">{product.category}</p>
        <p className="price">₱{product.price?.toFixed(2)}</p>
      </div>
      <div className="pos-card-footer">
        <button
          className="info-btn"
          onClick={(e) => { e.stopPropagation(); onViewRecipe(product); }}
          title="View Ingredients"
        >
          Info
        </button>
        <button className="add-btn" onClick={() => onClick(product)}>+ Add</button>
      </div>
    </div>
  );
};

export default ProductCard;
