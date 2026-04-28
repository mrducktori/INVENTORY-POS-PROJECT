import React from 'react';
import { CATEGORIES_WITH_ALL } from '../../utils/constants';

const CategoryFilter = ({ category, setCategory }) => {
  return (
    <div className="pos-categories">
      {CATEGORIES_WITH_ALL.map(cat => (
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
