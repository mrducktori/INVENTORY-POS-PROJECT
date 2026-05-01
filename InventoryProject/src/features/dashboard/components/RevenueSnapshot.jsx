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
    <div className="revenue-snapshot-card">
      <div className="revenue-info">
        <div className="label">Total Revenue (Today)</div>
        <div className="value">₱{revenueDisplay}</div>
        {!isTrendExpanded && (
          <div className="trend-label">7-Day Sales Trend (Click to Expand)</div>
        )}
      </div>

      {!isTrendExpanded && (
        <div
          className="revenue-mini-chart"
          style={{ cursor: 'pointer', position: 'relative' }}
          title="Click to expand full trend analysis"
        >
          {/* Transparent overlay ensures clicks register above the SVG */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
            }}
            onClick={onExpand}
          />
          {loading ? (
            <div className="loading">...</div>
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
