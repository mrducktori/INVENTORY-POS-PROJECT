import React, { useState, useEffect } from 'react';
import { getIngredientDepletionForecast, getDemandForecast } from '../../../api/analyticsApi';
import { InfoTip } from '../../../components/shared/InfoTip';

const PredictiveInsights = ({ onNavigate }) => {
  const [depletionItems, setDepletionItems] = useState([]);
  const [demandForecasts, setDemandForecasts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        const [depletionRes, forecastsRes] = await Promise.all([
          getIngredientDepletionForecast(),
          getDemandForecast()
        ]);

        const ingredients = Array.isArray(depletionRes?.ingredients)
          ? depletionRes.ingredients
          : Array.isArray(depletionRes)
          ? depletionRes
          : [];
        setDepletionItems(ingredients);

        setDemandForecasts(Array.isArray(forecastsRes) ? forecastsRes : []);
      } catch (err) {
        console.error("Failed to fetch predictive analytics data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 7-Day Demand Forecast Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-7 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 m-0 inline-flex items-center gap-1.5">
                <span>7-Day Demand Forecast</span>
                <InfoTip text="Projects upcoming 7-day orders using a 90-day rolling sales baseline (weighted toward recent 14-day and 30-day velocity), adjusted for 4-year seasonality, Monday/Friday peak school days, weekends, and holidays." />
              </h3>
              <p className="text-xs text-zinc-500 m-0 mt-0.5">Projected retail volume by product</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('Forecasting')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200/80 px-3 py-1.5 rounded-lg transition-colors cursor-pointer group"
              title="Open full demand forecasting module"
            >
              <span>Open Forecast</span>
              <svg className="w-3.5 h-3.5 text-zinc-500 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col divide-y divide-gray-100">
            {loading ? (
              <div className="py-6 space-y-4">
                <div className="h-10 bg-zinc-100 rounded-lg animate-pulse" />
                <div className="h-10 bg-zinc-100 rounded-lg animate-pulse" />
                <div className="h-10 bg-zinc-100 rounded-lg animate-pulse" />
              </div>
            ) : demandForecasts.length > 0 ? (
              demandForecasts.slice(0, 3).map((f) => {
                const growthVal = parseFloat(f.growthRate) || 0;
                const isOutOfStock = f.stockoutRisk === 'Out of Stock' || (parseFloat(f.currentStock) || 0) <= 0;
                const isRestockNeeded = !isOutOfStock && (f.stockoutRisk === 'High' || (parseFloat(f.currentStock) || 0) < (f.predictedNext7Days || 0));

                return (
                  <div key={f.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-900">{f.name}</span>
                        {f.category && (
                          <span className="text-[11px] font-medium text-zinc-400">
                            {f.category}
                          </span>
                        )}
                      </div>
                      <span className="tabular-nums text-sm font-extrabold text-zinc-900 bg-zinc-100 px-2.5 py-0.5 rounded-md">
                        {f.predictedNext7Days} units
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <div className="flex items-center gap-2">
                        <span>Avg. {f.avgDailySales || 0} / day</span>
                        <span className="text-zinc-300">•</span>
                        <span className={`font-semibold ${growthVal > 0 ? 'text-emerald-700' : growthVal < 0 ? 'text-rose-700' : 'text-zinc-600'}`}>
                          {growthVal > 0 ? `+${growthVal}% trend` : growthVal < 0 ? `${growthVal}% trend` : 'Steady demand'}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isOutOfStock
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : isRestockNeeded
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {isOutOfStock ? 'Out of Stock' : isRestockNeeded ? 'Restock Needed' : 'In Stock'}
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

      {/* Stock Depletion Timeline Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-7 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 m-0 inline-flex items-center gap-1.5">
                <span>Stock Depletion Timeline</span>
                <InfoTip text="Estimates days remaining from current stock and your recipe consumption rate over the last 90 days (weighted toward recent 14-day and 30-day usage)." />
              </h3>
              <p className="text-xs text-zinc-500 m-0 mt-0.5">Estimated runout based on actual recipe usage</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('Forecasting')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200/80 px-3 py-1.5 rounded-lg transition-colors cursor-pointer group"
              title="Open full ingredient forecast and restock recommender"
            >
              <span>View Depletion</span>
              <svg className="w-3.5 h-3.5 text-zinc-500 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {loading ? (
              <div className="py-6 space-y-4">
                <div className="h-10 bg-zinc-100 rounded-lg animate-pulse" />
                <div className="h-10 bg-zinc-100 rounded-lg animate-pulse" />
                <div className="h-10 bg-zinc-100 rounded-lg animate-pulse" />
              </div>
            ) : depletionItems.length > 0 ? (
              depletionItems.slice(0, 4).map((item) => {
                const days = item.days_remaining ?? item.daysRemaining;
                const stockQty = parseFloat(item.stock_quantity) || 0;
                const burnRate = parseFloat(item.avg_daily_burn_rate) || 0;
                const isOutOfStock = stockQty <= 0 || days === 0;
                const isCritical = !isOutOfStock && days !== null && days <= 3;
                const isWarning = !isOutOfStock && days !== null && days > 3 && days <= 7;
                
                // Represent days remaining relative to a 14-day supply window
                const supplyPct = isOutOfStock
                  ? 0
                  : days === null
                  ? 100
                  : Math.max(5, Math.min(Math.round((days / 14) * 100), 100));

                return (
                  <div key={item.id} className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-zinc-900">{item.name}</span>
                      {isOutOfStock ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Out of Stock
                        </span>
                      ) : isCritical ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          {days === 1 ? '1 day left' : `${days} days left`}
                        </span>
                      ) : isWarning ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          {days} days left
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {days ? `${days} days left` : 'Stable Stock'}
                        </span>
                      )}
                    </div>

                    {/* Proportional Supply Bar */}
                    <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ease-out ${
                          isOutOfStock || isCritical
                            ? 'bg-rose-500'
                            : isWarning
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${supplyPct}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] text-zinc-400 font-medium">
                      <span>Stock: {stockQty} {item.unit || ''}</span>
                      <span>{burnRate > 0 ? `~${burnRate} ${item.unit || ''}/day usage` : 'Minimal usage'}</span>
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
