import React from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

// ---------------------------------------------------------------------------
// RevenueSnapshot
// Displays the "Total Revenue Today" figure and a sleek interactive sparkline
// with expand controls and thousand-separated currency formatting.
// ---------------------------------------------------------------------------

const RevenueSnapshot = ({ stats, loading, isTrendExpanded, onExpand }) => {
  const rawRevenue = stats?.totalRevenueToday ?? 0;
  const formattedRevenue = Number(rawRevenue).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const trendData = stats?.salesTrend || [];
  const hasTrendData = trendData.length > 0 && trendData.some((d) => (d.revenue || 0) > 0);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Left Column: Big, Readable Revenue Figures */}
        <div className="flex-1">
          <div className="text-sm md:text-base font-bold uppercase tracking-wider text-zinc-500 mb-2">
            Today's Total Revenue
          </div>

          <div className="text-4xl md:text-5xl font-extrabold text-zinc-900 tracking-tight tabular-nums mb-2">
            ₱{loading ? '---' : formattedRevenue}
          </div>

          {!isTrendExpanded && (
            <div className="text-sm font-medium text-zinc-500">
              Updated live from POS terminal transactions
            </div>
          )}
        </div>

        {/* Right Column: Combined Mini Sparkline & 7-Day Trends Widget */}
        {!isTrendExpanded && (
          <button
            type="button"
            onClick={onExpand}
            className="group flex items-center justify-between gap-4 h-20 p-2.5 bg-zinc-50 hover:bg-zinc-100/90 border border-zinc-200 hover:border-zinc-300 rounded-2xl transition-all cursor-pointer lg:w-96 w-full text-left"
            title="Click to view full 7-day trend analysis"
          >
            <div className="flex-1 h-full min-w-0 pr-2">
              {loading ? (
                <div className="h-full flex items-center justify-center text-sm text-zinc-400">
                  Loading...
                </div>
              ) : hasTrendData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 4, bottom: 2 }}>
                    <defs>
                      <linearGradient id="revenueMiniGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#18181b" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#18181b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#18181b"
                      strokeWidth={2.5}
                      fill="url(#revenueMiniGrad)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-zinc-400 font-medium">
                  Awaiting shift transactions
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-white group-hover:bg-zinc-900 text-zinc-800 group-hover:text-white rounded-xl border border-zinc-200 group-hover:border-zinc-900 text-xs md:text-sm font-bold transition-all shadow-xs">
              <span>7-Day Trends</span>
              <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

export default RevenueSnapshot;
