import React from 'react';
import { CATEGORIES } from '../../utils/constants';

const CategoryFilter = ({ category, setCategory, categories }) => {
  const baseList =
    Array.isArray(categories) && categories.length > 0
      ? categories
      : CATEGORIES.filter((c) => c !== 'OTHERS');

  const pills = ['ALL'];
  baseList.forEach((cat) => {
    const upper = String(cat || '').trim().toUpperCase();
    if (upper && upper !== 'ALL' && upper !== 'OTHERS' && !pills.includes(upper)) {
      pills.push(upper);
    }
  });
  pills.push('OTHERS');

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {pills.map(cat => (
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
