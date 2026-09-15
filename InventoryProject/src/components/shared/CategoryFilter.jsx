import React from 'react';
import { CATEGORIES_WITH_ALL } from '../../utils/constants';

const CategoryFilter = ({ category, setCategory }) => {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {CATEGORIES_WITH_ALL.map(cat => (
        <button
          key={cat}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            category === cat
              ? "bg-gray-900 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
          }`}
          onClick={() => setCategory(cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  );
};

export default CategoryFilter;
