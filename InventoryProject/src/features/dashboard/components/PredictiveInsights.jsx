import React, { useState, useEffect } from 'react';
import { getForecast } from '../../../api/analyticsApi';
import { getReorderPlan } from '../../../api/inventoryApi';
import { formatQty } from '../../analytics/utils/forecastUtils';
import { InfoTip } from '../../../components/shared/InfoTip';

const OpenButton = ({ onClick, label, title }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200/80 px-3 py-1.5 rounded-lg transition-colors cursor-pointer group"
    title={title}
  >
    <span>{label}</span>
    <svg className="w-3.5 h-3.5 text-zinc-500 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
    </svg>
  </button>
);

const Skeleton = () => (
  <div className="py-6 space-y-4">
    <div className="h-10 bg-zinc-100 rounded-lg animate-pulse" />
    <div className="h-10 bg-zinc-100 rounded-lg animate-pulse" />
    <div className="h-10 bg-zinc-100 rounded-lg animate-pulse" />
  </div>
);

const ALERT_LABEL = {
  OUT_OF_STOCK: 'Out of stock',
  CANNOT_MAKE: "Can't make",
  REORDER_NOW: 'Order now',
  BELOW_MANUAL_THRESHOLD: 'Running low',
};

const PredictiveInsights = ({ onNavigate }) => {
  const [forecast, setForecast] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        const [forecastRes, planRes] = await Promise.allSettled([getForecast(14), getReorderPlan()]);
        if (forecastRes.status === 'fulfilled') setForecast(forecastRes.value);
        if (planRes.status === 'fulfilled' && Array.isArray(planRes.value)) {
          setAlerts(planRes.value.filter((i) => i.alert));
        }
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, []);

  const top = (forecast?.products || []).filter((p) => p.next7 > 0).slice(0, 3);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-7 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 m-0 inline-flex items-center gap-1.5">
                <span>Expected sales, next 7 days</span>
                <InfoTip text={forecast?.method || 'Based on what each item sold over the last 8 weeks.'} />
              </h3>
              <p className="text-xs text-zinc-500 m-0 mt-0.5">
                {forecast?.asOf ? `Based on sales up to ${forecast.asOf}` : 'Top selling items'}
              </p>
            </div>
            <OpenButton onClick={() => onNavigate?.('Forecasting')} label="Open Forecast" title="Open the full sales forecast" />
          </div>

          <div className="flex flex-col divide-y divide-gray-100">
            {loading ? (
              <Skeleton />
            ) : top.length > 0 ? (
              top.map((p) => {
                const trend = p.trendPct == null ? null : Math.round(p.trendPct);
                return (
                  <div key={p.product_id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-900">{p.name}</span>
                        {p.category && <span className="text-[11px] font-medium text-zinc-400">{p.category}</span>}
                      </div>
                      <span className="tabular-nums text-sm font-extrabold text-zinc-900 bg-zinc-100 px-2.5 py-0.5 rounded-md">
                        {Math.round(p.next7)} {p.track_stock === false ? 'orders' : 'cups/orders'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span>About {p.recentDailyAvg} per day</span>
                      <span className="text-zinc-300">•</span>
                      <span className={`font-semibold ${trend > 0 ? 'text-emerald-700' : trend < 0 ? 'text-rose-700' : 'text-zinc-600'}`}>
                        {trend == null ? 'Trend: not enough data' : trend === 0 ? 'Steady' : `${trend > 0 ? '↑' : '↓'} ${Math.abs(trend)}% vs previous 4 weeks`}
                      </span>
                    </div>
                    {p.insight && <p className="m-0 mt-1 text-xs text-zinc-500">{p.insight}</p>}
                  </div>
                );
              })
            ) : (
              <div className="text-center text-zinc-500 py-10 text-sm font-medium">No sales forecast yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-7 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 m-0 inline-flex items-center gap-1.5">
                <span>Ingredients to restock</span>
                <InfoTip text="Order point = daily usage × (supplier lead time + 2 safety days). Expired stock is not counted." />
              </h3>
              <p className="text-xs text-zinc-500 m-0 mt-0.5">Based on expected daily use</p>
            </div>
            <OpenButton onClick={() => onNavigate?.('Forecasting')} label="View Restock" title="Open the ingredient restock plan" />
          </div>

          <div className="flex flex-col gap-4">
            {loading ? (
              <Skeleton />
            ) : alerts.length > 0 ? (
              alerts.slice(0, 4).map((item) => {
                const urgent = ['OUT_OF_STOCK', 'CANNOT_MAKE', 'REORDER_NOW'].includes(item.alert);
                const blockedNames = (item.blocked_products || []).map((p) => p.name).join(', ');
                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-zinc-900">{item.name}</span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          urgent ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {ALERT_LABEL[item.alert]}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-zinc-400 font-medium">
                      <span>Usable: {formatQty(item.usable_stock)} {item.unit}</span>
                      <span>
                        {item.days_of_cover == null ? 'No recent use' : `Lasts about ${formatQty(item.days_of_cover)} days`}
                        {item.suggested_order_qty > 0 ? ` · order ${formatQty(item.suggested_order_qty)} ${item.unit}` : ''}
                      </span>
                    </div>
                    {item.alert === 'CANNOT_MAKE' && blockedNames && (
                      <div className="text-[11px] text-red-700 font-medium">Not enough for: {blockedNames}</div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center text-zinc-500 py-10 text-sm font-medium">Nothing needs restocking right now.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictiveInsights;
