import React, { useState, useEffect, useMemo } from 'react';
import { getIngredients } from '../../api/inventoryApi';
import { reportWastage, getWastageHistory } from '../../api/wastageApi';
import { formatQuantity } from '../../utils/productUtils';
import { getCurrentUser } from '../../api/authApi';
import { TableSkeleton } from '../../components/shared/SkeletonLoader';
import SearchableIngredientSelect from '../../components/shared/SearchableIngredientSelect';
import Pagination from '../../components/shared/Pagination';

const REASON_COLORS = {
  'Expiry': 'bg-amber-50 text-amber-800 border-amber-200/80',
  'Spoilage': 'bg-rose-50 text-rose-800 border-rose-200/80',
  'Damage': 'bg-purple-50 text-purple-800 border-purple-200/80',
  'Spillage': 'bg-blue-50 text-blue-800 border-blue-200/80',
  'Quality Issue': 'bg-orange-50 text-orange-800 border-orange-200/80',
  'Other': 'bg-zinc-100 text-zinc-800 border-zinc-200'
};

const ReportWastage = () => {
  const [ingredients, setIngredients] = useState([]);
  const [wastageHistory, setWastageHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [formData, setFormData] = useState({
    ingredient_id: '',
    quantity: '',
    reason: ''
  });
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const selectedIngredient = useMemo(
    () => ingredients.find(ing => ing.id === formData.ingredient_id),
    [ingredients, formData.ingredient_id]
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ings, history] = await Promise.all([
        getIngredients(),
        getWastageHistory()
      ]);
      setIngredients(ings || []);
      setWastageHistory(history || []);
    } catch (err) {
      console.error('Error loading wastage data:', err);
      setFeedback({ type: 'error', text: 'Failed to load records: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ingredient_id || !formData.quantity || !formData.reason) {
      setFeedback({ type: 'error', text: 'Please fill in all required fields.' });
      return;
    }

    const qty = parseFloat(formData.quantity);
    if (isNaN(qty) || qty <= 0) {
      setFeedback({ type: 'error', text: 'Wastage quantity must be greater than zero.' });
      return;
    }

    if (selectedIngredient && qty > parseFloat(selectedIngredient.stock_quantity || 0)) {
      setFeedback({
        type: 'error',
        text: `Cannot report ${qty} ${selectedIngredient.unit}. Current stock is only ${selectedIngredient.stock_quantity} ${selectedIngredient.unit}.`
      });
      return;
    }

    try {
      setSubmitting(true);
      const currentUser = getCurrentUser() || JSON.parse(localStorage.getItem('user') || '{}');
      await reportWastage({
        ...formData,
        quantity: qty,
        reported_by: currentUser.id
      });

      setFeedback({ type: 'success', text: 'Wastage logged and inventory successfully deducted!' });
      setFormData({ ingredient_id: '', quantity: '', reason: '' });
      setTimeout(() => setFeedback({ type: '', text: '' }), 4000);
      await fetchData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to submit wastage report.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // KPI Calculations
  const totalWastageQuantity = useMemo(
    () => wastageHistory.reduce((sum, w) => sum + (parseFloat(w.quantity) || 0), 0),
    [wastageHistory]
  );

  const thisMonthCount = useMemo(() => {
    const now = new Date();
    return wastageHistory.filter(w => {
      const date = new Date(w.created_at);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
  }, [wastageHistory]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    if (!searchFilter.trim()) return wastageHistory;
    const q = searchFilter.toLowerCase();
    return wastageHistory.filter(w =>
      (w.ingredients?.name || '').toLowerCase().includes(q) ||
      (w.reason || '').toLowerCase().includes(q) ||
      (w.users?.name || '').toLowerCase().includes(q)
    );
  }, [wastageHistory, searchFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / itemsPerPage));
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredHistory.slice(start, start + itemsPerPage);
  }, [filteredHistory, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter]);

  return (
    <div className="w-full px-6 lg:px-10 py-6 min-h-full space-y-6">
      {/* Operational Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight m-0">
            Report Wastage
          </h1>
          <p className="text-sm text-zinc-500 mt-1 mb-0">
            Log spoiled, spilled, damaged, or expired stock to keep raw material counts synchronized.
          </p>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs">
          <div className="text-xs font-medium text-zinc-500 mb-1">
            Total Incidents
          </div>
          <div className="text-3xl font-bold text-zinc-900 tabular-nums">
            {wastageHistory.length}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            Historical incident records
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs">
          <div className="text-xs font-medium text-zinc-500 mb-1">
            Total Units Wasted
          </div>
          <div className="text-3xl font-bold text-zinc-900 tabular-nums">
            {totalWastageQuantity.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            Cumulative ingredient deduction
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs">
          <div className="text-xs font-medium text-zinc-500 mb-1">
            Logged This Month
          </div>
          <div className="text-3xl font-bold text-zinc-900 tabular-nums">
            {thisMonthCount}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            Incidents reported in current cycle
          </div>
        </div>
      </div>

      {/* Adaptive 2-Column Section: Form on Left, History Table on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Log Wastage Form */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white border border-gray-200/90 rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="pb-4 border-b border-gray-100">
            <h2 className="text-xl font-bold text-zinc-900 m-0">
              Log Incident
            </h2>
            <p className="text-sm text-zinc-500 font-medium mt-1 mb-0">
              Deductions reflect in real time.
            </p>
          </div>

          {/* Feedback Banner */}
          {feedback.text && (
            <div
              className={`p-4 rounded-xl text-sm font-semibold border transition-all ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Ingredient Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700">
                Raw Material Ingredient *
              </label>
              <SearchableIngredientSelect
                ingredients={ingredients}
                value={formData.ingredient_id}
                onChange={(selectedId) =>
                  setFormData((prev) => ({ ...prev, ingredient_id: selectedId }))
                }
                placeholder="Search or select raw material..."
              />
            </div>

            {/* Live Stock Context Chip */}
            {selectedIngredient && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500">
                    Current Stock
                  </span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      selectedIngredient.stock_quantity <= 0
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : selectedIngredient.stock_quantity <= selectedIngredient.low_stock_alert
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {selectedIngredient.stock_quantity <= 0
                      ? 'Out of Stock'
                      : selectedIngredient.stock_quantity <= selectedIngredient.low_stock_alert
                      ? 'Low Stock'
                      : 'In Stock'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-zinc-600">Available:</span>
                  <span className="text-zinc-900 font-bold tabular-nums font-mono">
                    {formatQuantity(selectedIngredient.stock_quantity, selectedIngredient.unit)}
                  </span>
                </div>

                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-zinc-500">Alert threshold:</span>
                  <span className="text-zinc-700 font-medium tabular-nums font-mono">
                    {formatQuantity(selectedIngredient.low_stock_alert, selectedIngredient.unit)}
                  </span>
                </div>
              </div>
            )}

            {/* Quantity Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700">
                Quantity Wasted *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  name="quantity"
                  placeholder="e.g. 250"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3.5 py-2.5 bg-zinc-50 hover:bg-white focus:bg-white border border-zinc-300 rounded-xl text-sm text-zinc-900 font-medium focus:outline-none focus:border-zinc-900 transition-all shadow-xs tabular-nums pr-16"
                />
                {selectedIngredient?.unit && (
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-500">
                    {selectedIngredient.unit}
                  </span>
                )}
              </div>
            </div>

            {/* Reason Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700">
                Reason *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {['Expiry', 'Spoilage', 'Damage', 'Spillage', 'Quality Issue', 'Other'].map((reasonOption) => {
                  const isActive = formData.reason === reasonOption;
                  return (
                    <button
                      key={reasonOption}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, reason: reasonOption }))
                      }
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                        isActive
                          ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                          : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                      }`}
                    >
                      {reasonOption}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-6 bg-zinc-900 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Deducting Stock...' : 'Submit Wastage Report'}
            </button>
          </form>
        </div>

        {/* Right Column: Wastage History Table */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white border border-gray-200/90 rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 m-0">
                Wastage Log History
              </h2>
              <p className="text-sm text-zinc-500 font-medium mt-1 mb-0">
                Audit trail of ingredient deductions.
              </p>
            </div>

            {/* Filter Search Input */}
            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Search ingredient, reason..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-zinc-50 hover:bg-white focus:bg-white border border-zinc-300 rounded-xl text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all shadow-xs"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="w-full">
            {loading ? (
              <div className="py-4">
                <TableSkeleton rows={6} cols={6} />
              </div>
            ) : filteredHistory.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold text-xs">
                      <th className="px-5 py-3">
                        Date & Time
                      </th>
                      <th className="px-5 py-3">
                        Ingredient
                      </th>
                      <th className="px-5 py-3 text-right">
                        Quantity
                      </th>
                      <th className="px-5 py-3">
                        Unit
                      </th>
                      <th className="px-5 py-3">
                        Reason
                      </th>
                      <th className="px-5 py-3">
                        Reported By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {paginatedHistory.map((record) => {
                      const reasonClass = REASON_COLORS[record.reason] || 'bg-zinc-100 text-zinc-800 border-zinc-200';
                      const formattedDate = new Intl.DateTimeFormat('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true,
                        timeZone: 'Asia/Manila'
                      }).format(new Date(record.created_at));

                      return (
                        <tr key={record.id} className="hover:bg-zinc-50/70 transition-colors">
                          <td className="px-5 py-4 text-sm font-semibold text-zinc-600 tabular-nums">
                            {formattedDate}
                          </td>
                          <td className="px-5 py-4 text-base font-bold text-zinc-900">
                            {record.ingredients?.name || 'Unknown'}
                          </td>
                          <td className="px-5 py-4 text-base font-bold font-mono text-zinc-900 text-right tabular-nums">
                            {record.quantity}
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-zinc-600 uppercase">
                            {record.ingredients?.unit || '—'}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${reasonClass}`}>
                              {record.reason}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-zinc-700">
                            {record.users?.name || record.users?.username || 'Staff'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredHistory.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(val) => {
                    setItemsPerPage(val);
                    setCurrentPage(1);
                  }}
                  itemsPerPageOptions={[10, 20, 50]}
                />
              </div>
            ) : (
              <div className="py-16 px-6 rounded-xl bg-zinc-50 border border-dashed border-zinc-300 flex flex-col items-center justify-center text-center">
                <h3 className="text-base font-bold text-zinc-800 m-0 mb-1">
                  No Wastage Records Found
                </h3>
                <p className="text-sm text-zinc-500 max-w-sm m-0">
                  {searchFilter
                    ? 'No matching incidents found for your search filter.'
                    : 'Any reported ingredient losses or spoilage will be cataloged here.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportWastage;
