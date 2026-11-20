import { useState, useEffect, useMemo, useCallback } from 'react';
import { getSales } from '../../../api/salesApi.js';
import { getCategorySettings, extractCategoryNames } from '../../../api/categorySettingsApi.js';
import { getManilaDateOnly } from '../../../utils/dateUtils.js';

// Format date to: YYYY-MM-DD hh:mm:ss A (Asia/Manila)
export const formatDateTime = (dateStr) => {
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

export const CATEGORY_PILLS = [
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

export const DATE_PRESETS = [
  { id: 'RECENT', label: 'Latest' },
  { id: 'TODAY', label: 'Today' },
  { id: '7D', label: 'Last 7 Days' },
  { id: 'MONTH', label: 'This Month' },
];

/**
 * Manages state, receipt fetching, filtering, sorting, pagination, KPIs, and CSV export for SalesReceiptJournal.
 */
export const useSalesReceiptJournal = () => {
  const [sales, setSales] = useState([]);
  const [dynamicCategoryNames, setDynamicCategoryNames] = useState(() => extractCategoryNames([]));
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

  // Fetch dynamic categories once on mount
  useEffect(() => {
    let active = true;
    getCategorySettings()
      .then((rows) => {
        if (active) setDynamicCategoryNames(extractCategoryNames(rows));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const categoryPills = useMemo(() => [
    { id: 'ALL', label: 'All Types' },
    ...dynamicCategoryNames.map((cat) => ({ id: cat, label: cat })),
    { id: 'CASH', label: 'CASH' },
    { id: 'GCASH', label: 'GCASH' },
    { id: 'DISCOUNTED', label: 'DISCOUNTED' },
  ], [dynamicCategoryNames]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const applyDatePreset = useCallback((preset) => {
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
  }, []);

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
      if (datePreset === 'RECENT') {
        filters.skip_count = true;
      }

      const limitParam = datePreset === 'RECENT'
        ? (Number(fetchLimit) || 250)
        : (fetchLimit === 'all' ? 'all' : Number(fetchLimit) || 250);
      const result = await getSales(filters, limitParam, 1);
      const list = Array.isArray(result) ? result : (result?.data || []);
      setSales(list);
      setTotalServerCount(
        datePreset === 'RECENT'
          ? list.length
          : (typeof result?.total === 'number' ? result.total : list.length)
      );
    } catch (err) {
      console.error('Failed to load sales journal:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, datePreset, startDate, endDate, selectedType, statusScope, fetchLimit]);

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
      all: datePreset === 'RECENT'
        ? sales.length
        : (totalServerCount > 0 ? totalServerCount : sales.length),
      today,
      cash,
      gcash,
      discounted,
    };
  }, [sales, totalServerCount, datePreset, isSaleToday]);

  // Dynamic fetch options based on the total records matching active filters
  const fetchOptions = useMemo(() => {
    if (datePreset === 'RECENT') {
      return [
        { value: 100, label: 'Latest 100' },
        { value: 250, label: 'Latest 250' },
        { value: 500, label: 'Latest 500' },
        { value: 1000, label: 'Latest 1,000' },
      ];
    }

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
  }, [datePreset, totalServerCount]);

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

  const pageNumbers = useMemo(() => {
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
  }, [totalPages, currentPage]);

  const handleSort = useCallback((field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField]);

  const handleStartDateChange = useCallback((value) => {
    setDatePreset('CUSTOM');
    setStartDate(value);
    setCurrentPage(1);
  }, []);

  const handleEndDateChange = useCallback((value) => {
    setDatePreset('CUSTOM');
    setEndDate(value);
    setCurrentPage(1);
  }, []);

  const handleFetchLimitChange = useCallback((value) => {
    const val = value === 'all' ? 'all' : Number(value);
    setFetchLimit(val);
    setCurrentPage(1);
  }, []);

  const handleTypeChange = useCallback((typeId) => {
    setSelectedType(typeId);
    setCurrentPage(1);
  }, []);

  const handleStatusScopeChange = useCallback((scopeId) => {
    setStatusScope(scopeId);
    setCurrentPage(1);
  }, []);

  const handlePageSizeChange = useCallback((newSize) => {
    setPageSize(Number(newSize));
    setCurrentPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSelectedType('ALL');
    setStatusScope('ALL');
    setSearchInput('');
    setCurrentPage(1);
  }, []);

  // Export filtered receipts to CSV
  const handleExportCSV = useCallback(() => {
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
  }, [filteredSales]);

  return {
    sales,
    categoryPills,
    totalServerCount,
    loading,
    searchInput,
    setSearchInput,
    pageSize,
    fetchLimit,
    currentPage,
    setCurrentPage,
    datePreset,
    startDate,
    endDate,
    selectedType,
    statusScope,
    activeReceiptSaleId,
    setActiveReceiptSaleId,
    showGuide,
    setShowGuide,
    counts,
    fetchOptions,
    metrics,
    filteredSales,
    displayedSales,
    effectiveTotal,
    totalPages,
    startEntry,
    endEntry,
    pageNumbers,
    fetchSales,
    applyDatePreset,
    handleStartDateChange,
    handleEndDateChange,
    handleFetchLimitChange,
    handleTypeChange,
    handleStatusScopeChange,
    handlePageSizeChange,
    handleResetFilters,
    handleSort,
    handleExportCSV,
  };
};
