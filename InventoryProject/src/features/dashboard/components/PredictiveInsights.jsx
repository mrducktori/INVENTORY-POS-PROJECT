import React, { useState, useEffect } from 'react';
import { getInventoryDepletion, getDemandForecast } from '../../../api/analyticsApi';
import './PredictiveInsights.css';

const PredictiveInsights = () => {
  const [depletionData, setDepletionData] = useState([]);
  const [multiForecast, setMultiForecast] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        const [depletion, forecasts] = await Promise.all([
          getInventoryDepletion(),
          getDemandForecast()
        ]);
        setDepletionData(depletion || []);
        setMultiForecast(forecasts || []);
      } catch (err) {
        console.error("Failed to fetch analytics data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, []);

  return (
    <div className="stats-grid insights-container">
      {/* Demand Forecast Card */}
      <div className="stat-card insight-card">
        <div className="insight-header">
          <div className="insight-label">Demand Forecast & Growth</div>
          <span className="ai-badge">AI Predicted</span>
        </div>
        
        <div className="insight-list">
          {loading ? (
            <div className="loading">Calculating...</div>
          ) : multiForecast.length > 0 ? (
            multiForecast.slice(0, 3).map(f => (
              <div key={f.id} className="forecast-item">
                <div className="forecast-main">
                  <span className="forecast-product">{f.name}</span>
                  <span className="forecast-qty">{f.predictedNext7Days} units</span>
                </div>
                <div className="forecast-details">
                  <span>Growth: <strong className={`forecast-growth ${parseFloat(f.growthRate) >= 0 ? 'up' : 'down'}`}>{f.growthRate}%</strong></span>
                  <span>Confidence: <strong className="forecast-confidence">{f.confidence}%</strong></span>
                  <span>Risk: <strong className={`forecast-risk ${f.stockoutRisk === 'Low' ? 'low' : 'high'}`}>{f.stockoutRisk}</strong></span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state-text">No forecast available.</div>
          )}
        </div>
      </div>

      {/* Stock Depletion Card */}
      <div className="stat-card insight-card border-red">
        <div className="insight-header">
          <div className="insight-label">Predictive Stock Depletion</div>
          <span className="depletion-badge">30-day usage base</span>
        </div>

        <div className="insight-list">
          {loading ? (
            <div className="loading">Analyzing...</div>
          ) : depletionData.length > 0 ? (
            depletionData.slice(0, 4).map(item => (
              <div key={item.id}>
                <div className="depletion-item-header">
                  <span className="depletion-product">{item.name}</span>
                  <span className={`depletion-days ${item.daysRemaining < 3 ? 'critical' : 'stable'}`}>
                    {item.daysRemaining ? `${item.daysRemaining} days left` : 'Stable'}
                  </span>
                </div>
                <div className="progress-track depletion-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${item.depletionPercentage}%`,
                      background: item.depletionPercentage > 80 ? '#c62828' : item.depletionPercentage > 50 ? '#f57f17' : '#2e7d32'
                    }}
                  ></div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state-text">No depletion data available.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PredictiveInsights;
