import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createPaymentIntent, getPosSettings } from '../../../api/posApi';
import { round2 } from '../../../utils/money';

const DEFAULT_DISCOUNT_TYPES = [
  { id: 'SENIOR', label: 'Senior Citizen', rate_percent: 20, requires_id: true, vat_exempt: true, active: true },
  { id: 'PWD', label: 'PWD', rate_percent: 20, requires_id: true, vat_exempt: true, active: true },
  { id: 'STUDENT', label: 'Student', rate_percent: 10, requires_id: false, vat_exempt: false, active: true },
  { id: 'STAFF', label: 'Employee / Staff', rate_percent: 15, requires_id: false, vat_exempt: false, active: true }
];

const DEFAULT_PROMOS = [
  { code: 'COFTEA10', type: 'PERCENT', value: 10, min_subtotal: 0, active: true, description: '10% off' },
  { code: 'COFTEA20', type: 'PERCENT', value: 20, min_subtotal: 0, active: true, description: '20% off' },
  { code: 'WELCOME50', type: 'FIXED', value: 50, min_subtotal: 200, active: true, description: '₱50 off min ₱200' },
  { code: 'B1T1', type: 'B1T1', value: 0, min_subtotal: 0, active: true, description: 'Buy 1 Take 1' }
];

const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Cash' },
  { id: 'GCASH', label: 'GCash' },
  { id: 'MAYA', label: 'Maya' },
  { id: 'CARD', label: 'Card' },
  { id: 'QRPH', label: 'QRPH' },
  { id: 'SPLIT', label: 'Split' }
];

const LEG_METHODS = ['CASH', 'GCASH', 'MAYA', 'CARD', 'QRPH'];

const generateIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pos-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const PaymentModal = ({ order, posSettings = null, onConfirm, onClose }) => {
  const [localSettings, setLocalSettings] = useState(posSettings);
  useEffect(() => {
    if (posSettings) {
      setLocalSettings(posSettings);
      return;
    }
    let mounted = true;
    getPosSettings()
      .then((res) => {
        if (mounted && res) setLocalSettings(res);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [posSettings]);

  const effectiveSettings = posSettings || localSettings;

  const discountOptions = useMemo(() => {
    const presets = effectiveSettings?.discount_presets || {};
    const itemizedList = Array.isArray(effectiveSettings?.discount_types) && effectiveSettings.discount_types.length > 0
      ? effectiveSettings.discount_types.filter((d) => d && d.active !== false)
      : DEFAULT_DISCOUNT_TYPES.map((def) => ({
          ...def,
          rate_percent:
            def.id === 'SENIOR' && presets.senior_rate !== undefined
              ? Math.round(presets.senior_rate * 10000) / 100
              : def.id === 'PWD' && presets.pwd_rate !== undefined
              ? Math.round(presets.pwd_rate * 10000) / 100
              : def.id === 'STUDENT' && presets.student_rate !== undefined
              ? Math.round(presets.student_rate * 10000) / 100
              : def.id === 'STAFF' && presets.staff_rate !== undefined
              ? Math.round(presets.staff_rate * 10000) / 100
              : def.rate_percent
        }));

    return [
      { id: 'NONE', label: 'No Discount', rate: 0, rate_percent: 0, requires_id: false, vat_exempt: false, badge: '0%' },
      ...itemizedList.map((d) => {
        const pct = Number(d.rate_percent || 0);
        const flags = [
          d.requires_id ? '+ ID' : null,
          d.vat_exempt ? 'VAT-Ex' : null
        ].filter(Boolean).join(' • ');
        return {
          id: d.id,
          label: d.label,
          rate: pct / 100,
          rate_percent: pct,
          requires_id: Boolean(d.requires_id),
          vat_exempt: Boolean(d.vat_exempt),
          badge: flags ? `${pct}% OFF (${flags})` : `${pct}% OFF`
        };
      }),
      { id: 'PROMO_CODE', label: 'Promo Code / B1T1', rate: null, requires_id: false, vat_exempt: false, badge: 'Code' },
      { id: 'CUSTOM', label: 'Custom', rate: null, requires_id: false, vat_exempt: false, badge: 'Custom' }
    ];
  }, [effectiveSettings]);

  const activePromoCodes = useMemo(() => {
    const list = Array.isArray(effectiveSettings?.promo_codes)
      ? effectiveSettings.promo_codes
      : DEFAULT_PROMOS;
    return list.filter((p) => p && p.active !== false);
  }, [effectiveSettings]);

  const [fallbackKey] = useState(generateIdempotencyKey);
  const idempotencyKey = order?.idempotencyKey || fallbackKey;
  const busyRef = useRef(false);
  const [method, setMethod] = useState('CASH');
  const [discountType, setDiscountType] = useState(() => {
    const raw = order?.discountType || 'NONE';
    return raw === 'PROMO' ? 'PROMO_CODE' : raw;
  });
  const [customMode, setCustomMode] = useState(order?.customDiscountMode || 'PERCENT');
  const [customValue, setCustomValue] = useState(order?.customDiscountValue ?? '');
  const [managerPin, setManagerPin] = useState('');
  const attemptRef = useRef(null);
  const [customerName, setCustomerName] = useState('');
  const [discountIdNumber, setDiscountIdNumber] = useState('');
  const [promoCode, setPromoCode] = useState('');

  const [amountReceived, setAmountReceived] = useState('');
  const [reference, setReference] = useState('');
  const [qrIntent, setQrIntent] = useState(null);
  const [generatingQr, setGeneratingQr] = useState(false);

  const [splitLegs, setSplitLegs] = useState([
    { method: 'CASH', amount: '', reference_number: '' },
    { method: 'GCASH', amount: '', reference_number: '' }
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const subtotal = round2(parseFloat(order?.total) || 0);
  const isQrProvider = method === 'GCASH' || method === 'MAYA' || method === 'QRPH';
  const activeWalletConfig = isQrProvider ? effectiveSettings?.ewallet_accounts?.[method] || null : null;
  const selectedDiscountOption = useMemo(
    () => discountOptions.find((d) => d.id === discountType) || discountOptions[0],
    [discountOptions, discountType]
  );

  const { discountAmount, discountLabel, finalTotal, discountError } = useMemo(() => {
    const selected = selectedDiscountOption;
    let disc = 0;
    let label = '';
    let dErr = '';

    if (discountType === 'NONE') {
      disc = 0;
      label = '';
    } else if (discountType === 'PROMO_CODE') {
      const code = promoCode.trim().toUpperCase();
      if (!code) {
        dErr = 'Enter or select a promo code.';
      } else {
        const matchedPromo = activePromoCodes.find(
          (p) => String(p.code || '').trim().toUpperCase() === code
        );
        if (!matchedPromo) {
          dErr = `Unknown or inactive promo code "${code}".`;
        } else if (Number(matchedPromo.min_subtotal) > 0 && subtotal < Number(matchedPromo.min_subtotal)) {
          dErr = `${code} requires a minimum subtotal of ₱${Number(matchedPromo.min_subtotal).toFixed(2)}.`;
        } else if (matchedPromo.type === 'PERCENT') {
          disc = subtotal * (Number(matchedPromo.value || 0) / 100);
          label = `Promo ${code} (${matchedPromo.value}%)`;
        } else if (matchedPromo.type === 'FIXED') {
          disc = Math.min(subtotal, Number(matchedPromo.value || 0));
          label = `Promo ${code} (-₱${round2(disc).toFixed(2)})`;
        } else if (matchedPromo.type === 'B1T1') {
          const items = Array.isArray(order?.items) ? order.items : [];
          const totalQty = items.reduce((sum, it) => sum + (Number(it.qty ?? it.quantity) || 0), 0);
          if (totalQty < 2) {
            dErr = `${code} requires at least 2 items in the order.`;
          } else {
            const unitPrices = items
              .map((it) => parseFloat(it.price) || 0)
              .filter((p) => p > 0);
            disc = unitPrices.length > 0 ? Math.min(...unitPrices) : 0;
            label = disc > 0 ? `Promo ${code} (-₱${disc.toFixed(2)})` : '';
          }
        }
      }
    } else if (discountType === 'CUSTOM') {
      const val = parseFloat(customValue);
      if (customValue === '' || Number.isNaN(val) || val <= 0) {
        dErr = 'Custom discount must be greater than 0.';
      } else if (customMode === 'PERCENT') {
        if (val > 100) {
          dErr = 'Custom percentage cannot exceed 100%.';
        } else {
          disc = subtotal * (val / 100);
          label = `Custom (${val}%)`;
        }
      } else {
        if (val > subtotal) {
          dErr = `Custom discount cannot exceed subtotal (₱${subtotal.toFixed(2)}).`;
        } else {
          disc = val;
          label = `Custom (-₱${disc.toFixed(2)})`;
        }
      }
    } else if (selected.rate) {
      if (selected.vat_exempt) {
        // RA 9994/10754: remove 12% VAT first, then apply the rate on the VAT-exclusive price
        const vatExclusive = subtotal / 1.12;
        disc = vatExclusive * selected.rate + (subtotal - vatExclusive);
      } else {
        disc = subtotal * selected.rate;
      }
      label = `${selected.label} (${selected.rate_percent}%)`;
    }

    const roundedDisc = Math.min(subtotal, Math.max(0, round2(disc)));
    const netTotal = Math.max(0, round2(subtotal - roundedDisc));

    return {
      discountAmount: roundedDisc,
      discountLabel: label,
      finalTotal: netTotal,
      discountError: dErr
    };
  }, [subtotal, discountType, customMode, customValue, promoCode, order?.items, selectedDiscountOption, activePromoCodes]);

  const maxCashAllowed = Math.min(100000, Math.max(finalTotal + 5000, 50000));
  const received = parseFloat(amountReceived) || 0;
  const cashChange = method === 'CASH' && received >= finalTotal ? round2(received - finalTotal) : 0;

  const splitSummary = useMemo(() => {
    const totalAllocated = round2(splitLegs.reduce((sum, leg) => sum + (parseFloat(leg.amount) || 0), 0));
    const nonCashAllocated = round2(
      splitLegs
        .filter((leg) => leg.method !== 'CASH')
        .reduce((sum, leg) => sum + (parseFloat(leg.amount) || 0), 0)
    );
    const remaining = Math.max(0, round2(finalTotal - totalAllocated));
    const change = totalAllocated >= finalTotal ? round2(totalAllocated - finalTotal) : 0;
    return { totalAllocated, nonCashAllocated, remaining, change };
  }, [splitLegs, finalTotal]);

  const quickPresets = [
    { label: `Exact (₱${finalTotal.toFixed(2)})`, val: finalTotal },
    { label: '₱100', val: 100 },
    { label: '₱200', val: 200 },
    { label: '₱500', val: 500 },
    { label: '₱1,000', val: 1000 }
  ].filter(
    (p, idx, arr) =>
      (p.val >= finalTotal || Math.abs(p.val - finalTotal) < 0.01) &&
      arr.findIndex((x) => Math.abs(x.val - p.val) < 0.01) === idx
  );

  const handleSelectMethod = (nextMethod) => {
    setMethod(nextMethod);
    setError('');
    setQrIntent(null);
  };

  const handleGenerateQr = async () => {
    if (!isQrProvider) return;
    try {
      setGeneratingQr(true);
      setError('');
      const intent = await createPaymentIntent({ provider: method, amount: finalTotal });
      setQrIntent(intent);
    } catch (err) {
      setError(err.message || 'Failed to generate QR payment intent.');
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleAddSplitLeg = () => {
    if (splitLegs.length >= 4) return;
    setSplitLegs((prev) => [...prev, { method: 'CARD', amount: '', reference_number: '' }]);
  };

  const handleRemoveSplitLeg = (index) => {
    if (splitLegs.length <= 2) return;
    setSplitLegs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSplitLegChange = (index, field, val) => {
    setSplitLegs((prev) =>
      prev.map((leg, i) => (i === index ? { ...leg, [field]: val } : leg))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busyRef.current || submitting) return;
    setError('');

    if (discountError) {
      setError(discountError);
      return;
    }

    if (discountType === 'CUSTOM' && !/^\d{4,8}$/.test(managerPin)) {
      setError('Enter a valid 4-8 digit Manager PIN to apply a custom discount.');
      return;
    }

    if (selectedDiscountOption?.requires_id) {
      if (customerName.trim().length < 2) {
        setError(`Customer full name is required for ${selectedDiscountOption.label} discounts.`);
        return;
      }
      if (discountIdNumber.trim().length < 3) {
        setError(`${selectedDiscountOption.label} ID number (at least 3 characters) is required.`);
        return;
      }
    }

    let payloadAmountReceived = finalTotal;
    let payloadChange = 0;
    let payloadReference = '';
    let payloadPayments = null;

    if (method === 'CASH') {
      const receivedNum = parseFloat(amountReceived);
      if (Number.isNaN(receivedNum) || receivedNum < finalTotal - 0.01) {
        setError(`Amount received must be at least ₱${finalTotal.toFixed(2)}.`);
        return;
      }
      if (receivedNum > maxCashAllowed) {
        setError(`Amount received cannot exceed ₱${maxCashAllowed.toLocaleString()}.`);
        return;
      }
      payloadAmountReceived = round2(receivedNum);
      payloadChange = cashChange;
    } else if (method === 'SPLIT') {
      if (splitLegs.length < 2 || splitLegs.length > 4) {
        setError('Split payment requires between 2 and 4 payment legs.');
        return;
      }
      const normalizedLegs = [];
      for (let i = 0; i < splitLegs.length; i += 1) {
        const leg = splitLegs[i];
        const legAmt = parseFloat(leg.amount);
        if (Number.isNaN(legAmt) || legAmt <= 0 || legAmt > 1000000) {
          setError(`Split leg #${i + 1} amount must be between ₱0.01 and ₱1,000,000.`);
          return;
        }
        const refTrim = (leg.reference_number || '').trim();
        if (leg.method !== 'CASH' && (refTrim.length < 4 || refTrim.length > 60)) {
          setError(`Split leg #${i + 1} (${leg.method}) requires a 4-60 character reference number.`);
          return;
        }
        normalizedLegs.push({
          method: leg.method,
          amount: round2(legAmt),
          reference_number: leg.method === 'CASH' ? null : refTrim
        });
      }
      if (splitSummary.nonCashAllocated > finalTotal + 0.01) {
        setError('Non-cash split payment legs cannot exceed the total amount due.');
        return;
      }
      if (splitSummary.totalAllocated < finalTotal - 0.01) {
        setError(`Split legs total ₱${splitSummary.totalAllocated.toFixed(2)} is less than ₱${finalTotal.toFixed(2)}.`);
        return;
      }
      payloadPayments = normalizedLegs;
      payloadAmountReceived = splitSummary.totalAllocated;
      payloadChange = splitSummary.change;
    } else {
      const cleanRef = reference.trim();
      if (cleanRef.length < 4 || cleanRef.length > 60) {
        setError(`Please enter a valid ${method} reference / approval code (4-60 characters).`);
        return;
      }
      payloadReference = cleanRef;
    }

    // A retry of the same payload reuses the key; any change to discount/payment gets a fresh one.
    const attemptSig = JSON.stringify([
      discountType, promoCode, customMode, customValue, discountIdNumber,
      method, payloadAmountReceived, payloadReference, payloadPayments
    ]);
    if (!attemptRef.current) attemptRef.current = { sig: attemptSig, key: idempotencyKey };
    else if (attemptRef.current.sig !== attemptSig) attemptRef.current = { sig: attemptSig, key: generateIdempotencyKey() };

    busyRef.current = true;
    setSubmitting(true);
    try {
      await onConfirm({
        method,
        amountReceived: payloadAmountReceived,
        change: payloadChange,
        reference: payloadReference,
        payments: payloadPayments,
        discountType,
        discountLabel,
        discountAmount,
        finalTotal,
        customerName: customerName.trim(),
        discountIdNumber: discountIdNumber.trim(),
        promoCode: discountType === 'PROMO_CODE' ? promoCode.trim().toUpperCase() : '',
        customDiscountMode: discountType === 'CUSTOM' ? customMode : null,
        customDiscountValue: discountType === 'CUSTOM' ? parseFloat(customValue) || 0 : null,
        managerPin: discountType === 'CUSTOM' ? managerPin : '',
        idempotencyKey: attemptRef.current.key
      });
    } catch (err) {
      setSubmitting(false);
      setError('Payment failed: ' + (err.message || 'Please try again.'));
    } finally {
      busyRef.current = false;
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[99990] p-4 flex justify-center items-center animate-[modalBackdropFadeIn_0.2s_ease-out]"    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[calc(100vh-3rem)] animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="m-0 text-xl font-bold tracking-wide">Complete Payment</h2>
          <button
            type="button"
            className="text-gray-400 hover:text-white transition-colors bg-transparent border-none text-2xl leading-none cursor-pointer p-0"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden min-h-0 flex-1">
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {error && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm font-bold shadow-sm">
                {error}
              </div>
            )}

            {/* Totals Summary */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/80 flex flex-col gap-1.5">
              {discountAmount > 0 && (
                <>
                  <div className="flex justify-between items-center text-xs sm:text-sm text-gray-500 font-medium">
                    <span>Subtotal</span>
                    <span className="font-mono font-semibold text-gray-700">₱{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm text-emerald-700 font-semibold">
                    <span>Discount ({discountLabel})</span>
                    <span className="font-mono font-bold">-₱{discountAmount.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-200 my-1" />
                </>
              )}
              <div className="flex flex-col items-center justify-center pt-0.5">
                <span className="text-xs text-gray-500 font-medium block">Total Amount Due</span>
                <h1 className="m-0 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight font-mono">
                  ₱{finalTotal.toFixed(2)}
                </h1>
              </div>
            </div>

            {/* Discount Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Discount Option
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {discountOptions.map((opt) => {
                  const isSelected = discountType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setDiscountType(opt.id);
                        setError('');
                      }}
                      className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-gray-900 text-white border-gray-900 shadow-xs'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xs font-bold leading-tight truncate">{opt.label}</span>
                      <span className={`text-[10px] font-semibold mt-0.5 ${isSelected ? 'text-emerald-300' : 'text-gray-400'}`}>
                        {opt.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedDiscountOption?.requires_id && (
                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-zinc-700 uppercase">Customer Name *</label>
                    <input
                      type="text"
                      maxLength={100}
                      required
                      placeholder="Full name on ID"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="px-3 py-1.5 text-xs font-semibold bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-900"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-zinc-700 uppercase">
                      {selectedDiscountOption.label} ID # *
                    </label>
                    <input
                      type="text"
                      maxLength={40}
                      required
                      placeholder="ID Number"
                      value={discountIdNumber}
                      onChange={(e) => setDiscountIdNumber(e.target.value)}
                      className="px-3 py-1.5 text-xs font-semibold bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-900"
                    />
                  </div>
                </div>
              )}

              {discountType === 'PROMO_CODE' && (
                <div className="mt-2.5 bg-zinc-50 p-3 rounded-xl border border-zinc-200 space-y-2">
                  <input
                    type="text"
                    maxLength={40}
                    placeholder="Enter promo code (e.g. COFTEA10)"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 text-xs font-bold uppercase bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-900"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {activePromoCodes.map((p) => {
                      const hint =
                        p.description ||
                        (p.type === 'PERCENT'
                          ? `${p.value}% off`
                          : p.type === 'FIXED'
                          ? `₱${p.value} off`
                          : 'Buy 1 Take 1');
                      return (
                        <button
                          key={p.code}
                          type="button"
                          onClick={() => {
                            setPromoCode(p.code);
                            setError('');
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                            promoCode.trim().toUpperCase() === p.code
                              ? 'bg-zinc-900 text-white border-zinc-900'
                              : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                          }`}
                        >
                          {p.code} ({hint})
                        </button>
                      );
                    })}
                  </div>
                  {discountError && (
                    <div className="text-[11px] font-semibold text-rose-600">{discountError}</div>
                  )}
                </div>
              )}

              {discountType === 'CUSTOM' && (
                <div className="mt-2.5 space-y-1.5 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-lg bg-gray-200/80 p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setCustomMode('PERCENT')}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                          customMode === 'PERCENT' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600'
                        }`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomMode('AMOUNT')}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                          customMode === 'AMOUNT' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600'
                        }`}
                      >
                        ₱
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0.01"
                      max={customMode === 'PERCENT' ? 100 : subtotal}
                      step="0.01"
                      placeholder={customMode === 'PERCENT' ? 'Enter % (e.g. 15)' : 'Enter ₱ amount'}
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm font-semibold bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
                    />
                  </div>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={8}
                    placeholder="Manager PIN (4-8 digits) *"
                    value={managerPin}
                    onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-1.5 text-sm font-semibold bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
                  />
                  {discountError && (
                    <div className="text-[11px] font-semibold text-rose-600">{discountError}</div>
                  )}
                </div>
              )}
            </div>

            {/* Payment Method Tabs */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Payment Method
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 bg-gray-100 rounded-xl p-1 gap-1">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer border-none ${
                      method === pm.id
                        ? 'bg-white text-gray-900 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900 bg-transparent'
                    }`}
                    onClick={() => handleSelectMethod(pm.id)}
                    disabled={submitting}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* CASH */}
            {method === 'CASH' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-700">Amount Received</label>
                    <span className="text-xs text-gray-400 font-medium">Max: ₱{maxCashAllowed.toLocaleString()}</span>
                  </div>

                  {quickPresets.length > 0 && (
                    <div className="flex flex-wrap gap-2 my-1">
                      {quickPresets.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-900 shadow-xs transition-colors cursor-pointer"
                          onClick={() => {
                            setAmountReceived(preset.val.toString());
                            setError('');
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <input
                    type="number"
                    step="0.01"
                    min={finalTotal}
                    max={maxCashAllowed}
                    autoFocus
                    placeholder="0.00"
                    value={amountReceived}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== '' && parseFloat(val) > maxCashAllowed) {
                        setError(`Amount cannot exceed ₱${maxCashAllowed.toLocaleString()}.`);
                        return;
                      }
                      setError('');
                      setAmountReceived(val);
                    }}
                    required
                    disabled={submitting}
                    className="w-full px-4 py-3 text-lg font-bold border border-gray-300 rounded-xl focus:outline-none focus:border-gray-900 transition-all disabled:bg-gray-100 font-mono"
                  />
                </div>
                <div className="flex justify-between items-center px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs font-semibold text-gray-700">Change</span>
                  <div className={`text-xl font-bold font-mono ${cashChange > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                    ₱{cashChange.toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {/* QR PROVIDERS: GCASH / MAYA / QRPH */}
            {isQrProvider && (
              <div className="flex flex-col gap-3.5">
                {activeWalletConfig &&
                  (activeWalletConfig.qr_image_url ||
                    activeWalletConfig.account_number ||
                    activeWalletConfig.account_name) && (
                    <div className="p-3.5 bg-white border border-zinc-200 rounded-xl flex items-center gap-3.5 shadow-2xs">
                      {activeWalletConfig.qr_image_url && (
                        <div className="w-24 h-24 rounded-lg border border-zinc-200 overflow-hidden bg-zinc-50 shrink-0 flex items-center justify-center">
                          <img
                            src={activeWalletConfig.qr_image_url}
                            alt={`${method} Store QR`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">
                          {method} Account Details
                        </div>
                        {activeWalletConfig.account_name && (
                          <div className="text-xs font-bold text-zinc-800 truncate">
                            {activeWalletConfig.account_name}
                          </div>
                        )}
                        {activeWalletConfig.account_number && (
                          <div className="text-xs font-mono font-bold text-zinc-900">
                            {activeWalletConfig.account_number}
                          </div>
                        )}
                        {activeWalletConfig.instructions && (
                          <div className="text-[11px] text-zinc-500 leading-snug">
                            {activeWalletConfig.instructions}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                        {method} QR Payment & Reference Verification
                      </div>
                      <div className="text-[11px] text-zinc-500 font-medium">
                        Generate a tracking intent or verify customer payment reference below
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateQr}
                      disabled={generatingQr || submitting}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {generatingQr ? 'Generating...' : 'Generate QR'}
                    </button>
                  </div>

                  {qrIntent && (
                    <div className="p-3 bg-white border border-zinc-200 rounded-lg flex items-center gap-3">
                      <div className="w-14 h-14 bg-zinc-900 text-white rounded-lg flex items-center justify-center shrink-0">
                        <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 14.25h3.75v3.75H13.5v-3.75zm3.75 3.75h3v2.25h-3V18zm-3.75 0v2.25h1.5V18h-1.5zm5.25-3.75H20.25v2.25h-1.5v-2.25z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-zinc-900 font-mono">{qrIntent.intent_id}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {qrIntent.mode || 'MANUAL_REFERENCE_VERIFICATION'}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">
                          {qrIntent.qr_payload}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-700">{method} Reference Number *</label>
                  <input
                    type="text"
                    minLength={4}
                    maxLength={60}
                    autoFocus
                    placeholder="Enter 4-60 character Reference #"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    required
                    disabled={submitting}
                    className="w-full px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-xl focus:outline-none focus:border-gray-900 transition-all disabled:bg-gray-100"
                  />
                </div>
              </div>
            )}

            {/* CARD */}
            {method === 'CARD' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700">Card Approval / Reference Code *</label>
                <input
                  type="text"
                  minLength={4}
                  maxLength={60}
                  autoFocus
                  placeholder="Enter terminal approval code"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-xl focus:outline-none focus:border-gray-900 transition-all disabled:bg-gray-100"
                />
              </div>
            )}

            {/* SPLIT */}
            {method === 'SPLIT' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Split Payment Legs ({splitLegs.length}/4)
                  </label>
                  {splitLegs.length < 4 && (
                    <button
                      type="button"
                      onClick={handleAddSplitLeg}
                      className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-xs font-bold cursor-pointer border border-zinc-200"
                    >
                      + Add Leg
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {splitLegs.map((leg, idx) => (
                    <div key={idx} className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                      <select
                        value={leg.method}
                        onChange={(e) => handleSplitLegChange(idx, 'method', e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-bold cursor-pointer"
                      >
                        {LEG_METHODS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="1000000"
                        placeholder="Amount"
                        value={leg.amount}
                        onChange={(e) => handleSplitLegChange(idx, 'amount', e.target.value)}
                        className="w-full sm:w-28 px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-bold font-mono"
                        required
                      />
                      {leg.method !== 'CASH' && (
                        <input
                          type="text"
                          minLength={4}
                          maxLength={60}
                          placeholder="Ref # (4-60 chars)"
                          value={leg.reference_number}
                          onChange={(e) => handleSplitLegChange(idx, 'reference_number', e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-medium"
                          required
                        />
                      )}
                      {splitLegs.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSplitLeg(idx)}
                          className="px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded cursor-pointer bg-transparent border-none"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="block text-gray-500">Total Allocated</span>
                    <strong className="font-mono text-gray-900">₱{splitSummary.totalAllocated.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="block text-gray-500">Remaining</span>
                    <strong className={`font-mono ${splitSummary.remaining > 0.01 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      ₱{splitSummary.remaining.toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-gray-500">Change</span>
                    <strong className="font-mono text-emerald-700">₱{splitSummary.change.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100 shrink-0">
            <button
              type="button"
              className="flex-1 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-2 py-2.5 bg-zinc-900 border-none rounded-xl text-xs sm:text-sm font-bold text-white hover:bg-black hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              disabled={submitting}
            >
              {submitting ? 'Processing...' : 'Complete Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default PaymentModal;
