import React from 'react';
import { createPortal } from 'react-dom';

const ForecastGuideModal = ({ isOpen, onClose, guideTab, setGuideTab }) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto flex justify-center items-start pt-8 sm:pt-12 md:pt-16 pb-12 p-4 bg-black/60 backdrop-blur-xs animate-[modalBackdropFadeIn_0.2s_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-xl overflow-hidden flex flex-col animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-zinc-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div>
              <h3 className="m-0 text-base font-bold">Forecasting Reference Guide</h3>
              <p className="m-0 text-xs text-zinc-400 mt-0.5">
                How Ingredient Restock and Menu Demand projections are calculated
              </p>
            </div>
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

        {/* Modal Guide Switcher Tabs */}
        <div className="px-6 pt-3.5 pb-2 bg-zinc-50 border-b border-zinc-200 flex gap-2">
          <button
            type="button"
            onClick={() => setGuideTab('ingredients')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              guideTab === 'ingredients'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            Ingredient Restock Guide
          </button>
          <button
            type="button"
            onClick={() => setGuideTab('products')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              guideTab === 'products'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            Menu Demand Guide
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs sm:text-sm text-zinc-600 leading-relaxed max-h-[calc(100vh-14rem)] overflow-y-auto">
          {guideTab === 'ingredients' ? (
            <>
              {/* Ingredient Section 1 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                  <h4 className="m-0 text-sm font-bold text-zinc-900">
                    1. Recipe-Based Daily Usage (Burn Rate)
                  </h4>
                </div>
                <div className="pl-4 space-y-1.5 border-l-2 border-zinc-100">
                  <p className="m-0">
                    Every drink sold at the POS is mapped to its bill of materials (grams of coffee beans or powders, milliliters of milk or syrup, and packaging pieces).
                  </p>
                  <p className="m-0">
                    <span className="font-semibold text-zinc-900">Weighted Velocity:</span> Daily usage blends a 90-day (3-month) rolling baseline with extra weight on the most recent 14-day and 30-day recipe consumption so sudden shifts in drink popularity are reflected immediately.
                  </p>
                </div>
              </div>

              {/* Ingredient Section 2 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                  <h4 className="m-0 text-sm font-bold text-zinc-900">
                    2. Estimated Time Left &amp; Urgency Status
                  </h4>
                </div>
                <div className="pl-4 space-y-2 border-l-2 border-zinc-100">
                  <p className="m-0">
                    <span className="font-semibold text-zinc-900">Est. Time Left:</span> Compares current on-hand stock against the daily usage rate to estimate how many operating days remain before stock runs out.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <div className="p-2.5 rounded-lg bg-red-50/70 border border-red-200/80">
                      <span className="text-xs font-bold text-red-700 block">Critical (≤ 3 days)</span>
                      <span className="text-[11px] text-red-900/80">Immediate reorder needed or below alert threshold.</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80">
                      <span className="text-xs font-bold text-amber-700 block">Low Supply (4–7 days)</span>
                      <span className="text-[11px] text-amber-900/80">Approaching reorder point for this week&apos;s delivery.</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80">
                      <span className="text-xs font-bold text-emerald-700 block">Healthy (&gt; 7 days)</span>
                      <span className="text-[11px] text-emerald-900/80">Sufficient raw material buffer on hand.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ingredient Section 3 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                  <h4 className="m-0 text-sm font-bold text-zinc-900">
                    3. Suggested Order &amp; Supplier Unit Conversion
                  </h4>
                </div>
                <div className="pl-4 space-y-1.5 border-l-2 border-zinc-100">
                  <p className="m-0">
                    <span className="font-semibold text-zinc-900">14-Day Target Buffer:</span> When an ingredient needs restocking, the system calculates how much stock is needed to cover a full 14-day supply window.
                  </p>
                  <p className="m-0">
                    <span className="font-semibold text-zinc-900">Purchase Units:</span> Raw gram/milliliter deficits are automatically rounded up into supplier ordering units (such as 1 kg bags, 750 ml syrup bottles, or 1 L milk cartons) for one-click Purchase Order creation.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Menu Demand Section 1 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                  <h4 className="m-0 text-sm font-bold text-zinc-900">
                    1. Multi-Year Seasonality &amp; YoY Growth (2023–2026)
                  </h4>
                </div>
                <div className="pl-4 space-y-1.5 border-l-2 border-zinc-100">
                  <p className="m-0">
                    <span className="font-semibold text-zinc-900">4-Year Seasonal Index:</span> Evaluates 47 months of Cof/Tea sales history (2023–2026) to measure how each calendar month performs relative to the annual average—capturing April–May summer surges for iced drinks, February HAMAKA Fiesta &amp; Valentine&apos;s week, school exam periods, and November–December holiday peaks.
                  </p>
                  <p className="m-0">
                    <span className="font-semibold text-zinc-900">Year-over-Year (YoY) Trajectory:</span> Compares same-month sales across consecutive years (2023 through 2026) so long-term store growth is factored into upcoming projections.
                  </p>
                </div>
              </div>

              {/* Menu Demand Section 2 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                  <h4 className="m-0 text-sm font-bold text-zinc-900">
                    2. Recent Counter Velocity (14-Day, 30-Day &amp; 90-Day)
                  </h4>
                </div>
                <div className="pl-4 space-y-1.5 border-l-2 border-zinc-100">
                  <p className="m-0">
                    <span className="font-semibold text-zinc-900">Daily Average &amp; Momentum:</span> Tracks each menu item&apos;s recent 14-day (50%), 30-day (30%), and 90-day quarterly baseline (20%) order pace and blends it with the 4-year seasonal index so both newly trending drinks and established bestsellers are accurately projected.
                  </p>
                </div>
              </div>

              {/* Menu Demand Section 3 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                  <h4 className="m-0 text-sm font-bold text-zinc-900">
                    3. Peak School Days (Mon–Fri), Weekends &amp; Holidays
                  </h4>
                </div>
                <div className="pl-4 space-y-1.5 border-l-2 border-zinc-100">
                  <p className="m-0">
                    <span className="font-semibold text-zinc-900">7-Day &amp; Monthly View:</span> Projections adjust for Monday and Friday student foot-traffic surges, weekend hangout demand, and national/local holidays. Click <span className="font-semibold text-zinc-900">By Month</span> on any drink to inspect its month-by-month breakdown and 2023–2026 historical comparison.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-900 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-black cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ForecastGuideModal;
