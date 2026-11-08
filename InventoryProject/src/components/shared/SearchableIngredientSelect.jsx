import React, { useState, useRef, useEffect, useMemo } from 'react';

/**
 * Modern Searchable Ingredient Select Component
 * Replaces tedious native HTML <select> dropdowns with a search-as-you-type combobox.
 * Strictly adheres to Rule 16 (No emojis, clean semantic SVG icons).
 */
const SearchableIngredientSelect = ({
  ingredients = [],
  value = '',
  onChange,
  placeholder = 'Search or select ingredient...',
  filterExcludedIds = [],
  autoFocusNextRef = null,
  className = '',
  disabled = false,
  showCategoryFilters = true,
  id = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Find currently selected ingredient
  const selectedIngredient = useMemo(() => {
    return ingredients.find(ing => String(ing.id) === String(value));
  }, [ingredients, value]);

  // Quick category matcher based on name and unit
  const categorizeIngredient = (ing) => {
    const name = (ing?.name || '').toUpperCase();
    const unit = (ing?.unit || '').toUpperCase();

    if (name.includes('CUP') || name.includes('STRAW') || name.includes('LID') || unit === 'PCS') {
      return 'PACKAGING';
    }
    if (name.includes('SYRUP') || name.includes('SAUCE') || name.includes('DRIZZLE')) {
      return 'SYRUPS';
    }
    if (name.includes('MILK') || name.includes('CREAM') || name.includes('DAIRY') || name.includes('CHEESE')) {
      return 'DAIRY';
    }
    if (name.includes('TEA') || name.includes('COFFEE') || name.includes('ESPRESSO') || name.includes('BEANS')) {
      return 'BEVERAGES';
    }
    if (name.includes('POWDER') || name.includes('PEARL') || name.includes('CRUMB') || name.includes('JELLY') || name.includes('NATA') || name.includes('SUGAR') || name.includes('FRUCTOSE')) {
      return 'TOPPINGS';
    }
    return 'OTHER';
  };

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    return ingredients.filter(ing => {
      // Exclude already added IDs if requested
      if (filterExcludedIds.length > 0 && filterExcludedIds.includes(ing.id)) {
        return false;
      }

      // Filter by category
      if (activeCategory !== 'ALL') {
        const cat = categorizeIngredient(ing);
        if (cat !== activeCategory) return false;
      }

      // Filter by search term
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const name = (ing.name || '').toLowerCase();
      const unit = (ing.unit || '').toLowerCase();
      return name.includes(term) || unit.includes(term);
    });
  }, [ingredients, filterExcludedIds, activeCategory, searchTerm]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index on filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredIngredients.length, activeCategory]);

  const handleSelect = (ingredient) => {
    onChange(ingredient ? ingredient.id : '', ingredient);
    setIsOpen(false);
    setSearchTerm('');
    if (autoFocusNextRef && autoFocusNextRef.current) {
      setTimeout(() => {
        autoFocusNextRef.current?.focus();
        if (autoFocusNextRef.current?.select) {
          autoFocusNextRef.current.select();
        }
      }, 50);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('', null);
    setSearchTerm('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredIngredients.length - 1 ? prev + 1 : 0));
      // Scroll into view
      if (listRef.current) {
        const item = listRef.current.children[highlightedIndex + 1];
        if (item) item.scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredIngredients.length - 1));
      if (listRef.current) {
        const item = listRef.current.children[highlightedIndex - 1];
        if (item) item.scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredIngredients[highlightedIndex]) {
        handleSelect(filteredIngredients[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const categories = [
    { id: 'ALL', label: 'All' },
    { id: 'PACKAGING', label: 'Cups & Packaging' },
    { id: 'SYRUPS', label: 'Syrups' },
    { id: 'DAIRY', label: 'Milks & Dairy' },
    { id: 'BEVERAGES', label: 'Tea & Coffee' },
    { id: 'TOPPINGS', label: 'Powders & Toppings' }
  ];

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger & Search Input Container */}
      <div 
        className={`flex items-center w-full px-3 py-2 bg-white border rounded-lg text-sm transition-all shadow-sm ${
          isOpen ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'bg-gray-100 opacity-60 cursor-not-allowed' : 'cursor-text'}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        {/* Search Icon */}
        <svg className="w-4 h-4 text-gray-400 shrink-0 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        {/* Selected badge / input */}
        <div className="flex-1 flex items-center min-w-0">
          {selectedIngredient && !isOpen ? (
            <div className="flex items-center justify-between w-full">
              <span className="font-semibold text-gray-900 truncate">
                {selectedIngredient.name}
              </span>
              <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-gray-100 text-gray-700 rounded border border-gray-200 uppercase shrink-0">
                {selectedIngredient.unit}
              </span>
            </div>
          ) : (
            <input
              ref={inputRef}
              id={id}
              type="text"
              disabled={disabled}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={selectedIngredient ? selectedIngredient.name : placeholder}
              className="w-full bg-transparent border-none p-0 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0"
            />
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center shrink-0 ml-2 gap-1">
          {selectedIngredient && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100 transition-colors cursor-pointer"
              title="Clear selection"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) setIsOpen(!isOpen);
            }}
            className="p-1 text-gray-400 hover:text-gray-700 rounded transition-transform"
          >
            <svg 
              className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Popover Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden animate-[fadeIn_0.15s_ease-out]">
          {/* Category Chips Bar */}
          {showCategoryFilters && (
            <div className="p-2 border-b border-gray-100 bg-gray-50/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-gray-900 text-white shadow-xs'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* Results List */}
          <div 
            ref={listRef}
            className="max-h-60 overflow-y-auto divide-y divide-gray-50 scrollbar-thin scrollbar-thumb-gray-200"
          >
            {filteredIngredients.length > 0 ? (
              filteredIngredients.map((ing, idx) => {
                const isSelected = selectedIngredient && selectedIngredient.id === ing.id;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={ing.id}
                    onClick={() => handleSelect(ing)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? 'bg-amber-50/60 font-bold' : ''
                    } ${isHighlighted && !isSelected ? 'bg-gray-100/80' : ''}`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {ing.name}
                        </span>
                        {isSelected && (
                          <span className="text-emerald-600 shrink-0">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 font-medium">
                        Unit: {ing.unit} {(ing.stock_quantity !== undefined || ing.current_stock !== undefined) ? `• On Hand: ${ing.stock_quantity ?? ing.current_stock} ${ing.unit}` : ''}
                      </span>
                    </div>

                    <span className="px-2 py-0.5 text-xs font-bold bg-gray-100 text-gray-700 rounded border border-gray-200 uppercase shrink-0">
                      {ing.unit}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="py-6 px-4 text-center text-sm text-gray-500 font-medium">
                No matching ingredients found.
              </div>
            )}
          </div>

          {/* Footer stats / hint */}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>{filteredIngredients.length} ingredients</span>
            <span className="text-gray-400">Use ↑↓ and Enter to select</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableIngredientSelect;
