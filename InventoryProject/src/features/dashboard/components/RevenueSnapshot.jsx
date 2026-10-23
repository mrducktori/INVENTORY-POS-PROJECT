import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Date & Currency Formatters
// ---------------------------------------------------------------------------

const formatShortDay = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length === 2) {
    const currentYear = new Date().getFullYear();
    const d = new Date(currentYear, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-PH', { weekday: 'short' });
    }
  }
  return dateStr;
};

const formatFullDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length === 2) {
    const currentYear = new Date().getFullYear();
    const d = new Date(currentYear, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-PH', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  }
  return dateStr;
};

const formatPesoTick = (value) => {
  if (value >= 1000) return `₱${(value / 1000).toFixed(1)}k`;
  return `₱${value}`;
};

// ---------------------------------------------------------------------------
// Custom Interactive Tooltip
// ---------------------------------------------------------------------------

const CustomRevenueTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const dataPoint = payload[0]?.payload;
  const val = payload[0]?.value || 0;

  return (
    <div className="bg-zinc-950/95 text-white border border-zinc-700/80 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md min-w-[200px] animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2 mb-2">
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          {formatFullDate(label)}
        </span>
        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
      </div>

      <div className="text-xs text-zinc-400 uppercase font-semibold tracking-wider mb-0.5">
        Gross Sales
      </div>
      <div className="text-2xl font-black text-white tabular-nums tracking-tight">
        ₱{Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>

      {dataPoint?.categories && Object.keys(dataPoint.categories).length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-zinc-800/80 space-y-1">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Top Categories
          </div>
          {Object.entries(dataPoint.categories)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([cat, amount]) => (
              <div key={cat} className="flex justify-between items-center text-xs text-zinc-300">
                <span className="truncate max-w-[110px]">{cat}</span>
                <span className="font-bold tabular-nums text-emerald-400">
                  ₱{Number(amount).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// RevenueSnapshot Component
// ---------------------------------------------------------------------------

const RevenueSnapshot = ({ stats, loading, isTrendExpanded, onExpand }) => {
  const [chartMode, setChartMode] = useState('area'); // 'area' | 'bar'

  const rawRevenue = stats?.totalRevenueToday ?? 0;
  const formattedRevenue = Number(rawRevenue).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const trendData = stats?.salesTrend || [];
  const hasTrendData = trendData.length > 0;
  const hasAnyRevenue = hasTrendData && trendData.some((d) => (d.revenue || 0) > 0);

  // 7-day metric calculations
  const total7Day = trendData.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0);
  const avgDaily = trendData.length > 0 ? total7Day / trendData.length : 0;

  let peakDay = null;
  let peakRevenue = 0;
  trendData.forEach((d) => {
    const rev = Number(d.revenue) || 0;
    if (rev > peakRevenue) {
      peakRevenue = rev;
      peakDay = d;
    }
  });

  const diffVsAvg = avgDaily > 0 ? ((rawRevenue - avgDaily) / avgDaily) * 100 : 0;
  const isPositiveVsAvg = diffVsAvg >= 0;

  return (
    <div className="bg-white border border-gray-200/90 rounded-3xl p-6 md:p-8 shadow-xs hover:border-gray-300 transition-all">
      {/* Top Section: Revenue Header & Comparative Metrics */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 pb-6 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live POS Revenue
            </span>
            <span className="text-xs text-zinc-400 font-medium hidden sm:inline">• Past 7 Days Rolling</span>
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-4xl md:text-5xl font-black text-zinc-950 tracking-tight tabular-nums">
              ₱{loading ? '---' : formattedRevenue}
            </span>

            {hasAnyRevenue && (
              <span
                className={`inline-flex items-center gap-1 text-xs md:text-sm font-extrabold px-2.5 py-1 rounded-xl border ${
                  isPositiveVsAvg
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                }`}
                title="Today compared to the 7-day daily average"
              >
                {isPositiveVsAvg ? (
                  <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
                <span>{Math.abs(diffVsAvg).toFixed(1)}%</span>
                <span className="font-semibold text-zinc-500 text-[11px]">vs 7-day avg</span>
              </span>
            )}
          </div>

          <p className="text-xs md:text-sm text-zinc-500 font-medium m-0 mt-1.5">
            Real-time cashier register intake for today's operating shift
          </p>
        </div>

        {/* 7-Day Performance Metric Pills */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap lg:justify-end">
          <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl px-3.5 py-2 min-w-[105px]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              7-Day Total
            </div>
            <div className="text-base font-black text-zinc-900 tabular-nums">
              ₱{total7Day.toLocaleString('en-PH', { maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl px-3.5 py-2 min-w-[105px]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Daily Avg
            </div>
            <div className="text-base font-black text-zinc-900 tabular-nums">
              ₱{avgDaily.toLocaleString('en-PH', { maximumFractionDigits: 0 })}
            </div>
          </div>

          {peakDay && peakRevenue > 0 && (
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl px-3.5 py-2 min-w-[115px]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <svg className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" viewBox="0 0 24 24">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span>Peak Day ({formatShortDay(peakDay.date)})</span>
              </div>
              <div className="text-base font-black text-amber-900 tabular-nums">
                ₱{Number(peakDay.revenue || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls Bar: Switch between Area Curve, Daily Bars & Category Expansion */}
      <div className="flex items-center justify-between pt-5 pb-2 flex-wrap gap-3">
        <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setChartMode('area')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              chartMode === 'area'
                ? 'bg-white text-zinc-950 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Spline Trend
          </button>
          <button
            type="button"
            onClick={() => setChartMode('bar')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              chartMode === 'bar'
                ? 'bg-white text-zinc-950 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Daily Volume
          </button>
        </div>

        {onExpand && !isTrendExpanded && (
          <button
            type="button"
            onClick={onExpand}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-all shadow-xs hover:shadow cursor-pointer"
          >
            <span>Breakdown by Category</span>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        )}
      </div>

      {/* Main Chart Canvas: Lush, Luminous Visual Presentation */}
      <div className="h-56 md:h-64 w-full pt-3 relative">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm font-medium text-zinc-400">
            Loading revenue curve...
          </div>
        ) : hasTrendData ? (
          <>
            {!hasAnyRevenue && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="bg-white/90 backdrop-blur-xs border border-zinc-200/90 px-4 py-2 rounded-2xl text-xs font-semibold text-zinc-500 shadow-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-300"></span>
                  No sales recorded yet for this 7-day window
                </div>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'area' ? (
                <AreaChart data={trendData} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                  <defs>
                    {/* Multi-stop emerald glow gradient */}
                    <linearGradient id="revenueLuminousGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.42} />
                      <stop offset="50%" stopColor="#059669" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#047857" stopOpacity={0.0} />
                    </linearGradient>

                    {/* Luminous stroke gradient */}
                    <linearGradient id="revenueStrokeGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="60%" stopColor="#059669" />
                      <stop offset="100%" stopColor="#047857" />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDay}
                    tick={{ fontSize: 12, fill: '#71717a', fontWeight: 600 }}
                    axisLine={{ stroke: '#e4e4e7' }}
                    tickLine={false}
                    dy={6}
                  />

                  <YAxis
                    domain={hasAnyRevenue ? [0, 'auto'] : [0, 1000]}
                    tickFormatter={formatPesoTick}
                    tick={{ fontSize: 12, fill: '#71717a', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                  />

                  <Tooltip content={<CustomRevenueTooltip />} />

                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="url(#revenueStrokeGradient)"
                    strokeWidth={3}
                    fill="url(#revenueLuminousGlow)"
                    dot={{ r: 3.5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{
                      r: 6.5,
                      fill: '#10b981',
                      stroke: '#ffffff',
                      strokeWidth: 3,
                    }}
                  />
                </AreaChart>
              ) : (
                <BarChart data={trendData} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDay}
                    tick={{ fontSize: 12, fill: '#71717a', fontWeight: 600 }}
                    axisLine={{ stroke: '#e4e4e7' }}
                    tickLine={false}
                    dy={6}
                  />

                  <YAxis
                    domain={hasAnyRevenue ? [0, 'auto'] : [0, 1000]}
                    tickFormatter={formatPesoTick}
                    tick={{ fontSize: 12, fill: '#71717a', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                  />

                  <Tooltip content={<CustomRevenueTooltip />} />

                  <Bar
                    dataKey="revenue"
                    fill="url(#revenueBarGrad)"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-zinc-50/60 rounded-2xl border border-dashed border-zinc-200">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 mb-2 border border-zinc-200/80">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <p className="text-sm font-bold text-zinc-700 m-0">Awaiting Shift Transactions</p>
            <p className="text-xs text-zinc-400 m-0 mt-0.5">
              Sales trend visualization will compile dynamically as POS sales are completed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RevenueSnapshot;

