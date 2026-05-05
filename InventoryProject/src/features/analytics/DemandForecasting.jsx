import React, { useState, useEffect } from 'react';
import { getDemandForecast } from '../../api/analyticsApi';
import './DemandForecasting.css';

const DemandForecasting = () => {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchForecasts();
  }, []);

  const fetchForecasts = async () => {
    try {
      setLoading(true);
      const data = await getDemandForecast();
      setForecasts(data || []);
    } catch (err) {
      console.error("Failed to fetch forecasts:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Demand Forecasting</h1>
        <p>Advanced predictive analytics for your product inventory.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card border-blue">
          <div className="label">Forecast Accuracy</div>
          <div className="value">92%</div>
        </div>
        <div className="stat-card border-green">
          <div className="label">High Growth Items</div>
          <div className="value">
            {forecasts.filter(f => parseFloat(f.growthRate) > 5).length}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Analysis Period</div>
          <div className="value">30 Days</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Product Demand Predictions (Next 7 Days)</h2>
          <button className="btn btn-secondary forecast-refresh-btn" onClick={fetchForecasts} disabled={loading}>
            {loading ? 'Analyzing...' : 'Refresh Forecast'}
          </button>
        </div>
        <div className="card-body">
          {loading ? (
            <p className="loading">Generating predictions using historical sales data...</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Daily Avg</th>
                    <th>7-Day Forecast</th>
                    <th>Growth</th>
                    <th>Confidence</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {forecasts.map(item => (
                    <tr key={item.id}>
                      <td><strong>{item.name}</strong></td>
                      <td>{item.category}</td>
                      <td>{item.avgDailySales}</td>
                      <td className="forecast-value">{item.predictedNext7Days} units</td>
                      <td className={`growth-indicator ${parseFloat(item.growthRate) >= 0 ? 'growth-up' : 'growth-down'}`}>
                        {parseFloat(item.growthRate) >= 0 ? '↑' : '↓'} {Math.abs(item.growthRate)}%
                      </td>
                      <td>
                        <div className="confidence-container">
                          <div className="confidence-bar-track">
                            <div 
                              className="confidence-bar-fill" 
                              style={{ width: `${item.confidence}%` }}
                            ></div>
                          </div>
                          <span className="confidence-label">{item.confidence}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status ${item.stockoutRisk === 'Low' ? 'normal' : 'critical'}`}>
                          {item.stockoutRisk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2>Forecasting Methodology</h2>
        </div>
        <div className="card-body">
          <div className="methodology-note">
            Our demand forecasting engine analyzes transaction history from the last 30 days to identify sales patterns, 
            day-of-week trends, and growth trajectories. The "7-Day Forecast" predicts total units required for the coming week, 
            helping you optimize stock levels and reduce wastage.
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemandForecasting;
