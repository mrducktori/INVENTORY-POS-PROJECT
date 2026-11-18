import React from 'react';

/**
 * Reference modal explaining receipt serial numbering, statutory 12% VAT, discount classes, and payment archiving.
 */
const ReceiptGuideModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100">
          <div>
            <h3 className="text-xl font-bold text-zinc-900 m-0">
              Receipt Journal &amp; POS Audit Guide
            </h3>
            <p className="text-xs text-zinc-500 mt-1 mb-0 font-medium">
              Standard operating reference for digital transaction slips, VAT, and discounts.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Close guide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 text-xs md:text-sm text-zinc-600 leading-relaxed">
          <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 space-y-1.5">
            <div className="font-bold text-zinc-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-900" />
              Receipt Serial Numbering Standard
            </div>
            <p className="m-0 text-zinc-600 text-xs">
              Every order completed through the sales console receives an atomic serial number formatted as <code className="bg-white px-1.5 py-0.5 rounded border border-zinc-200 font-mono text-zinc-800">RCP-YYYYMMDD-XXXXXX</code>. This guarantees sequential audit tracing for accounting reconciliations.
            </p>
          </div>

          <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 space-y-1.5">
            <div className="font-bold text-zinc-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-900" />
              12% Value-Added Tax (VAT) &amp; Statutory Compliance
            </div>
            <div className="space-y-1 text-xs text-zinc-600 mt-1">
              <div><strong>Vatable Sales:</strong> Net sales amount before Value-Added Tax (<code className="font-mono">Total ÷ 1.12</code>).</div>
              <div><strong>VAT Amount (12%):</strong> Standard 12% statutory consumption tax component.</div>
              <div><strong>Senior Citizen &amp; PWD:</strong> Republic Act 9994 / 10754 exempts qualifying transactions from 12% VAT and applies a 20% discount on personal consumption.</div>
            </div>
          </div>

          <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 space-y-1.5">
            <div className="font-bold text-zinc-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-900" />
              Discount Classifications
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-600 mt-1">
              <div className="p-2.5 bg-white rounded-lg border border-zinc-200">
                <strong className="text-zinc-900 block">Senior Citizen &amp; PWD (20%)</strong>
                <span>Statutory deduction with mandatory ID validation at register.</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-zinc-200">
                <strong className="text-zinc-900 block">Student / Promo (10%)</strong>
                <span>Institutional or promotional pricing applied to eligible orders.</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-zinc-200">
                <strong className="text-zinc-900 block">Employee / Staff (15%)</strong>
                <span>Internal crew meal allowance privileges.</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-zinc-200">
                <strong className="text-zinc-900 block">Custom Discount</strong>
                <span>Manager-approved ad-hoc percent or peso price reductions.</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 space-y-1.5">
            <div className="font-bold text-zinc-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-900" />
              Payment Tenders &amp; Digital Archiving
            </div>
            <p className="m-0 text-zinc-600 text-xs">
              All transactions record the tender mode (Cash with tendered amount &amp; change, or GCash with electronic reference code). Clicking any row opens the full thermal digital slip equipped with print capabilities for customer paper issuance.
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptGuideModal;
