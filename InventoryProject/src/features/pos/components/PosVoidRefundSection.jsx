import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getSales } from '../../../api/salesApi';
import { voidOrRefundSale, setManagerPin } from '../../../api/posApi';
import Pagination from '../../../components/shared/Pagination';
import { formatReceiptDateTime } from '../../../utils/receiptPrint';

const ACTIONS = [
  { id: 'VOID', label: 'Void Sale' },
  { id: 'RETURN', label: 'Return Items' },
  { id: 'REFUND', label: 'Issue Refund' }
];

const RESTOCK_POLICIES = [
  { id: 'RESTOCK', label: 'Restock Usable Stock', desc: 'Restores product counts and creates VOID_RESTOCK ingredient batches.' },
  { id: 'WASTAGE', label: 'Log as Damaged Wastage', desc: 'Records items as wastage without adding back to sellable stock.' }
];

const PosVoidRefundSection = ({ user }) => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedSale, setSelectedSale] = useState(null);

  const [actionType, setActionType] = useState('VOID');
  const [restockPolicy, setRestockPolicy] = useState('RESTOCK');
  const [reason, setReason] = useState('');
  const [managerPinInput, setManagerPinInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const [showPinConfig, setShowPinConfig] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [pinFeedback, setPinFeedback] = useState({ type: '', text: '' });

  const isManagerRole = user?.role === 'Owner' || user?.role === 'Admin';

  const loadSales = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getSales({}, 40, 1);
      const list = Array.isArray(res) ? res : (res?.data || res?.sales || []);
      setSales(list);
      setSelectedSale((prev) => {
        if (!prev) return null;
        return list.find((s) => s.id === prev.id) || prev;
      });
    } catch (err) {
      setFormError(err?.message || 'Failed to load recent transactions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  const [salesPage, setSalesPage] = useState(1);
  const SALES_PER_PAGE = 10;

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (sales || []).filter((sale) => {
      const status = String(sale.status || (sale.void_info ? 'VOIDED' : 'COMPLETED')).toUpperCase();
      if (statusFilter === 'COMPLETED' && (status === 'VOIDED' || status === 'REFUNDED')) return false;
      if (statusFilter === 'VOIDED' && status !== 'VOIDED' && status !== 'REFUNDED') return false;
      if (!q) return true;
      const receiptNo = String(sale.receipt_number || sale.id || '').toLowerCase();
      const cashier = String(sale.users?.name || sale.users?.username || '').toLowerCase();
      return receiptNo.includes(q) || cashier.includes(q);
    });
  }, [sales, search, statusFilter]);

  const pagedSales = filteredSales.slice(
    (Math.min(salesPage, Math.max(1, Math.ceil(filteredSales.length / SALES_PER_PAGE))) - 1) * SALES_PER_PAGE,
    Math.min(salesPage, Math.max(1, Math.ceil(filteredSales.length / SALES_PER_PAGE))) * SALES_PER_PAGE
  );

  const selectedIsVoided = Boolean(
    selectedSale &&
      (selectedSale.void_info ||
        ['VOIDED', 'REFUNDED', 'RETURNED'].includes(String(selectedSale.status || '').toUpperCase()))
  );

  const handleSubmitVoid = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!selectedSale) {
      setFormError('Select a sale transaction from the list first.');
      return;
    }
    if (selectedIsVoided) {
      setFormError('This transaction has already been voided or refunded.');
      return;
    }
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3 || trimmedReason.length > 300) {
      setFormError('Reason must be between 3 and 300 characters.');
      return;
    }
    const cleanPin = managerPinInput.trim();
    if (!/^\d{4,8}$/.test(cleanPin)) {
      setFormError('Enter a valid 4-8 digit numeric Manager PIN.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await voidOrRefundSale(selectedSale.id, {
        action_type: actionType,
        reason: trimmedReason,
        restock_policy: restockPolicy,
        manager_pin: cleanPin
      });
      const approver = res?.void_record?.approved_by_name || res?.approved_by_name || 'Manager';
      setFormSuccess(
        `${actionType} completed for ${selectedSale.receipt_number || selectedSale.id} (Approved by ${approver}).`
      );
      setReason('');
      setManagerPinInput('');
      await loadSales();
    } catch (err) {
      setFormError(err?.message || 'Failed to process void / refund.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePin = async (e) => {
    e.preventDefault();
    setPinFeedback({ type: '', text: '' });
    const clean = newPin.trim();
    if (!/^\d{4,8}$/.test(clean)) {
      setPinFeedback({ type: 'error', text: 'Manager PIN must be 4 to 8 numeric digits.' });
      return;
    }
    setSavingPin(true);
    try {
      await setManagerPin({ pin: clean, targetUserId: user?.id });
      setPinFeedback({ type: 'success', text: 'Manager approval PIN updated successfully.' });
      setNewPin('');
    } catch (err) {
      setPinFeedback({ type: 'error', text: err?.message || 'Failed to update manager PIN.' });
    } finally {
      setSavingPin(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50">
      {isManagerRole && (
        <div className="px-6 py-3 bg-white border-b border-gray-200">
          <button
            type="button"
            onClick={() => setShowPinConfig((v) => !v)}
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-800 hover:text-black bg-transparent border-none p-0 cursor-pointer"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Manager Approval PIN Settings
            <span className="text-[11px] font-medium text-gray-500">
              ({showPinConfig ? 'Hide' : 'Configure'})
            </span>
          </button>

          {showPinConfig && (
            <form onSubmit={handleSavePin} className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                placeholder="New 4-8 digit Manager PIN"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button
                type="submit"
                disabled={savingPin}
                className="px-3.5 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {savingPin ? 'Saving...' : 'Update PIN'}
              </button>
              {pinFeedback.text && (
                <span
                  className={`text-xs font-semibold ${
                    pinFeedback.type === 'error' ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {pinFeedback.text}
                </span>
              )}
            </form>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="m-0 text-sm font-bold text-gray-900">Recent Transactions</h3>
                <p className="m-0 text-xs text-gray-500">Select a transaction to void, return, or refund.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Receipt # or cashier..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  maxLength={60}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold bg-white text-gray-700"
                >
                  <option value="ALL">All</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="VOIDED">Voided / Refunded</option>
                </select>
                <button
                  type="button"
                  onClick={loadSales}
                  disabled={loading}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer bg-white"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Receipt No.</th>
                    <th className="py-2.5 px-3 font-semibold">Date & Time</th>
                    <th className="py-2.5 px-3 font-semibold">Method</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-400">
                        Loading sales...
                      </td>
                    </tr>
                  ) : filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-400">
                        No transactions match your filter.
                      </td>
                    </tr>
                  ) : (
                    pagedSales.map((sale) => {
                      const status = String(
                        sale.void_info?.action_type === 'REFUND'
                          ? 'REFUNDED'
                          : sale.void_info
                          ? 'VOIDED'
                          : sale.status || 'COMPLETED'
                      ).toUpperCase();
                      const isVoid = status === 'VOIDED' || status === 'REFUNDED' || status === 'RETURNED';
                      const isSelected = selectedSale?.id === sale.id;
                      const receiptNo = sale.receipt_number || `RCP-${String(sale.id).slice(0, 8).toUpperCase()}`;

                      return (
                        <tr
                          key={sale.id}
                          onClick={() => {
                            setSelectedSale(sale);
                            setFormError('');
                            setFormSuccess('');
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-gray-900/5' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-gray-900">
                            {receiptNo}
                          </td>
                          <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">
                            {formatReceiptDateTime(sale.created_at)}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-gray-700 uppercase">
                            {sale.payment_method || 'CASH'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">
                            ₱{Number(sale.total_amount || 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                isVoid
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
<Pagination currentPage={Math.min(salesPage,Math.max(1,Math.ceil(filteredSales.length/SALES_PER_PAGE)))} totalPages={Math.max(1,Math.ceil(filteredSales.length/SALES_PER_PAGE))} totalItems={filteredSales.length} itemsPerPage={SALES_PER_PAGE} onPageChange={setSalesPage} />
            </div>
          </div>

          <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-4">
            <div>
              <h3 className="m-0 text-sm font-bold text-gray-900">Void / Return / Refund</h3>
              <p className="m-0 text-xs text-gray-500 mt-0.5">
                Requires Manager PIN approval and records an inventory adjustment audit trail.
              </p>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-700">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800">
                {formSuccess}
              </div>
            )}

            {!selectedSale ? (
              <div className="p-8 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center text-xs text-gray-500">
                Click any transaction on the left to inspect and void or refund it.
              </div>
            ) : (
              <form onSubmit={handleSubmitVoid} className="space-y-4">
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5 text-xs">
                  <div className="flex justify-between font-bold text-gray-900">
                    <span>{selectedSale.receipt_number || selectedSale.id}</span>
                    <span className="font-mono">₱{Number(selectedSale.total_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="text-gray-500">
                    Cashier: {selectedSale.users?.name || 'Staff'} • {formatReceiptDateTime(selectedSale.created_at)}
                  </div>
                  {Array.isArray(selectedSale.sale_items) && selectedSale.sale_items.length > 0 && (
                    <div className="pt-1.5 border-t border-gray-200 text-gray-700 space-y-0.5">
                      {selectedSale.sale_items.map((it, idx) => (
                        <div key={it.id || idx} className="flex justify-between">
                          <span>
                            {it.quantity}x {it.products?.name || it.name || 'Item'}
                          </span>
                          <span className="font-mono">
                            ₱{(Number(it.quantity || 1) * Number(it.unit_price || 0)).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedIsVoided ? (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
                    <div className="font-bold uppercase">Transaction Already Voided / Refunded</div>
                    {selectedSale.void_info?.reason && (
                      <div>Reason: {selectedSale.void_info.reason}</div>
                    )}
                    {selectedSale.void_info?.approved_by_name && (
                      <div>Approved By: {selectedSale.void_info.approved_by_name}</div>
                    )}
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Action
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {ACTIONS.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setActionType(a.id)}
                            className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              actionType === a.id
                                ? 'bg-gray-900 text-white border-gray-900'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                            }`}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Inventory Restock Policy
                      </label>
                      <div className="space-y-2">
                        {RESTOCK_POLICIES.map((pol) => (
                          <button
                            key={pol.id}
                            type="button"
                            onClick={() => setRestockPolicy(pol.id)}
                            className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                              restockPolicy === pol.id
                                ? 'bg-gray-900 text-white border-gray-900'
                                : 'bg-white text-gray-800 border-gray-200 hover:border-gray-400'
                            }`}
                          >
                            <div className="text-xs font-bold">{pol.label}</div>
                            <div
                              className={`text-[11px] mt-0.5 ${
                                restockPolicy === pol.id ? 'text-gray-300' : 'text-gray-500'
                              }`}
                            >
                              {pol.desc}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Reason <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        maxLength={300}
                        placeholder="Customer returned order, wrong item, cancelled payment..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Manager PIN <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={8}
                        placeholder="Enter 4-8 digit PIN"
                        value={managerPinInput}
                        onChange={(e) => setManagerPinInput(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? 'Processing...' : `Confirm ${actionType}`}
                    </button>
                  </>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PosVoidRefundSection;
