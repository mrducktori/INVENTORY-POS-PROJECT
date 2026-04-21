import React from 'react';

const ProductCard = ({ product, onClick, onViewRecipe }) => (
  <div className="pos-card">
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

export default ProductCard;
