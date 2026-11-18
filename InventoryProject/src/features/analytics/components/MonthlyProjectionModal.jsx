import React from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../utils/forecastUtils';

const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MonthlyProjectionModal = ({
  isOpen,
  onClose,
  selectedProduct,
  targetYear,
  targetMonth,
  loading,
  result,
  onSelectYear,
  onSelectMonth,
}) => {
  if (!isOpen) return null;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const YEARS = [currentYear, currentYear + 1];

  const isPastMonth =
    targetYear < currentYear ||
    (targetYear === currentYear && targetMonth < currentMonth) ||
    Boolean(result?.isHistorical);
  const daysInSelectedMonth =
    result?.daysInMonth || new Date(targetYear, targetMonth, 0).getDate() || 30;
  const displayedUnits = result?.predictedUnitsSold || 0;
  const dailyAverage = Math.round((displayedUnits / daysInSelectedMonth) * 10) / 10;
  const monthLabel = `${FULL_MONTHS[targetMonth - 1] || ''} ${targetYear}`;
  const unitPrice = Number(result?.price ?? selectedProduct?.price ?? selectedProduct?.selling_price ?? 0);
  const revenue = displayedUnits * unitPrice;
  const reasoning = !isPastMonth && typeof result?.reasoning === 'string' ? result.reasoning.trim() : '';

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto flex justify-center items-start pt-8 sm:pt-12 md:pt-16 pb-12 p-4 bg-black/60 backdrop-blur-xs animate-[modalBackdropFadeIn_0.2s_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-md overflow-hidden flex flex-col animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between">
          <div>
            <h3 className="m-0 text-base font-bold">{selectedProduct?.name}</h3>
            <p className="m-0 text-xs text-zinc-400 mt-0.5">
              {isPastMonth ? 'Historical Monthly Performance' : 'Monthly Demand Projection'}
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

        {/* Month/Year Selector (Current & Upcoming Forecast Horizon) */}
        <div className="p-4 bg-zinc-50 border-b border-zinc-200 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex bg-zinc-200/70 p-0.5 rounded-lg">
              {YEARS.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => onSelectYear(yr)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    targetYear === yr
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-zinc-500 font-medium">
              {loading
                ? 'Updating...'
                : isPastMonth
                ? 'Historical Record (Past Month)'
                : '90-Day + 4-Yr Seasonal Forecast'}
            </span>
          </div>

          <div className="grid grid-cols-6 gap-1">
            {MONTHS.map((mShort, idx) => {
              const mNum = idx + 1;
              const isSelected = targetMonth === mNum;
              const isPastBtn =
                targetYear < currentYear || (targetYear === currentYear && mNum < currentMonth);
              return (
                <button
                  key={mNum}
                  type="button"
                  onClick={() => onSelectMonth(mNum)}
                  title={isPastBtn ? 'View recorded historical sales' : 'View demand projection'}
                  className={`py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : isPastBtn
                      ? 'bg-zinc-100/80 border border-zinc-200/70 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
                      : 'bg-white border border-zinc-200/80 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {mShort}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-zinc-400">
              {isPastMonth ? 'Loading historical sales...' : 'Calculating monthly projection...'}
            </div>
          ) : result ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-center">
                  <span className="text-xs text-zinc-500 block">
                    {isPastMonth ? 'Recorded Sales (Actual)' : 'Projected Volume'}
                  </span>
                  <span className="text-2xl font-bold text-zinc-900 mt-1 block font-mono">
                    {displayedUnits} orders
                  </span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">{monthLabel} total</span>
                </div>

                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-center">
                  <span className="text-xs text-zinc-500 block">
                    {isPastMonth ? 'Actual Daily Average' : 'Projected Daily Avg'}
                  </span>
                  <span className="text-2xl font-bold text-zinc-900 mt-1 block font-mono">
                    {dailyAverage} / day
                  </span>
                </div>
              </div>

              {unitPrice > 0 && (
                <div className="px-4 py-3 border border-zinc-200 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-zinc-500">
                    {isPastMonth ? 'Recorded Revenue' : 'Est. Revenue'}
                  </span>
                  <span className="text-base font-bold text-zinc-900 font-mono">{formatCurrency(revenue)}</span>
                </div>
              )}

              {reasoning && (
                <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/60">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">
                    Demand Outlook
                  </div>
                  <p className="m-0 text-xs sm:text-sm leading-relaxed text-zinc-700">{reasoning}</p>
                </div>
              )}
              <div className="border border-zinc-200 rounded-xl p-4 space-y-2 text-xs sm:text-sm">
                <div className="font-semibold text-zinc-900 mb-2">Multi-Year &amp; Calendar Factors</div>
                <div className="flex justify-between text-zinc-600">
                  <span>Seasonal Index (2023–2026)</span>
                  <span className="font-mono font-semibold text-zinc-900">
                    {result.factors?.seasonalIndex ? `${result.factors.seasonalIndex}x` : '1.00x'}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Year-over-Year (YoY) Trend</span>
                  <span
                    className={`font-mono font-semibold ${
                      Number(result.factors?.yoyGrowthRate || 0) > 0
                        ? 'text-emerald-700'
                        : Number(result.factors?.yoyGrowthRate || 0) < 0
                        ? 'text-amber-700'
                        : 'text-zinc-900'
                    }`}
                  >
                    {Number(result.factors?.yoyGrowthRate || 0) >= 0 ? '+' : ''}
                    {result.factors?.yoyGrowthRate ?? 0}%
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Weekend Demand Multiplier</span>
                  <span className="font-mono font-semibold text-zinc-900">
                    {result.factors?.weekendMultiplier ? `${result.factors.weekendMultiplier}x` : '1.0x'}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Peak School Days (Mon &amp; Fri)</span>
                  <span className="font-mono font-semibold text-zinc-900">
                    {result.factors?.peakDayMultiplier || result.factors?.paydayMultiplier
                      ? `${result.factors.peakDayMultiplier || result.factors.paydayMultiplier}x`
                      : '1.0x'}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Holidays in Selected Month</span>
                  <span className="font-mono font-semibold text-zinc-900">
                    {result.factors?.holidaySurgeDays ?? 0} days
                  </span>
                </div>
              </div>

              {Array.isArray(result.factors?.sameMonthHistory) &&
                result.factors.sameMonthHistory.length > 0 && (
                  <div className="border border-zinc-200 rounded-xl p-4 space-y-2 text-xs sm:text-sm bg-zinc-50/60">
                    <div className="font-semibold text-zinc-900">
                      Same-Month Historical Sales (2023–2026)
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                      {result.factors.sameMonthHistory.map((h) => (
                        <div
                          key={h.year}
                          className="bg-white border border-zinc-200 rounded-lg px-2.5 py-2 text-center"
                        >
                          <span className="text-[11px] font-semibold text-zinc-500 block">
                            {h.year}
                          </span>
                          <span className="text-xs sm:text-sm font-bold font-mono text-zinc-900 block">
                            {h.unitsSold ?? h.qty ?? 0}
                          </span>
                          <span className="text-[10px] text-zinc-400 block">orders</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </>
          ) : (
            <div className="py-6 text-center text-sm text-zinc-500">
              No projection data available.
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-900 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-black cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MonthlyProjectionModal;
