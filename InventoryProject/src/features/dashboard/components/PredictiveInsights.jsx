import React, { useState, useEffect } from 'react';
import { getInventoryDepletion, getDemandForecast } from '../../../api/analyticsApi';

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
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6 mt-8">
      {/* Demand Forecast Card */}
      <div className="text-left p-[18px] bg-white border border-[#e0e0e0] rounded-[4px] shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#f0f0f0]">
          <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#333]">Demand Forecast & Growth</div>
          <span className="text-[9px] bg-black text-white px-2 py-0.5 rounded-[2px] uppercase font-bold tracking-[0.5px]">AI Predicted</span>
        </div>
        
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="text-[#666] italic">Calculating...</div>
          ) : multiForecast.length > 0 ? (
            multiForecast.slice(0, 3).map(f => (
              <div key={f.id} className="py-2 border-b border-[#f9f9f9] last:border-b-0">
                <div className="flex justify-between text-[13px] mb-1">
                  <span className="font-semibold text-black">{f.name}</span>
                  <span className="font-bold font-mono text-black">{f.predictedNext7Days} units</span>
                </div>
                <div className="flex gap-3 text-[10px] text-[#777] uppercase tracking-[0.2px]">
                  <span>Growth: <strong className={`font-bold ${parseFloat(f.growthRate) >= 0 ? 'text-[#2e7d32]' : 'text-[#c62828]'}`}>{f.growthRate}%</strong></span>
                  <span>Confidence: <strong className="font-bold text-[#333]">{f.confidence}%</strong></span>
                  <span>Risk: <strong className={`font-bold ${f.stockoutRisk === 'Low' ? 'text-[#2e7d32]' : 'text-[#c62828]'}`}>{f.stockoutRisk}</strong></span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-[#999] py-5 text-[11px] uppercase tracking-[0.5px]">No forecast available.</div>
          )}
        </div>
      </div>

      {/* Stock Depletion Card */}
      <div className="text-left p-[18px] bg-white border border-[#e0e0e0] border-t-4 border-t-[#c62828] rounded-[4px] shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#f0f0f0]">
          <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#333]">Predictive Stock Depletion</div>
          <span className="text-[9px] text-[#888] uppercase font-semibold">30-day usage base</span>
        </div>

        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="text-[#666] italic">Analyzing...</div>
          ) : depletionData.length > 0 ? (
            depletionData.slice(0, 4).map(item => (
              <div key={item.id}>
                <div className="flex justify-between text-[13px] mb-1">
                  <span className="font-semibold text-black">{item.name}</span>
                  <span className={`font-bold text-[11px] uppercase ${item.daysRemaining < 3 ? 'text-[#c62828]' : 'text-[#777]'}`}>
                    {item.daysRemaining ? `${item.daysRemaining} days left` : 'Stable'}
                  </span>
                </div>
                <div className="w-full bg-[#eee] h-1 rounded-none overflow-hidden">
                  <div 
                    className="h-full transition-all duration-300 ease-out"
                    style={{ 
                      width: `${item.depletionPercentage}%`,
                      background: item.depletionPercentage > 80 ? '#c62828' : item.depletionPercentage > 50 ? '#f57f17' : '#2e7d32'
                    }}
                  ></div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-[#999] py-5 text-[11px] uppercase tracking-[0.5px]">No depletion data available.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PredictiveInsights;
