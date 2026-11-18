import React, { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ---------------------------------------------------------------------------
// ExpandedTrendChart
// Full-width category revenue breakdown chart supporting timeframe presets,
// custom date range filtering, line/bar visualization modes, and category totals.
// ---------------------------------------------------------------------------

const PERIOD_OPTIONS = [
  { id: '7d', label: 'Past 7 Days', title: '7-Day Detailed Category Trend' },
  { id: '14d', label: 'Past 14 Days', title: '14-Day Detailed Category Trend' },
  { id: '30d', label: 'Past 30 Days', title: '30-Day Detailed Category Trend' },
  { id: 'month', label: 'This Month', title: 'This Month Category Trend' },
  { id: 'custom', label: 'Custom', title: 'Custom Range Category Trend' },
];

/**
 * Parses backend "MM/DD" strings using the current Manila year (avoiding JS's 2001 default),
 * or falls back to ISO date parsing.
 */
const parseChartDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = String(dateStr).split('/');
  if (parts.length === 2) {
    const manilaNow = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
    );
    const month = parseInt(parts[0], 10) - 1;
    const day = parseInt(parts[1], 10);
    if (!isNaN(month) && !isNaN(day)) {
      return new Date(manilaNow.getFullYear(), month, day);
    }
  }
  const isoDate = new Date(dateStr);
  return isNaN(isoDate.getTime()) ? null : isoDate;
};

const formatDateLabel = (dateStr) => {
  const parsed = parseChartDate(dateStr);
  if (!parsed) return dateStr || '';
  return parsed.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatPesoTick = (value) => {
  if (value >= 1000) return `₱${(value / 1000).toFixed(1)}k`;
  return `₱${value}`;
};

const formatPesoCompact = (value) => {
  const num = Number(value) || 0;
  if (num >= 1000) return `₱${(num / 1000).toFixed(1)}k`;
  return `₱${num.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  const parsed = parseChartDate(label);
  const formattedDate = parsed
    ? parsed.toLocaleDateString('en-PH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : label;

  return (
    <div className="bg-gray-900 text-white px-4 py-3 rounded-lg text-sm md:text-base leading-relaxed min-w-[190px] border border-gray-700 shadow-lg">
      <div className="font-semibold mb-2 border-b border-gray-700 pb-2 text-white">
        {formattedDate}
      </div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex justify-between gap-4 items-center mb-1 last:mb-0">
          <span className="flex items-center gap-2 text-gray-200">
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                background: entry.color,
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            {entry.name}
          </span>
          <span className="font-bold text-white tabular-nums">
            ₱{Number(entry.value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </span>
        </div>
      ))}
    </div>
  );
};

const ExpandedTrendChart = ({
  loading,
  trendChartData = [],
  trendCategories = [],
  trendCategoryTotals = {},
  activeTrendCategory = 'All',
  onCategoryChange,
  trendPeriod = '7d',
  onPeriodChange,
  trendStartDate = '',
  trendEndDate = '',
  onStartDateChange,
  onEndDateChange,
  onCollapse,
  COLORS = ['#1e40af', '#991b1b', '#166534', '#6b21a8', '#9a3412', '#115e59'],
}) => {
  const [chartType, setChartType] = useState('line'); // 'line' | 'bar'
  const isShowingAll = activeTrendCategory === 'All';

  const activePeriodMeta =
    PERIOD_OPTIONS.find((opt) => opt.id === trendPeriod) || PERIOD_OPTIONS[0];

  const totalPeriodRevenue = Object.values(trendCategoryTotals).reduce(
    (sum, val) => sum + (Number(val) || 0),
    0
  );

  const handleSelectPeriod = (periodId) => {
    if (onPeriodChange) onPeriodChange(periodId);
    if (periodId !== 'custom') {
      if (onStartDateChange) onStartDateChange('');
      if (onEndDateChange) onEndDateChange('');
    }
  };

  const xAxisInterval = trendChartData.length > 10 ? 'preserveStartEnd' : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-xs animate-[fadeIn_0.2s_ease-in-out]">
      {/* Header Row: Title & Timeframe / Chart Controls */}
      <div className="flex justify-between items-start md:items-center mb-4 pb-4 border-b border-gray-100 flex-wrap gap-4">
        <div>
          <h3 className="m-0 text-lg font-bold text-zinc-900">
            {activePeriodMeta.title}
          </h3>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            Daily sales revenue breakdown by category
            {totalPeriodRevenue > 0 && (
              <span className="ml-2 font-semibold text-zinc-700">
                ({formatPesoCompact(totalPeriodRevenue)} total)
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Segmented Timeframe Filter Bar */}
          <div className="flex flex-wrap bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            {PERIOD_OPTIONS.map((opt) => {
              const isActive =
                opt.id === 'custom'
                  ? trendPeriod === 'custom' || Boolean(trendStartDate || trendEndDate)
                  : trendPeriod === opt.id && !trendStartDate && !trendEndDate;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectPeriod(opt.id)}
                  className={`px-3 py-1.5 text-xs md:text-sm font-bold rounded-lg cursor-pointer transition-all ${
                    isActive
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Chart Type Toggle (Line vs Bar) */}
          <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            <button
              type="button"
              onClick={() => setChartType('line')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                chartType === 'line'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Line
            </button>
            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                chartType === 'bar'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Bar
            </button>
          </div>

          {/* Collapse Button */}
          <button
            type="button"
            className="bg-white border border-zinc-200 text-zinc-900 font-bold px-4 py-2 rounded-xl text-xs md:text-sm cursor-pointer transition-colors hover:bg-zinc-100 shadow-xs"
            onClick={onCollapse}
          >
            Close View
          </button>
        </div>
      </div>

      {/* Filter Row: Custom Date Range Inputs (when Custom active) & Category Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className={`px-3.5 py-1.5 rounded-xl text-xs md:text-sm font-bold cursor-pointer transition-colors inline-flex items-center gap-2 ${
              isShowingAll
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
            onClick={() => onCategoryChange('All')}
          >
            <span>All Categories</span>
            {totalPeriodRevenue > 0 && (
              <span
                className={`text-[11px] font-semibold tabular-nums ${
                  isShowingAll ? 'text-zinc-300' : 'text-zinc-500'
                }`}
              >
                {formatPesoCompact(totalPeriodRevenue)}
              </span>
            )}
          </button>

          {trendCategories.map((cat) => {
            const isSelected = activeTrendCategory === cat;
            const catTotal = trendCategoryTotals[cat] || 0;
            return (
              <button
                key={cat}
                type="button"
                className={`px-3.5 py-1.5 rounded-xl text-xs md:text-sm font-bold cursor-pointer transition-colors inline-flex items-center gap-2 ${
                  isSelected
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
                onClick={() => onCategoryChange(cat)}
              >
                <span>{cat}</span>
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    isSelected ? 'text-zinc-300' : 'text-zinc-500'
                  }`}
                >
                  {formatPesoCompact(catTotal)}
                </span>
              </button>
            );
          })}
        </div>

        {(trendPeriod === 'custom' || trendStartDate || trendEndDate) && (
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 p-1.5 rounded-xl text-xs">
            <input
              type="date"
              value={trendStartDate || ''}
              onChange={(e) => onStartDateChange && onStartDateChange(e.target.value)}
              className="px-2 py-1 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 cursor-pointer"
              title="Start Date"
            />
            <span className="text-zinc-400 font-bold">to</span>
            <input
              type="date"
              value={trendEndDate || ''}
              onChange={(e) => onEndDateChange && onEndDateChange(e.target.value)}
              className="px-2 py-1 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 cursor-pointer"
              title="End Date"
            />
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      <div className="h-80 flex items-center justify-center">
        {loading ? (
          <div className="text-zinc-500 text-sm font-medium">Loading category breakdown...</div>
        ) : trendChartData.length === 0 ? (
          <div className="text-zinc-400 text-sm font-medium">
            {trendPeriod === 'custom' && !trendStartDate && !trendEndDate
              ? 'Select a start or end date to view custom category trends.'
              : 'No category revenue recorded for the selected timeframe.'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            {chartType === 'line' ? (
              <LineChart data={trendChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  tick={{ fontSize: 13, fill: '#555' }}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                  interval={xAxisInterval}
                />
                <YAxis
                  tickFormatter={formatPesoTick}
                  tick={{ fontSize: 13, fill: '#555' }}
                  width={80}
                  label={{
                    value: 'Revenue (₱)',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 10,
                    style: { fontSize: 13, fill: '#999', textAnchor: 'middle' },
                  }}
                />
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
                      dot={trendChartData.length <= 14 ? { r: 3.5, strokeWidth: 2 } : false}
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
                    dot={trendChartData.length <= 14 ? { r: 5, strokeWidth: 2, fill: '#fff' } : false}
                    activeDot={{ r: 8 }}
                  />
                )}

                {isShowingAll ? (
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    iconSize={10}
                    wrapperStyle={{ fontSize: '13px', paddingBottom: '10px' }}
                  />
                ) : null}
              </LineChart>
            ) : (
              <BarChart data={trendChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  tick={{ fontSize: 13, fill: '#555' }}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                  interval={xAxisInterval}
                />
                <YAxis
                  tickFormatter={formatPesoTick}
                  tick={{ fontSize: 13, fill: '#555' }}
                  width={80}
                  label={{
                    value: 'Revenue (₱)',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 10,
                    style: { fontSize: 13, fill: '#999', textAnchor: 'middle' },
                  }}
                />
                <Tooltip content={<CustomTooltip />} />

                {isShowingAll ? (
                  trendCategories.map((cat, index) => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      name={cat}
                      stackId="categoryRev"
                      fill={COLORS[index % COLORS.length]}
                      maxBarSize={42}
                    />
                  ))
                ) : (
                  <Bar
                    dataKey="revenue"
                    name={activeTrendCategory}
                    fill="#18181b"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={42}
                  />
                )}

                {isShowingAll ? (
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="square"
                    iconSize={10}
                    wrapperStyle={{ fontSize: '13px', paddingBottom: '10px' }}
                  />
                ) : null}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default ExpandedTrendChart;
