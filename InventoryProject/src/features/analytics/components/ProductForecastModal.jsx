import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { LongRangeWarning } from './MenuDemandTab';

const aiPctText = (f) => `${f > 1 ? '+' : '-'}${Math.abs(Math.round((f - 1) * 100))}%`;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const shortDate = (d) => {
  const dt = new Date(`${String(d).slice(0, 10)}T00:00:00Z`);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

const Section = ({ title, hint, children }) => (
  <section>
    <h4 className="m-0 text-sm font-bold text-zinc-900">{title}</h4>
    {hint && <p className="m-0 mt-0.5 mb-2 text-xs text-zinc-500">{hint}</p>}
    {children}
  </section>
);

const ProductForecastModal = ({ isOpen, onClose, product, forecast }) => {
  const horizon = forecast?.horizonDays || product?.forecast?.length || 14;

  const lineData = useMemo(() => {
    if (!product) return [];
    const hist = (product.history || []).map((h) => ({ date: h.date, actual: h.units }));
    const baseByDate = new Map((product.baseForecast || []).map((b) => [b.date, b.units]));
    const fut = (product.forecast || []).map((f) => ({ date: f.date, forecast: f.units, ...(baseByDate.has(f.date) && { base: baseByDate.get(f.date) }) }));
    // Join the dashed line to the last real day so there is no gap.
    if (hist.length && fut.length) {
      const last = hist[hist.length - 1];
      hist[hist.length - 1] = { ...last, forecast: last.actual, ...(baseByDate.size && { base: last.actual }) };
    }
    return [...hist, ...fut];
  }, [product]);

  const weekdayData = useMemo(
    () => (product?.weekdayProfile || []).map((v, i) => ({ day: DAYS[i], avg: Math.round(v * 10) / 10 })),
    [product]
  );

  const backtestData = useMemo(
    () => (product?.backtest || []).map((b) => ({
      week: `Week of ${shortDate(b.start)}`,
      predicted: Math.round(b.predicted),
      actual: Math.round(b.actual),
    })),
    [product]
  );

  if (!isOpen || !product) return null;

  const unit = product.track_stock === false ? 'orders' : 'cups/orders';
  const hasHistory = (product.history || []).some((h) => h.units > 0);
  const t = product.trendPct;
  const s = product.seasonPct;
  const pct = (v) => Math.abs(Math.round(v));
  const aiOn = product.aiFactor != null && product.aiFactor !== 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto flex justify-center items-start pt-8 sm:pt-12 pb-12 p-4 bg-black/60 backdrop-blur-xs animate-[modalBackdropFadeIn_0.2s_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-3xl overflow-hidden flex flex-col animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between">
          <div>
            <h3 className="m-0 text-base font-bold">{product.name}</h3>
            <p className="m-0 text-xs text-zinc-400 mt-0.5">
              About {Math.round(product.next7)} {unit} in the next 7 days · based on sales up to {forecast?.asOf}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 cursor-pointer bg-transparent border-none inline-flex items-center justify-center"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-2">
            <p className="m-0 text-sm font-semibold text-zinc-900">{product.insight}</p>
            <ul className="m-0 pl-5 text-sm text-zinc-600 space-y-1 list-disc">
              <li>
                {t == null
                  ? 'Trend: not enough sales history yet.'
                  : `Trend: ${t > 0 ? '+' : t < 0 ? '-' : ''}${pct(t)}% (last 4 weeks vs the 4 before)`}
              </li>
              <li>
                {s == null
                  ? 'Last year at this time: no data for this period.'
                  : Math.round(s) === 0
                    ? 'Last year at this time: about the same.'
                    : `Last year at this time: ${pct(s)}% ${s > 0 ? 'busier' : 'quieter'}`}
              </li>
              <li>
                Recent average: {product.recentDailyAvg} {unit} per day{product.peakDay ? `, busiest on ${product.peakDay}` : ''}.
              </li>
              <li>
                {product.accuracyPct == null
                  ? 'Accuracy: not enough data to check yet.'
                  : `Accuracy: ${Math.round(product.accuracyPct)}% over the last 4 weeks (${product.confidence} confidence).`}
              </li>
            </ul>
          </div>

          {horizon > 14 && <LongRangeWarning />}

          {aiOn && (
            <p className="m-0 text-sm text-violet-800 bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5">
              <span className="font-semibold">AI adjustment: {aiPctText(product.aiFactor)}</span>
              {product.aiReason ? ` (${product.aiReason})` : ''}
            </p>
          )}

          {!hasHistory ? (
            <p className="text-sm text-zinc-500 text-center py-6 m-0">No recent sales to chart yet.</p>
          ) : (
            <>
              <Section
                title={`Sales per day: last 56 days and the next ${horizon} days`}
                hint={`Solid line = what you sold (${unit}). Dashed line = what we expect.`}
              >
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                      <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} minTickGap={30} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip labelFormatter={shortDate} />
                      <Legend />
                      <Line type="monotone" dataKey="actual" name="Sold" stroke="#18181b" strokeWidth={2} dot={false} connectNulls={false} />
                      <Line type="monotone" dataKey="forecast" name={aiOn ? 'Forecast (with AI adjustment)' : 'Expected'} stroke="#059669" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} />
                      {aiOn && <Line type="monotone" dataKey="base" name="Computed (before AI)" stroke="#a1a1aa" strokeWidth={1.5} strokeDasharray="2 3" dot={false} connectNulls={false} />}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section title="Average sales by weekday" hint={`Average ${unit} sold on each day of the week.`}>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekdayData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="avg" name={`Average ${unit}`} fill="#18181b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section
                title="Forecast vs actual"
                hint="How close we were: what we would have predicted for each of the last 4 weeks, next to what you really sold."
              >
                {backtestData.length === 0 ? (
                  <p className="text-sm text-zinc-500 m-0">Not enough history to check past weeks yet.</p>
                ) : (
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={backtestData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="predicted" name="Expected" fill="#a1a1aa" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="actual" name="Actually sold" fill="#059669" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProductForecastModal;
