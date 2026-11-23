import React from 'react';
import { createPortal } from 'react-dom';

const POINTS = [
  'We look at what each item sold every day for the last 8 weeks.',
  'We work out the average for each weekday, so a busy Friday is expected to stay busy.',
  'We adjust for the trend: are the last 4 weeks selling more or less than the 4 weeks before?',
  'We adjust for the season, using what happened at this time last year (when we have that history).',
  'The result is the number of cups/orders we expect each day, and the total for the next 7 days.',
  'Accuracy is measured, not guessed: we check what we would have predicted for each of the last 4 weeks and compare it with what you really sold.',
  'New items or items with few sales show "Not enough data" instead of a made-up number.',
  'The numbers come from your own sales history. Each night an AI reads the results plus upcoming holidays and may nudge a forecast up or down by at most 10%, with a reason. It never invents sales.',
  'Ingredients: expected daily use comes from the forecast and your recipes. Reorder point = daily usage × (supplier lead time + 2 safety days). Expired stock is never counted.',
  '"Can\'t make" means some stock is left, but not enough for one serving of a product that needs it (for example a product needs 20 g and only 13 g is left). Stock above zero is not always enough, so order it.',
  '"Not used" means no active product uses this ingredient, so do not reorder it. Consider selling it or using it up.',
  'Expiry levels: Watch (7-14 days left) means keep an eye on it; Use first (3-6 days) means use it before newer stock; Use today (0-2 days) means use it now; Expired means it can no longer be used and is not counted.',
  'Items from different suppliers become separate POs, so each supplier can accept, decline or propose a new date on their own.',
];

const ForecastGuideModal = ({ isOpen, onClose, method }) => {
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
        <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between">
          <div>
            <h3 className="m-0 text-base font-bold">How the forecast works</h3>
            <p className="m-0 text-xs text-zinc-400 mt-0.5">In plain words</p>
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
        <div className="p-6 space-y-3">
          {method && <p className="m-0 text-sm font-semibold text-zinc-800">{method}</p>}
          <ul className="m-0 pl-5 space-y-2 text-sm text-zinc-700 list-disc">
            {POINTS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ForecastGuideModal;
