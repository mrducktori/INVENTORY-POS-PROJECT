import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

// ---------------------------------------------------------------------------
// RevenueSnapshot
// Displays the "Total Revenue Today" figure and a mini clickable sparkline
// chart that expands the full trend analysis when clicked.
// ---------------------------------------------------------------------------

const RevenueSnapshot = ({ stats, loading, isTrendExpanded, onExpand }) => {
  const revenueDisplay =
    stats?.totalRevenueToday !== undefined
      ? stats.totalRevenueToday.toFixed(2)
      : '0.00';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8 mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center shadow-sm relative group overflow-hidden">
      <div className="flex-1 relative z-10">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Revenue (Today)</div>
        <div className="text-4xl font-bold text-gray-900 mb-1">₱{revenueDisplay}</div>
        {!isTrendExpanded && (
          <div className="text-xs text-gray-400 font-medium">7-Day Sales Trend (Click to Expand)</div>
        )}
      </div>

      {!isTrendExpanded && (
        <div
          className="flex-1 max-w-[300px] h-[80px] w-full mt-5 sm:mt-0 relative cursor-pointer"
          title="Click to expand full trend analysis"
        >
          {/* Transparent overlay ensures clicks register above the SVG */}
          <div
            className="absolute inset-0 z-10"
            onClick={onExpand}
          />
          {loading ? (
            <div className="text-gray-500 italic">...</div>
          ) : (
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={stats?.salesTrend || []}>
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#000"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
};

export default RevenueSnapshot;
