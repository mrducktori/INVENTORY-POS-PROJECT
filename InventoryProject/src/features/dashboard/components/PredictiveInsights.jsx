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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Demand Forecast Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
            <h3 className="text-lg font-bold text-zinc-900 m-0">
              7-Day Demand Forecast
            </h3>
            <span className="text-sm font-semibold text-zinc-500">
              Projected Units
            </span>
          </div>
          
          <div className="flex flex-col divide-y divide-gray-100">
            {loading ? (
              <div className="py-8 space-y-4">
                <div className="h-5 bg-zinc-100 rounded animate-pulse w-3/4" />
                <div className="h-5 bg-zinc-100 rounded animate-pulse w-1/2" />
                <div className="h-5 bg-zinc-100 rounded animate-pulse w-2/3" />
              </div>
            ) : multiForecast.length > 0 ? (
              multiForecast.slice(0, 3).map((f) => {
                const growthVal = parseFloat(f.growthRate) || 0;
                const isHighRisk = f.stockoutRisk === 'High';

                return (
                  <div key={f.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-base text-zinc-900">{f.name}</span>
                      <span className="tabular-nums text-sm font-bold text-zinc-900 bg-zinc-100 px-3 py-1 rounded-md">
                        {f.predictedNext7Days} units
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-zinc-600">
                      <span className="font-medium">
                        Trend:
                        <span className={`ml-1 font-bold ${growthVal >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {growthVal >= 0 ? `+${growthVal}%` : `${growthVal}%`}
                        </span>
                      </span>

                      <span>•</span>

                      <span>
                        {f.confidence}% confidence
                      </span>

                      <span>•</span>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          isHighRisk
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {f.stockoutRisk || 'Low'} Risk
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-zinc-500 py-10 text-sm font-medium">
                No active demand projections yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stock Depletion Velocity Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
            <h3 className="text-lg font-bold text-zinc-900 m-0">
              Stock Depletion Timeline
            </h3>
            <span className="text-sm font-semibold text-zinc-500">
              Runout Estimate
            </span>
          </div>

          <div className="flex flex-col gap-5">
            {loading ? (
              <div className="py-8 space-y-4">
                <div className="h-5 bg-zinc-100 rounded animate-pulse w-3/4" />
                <div className="h-5 bg-zinc-100 rounded animate-pulse w-1/2" />
                <div className="h-5 bg-zinc-100 rounded animate-pulse w-2/3" />
              </div>
            ) : depletionData.length > 0 ? (
              depletionData.slice(0, 4).map((item) => {
                const days = item.daysRemaining;
                const isCritical = days !== null && days <= 3;
                const isWarning = days !== null && days > 3 && days <= 7;

                return (
                  <div key={item.id} className="space-y-2">
                    <div className="flex justify-between items-center text-sm md:text-base">
                      <span className="font-bold text-zinc-900">{item.name}</span>
                      {isCritical ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs md:text-sm font-bold bg-rose-100 text-rose-800">
                          {days} days left
                        </span>
                      ) : isWarning ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs md:text-sm font-bold bg-amber-100 text-amber-800">
                          {days} days left
                        </span>
                      ) : (
                        <span className="text-zinc-600 font-semibold text-sm">
                          {days ? `${days}d in stock` : 'Stable Stock'}
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-zinc-100 h-3 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ease-out ${
                          item.depletionPercentage > 80
                            ? 'bg-rose-600'
                            : item.depletionPercentage > 50
                            ? 'bg-amber-500'
                            : 'bg-zinc-800'
                        }`}
                        style={{ width: `${Math.min(item.depletionPercentage || 0, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-zinc-500 py-10 text-sm font-medium">
                No depletion warnings for current stock.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictiveInsights;
