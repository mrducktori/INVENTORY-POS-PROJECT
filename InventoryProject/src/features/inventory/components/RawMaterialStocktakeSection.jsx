import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getStocktakeHistory, submitStocktake } from '../../../api/inventoryApi';
import { formatQuantity } from '../../../utils/productUtils';
import { formatDisplayDate } from '../../../utils/dateUtils';
import Pagination from '../../../components/shared/Pagination';
import { INPUT_LIMITS, validateAmountInput } from '../../../utils/validationUtils';

const REASON_PRESETS = [
  'Physical Count Correction',
  'Unrecorded Spoilage',
  'Spillage / Waste',
  'Measurement Variance'
];

const formatVarianceValue = (val) => {
  const rounded = Math.round(val * 10000) / 10000;
  return Number.isInteger(rounded) ? String(rounded) : String(parseFloat(rounded.toFixed(4)));
};

const RawMaterialStocktakeSection = ({ ingredients = [], onRefreshIngredients }) => {
  const [countsMap, setCountsMap] = useState({});
  const [sessionNotes, setSessionNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState({ type: '', text: '' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PER_PAGE = 5;

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const data = await getStocktakeHistory();
      setHistory(Array.isArray(data) ? data : (data?.sessions || []));
    } catch (err) {
      console.error('Failed to load stocktake history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const categories = useMemo(() => {
    const set = new Set();
    ingredients.forEach((ing) => {
      if (ing.category) set.add(ing.category);
    });
    return ['ALL', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [ingredients]);

  const filteredIngredients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return [...ingredients]
      .filter((ing) => {
        const matchSearch =
          !term ||
          (ing.name || '').toLowerCase().includes(term) ||
          (ing.category || '').toLowerCase().includes(term);
        const matchCat = categoryFilter === 'ALL' || ing.category === categoryFilter;
        return matchSearch && matchCat;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [ingredients, searchTerm, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredIngredients.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedIngredients = filteredIngredients.slice((safePage - 1) * perPage, safePage * perPage);

  const enteredEntries = useMemo(() => {
    return Object.entries(countsMap).filter(
      ([, entry]) => entry && entry.physicalCount !== undefined && String(entry.physicalCount).trim() !== ''
    );
  }, [countsMap]);

  const handleCountChange = (ingredientId, value) => {
    setCountsMap((prev) => ({
      ...prev,
      [ingredientId]: {
        ...(prev[ingredientId] || {}),
        physicalCount: value
      }
    }));
  };

  const handleReasonChange = (ingredientId, value) => {
    setCountsMap((prev) => ({
      ...prev,
      [ingredientId]: {
        ...(prev[ingredientId] || {}),
        reason: value
      }
    }));
  };

  const handleResetCounts = () => {
    setCountsMap({});
    setSessionNotes('');
    setBanner({ type: '', text: '' });
  };

  const handleCommitStocktake = async (e) => {
    e.preventDefault();
    setBanner({ type: '', text: '' });

    if (enteredEntries.length === 0) {
      setBanner({ type: 'error', text: 'Enter at least one physical count before committing reconciliation.' });
      return;
    }

    const countsPayload = [];
    for (const [ingredientId, entry] of enteredEntries) {
      const ing = ingredients.find((i) => String(i.id) === String(ingredientId));
      const label = ing ? `Physical count for ${ing.name}` : 'Physical count';
      const check = validateAmountInput(entry.physicalCount, {
        label,
        min: INPUT_LIMITS.STOCKTAKE_COUNT_MIN,
        max: INPUT_LIMITS.STOCKTAKE_COUNT_MAX
      });
      if (!check.valid) {
        setBanner({ type: 'error', text: check.error });
        return;
      }

      const cleanReason = String(entry.reason || '').trim();
      if (cleanReason.length > 200) {
        setBanner({ type: 'error', text: `Reason for ${ing?.name || 'item'} must be 200 characters or less.` });
        return;
      }

      countsPayload.push({
        ingredient_id: ingredientId,
        physical_count: check.numericValue,
        reason: cleanReason || 'Physical Count Correction'
      });
    }

    try {
      setSubmitting(true);
      const session = await submitStocktake({
        counts: countsPayload,
        notes: sessionNotes.trim()
      });
      const adjustedCount = session?.items_adjusted ?? 0;
      setBanner({
        type: 'success',
        text: `Stocktake committed cleanly (${countsPayload.length} item(s) checked, ${adjustedCount} adjusted).`
      });
      setCountsMap({});
      setSessionNotes('');
      await Promise.all([
        onRefreshIngredients ? onRefreshIngredients() : Promise.resolve(),
        loadHistory()
      ]);
    } catch (err) {
      setBanner({ type: 'error', text: err.message || 'Failed to commit stocktake reconciliation.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <datalist id="stocktake-reason-presets">
        {REASON_PRESETS.map((preset) => (
          <option key={preset} value={preset} />
        ))}
      </datalist>

      {banner.text && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between border shadow-xs ${
            banner.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner({ type: '', text: '' })}
            className="text-xs font-bold uppercase opacity-75 hover:opacity-100 cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleCommitStocktake} className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Physical Count Reconciliation</h2>
            <p className="m-0 mt-0.5 text-xs text-gray-500 font-medium">
              Enter actual counted quantities to reconcile system stock and active batches.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <input
              type="text"
              placeholder="Search ingredients..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full sm:w-56 px-3.5 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="w-full sm:w-52 px-3.5 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'ALL' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Ingredient</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">System Stock</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Physical Count</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Variance</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Reason / Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredIngredients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400 font-medium">
                    No active raw materials match your filter.
                  </td>
                </tr>
              ) : (
                pagedIngredients.map((ing) => {
                  const entry = countsMap[ing.id] || {};
                  const rawCount = entry.physicalCount ?? '';
                  const hasInput = String(rawCount).trim() !== '';
                  const parsedCount = hasInput ? Number(rawCount) : NaN;
                  const systemQty = Number(ing.stock_quantity) || 0;
                  const variance = hasInput && Number.isFinite(parsedCount) ? parsedCount - systemQty : null;

                  return (
                    <tr key={ing.id} className={`transition-colors ${hasInput ? 'bg-zinc-50/80' : 'hover:bg-gray-50/50'}`}>
                      <td className="px-6 py-3.5">
                        <div className="text-sm font-bold text-gray-900">{ing.name}</div>
                        <div className="text-[11px] text-gray-500 font-medium">
                          {ing.category || 'GENERAL'} • {ing.unit}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-bold text-gray-700 text-right tabular-nums">
                        {formatQuantity(systemQty, ing.unit)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="1000000"
                            step="any"
                            value={rawCount}
                            onChange={(e) => handleCountChange(ing.id, e.target.value)}
                            placeholder={String(systemQty)}
                            className="w-32 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-900"
                          />
                          <span className="text-xs font-semibold text-gray-500">{ing.unit}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {variance === null ? (
                          <span className="text-xs text-gray-400 font-medium">—</span>
                        ) : Math.abs(variance) <= 0.0001 ? (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            0 Matched
                          </span>
                        ) : variance > 0 ? (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200 tabular-nums">
                            +{formatVarianceValue(variance)} {ing.unit} Overage
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 tabular-nums">
                            -{formatVarianceValue(Math.abs(variance))} {ing.unit} Shortage
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <input
                          type="text"
                          maxLength={200}
                          list="stocktake-reason-presets"
                          value={entry.reason || ''}
                          onChange={(e) => handleReasonChange(ing.id, e.target.value)}
                          placeholder="Physical Count Correction"
                          className="w-full min-w-[160px] max-w-[260px] px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          totalItems={filteredIngredients.length}
          itemsPerPage={perPage}
          onPageChange={setPage}
          onItemsPerPageChange={(n) => { setPerPage(n); setPage(1); }}
        />

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700 shrink-0">
              Modified: {enteredEntries.length} item(s)
            </span>
            <input
              type="text"
              maxLength={200}
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="Optional session notes (e.g. End-of-week count)"
              className="w-full sm:max-w-sm px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div className="flex items-center gap-2.5">
            {enteredEntries.length > 0 && (
              <button
                type="button"
                onClick={handleResetCounts}
                disabled={submitting}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Clear Counts
              </button>
            )}
            <button
              type="submit"
              disabled={submitting || enteredEntries.length === 0}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors shadow-xs disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? 'Committing...' : 'Commit Stocktake Reconciliation'}
            </button>
          </div>
        </div>
      </form>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div>
            <h3 className="m-0 text-base font-bold text-gray-900 tracking-tight">Recent Stocktake Reconciliations</h3>
            <p className="m-0 text-xs text-gray-500 font-medium mt-0.5">Latest physical count audit sessions</p>
          </div>
          <button
            type="button"
            onClick={loadHistory}
            disabled={loadingHistory}
            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors cursor-pointer"
          >
            {loadingHistory ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="overflow-x-auto">
          {history.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400 font-medium">
              No stocktake reconciliations recorded yet.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Conducted By</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">Items Adjusted</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Details</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs md:text-sm">
                {history.slice((historyPage - 1) * HISTORY_PER_PAGE, historyPage * HISTORY_PER_PAGE).map((session) => {
                  const adjusted = Array.isArray(session.items) ? session.items : [];
                  return (
                    <tr key={session.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3.5 text-gray-700 font-semibold whitespace-nowrap">
                        {formatDisplayDate(session.conducted_at || session.created_at)}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-gray-900 whitespace-nowrap">
                        {session.conducted_by_name || 'Staff'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-gray-900 whitespace-nowrap">
                        {session.items_adjusted ?? adjusted.length} / {session.total_checked ?? adjusted.length}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">
                        {adjusted.length === 0 ? (
                          <span className="text-gray-400">All counted items matched system stock</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {adjusted.slice(0, 4).map((it, idx) => (
                              <span
                                key={`${session.id}-${it.ingredient_id || idx}`}
                                className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-[11px] font-semibold text-zinc-800"
                              >
                                {it.ingredient_name}: {it.system_quantity} {'->'} {it.physical_count} {it.unit || ''}
                              </span>
                            ))}
                            {adjusted.length > 4 && (
                              <span className="text-[11px] font-semibold text-gray-500">
                                +{adjusted.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-gray-500 max-w-xs truncate">
                        {session.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <Pagination
          currentPage={historyPage}
          totalPages={Math.max(1, Math.ceil(history.length / HISTORY_PER_PAGE))}
          totalItems={history.length}
          itemsPerPage={HISTORY_PER_PAGE}
          onPageChange={setHistoryPage}
        />
      </div>
    </div>
  );
};

export default RawMaterialStocktakeSection;
