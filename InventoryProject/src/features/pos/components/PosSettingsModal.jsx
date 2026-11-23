import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../config/supabaseClient';
import { getPosSettings, updatePosSettings } from '../../../api/posApi';
import SearchableIngredientSelect from '../../../components/shared/SearchableIngredientSelect';

const PROVIDERS = [
  { id: 'GCASH', label: 'GCash' },
  { id: 'MAYA', label: 'Maya' },
  { id: 'QRPH', label: 'QRPH' }
];

const buildDefaultSettings = (initial = null) => ({
  promo_codes: Array.isArray(initial?.promo_codes)
    ? initial.promo_codes.map((p) => ({ ...p }))
    : [
        { code: 'COFTEA10', type: 'PERCENT', value: 10, min_subtotal: 0, active: true, description: '10% off order' },
        { code: 'COFTEA20', type: 'PERCENT', value: 20, min_subtotal: 0, active: true, description: '20% off order' },
        { code: 'WELCOME50', type: 'FIXED', value: 50, min_subtotal: 200, active: true, description: '₱50 off min ₱200' },
        { code: 'B1T1', type: 'B1T1', value: 0, min_subtotal: 0, active: true, description: 'Buy 1 Take 1 (free lowest item)' }
      ],
  discount_presets: {
    senior_rate: initial?.discount_presets?.senior_rate ?? 0.20,
    pwd_rate: initial?.discount_presets?.pwd_rate ?? 0.20,
    student_rate: initial?.discount_presets?.student_rate ?? 0.10,
    staff_rate: initial?.discount_presets?.staff_rate ?? 0.15
  },
  ewallet_accounts: {
    GCASH: {
      account_name: initial?.ewallet_accounts?.GCASH?.account_name ?? 'CofTea Cafe',
      account_number: initial?.ewallet_accounts?.GCASH?.account_number ?? '',
      qr_image_url: initial?.ewallet_accounts?.GCASH?.qr_image_url ?? '',
      instructions: initial?.ewallet_accounts?.GCASH?.instructions ?? 'Scan QR or send to GCash number and enter the Reference #.'
    },
    MAYA: {
      account_name: initial?.ewallet_accounts?.MAYA?.account_name ?? 'CofTea Cafe',
      account_number: initial?.ewallet_accounts?.MAYA?.account_number ?? '',
      qr_image_url: initial?.ewallet_accounts?.MAYA?.qr_image_url ?? '',
      instructions: initial?.ewallet_accounts?.MAYA?.instructions ?? 'Scan QR or send to Maya number and enter the Reference #.'
    },
    QRPH: {
      account_name: initial?.ewallet_accounts?.QRPH?.account_name ?? 'CofTea Cafe',
      account_number: initial?.ewallet_accounts?.QRPH?.account_number ?? '',
      qr_image_url: initial?.ewallet_accounts?.QRPH?.qr_image_url ?? '',
      instructions: initial?.ewallet_accounts?.QRPH?.instructions ?? 'Scan QRPH code and enter the Reference #.'
    }
  },
  takeout_packaging: {
    carrier_ingredient_id: initial?.takeout_packaging?.carrier_ingredient_id || null,
    carrier_qty_per_order: initial?.takeout_packaging?.carrier_qty_per_order ?? 1,
    apply_to_takeout: initial?.takeout_packaging?.apply_to_takeout !== false,
    apply_to_delivery: initial?.takeout_packaging?.apply_to_delivery !== false
  }
});

const PosSettingsModal = ({ allIngredients = [], initialSettings = null, onSaved, onClose }) => {
  const [activeTab, setActiveTab] = useState('PROMOS');
  const [settings, setSettings] = useState(() => buildDefaultSettings(initialSettings));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingProvider, setUploadingProvider] = useState(null);
  const [notice, setNotice] = useState({ type: '', text: '' });

  const [newPromo, setNewPromo] = useState({
    code: '',
    type: 'PERCENT',
    value: '',
    min_subtotal: '0',
    description: ''
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getPosSettings();
        if (mounted && data) {
          setSettings(buildDefaultSettings(data));
        }
      } catch (err) {
        if (mounted) {
          setNotice({ type: 'error', text: err.message || 'Failed to load POS settings.' });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleAddPromo = (e) => {
    e.preventDefault();
    setNotice({ type: '', text: '' });
    const cleanCode = newPromo.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (cleanCode.length < 2 || cleanCode.length > 30) {
      setNotice({ type: 'error', text: 'Promo code must be 2 to 30 alphanumeric characters.' });
      return;
    }
    if (settings.promo_codes.some((p) => p.code.toUpperCase() === cleanCode)) {
      setNotice({ type: 'error', text: `Promo code "${cleanCode}" already exists.` });
      return;
    }
    const pType = newPromo.type;
    const valNum = pType === 'B1T1' ? 0 : parseFloat(newPromo.value);
    if (pType === 'PERCENT' && (!Number.isFinite(valNum) || valNum <= 0 || valNum > 100)) {
      setNotice({ type: 'error', text: 'Percent promo value must be between 1 and 100.' });
      return;
    }
    if (pType === 'FIXED' && (!Number.isFinite(valNum) || valNum <= 0 || valNum > 100000)) {
      setNotice({ type: 'error', text: 'Fixed discount value must be between ₱1 and ₱100,000.' });
      return;
    }
    const minSub = Math.max(0, Math.min(100000, parseFloat(newPromo.min_subtotal) || 0));

    setSettings((prev) => ({
      ...prev,
      promo_codes: [
        ...prev.promo_codes,
        {
          code: cleanCode,
          type: pType,
          value: valNum,
          min_subtotal: minSub,
          active: true,
          description:
            newPromo.description.trim() ||
            (pType === 'PERCENT'
              ? `${valNum}% off`
              : pType === 'FIXED'
              ? `₱${valNum} off`
              : 'Buy 1 Take 1')
        }
      ]
    }));
    setNewPromo({ code: '', type: 'PERCENT', value: '', min_subtotal: '0', description: '' });
  };

  const handleTogglePromo = (idx) => {
    setSettings((prev) => ({
      ...prev,
      promo_codes: prev.promo_codes.map((p, i) => (i === idx ? { ...p, active: !p.active } : p))
    }));
  };

  const handleRemovePromo = (idx) => {
    setSettings((prev) => ({
      ...prev,
      promo_codes: prev.promo_codes.filter((_, i) => i !== idx)
    }));
  };

  const handleWalletChange = (provider, field, value) => {
    setSettings((prev) => ({
      ...prev,
      ewallet_accounts: {
        ...prev.ewallet_accounts,
        [provider]: {
          ...prev.ewallet_accounts[provider],
          [field]: value
        }
      }
    }));
  };

  const handleUploadQrImage = async (provider, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNotice({ type: '', text: '' });

    if (file.size > 5 * 1024 * 1024) {
      setNotice({ type: 'error', text: 'QR image file must be 5 MB or smaller.' });
      return;
    }

    try {
      setUploadingProvider(provider);
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `pos-qr-${provider.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('cms-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('cms-images')
        .getPublicUrl(filePath);

      handleWalletChange(provider, 'qr_image_url', data.publicUrl);
      setNotice({ type: 'success', text: `${provider} QR image uploaded. Click Save Setup to apply.` });
    } catch (err) {
      setNotice({ type: 'error', text: err.message || `Failed to upload ${provider} QR image.` });
    } finally {
      setUploadingProvider(null);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setNotice({ type: '', text: '' });
      const saved = await updatePosSettings(settings);
      setSettings(buildDefaultSettings(saved));
      onSaved?.(saved);
      setNotice({ type: 'success', text: 'POS Store Setup saved and active across registers.' });
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to save POS Store Setup.' });
    } finally {
      setSaving(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[99990] p-4 flex justify-center items-start pt-6 sm:pt-10 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[calc(100vh-4rem)] animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <div>
            <h2 className="m-0 text-lg md:text-xl font-bold tracking-wide">POS Store Setup</h2>
            <p className="m-0 text-xs text-gray-300 font-medium mt-0.5">
              Configure promos, discount rates, GCash/Maya QR payment codes, and take-out packaging.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="text-gray-300 hover:text-white transition-colors bg-transparent border-none cursor-pointer p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sub-Navigation */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-2 shrink-0">
          {[
            { id: 'PROMOS', label: 'Promos & Discounts' },
            { id: 'QR_WALLETS', label: 'E-Wallet & Static QR' },
            { id: 'PACKAGING_KDS', label: 'Packaging & Routing' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-gray-900 text-white border-gray-900 shadow-xs'
                  : 'bg-white text-gray-600 border-gray-200 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {notice.text && (
            <div
              className={`p-3.5 rounded-xl text-xs md:text-sm font-bold border ${
                notice.type === 'error'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              {notice.text}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading POS store configuration...</div>
          ) : (
            <>
              {/* TAB 1: PROMOS & DISCOUNTS */}
              {activeTab === 'PROMOS' && (
                <div className="space-y-6">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                    <h3 className="m-0 text-sm font-extrabold text-gray-900 uppercase tracking-wider">
                      Standard Discount Rates
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white p-3 rounded-lg border border-gray-200">
                        <span className="block text-[10px] font-bold text-gray-500 uppercase">Senior Citizen</span>
                        <span className="text-base font-extrabold text-gray-900 font-mono">
                          {Math.round((settings.discount_presets.senior_rate ?? 0.2) * 100)}% + ID
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-200">
                        <span className="block text-[10px] font-bold text-gray-500 uppercase">PWD</span>
                        <span className="text-base font-extrabold text-gray-900 font-mono">
                          {Math.round((settings.discount_presets.pwd_rate ?? 0.2) * 100)}% + ID
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-200 flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-600 uppercase">Student Rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={Math.round((settings.discount_presets.student_rate ?? 0.1) * 100)}
                          onChange={(e) => {
                            const pct = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                            setSettings((prev) => ({
                              ...prev,
                              discount_presets: { ...prev.discount_presets, student_rate: pct / 100 }
                            }));
                          }}
                          className="w-full px-2.5 py-1 border border-gray-300 rounded text-sm font-bold font-mono bg-white"
                        />
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-200 flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-600 uppercase">Staff Rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={Math.round((settings.discount_presets.staff_rate ?? 0.15) * 100)}
                          onChange={(e) => {
                            const pct = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                            setSettings((prev) => ({
                              ...prev,
                              discount_presets: { ...prev.discount_presets, staff_rate: pct / 100 }
                            }));
                          }}
                          className="w-full px-2.5 py-1 border border-gray-300 rounded text-sm font-bold font-mono bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="m-0 text-sm font-extrabold text-gray-900 uppercase tracking-wider">
                        Promo Codes &amp; B1T1 Deals ({settings.promo_codes.length})
                      </h3>
                    </div>

                    {settings.promo_codes.length > 0 ? (
                      <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                        {settings.promo_codes.map((p, idx) => (
                          <div
                            key={p.code}
                            className="p-3 bg-white flex flex-wrap items-center justify-between gap-3 hover:bg-gray-50/70"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-extrabold text-sm text-gray-900">{p.code}</span>
                                <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-[10px] font-bold uppercase text-zinc-700">
                                  {p.type === 'PERCENT'
                                    ? `${p.value}% OFF`
                                    : p.type === 'FIXED'
                                    ? `-₱${Number(p.value).toFixed(2)}`
                                    : 'BUY 1 TAKE 1'}
                                </span>
                                {Number(p.min_subtotal) > 0 && (
                                  <span className="text-[11px] font-semibold text-gray-500">
                                    Min ₱{Number(p.min_subtotal).toFixed(2)}
                                  </span>
                                )}
                              </div>
                              {p.description && (
                                <div className="text-xs text-gray-500 mt-0.5">{p.description}</div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleTogglePromo(idx)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase border cursor-pointer ${
                                  p.active
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-gray-100 text-gray-500 border-gray-200'
                                }`}
                              >
                                {p.active ? 'Active' : 'Disabled'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemovePromo(idx)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center bg-gray-50 border border-dashed border-gray-200 rounded-xl text-xs text-gray-500">
                        No promo codes configured yet.
                      </div>
                    )}

                    <form onSubmit={handleAddPromo} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                      <span className="block text-xs font-extrabold text-gray-800 uppercase tracking-wider">
                        Add Promo Code
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        <input
                          type="text"
                          maxLength={30}
                          placeholder="Code (e.g. SUMMER15)"
                          value={newPromo.code}
                          onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold uppercase bg-white"
                        />
                        <select
                          value={newPromo.type}
                          onChange={(e) => setNewPromo({ ...newPromo, type: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold bg-white cursor-pointer"
                        >
                          <option value="PERCENT">Percent (% Off)</option>
                          <option value="FIXED">Fixed Amount (₱ Off)</option>
                          <option value="B1T1">Buy 1 Take 1 (Cheapest Free)</option>
                        </select>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={newPromo.type === 'PERCENT' ? 100 : 100000}
                          disabled={newPromo.type === 'B1T1'}
                          placeholder={
                            newPromo.type === 'B1T1'
                              ? 'Auto (Cheapest Item)'
                              : newPromo.type === 'PERCENT'
                              ? 'Percent (1-100)'
                              : 'Amount (₱)'
                          }
                          value={newPromo.type === 'B1T1' ? '' : newPromo.value}
                          onChange={(e) => setNewPromo({ ...newPromo, value: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold bg-white disabled:bg-gray-100"
                        />
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="100000"
                          placeholder="Min Subtotal (₱)"
                          value={newPromo.min_subtotal}
                          onChange={(e) => setNewPromo({ ...newPromo, min_subtotal: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold bg-white"
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          type="text"
                          maxLength={120}
                          placeholder="Short description shown to cashiers (optional)"
                          value={newPromo.description}
                          onChange={(e) => setNewPromo({ ...newPromo, description: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer border-none"
                        >
                          + Add Promo Code
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 2: E-WALLET & STATIC QR */}
              {activeTab === 'QR_WALLETS' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-700 leading-relaxed">
                    Upload the client&rsquo;s merchant/personal static QR code image and account number for GCash, Maya, or QRPH. Cashiers see this QR image during checkout for manual reference verification today, while the system stays ready for future live gateway webhooks.
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {PROVIDERS.map(({ id, label }) => {
                      const wallet = settings.ewallet_accounts[id] || {};
                      const isUploading = uploadingProvider === id;
                      return (
                        <div key={id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                            <span className="text-sm font-extrabold text-gray-900">{label} Payment Channel</span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                              {wallet.qr_image_url ? 'QR Uploaded' : 'Reference Verification Only'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-bold text-gray-600 uppercase">Account / Merchant Name</label>
                              <input
                                type="text"
                                maxLength={100}
                                value={wallet.account_name || ''}
                                onChange={(e) => handleWalletChange(id, 'account_name', e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold bg-white"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-bold text-gray-600 uppercase">Mobile / Account Number</label>
                              <input
                                type="text"
                                maxLength={40}
                                placeholder="e.g. 09XX XXX XXXX"
                                value={wallet.account_number || ''}
                                onChange={(e) => handleWalletChange(id, 'account_number', e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold font-mono bg-white"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-4 items-start">
                            <div className="flex-1 w-full space-y-2">
                              <label className="block text-[11px] font-bold text-gray-600 uppercase">
                                Static QR Code Image (PNG / JPG / WEBP)
                              </label>
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="file"
                                  accept=".png,.jpg,.jpeg,.webp"
                                  disabled={isUploading}
                                  onChange={(e) => handleUploadQrImage(id, e)}
                                  className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-xs file:font-bold file:bg-gray-100 file:text-gray-800 hover:file:bg-gray-200 cursor-pointer"
                                />
                                {isUploading && (
                                  <span className="text-xs font-bold text-blue-600 animate-pulse">Uploading QR...</span>
                                )}
                                {wallet.qr_image_url && (
                                  <button
                                    type="button"
                                    onClick={() => handleWalletChange(id, 'qr_image_url', '')}
                                    className="px-2.5 py-1 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg cursor-pointer"
                                  >
                                    Clear QR
                                  </button>
                                )}
                              </div>
                              <input
                                type="text"
                                maxLength={500}
                                placeholder="Or paste public QR image URL (https://...)"
                                value={wallet.qr_image_url || ''}
                                onChange={(e) => handleWalletChange(id, 'qr_image_url', e.target.value)}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                              />
                              <input
                                type="text"
                                maxLength={250}
                                placeholder="Cashier instructions..."
                                value={wallet.instructions || ''}
                                onChange={(e) => handleWalletChange(id, 'instructions', e.target.value)}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                              />
                            </div>

                            {wallet.qr_image_url && (
                              <div className="w-24 h-24 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center">
                                <img
                                  src={wallet.qr_image_url}
                                  alt={`${label} QR`}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: PACKAGING & KDS ROUTING */}
              {activeTab === 'PACKAGING_KDS' && (
                <div className="space-y-5">
                  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
                    <div>
                      <h3 className="m-0 text-sm font-extrabold text-gray-900 uppercase tracking-wider">
                        Order-Level Take-Out &amp; Delivery Carrier Packaging
                      </h3>
                      <p className="m-0 text-xs text-gray-500 mt-0.5">
                        Automatically deducts 1 carrier bag/holder per Take-Out or Delivery checkout (in addition to cup/lid/straw configured per Cup Size).
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div className="sm:col-span-2 flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-gray-600 uppercase">
                          Default Carrier / Paper Bag Material
                        </label>
                        <SearchableIngredientSelect
                          ingredients={allIngredients}
                          value={settings.takeout_packaging.carrier_ingredient_id || ''}
                          onChange={(id) =>
                            setSettings((prev) => ({
                              ...prev,
                              takeout_packaging: {
                                ...prev.takeout_packaging,
                                carrier_ingredient_id: id || null
                              }
                            }))
                          }
                          placeholder="Search paper bag, cup carrier, etc. (optional)..."
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-gray-600 uppercase">Qty Per Order</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={settings.takeout_packaging.carrier_qty_per_order ?? 1}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              takeout_packaging: {
                                ...prev.takeout_packaging,
                                carrier_qty_per_order: Math.min(100, Math.max(0, Number(e.target.value) || 0))
                              }
                            }))
                          }
                          className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold font-mono bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-5 pt-1">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(settings.takeout_packaging.apply_to_takeout)}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              takeout_packaging: {
                                ...prev.takeout_packaging,
                                apply_to_takeout: e.target.checked
                              }
                            }))
                          }
                          className="w-4 h-4 accent-gray-900"
                        />
                        Deduct on Take-Out orders
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(settings.takeout_packaging.apply_to_delivery)}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              takeout_packaging: {
                                ...prev.takeout_packaging,
                                apply_to_delivery: e.target.checked
                              }
                            }))
                          }
                          className="w-4 h-4 accent-gray-900"
                        />
                        Deduct on Delivery orders
                      </label>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 text-xs text-zinc-700">
                    <div className="font-extrabold text-zinc-900 uppercase tracking-wider">
                      Where Other Client Configurations Live
                    </div>
                    <ul className="m-0 pl-4 space-y-1">
                      <li>
                        <strong>Cup Sizes, Lids, Straws &amp; KDS Station (Barista vs Kitchen):</strong> Configure per category in <strong>Products &rarr; Manage Categories</strong>, or customize per product when adding/modifying an item.
                      </li>
                      <li>
                        <strong>Manager Approval PINs (Void/Refund Override):</strong> Configure per Owner/Admin account in <strong>Access Control &rarr; Manager PINs</strong>.
                      </li>
                      <li>
                        <strong>Raw Material Perishability &amp; Shelf-Life:</strong> Set on each ingredient in <strong>Raw Materials &rarr; Add / Modify Material</strong>.
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-100 cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || Boolean(uploadingProvider)}
            className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider border-none cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Setup'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default PosSettingsModal;
