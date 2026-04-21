import React from 'react';

const CategoryFilter = ({ category, setCategory }) => {
  const categories = ["ALL", "COFFEE", "FRAPPE", "MILK TEA", "PASTRIES", "PROMO", "OTHERS"];

  return (
    <div className="pos-categories">
      {categories.map(cat => (
        <button
          key={cat}
          className={`cat-btn ${category === cat ? "active" : ""}`}
          onClick={() => setCategory(cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  );
};

export default CategoryFilter;
