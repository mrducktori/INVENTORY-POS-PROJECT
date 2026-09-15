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
    <div className="bg-gray-900 text-white px-4 py-3 rounded-lg text-sm leading-relaxed min-w-[180px] border border-gray-700 shadow-lg">
      <div className="font-semibold mb-2 border-b border-gray-700 pb-2 text-white">
        {formattedDate}
      </div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex justify-between gap-4 items-center mb-1 last:mb-0">
          {/* Colored swatch (square) instead of bullet to avoid black-on-black */}
          <span className="flex items-center gap-2 text-gray-200">
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: entry.color, display: 'inline-block', flexShrink: 0 }} />
            {entry.name}
          </span>
          <span className="font-bold text-white">
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
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm col-span-1 lg:col-span-2 mt-8 mb-8 animate-[fadeIn_0.2s_ease-in-out]">
      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4 flex-wrap gap-4">
        <h3 className="m-0 text-sm font-semibold text-gray-800 uppercase tracking-wider">Detailed Sales Trend (Last 7 Days)</h3>

        <div className="flex items-center gap-3 flex-wrap">
          {/* "All" filter button */}
          <button
            className={`px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider cursor-pointer transition-colors ${isShowingAll ? 'bg-gray-900 text-white border border-gray-900' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
            onClick={() => onCategoryChange('All')}
          >
            All
          </button>

          {/* Per-category filter buttons */}
          {trendCategories.map((cat) => (
            <button
              key={cat}
              className={`px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider cursor-pointer transition-colors ${activeTrendCategory === cat ? 'bg-gray-900 text-white border border-gray-900' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
              onClick={() => onCategoryChange(cat)}
            >
              {cat}
            </button>
          ))}

          {/* Divider */}
          <div className="w-px h-5 bg-gray-300 mx-1" />

          {/* Collapse button */}
          <button
            className="bg-white border border-gray-300 text-gray-600 font-semibold px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider cursor-pointer transition-colors hover:bg-gray-50 hover:text-gray-900"
            onClick={onCollapse}
          >
            ✖ Collapse
          </button>
        </div>
      </div>

      <div className="h-80 flex items-center justify-center">
        {loading ? (
          <div className="text-[#666] italic">Loading chart...</div>
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
