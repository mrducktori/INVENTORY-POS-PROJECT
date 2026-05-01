import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ---------------------------------------------------------------------------
// ExpandedTrendChart
// The large, full-width sales trend chart that appears when the user expands
// the mini sparkline. Supports per-category filtering and a Collapse button.
// ---------------------------------------------------------------------------

// --- Label Formatters -------------------------------------------------------

/**
 * Formats date strings for the X-Axis ticks.
 * Handles both raw ISO dates ("2026-05-01") and pre-formatted strings.
 * Falls back gracefully if the date cannot be parsed.
 */
const formatDateLabel = (dateStr) => {
  if (!dateStr) return '';
  // If already a short formatted string (e.g. "Mon Apr 28"), return as-is
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toLocaleDateString('en-PH', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Manila',
    });
  }
  // Already pre-formatted by backend — just return it
  return dateStr;
};

/**
 * Formats Y-Axis tick values as short peso amounts (e.g. ₱1.2k, ₱500).
 */
const formatPesoTick = (value) => {
  if (value >= 1000) return `₱${(value / 1000).toFixed(1)}k`;
  return `₱${value}`;
};

/**
 * Custom Tooltip content that shows a formatted date header and peso values
 * for each active line in the chart.
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  // Try to format the label; if invalid, show raw label
  let formattedDate = label;
  const parsed = new Date(label);
  if (!isNaN(parsed.getTime())) {
    formattedDate = parsed.toLocaleDateString('en-PH', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Manila',
    });
  }

  return (
    <div
      style={{
        background: '#111',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: '4px',
        fontSize: '13px',
        lineHeight: '1.8',
        minWidth: '180px',
        border: '1px solid #333',
      }}
    >
      <div style={{ fontWeight: '700', marginBottom: '6px', borderBottom: '1px solid #444', paddingBottom: '6px', color: '#fff' }}>
        {formattedDate}
      </div>
      {payload.map((entry) => (
        <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center' }}>
          {/* Colored swatch (square) instead of bullet to avoid black-on-black */}
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: entry.color, display: 'inline-block', flexShrink: 0 }} />
            {entry.name}
          </span>
          <span style={{ fontWeight: '600', color: '#fff' }}>
            ₱{Number(entry.value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </span>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ExpandedTrendChart = ({
  loading,
  trendChartData,
  trendCategories,
  activeTrendCategory,
  onCategoryChange,
  onCollapse,
  COLORS,
}) => {
  const isShowingAll = activeTrendCategory === 'All';

  return (
    <div
      className="chart-card large animate-pop-in"
      style={{ marginTop: '20px' }}
    >
      <div
        className="chart-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <h3>Detailed Sales Trend (Last 7 Days)</h3>

        <div
          className="chart-filters"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {/* "All" filter button */}
          <button
            className={`filter-btn ${isShowingAll ? 'active' : ''}`}
            onClick={() => onCategoryChange('All')}
          >
            All
          </button>

          {/* Per-category filter buttons */}
          {trendCategories.map((cat) => (
            <button
              key={cat}
              className={`filter-btn ${activeTrendCategory === cat ? 'active' : ''}`}
              onClick={() => onCategoryChange(cat)}
            >
              {cat}
            </button>
          ))}

          {/* Divider */}
          <div style={{ width: '1px', height: '20px', background: '#ccc', margin: '0 8px' }} />

          {/* Collapse button */}
          <button
            className="filter-btn"
            onClick={onCollapse}
            style={{ fontWeight: 'bold', color: '#c62828', borderColor: '#c62828' }}
          >
            ✖ Collapse
          </button>
        </div>
      </div>

      <div className="chart-body">
        {loading ? (
          <div className="loading">Loading chart...</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trendChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />

              {/* X Axis: human-readable date labels, angled for readability */}
              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                tick={{ fontSize: 11, fill: '#555' }}
                angle={-20}
                textAnchor="end"
                height={50}
                interval={0}
              />

              {/* Y Axis: peso-formatted values */}
              <YAxis
                tickFormatter={formatPesoTick}
                tick={{ fontSize: 11, fill: '#555' }}
                width={60}
                label={{
                  value: 'Revenue (₱)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 10,
                  style: { fontSize: 11, fill: '#999', textAnchor: 'middle' },
                }}
              />

              {/* Custom Tooltip with formatted date + peso values */}
              <Tooltip content={<CustomTooltip />} />

              {isShowingAll ? (
                trendCategories.map((cat, index) => (
                  <Line
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    name={cat}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4, strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                ))
              ) : (
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name={activeTrendCategory}
                  stroke="#000"
                  strokeWidth={3}
                  dot={{ r: 6, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 8 }}
                />
              )}

              {/* Only show legend when multiple lines are visible */}
              {isShowingAll ? (
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default ExpandedTrendChart;
