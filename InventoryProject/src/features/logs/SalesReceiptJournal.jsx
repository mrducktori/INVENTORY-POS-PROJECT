import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getSales } from '../../api/salesApi.js';
import { getManilaDateOnly } from '../../utils/dateUtils.js';
import SalesReceiptModal from '../../components/SalesReceiptModal.jsx';

// Format date to: YYYY-MM-DD hh:mm:ss A (Asia/Manila)
const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    const manila = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = manila.getFullYear();
    const mm = pad(manila.getMonth() + 1);
    const dd = pad(manila.getDate());
    let hh = manila.getHours();
    const min = pad(manila.getMinutes());
    const ss = pad(manila.getSeconds());
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12 || 12;
    return `${yyyy}-${mm}-${dd} ${pad(hh)}:${min}:${ss} ${ampm}`;
  } catch {
    return dateStr;
  }
};

const getOffsetManilaDate = (daysBack) => {
  const todayStr = getManilaDateOnly();
  const base = new Date(`${todayStr}T00:00:00+08:00`);
  base.setTime(base.getTime() - daysBack * 86400000);
  const manila = new Date(base.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const pad = (n) => String(n).padStart(2, '0');
  return `${manila.getFullYear()}-${pad(manila.getMonth() + 1)}-${pad(manila.getDate())}`;
};

const CATEGORY_PILLS = [
  { id: 'ALL', label: 'All Types' },
  { id: 'COFFEE', label: 'COFFEE' },
  { id: 'MILK TEA', label: 'MILK TEA' },
  { id: 'FRAPPE', label: 'FRAPPE' },
  { id: 'FRUIT DRINKS', label: 'FRUIT DRINKS' },
  { id: 'PASTRIES', label: 'PASTRIES' },
  { id: 'CASH', label: 'CASH' },
  { id: 'GCASH', label: 'GCASH' },
  { id: 'DISCOUNTED', label: 'DISCOUNTED' },
];

const SalesReceiptJournal = () => {
  const [sales, setSales] = useState([]);
  const [totalServerCount, setTotalServerCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [fetchLimit, setFetchLimit] = useState(250);
  const [currentPage, setCurrentPage] = useState(1);

  // Server request date range & filters
  const [datePreset, setDatePreset] = useState('RECENT'); // 'RECENT' | 'TODAY' | '7D' | 'MONTH' | 'CUSTOM'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filters matching reference UI
  const [selectedType, setSelectedType] = useState('ALL');
  const [statusScope, setStatusScope] = useState('ALL'); // 'ALL' | 'TODAY' | 'CASH' | 'GCASH' | 'DISCOUNTED'

  // Sorting
  const [sortField, setSortField] = useState('created');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'

  // Modals
  const [activeReceiptSaleId, setActiveReceiptSaleId] = useState(null);
  const [showGuide, setShowGuide] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    setCurrentPage(1);
    const todayStr = getManilaDateOnly();
    if (preset === 'RECENT') {
      setStartDate('');
      setEndDate('');
      setFetchLimit(250);
    } else if (preset === 'TODAY') {
      setStartDate(todayStr);
      setEndDate(todayStr);
      setFetchLimit('all');
    } else if (preset === '7D') {
      setStartDate(getOffsetManilaDate(6));
      setEndDate(todayStr);
      setFetchLimit('all');
    } else if (preset === 'MONTH') {
      setStartDate(`${todayStr.slice(0, 8)}01`);
      setEndDate(todayStr);
      setFetchLimit('all');
    }
  };

  // Fetch sales from API with active date/type/search request filters
  const fetchSales = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {
        search: debouncedSearch,
      };
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;
      if (selectedType === 'CASH' || selectedType === 'GCASH') {
        filters.payment_method = selectedType;
      } else if (selectedType === 'DISCOUNTED') {
        filters.discounted = true;
      } else if (selectedType !== 'ALL') {
        filters.category = selectedType;
      }
      if (statusScope === 'CASH' || statusScope === 'GCASH') {
        filters.payment_method = statusScope;
      } else if (statusScope === 'DISCOUNTED') {
        filters.discounted = true;
      }

      const limitParam = fetchLimit === 'all' ? 'all' : Number(fetchLimit) || 250;
      const result = await getSales(filters, limitParam, 1);
      const list = Array.isArray(result) ? result : (result?.data || []);
      setSales(list);
      setTotalServerCount(typeof result?.total === 'number' ? result.total : list.length);
    } catch (err) {
      console.error('Failed to load sales journal:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, startDate, endDate, selectedType, statusScope, fetchLimit]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Helper to check if a sale was created today (Manila Timezone)
  const isSaleToday = useCallback((dateStr) => {
    if (!dateStr) return false;
    try {
      const today = getManilaDateOnly();
      const d = new Date(new Date(dateStr).toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      const pad = (n) => String(n).padStart(2, '0');
      const saleDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return saleDate === today;
    } catch {
      return false;
    }
  }, []);

  // Compute live counts for status pills based on loaded sales
  const counts = useMemo(() => {
    let today = 0;
    let cash = 0;
    let gcash = 0;
    let discounted = 0;

    sales.forEach((s) => {
      if (isSaleToday(s.created_at)) today += 1;
      const method = String(s.payment_method || '').toUpperCase();
      if (method === 'CASH') cash += 1;
      if (method === 'GCASH') gcash += 1;
      if (Number(s.discount_amount || 0) > 0) discounted += 1;
    });

    return {
      all: totalServerCount > 0 ? totalServerCount : sales.length,
      today,
      cash,
      gcash,
      discounted,
    };
  }, [sales, totalServerCount, isSaleToday]);

  // Dynamic fetch options based on the total records matching active filters
  const fetchOptions = useMemo(() => {
    const total = totalServerCount;
    if (!total || total <= 0) {
      return [{ value: 'all', label: 'All (0 matching)' }];
    }

    if (total <= 100) {
      return [{ value: 'all', label: `All (${total} receipts)` }];
    }

    if (total <= 500) {
      return [
        { value: 100, label: '100 receipts' },
        ...(total > 250 ? [{ value: 250, label: '250 receipts' }] : []),
        { value: 'all', label: `All (${total.toLocaleString()} receipts)` },
      ];
    }

    if (total <= 1000) {
      return [
        { value: 100, label: '100 receipts' },
        { value: 250, label: '250 receipts' },
        { value: 500, label: '500 receipts' },
        { value: 'all', label: `All (${total.toLocaleString()} receipts)` },
      ];
    }

    // High volume totals > 1000 (e.g. 14,044 matching receipts)
    const tiers = [250, 500, 1000, 2500, 5000].filter((t) => t < total);
    return [
      ...tiers.map((t) => ({ value: t, label: `${t.toLocaleString()} receipts` })),
      { value: 'all', label: `All (${total.toLocaleString()} receipts)` },
    ];
  }, [totalServerCount]);

  // KPI Calculations
  const metrics = useMemo(() => {
    const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
    const avgTicket = sales.length > 0 ? totalRevenue / sales.length : 0;
    return {
      totalRevenue,
      avgTicket,
    };
  }, [sales]);

  // Client-side filtering across Selected Type, Status Scope, and Search
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // 1. Selected Type Pill Filter
      if (selectedType !== 'ALL') {
        if (selectedType === 'CASH') {
          if (String(sale.payment_method || '').toUpperCase() !== 'CASH') return false;
        } else if (selectedType === 'GCASH') {
          if (String(sale.payment_method || '').toUpperCase() !== 'GCASH') return false;
        } else if (selectedType === 'DISCOUNTED') {
          if (Number(sale.discount_amount || 0) <= 0) return false;
        } else {
          // Category filter (COFFEE, MILK TEA, etc.)
          const hasCategory = (sale.sale_items || []).some(
            (item) => String(item.products?.category || '').toUpperCase() === selectedType
          );
          if (!hasCategory) return false;
        }
      }

      // 2. Status Scope Pill Filter
      if (statusScope !== 'ALL') {
        if (statusScope === 'TODAY' && !isSaleToday(sale.created_at)) return false;
        if (statusScope === 'CASH' && String(sale.payment_method || '').toUpperCase() !== 'CASH') return false;
        if (statusScope === 'GCASH' && String(sale.payment_method || '').toUpperCase() !== 'GCASH') return false;
        if (statusScope === 'DISCOUNTED' && Number(sale.discount_amount || 0) <= 0) return false;
      }

      // 3. Search query filter (strictly case-insensitive, matching receipt #, staff, items, add-ons, or notes)
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase().trim().replace(/^#/, '');
        const receiptNo = String(sale.receipt_number || '').toLowerCase();
        const fullId = String(sale.id || '').toLowerCase();
        const matchesId = q.length >= 6 && fullId.startsWith(q);
        const cashier = String(sale.users?.name || sale.users?.username || '').toLowerCase();
        const method = String(sale.payment_method || '').toLowerCase();
        const ref = String(sale.transaction_reference || '').toLowerCase();
        const notes = String(sale.notes || '').toLowerCase();

        const matchesTop =
          receiptNo.includes(q) ||
          matchesId ||
          cashier.includes(q) ||
          method.includes(q) ||
          ref.includes(q) ||
          notes.includes(q);

        if (matchesTop) return true;

        const hasItem = (sale.sale_items || []).some((it) => {
          const prodName = String(it.products?.name || it.name || '').toLowerCase();
          const prodCat = String(it.products?.category || it.category || '').toLowerCase();
          const cupSize = String(it.cup_size || '').toLowerCase();
          const itemNotes = String(it.notes || '').toLowerCase();

          let addOnsMatch = false;
          if (Array.isArray(it.add_ons)) {
            addOnsMatch = it.add_ons.some((ao) => {
              let parsed = ao;
              if (typeof ao === 'string') {
                try { parsed = JSON.parse(ao); } catch { parsed = { name: ao }; }
              }
              return String(parsed?.name || '').toLowerCase().includes(q);
            });
          }

          return (
            prodName.includes(q) ||
            prodCat.includes(q) ||
            cupSize.includes(q) ||
            itemNotes.includes(q) ||
            addOnsMatch
          );
        });

        if (!hasItem) return false;
      }

      return true;
    });
  }, [sales, selectedType, statusScope, debouncedSearch, isSaleToday]);

  // Client-side sorting
  const sortedSales = useMemo(() => {
    const list = [...filteredSales];
    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'customer') {
        valA = a.users?.name || '';
        valB = b.users?.name || '';
      } else if (sortField === 'total_price') {
        valA = Number(a.total_amount) || 0;
        valB = Number(b.total_amount) || 0;
      } else if (sortField === 'paid_amount') {
        valA = Number(a.amount_received || a.total_amount) || 0;
        valB = Number(b.amount_received || b.total_amount) || 0;
      } else if (sortField === 'created') {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredSales, sortField, sortOrder]);

  // Sliced page rows
  const displayedSales = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedSales.slice(start, start + pageSize);
  }, [sortedSales, currentPage, pageSize]);

  const effectiveTotal = sortedSales.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));
  const startEntry = effectiveTotal === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, effectiveTotal);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Export filtered receipts to CSV
  const handleExportCSV = () => {
    if (!filteredSales || filteredSales.length === 0) return;

    const headers = [
      'Receipt Number',
      'Date & Time',
      'Cashier',
      'Items Ordered',
      'Subtotal',
      'Discount',
      'Tax (12%)',
      'Total Amount',
      'Payment Method',
      'Amount Received',
      'Change',
      'Reference / Notes',
    ];

    const rows = filteredSales.map((sale) => {
      const itemsSummary = (sale.sale_items || [])
        .map((it) => `${it.quantity || 1}x ${it.products?.name || 'Item'}${it.cup_size ? ` (${it.cup_size})` : ''}`)
        .join('; ');
      const discount = Number(sale.discount_amount || 0);
      const subtotal = Number(sale.total_amount || 0) + discount;

      return [
        sale.receipt_number || sale.id,
        formatDateTime(sale.created_at),
        sale.users?.name || sale.users?.username || 'Staff',
        `"${itemsSummary.replace(/"/g, '""')}"`,
        subtotal.toFixed(2),
        discount.toFixed(2),
        Number(sale.tax_amount || 0).toFixed(2),
        Number(sale.total_amount || 0).toFixed(2),
        sale.payment_method || 'CASH',
        Number(sale.amount_received || sale.total_amount || 0).toFixed(2),
        Number(sale.change_amount || 0).toFixed(2),
        `"${String(sale.transaction_reference || sale.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `CofTea_Receipt_Journal_${getManilaDateOnly()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      if (currentPage <= 3) end = 4;
      else if (currentPage >= totalPages - 2) start = totalPages - 3;
      if (start > 2) pages.push('ellipsis-start');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('ellipsis-end');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="p-4 md:p-8 flex-1 bg-white min-h-screen overflow-y-auto w-full space-y-6">
      {/* Page Title & Operational Subtitle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight m-0">
            Receipt Journal
          </h1>
          <p className="text-sm text-zinc-500 font-medium mt-1 mb-0">
            Digital transaction audit trail, order breakdowns, and tendered payment records.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Total Receipts
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums mt-1">
            {totalServerCount > 0 ? totalServerCount.toLocaleString() : sales.length.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            {totalServerCount > sales.length
              ? `Loaded ${sales.length.toLocaleString()} of ${totalServerCount.toLocaleString()} matching`
              : `All ${sales.length.toLocaleString()} matching loaded`}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Journal Revenue
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums font-mono mt-1">
            ₱{metrics.totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            {totalServerCount > sales.length
              ? `Volume for ${sales.length.toLocaleString()} loaded receipts`
              : `Cumulative completed volume`}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Average Ticket
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums font-mono mt-1">
            ₱{metrics.avgTicket.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            Per customer transaction
          </div>
        </div>
      </div>

      {/* Main Journal Container (Reference Layout) */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs p-5 md:p-6 space-y-4">
        {/* Row 1: Search Input on Left, Action Buttons on Right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <svg
              className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search receipt #, staff, item..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-7 py-1.5 bg-zinc-50/70 border border-zinc-200 rounded-lg text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-400 transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer bg-transparent border-none inline-flex items-center justify-center"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {/* Right Action Buttons matching reference */}
          <div className="flex items-center gap-2 shrink-0">
            {filteredSales.length > 0 && (
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3.5 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                title="Download receipts as CSV spreadsheet"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Export CSV ({filteredSales.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>Receipt Guide</span>
            </button>

            <button
              type="button"
              onClick={fetchSales}
              disabled={loading}
              className="p-1.5 border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
              title="Refresh journal records"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Row 1.5: Date Range & Server Request Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 pb-1 border-y border-zinc-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'RECENT', label: 'Latest' },
              { id: 'TODAY', label: 'Today' },
              { id: '7D', label: 'Last 7 Days' },
              { id: 'MONTH', label: 'This Month' },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyDatePreset(preset.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer border ${
                  datePreset === preset.id
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                {preset.label}
              </button>
            ))}

            <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
              <input
                type="date"
                aria-label="Start date"
                value={startDate}
                onChange={(e) => {
                  setDatePreset('CUSTOM');
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-md text-xs text-zinc-800 focus:outline-none focus:border-zinc-400"
              />
              <span className="text-xs text-zinc-400">to</span>
              <input
                type="date"
                aria-label="End date"
                value={endDate}
                onChange={(e) => {
                  setDatePreset('CUSTOM');
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-md text-xs text-zinc-800 focus:outline-none focus:border-zinc-400"
              />
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => applyDatePreset('RECENT')}
                  className="px-2 py-1 text-xs font-semibold text-zinc-500 hover:text-zinc-800 cursor-pointer"
                >
                  Clear dates
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Fetch:</span>
            <select
              aria-label="Fetch receipt limit"
              value={fetchOptions.some((o) => String(o.value) === String(fetchLimit)) ? fetchLimit : 'all'}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setFetchLimit(val);
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-md text-xs font-semibold text-zinc-800 focus:outline-none focus:border-zinc-400 cursor-pointer"
            >
              {fetchOptions.map((opt) => (
                <option key={String(opt.value)} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Category / Type Filter Pills (exact match to reference) */}
        <div className="flex flex-wrap items-center gap-1 bg-zinc-100 p-1 rounded-lg">
          {CATEGORY_PILLS.map((pill) => {
            const isActive = selectedType === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => {
                  setSelectedType(pill.id);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Row 3: Status / Scope Filter Pills (exact match to reference) */}
        <div className="inline-flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/70">
          {[
            { id: 'ALL', label: 'All', count: counts.all },
            { id: 'TODAY', label: 'Today', count: counts.today },
            { id: 'CASH', label: 'Cash', count: counts.cash },
            { id: 'GCASH', label: 'GCash', count: counts.gcash },
            { id: 'DISCOUNTED', label: 'Discounted', count: counts.discounted },
          ].map((scope) => {
            const isActive = statusScope === scope.id;
            return (
              <button
                key={scope.id}
                type="button"
                onClick={() => {
                  setStatusScope(scope.id);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {scope.label} ({scope.count})
              </button>
            );
          })}
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="space-y-2 py-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-zinc-100/70 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 mx-auto flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className="text-sm font-bold text-zinc-800 m-0">No receipts match your current filters</h4>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">
              Try choosing another type or reset filters to display all transactions.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedType('ALL');
                setStatusScope('ALL');
                setSearchInput('');
              }}
              className="mt-3 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-500 font-semibold">
                  <th className="py-3 px-3 sticky left-0 bg-zinc-50/50 z-10 whitespace-nowrap">
                    Receipt No.
                  </th>
                  <th
                    onClick={() => handleSort('created')}
                    className="py-3 px-3 whitespace-nowrap cursor-pointer select-none group hover:text-zinc-900"
                  >
                    <div className="flex items-center gap-1">
                      <span>Date & Time</span>
                      <svg className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('customer')}
                    className="py-3 px-3 whitespace-nowrap cursor-pointer select-none group hover:text-zinc-900"
                  >
                    <div className="flex items-center gap-1">
                      <span>Cashier / Staff</span>
                      <svg className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </th>
                  <th className="py-3 px-3 whitespace-nowrap">
                    Items Breakdown
                  </th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">
                    Qty
                  </th>
                  <th className="py-3 px-3 whitespace-nowrap">
                    Method
                  </th>
                  <th className="py-3 px-3 whitespace-nowrap">
                    Discount
                  </th>
                  <th
                    onClick={() => handleSort('total_price')}
                    className="py-3 px-3 whitespace-nowrap cursor-pointer select-none group hover:text-zinc-900 text-right"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total</span>
                      <svg className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">
                    Status
                  </th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {displayedSales.map((sale) => {
                  const items = sale.sale_items || [];
                  const receiptNo = sale.receipt_number || `RCP-${String(sale.id).slice(0, 8).toUpperCase()}`;
                  const totalFormatted = `₱${Number(sale.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const method = String(sale.payment_method || 'CASH').toUpperCase();
                  const staffName = sale.users?.name || sale.users?.username || 'Staff';
                  const totalItemsQty = items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
                  const discountAmount = Number(sale.discount_amount || 0);

                  const discountLabel = typeof sale.notes === 'string' && sale.notes.startsWith('Discount:')
                    ? sale.notes.replace(/^Discount:\s*/i, '').trim()
                    : discountAmount > 0
                    ? 'Applied'
                    : null;

                  return (
                    <tr
                      key={sale.id}
                      onClick={() => setActiveReceiptSaleId(sale.id)}
                      className="hover:bg-zinc-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Receipt No */}
                      <td className="sticky left-0 bg-white group-hover:bg-zinc-50 z-10 py-3.5 px-3 font-mono font-bold text-zinc-900 whitespace-nowrap">
                        {receiptNo}
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-3 text-zinc-600 font-mono text-xs whitespace-nowrap">
                        {formatDateTime(sale.created_at)}
                      </td>

                      {/* Cashier / Staff */}
                      <td className="py-3.5 px-3 font-medium text-zinc-800 whitespace-nowrap">
                        {staffName}
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-3 text-zinc-800 max-w-xs">
                        {items.length > 0 ? (
                          <div className="space-y-1">
                            {items.slice(0, 2).map((it, idx) => (
                              <div key={it.id || idx} className="flex items-center gap-1.5 truncate">
                                <span className="inline-flex items-center justify-center min-w-4 px-1 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                                  {it.quantity || 1}×
                                </span>
                                <span className="truncate font-medium text-zinc-900">
                                  {it.products?.name || 'Item'}
                                </span>
                                {it.cup_size && (
                                  <span className="text-[10px] text-zinc-400 font-mono">({it.cup_size})</span>
                                )}
                              </div>
                            ))}
                            {items.length > 2 && (
                              <div className="text-[11px] text-zinc-400 font-medium">
                                +{items.length - 2} more item{items.length - 2 > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Total Qty */}
                      <td className="py-3.5 px-3 text-center text-zinc-700 font-mono font-semibold whitespace-nowrap">
                        {totalItemsQty}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                            method === 'GCASH'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                          }`}
                        >
                          {method}
                        </span>
                      </td>

                      {/* Discount Badge */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {discountLabel ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {discountLabel} (-₱{discountAmount.toFixed(2)})
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-zinc-950 whitespace-nowrap">
                        {totalFormatted}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Completed
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveReceiptSaleId(sale.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && effectiveTotal > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-zinc-100 text-xs md:text-sm text-zinc-600">
            <div className="flex items-center gap-3">
              <span>
                Showing <strong className="font-semibold text-zinc-900">{startEntry}</strong> to{' '}
                <strong className="font-semibold text-zinc-900">{endEntry}</strong> of{' '}
                <strong className="font-semibold text-zinc-900">{effectiveTotal}</strong> entries
              </span>

              <div className="flex items-center gap-1.5 border-l border-zinc-200 pl-3">
                <span className="text-zinc-500 text-xs">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-md text-xs font-semibold text-zinc-800 focus:outline-none focus:border-zinc-400 cursor-pointer"
                >
                  {[10, 25, 50].map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium text-zinc-700"
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, idx) =>
                  page === 'ellipsis-start' || page === 'ellipsis-end' ? (
                    <span key={`el-${idx}`} className="px-2 py-1 text-zinc-400 font-semibold">
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        currentPage === page
                          ? 'bg-zinc-900 text-white shadow-xs'
                          : 'text-zinc-700 hover:bg-zinc-100 border border-transparent hover:border-zinc-200'
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium text-zinc-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Digital Receipt Modal Component */}
      {activeReceiptSaleId && (
        <SalesReceiptModal
          saleId={activeReceiptSaleId}
          onClose={() => setActiveReceiptSaleId(null)}
        />
      )}

      {/* Receipt & Audit Reference Guide Modal */}
      {showGuide && (
        <div
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 m-0">
                  Receipt Journal & POS Audit Guide
                </h3>
                <p className="text-xs text-zinc-500 mt-1 mb-0 font-medium">
                  Standard operating reference for digital transaction slips, VAT, and discounts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
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
                  12% Value-Added Tax (VAT) & Statutory Compliance
                </div>
                <div className="space-y-1 text-xs text-zinc-600 mt-1">
                  <div><strong>Vatable Sales:</strong> Net sales amount before Value-Added Tax (<code className="font-mono">Total ÷ 1.12</code>).</div>
                  <div><strong>VAT Amount (12%):</strong> Standard 12% statutory consumption tax component.</div>
                  <div><strong>Senior Citizen & PWD:</strong> Republic Act 9994 / 10754 exempts qualifying transactions from 12% VAT and applies a 20% discount on personal consumption.</div>
                </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 space-y-1.5">
                <div className="font-bold text-zinc-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-900" />
                  Discount Classifications
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-600 mt-1">
                  <div className="p-2.5 bg-white rounded-lg border border-zinc-200">
                    <strong className="text-zinc-900 block">Senior Citizen & PWD (20%)</strong>
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
                  Payment Tenders & Digital Archiving
                </div>
                <p className="m-0 text-zinc-600 text-xs">
                  All transactions record the tender mode (Cash with tendered amount & change, or GCash with electronic reference code). Clicking any row opens the full thermal digital slip equipped with print capabilities for customer paper issuance.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesReceiptJournal;
