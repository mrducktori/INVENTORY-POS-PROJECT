import React from 'react';

// ---------------------------------------------------------------------------
// TopSalesGrid
// Renders each sales category as a card with a ranked product list inside.
// Accepts a sorting function from the parent hook via props — no logic here.
// ---------------------------------------------------------------------------

const TopSalesGrid = ({
  loading,
  topProductsByCategory,
  sortAsc,
  onToggleSort,
  getSortedProducts,
  period,
  onPeriodChange,
}) => {
  const categoryEntries = Object.entries(topProductsByCategory || {});
  const isEmpty = categoryEntries.length === 0;

  return (
    <div className="chart-card large" style={{ gridColumn: 'span 1' }}>
      <div
        className="chart-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h3>Top Sales by Category</h3>
          <div className="period-toggle" style={{ display: 'flex', background: '#f0f0f0', borderRadius: '4px', padding: '2px' }}>
            <button 
              onClick={() => onPeriodChange('day')}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                border: 'none',
                background: period === 'day' ? '#000' : 'transparent',
                color: period === 'day' ? '#fff' : '#666',
                cursor: 'pointer',
                borderRadius: '3px',
                fontWeight: period === 'day' ? 'bold' : 'normal'
              }}
            >
              Today
            </button>
            <button 
              onClick={() => onPeriodChange('week')}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                border: 'none',
                background: period === 'week' ? '#000' : 'transparent',
                color: period === 'week' ? '#fff' : '#666',
                cursor: 'pointer',
                borderRadius: '3px',
                fontWeight: period === 'week' ? 'bold' : 'normal'
              }}
            >
              Week
            </button>
          </div>
        </div>
        <button
          className="filter-btn"
          onClick={onToggleSort}
          style={{ fontWeight: 'bold' }}
        >
          Sort: {sortAsc ? 'Lowest First ↑' : 'Highest First ↓'}
        </button>
      </div>

      <div
        className="chart-body"
        style={{ height: 'auto', minHeight: '300px', alignItems: 'flex-start' }}
      >
        {loading ? (
          <div className="loading">Loading categorized products...</div>
        ) : (
          <div className="category-top-grid">
            {isEmpty ? (
              <div style={{ padding: '20px', color: '#666' }}>
                No sales data available.
              </div>
            ) : (
              categoryEntries.map(([category, products]) => (
                <div key={category} className="category-top-card">
                  <h4>{category}</h4>
                  <ul className="category-top-list">
                    {getSortedProducts(products).map((product, index) => (
                      <li key={product.name}>
                        <span className="rank">#{index + 1}</span>
                        <span className="name">{product.name}</span>
                        <span className="qty">{product.value} sold</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TopSalesGrid;
