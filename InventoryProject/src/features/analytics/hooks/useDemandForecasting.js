import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getForecast, refreshForecast } from '../../../api/analyticsApi';
import { getReorderPlan } from '../../../api/inventoryApi';
import { createPurchaseOrder } from '../../../api/purchasingApi';
import { suggestedPurchase } from '../utils/forecastUtils';
import { getCurrentUser } from '../../../utils/authUtils';

export const ING_PAGE_SIZE = 15;
export const PROD_PAGE_SIZE = 15;

export const NEEDS_ORDER_ALERTS = ['OUT_OF_STOCK', 'CANNOT_MAKE', 'REORDER_NOW'];

const EXPIRING_LEVELS = ['CRITICAL', 'WARNING', 'WATCH', 'EXPIRED'];
export const isExpiring = (i) => EXPIRING_LEVELS.includes(i.expiry_level);
export const isUnused = (i) => i.usage_status === 'NOT_IN_ANY_RECIPE';

// Unused ingredients are never suggested for ordering.
const hasSupplier = (item) => (item.available_suppliers || []).length > 0 && !isUnused(item);

const getInitialTab = () => {
  if (typeof window !== 'undefined' && window.location.hash.includes('/')) {
    const sub = window.location.hash.split('/')[1];
    if (sub === 'ingredients' || sub === 'products') return sub;
  }
  try {
    const saved = localStorage.getItem('coftea_forecasting_tab');
    if (saved === 'ingredients' || saved === 'products') return saved;
  } catch {
    /* ignore storage/history errors */
  }
  return 'ingredients';
};

const compareBy = (field, dir, getVal) => (a, b) => {
  const av = getVal(a, field);
  const bv = getVal(b, field);
  if (typeof av === 'string' || typeof bv === 'string') {
    const r = String(av ?? '').localeCompare(String(bv ?? ''));
    return dir === 'asc' ? r : -r;
  }
  // Missing numbers (null) always sort last.
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  return dir === 'asc' ? av - bv : bv - av;
};

const getSortVal = (r, f) => (f === 'name' ? r.name : r[f] == null ? null : Number(r[f]));

/**
 * State, data fetching, filtering, sorting, pagination, selection and PO / detail
 * modal handlers for DemandForecasting.
 */
export const useDemandForecasting = () => {
  const [activeTab, setActiveTab] = useState(getInitialTab); // 'ingredients' | 'products'
  const canRefresh = ['Owner', 'Admin'].includes(getCurrentUser()?.role);

  const handleTabSwitch = (tab) => setActiveTab(tab);

  useEffect(() => {
    try {
      localStorage.setItem('coftea_forecasting_tab', activeTab);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#Forecasting/${activeTab}`);
      }
    } catch {
      /* ignore storage/history errors */
    }
  }, [activeTab]);

  const [infoModalOpen, setInfoModalOpen] = useState(false);

  // Ingredient reorder plan
  const [reorderPlan, setReorderPlan] = useState([]);
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ORDER' | 'WATCH' | 'OK'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedIngredientIds, setSelectedIngredientIds] = useState([]);
  const [ingPage, setIngPage] = useState(1);
  const [ingSortField, setIngSortField] = useState('days_of_cover');
  const [ingSortDirection, setIngSortDirection] = useState('asc'); // lowest cover first

  // Product forecast
  const [forecast, setForecast] = useState(null); // full /analytics/forecast response
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('ALL');
  const [prodPage, setProdPage] = useState(1);
  const [prodSortField, setProdSortField] = useState('next7');
  const [prodSortDirection, setProdSortDirection] = useState('desc'); // highest demand first

  const handleIngSort = (field) => {
    if (ingSortField === field) {
      setIngSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setIngSortField(field);
      setIngSortDirection(field === 'days_of_cover' || field === 'name' ? 'asc' : 'desc');
    }
  };

  const handleProdSort = (field) => {
    if (prodSortField === field) {
      setProdSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setProdSortField(field);
      setProdSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  // Product detail modal
  const [detailProduct, setDetailProduct] = useState(null);

  // Chosen supplier per ingredient id; unset means the first (fastest/cheapest) one.
  const [supplierChoice, setSupplierChoice] = useState({});
  const [submittingPO, setSubmittingPO] = useState(false);
  const [poConfirm, setPoConfirm] = useState(null); // [{ sup, items }] awaiting confirmation
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((type, message) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4000);
  }, []);

  const fetchIngredientForecast = useCallback(async () => {
    try {
      setLoadingIngredients(true);
      const res = await getReorderPlan();
      setReorderPlan(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to fetch reorder plan:', err);
      showToast('error', 'Failed to load ingredient restock plan.');
    } finally {
      setLoadingIngredients(false);
    }
  }, [showToast]);

  const fetchProductForecasts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      setForecast(await getForecast(14));
    } catch (err) {
      console.error('Failed to fetch product forecasts:', err);
      showToast('error', 'Failed to load product demand forecast.');
    } finally {
      setLoadingProducts(false);
    }
  }, [showToast]);

  const handleRefreshForecast = async () => {
    try {
      setRefreshing(true);
      await refreshForecast();
      await Promise.all([fetchProductForecasts(), fetchIngredientForecast()]);
      showToast('success', 'Forecast updated.');
    } catch (err) {
      showToast('error', err.message || 'Could not refresh the forecast.');
    } finally {
      setRefreshing(false);
    }
  };

  const hasFetchedProductsRef = useRef(false);

  useEffect(() => {
    fetchIngredientForecast();
  }, [fetchIngredientForecast]);

  useEffect(() => {
    if (activeTab === 'products' && !hasFetchedProductsRef.current) {
      hasFetchedProductsRef.current = true;
      fetchProductForecasts();
    }
  }, [activeTab, fetchProductForecasts]);

  // Ingredient summary + categories + filtering
  const ingredientData = useMemo(() => {
    const count = (fn) => reorderPlan.filter(fn).length;
    return {
      ingredients: reorderPlan,
      summary: {
        criticalCount: count((i) => NEEDS_ORDER_ALERTS.includes(i.alert)),
        lowStockCount: count((i) => i.alert === 'BELOW_MANUAL_THRESHOLD'),
        healthyCount: count((i) => !i.alert),
        expiringCount: count((i) => Number(i.expiring_before_use_qty) > 0),
        cannotMakeCount: count((i) => i.alert === 'CANNOT_MAKE'),
        expiringLevelCount: count(isExpiring),
        unusedCount: count(isUnused),
      },
    };
  }, [reorderPlan]);

  const categories = useMemo(() => {
    const set = new Set();
    reorderPlan.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort();
  }, [reorderPlan]);

  const filteredIngredients = useMemo(() => {
    return reorderPlan.filter((item) => {
      if (statusFilter === 'ORDER' && !NEEDS_ORDER_ALERTS.includes(item.alert)) return false;
      if (statusFilter === 'WATCH' && item.alert !== 'BELOW_MANUAL_THRESHOLD') return false;
      if (statusFilter === 'OK' && item.alert) return false;
      if (statusFilter === 'CANNOT_MAKE' && item.alert !== 'CANNOT_MAKE') return false;
      if (statusFilter === 'EXPIRING' && !isExpiring(item)) return false;
      if (statusFilter === 'UNUSED' && !isUnused(item)) return false;
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        if (!item.name?.toLowerCase().includes(q) && !item.category?.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [reorderPlan, statusFilter, selectedCategory, searchTerm]);

  useEffect(() => {
    setIngPage(1);
  }, [statusFilter, selectedCategory, searchTerm, ingSortField, ingSortDirection]);

  const sortedIngredients = useMemo(
    () => [...filteredIngredients].sort(compareBy(ingSortField, ingSortDirection, getSortVal)),
    [filteredIngredients, ingSortField, ingSortDirection]
  );

  const paginatedIngredients = useMemo(() => {
    const start = (ingPage - 1) * ING_PAGE_SIZE;
    return sortedIngredients.slice(start, start + ING_PAGE_SIZE);
  }, [sortedIngredients, ingPage]);

  // Product categories & filtering
  const productForecasts = useMemo(() => forecast?.products || [], [forecast]);

  const productCategories = useMemo(() => {
    const set = new Set();
    productForecasts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [productForecasts]);

  const filteredProducts = useMemo(() => {
    return productForecasts.filter((item) => {
      if (productCategory !== 'ALL' && item.category !== productCategory) return false;
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase();
        if (!item.name?.toLowerCase().includes(q) && !item.category?.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [productForecasts, productCategory, productSearch]);

  useEffect(() => {
    setProdPage(1);
  }, [productCategory, productSearch, prodSortField, prodSortDirection]);

  const sortedProducts = useMemo(
    () => [...filteredProducts].sort(compareBy(prodSortField, prodSortDirection, getSortVal)),
    [filteredProducts, prodSortField, prodSortDirection]
  );

  const paginatedProducts = useMemo(() => {
    const start = (prodPage - 1) * PROD_PAGE_SIZE;
    return sortedProducts.slice(start, start + PROD_PAGE_SIZE);
  }, [sortedProducts, prodPage]);

  const productSummary = useMemo(() => {
    const total7DayUnits = productForecasts.reduce((sum, p) => sum + (Number(p.next7) || 0), 0);
    const topProduct = productForecasts.reduce(
      (best, p) => (!best || (Number(p.next7) || 0) > (Number(best.next7) || 0) ? p : best),
      null
    );
    const trendingUpCount = productForecasts.filter((p) => p.trendPct > 5).length;
    return { total7DayUnits, topProduct, trendingUpCount };
  }, [productForecasts]);

  // Selection helpers. Items with no supplier cannot be ordered, so they are never selectable.
  const selectableIngredients = useMemo(
    () => filteredIngredients.filter(hasSupplier),
    [filteredIngredients]
  );

  const getChosenSupplier = useCallback(
    (item) => {
      const list = item.available_suppliers || [];
      return list.find((s) => String(s.supplier_id) === String(supplierChoice[item.id])) || list[0] || null;
    },
    [supplierChoice]
  );

  const handleChooseSupplier = (ingredientId, supplierId) =>
    setSupplierChoice((prev) => ({ ...prev, [ingredientId]: supplierId }));

  const selectedItems = useMemo(
    () => reorderPlan.filter((i) => selectedIngredientIds.includes(i.id) && hasSupplier(i)),
    [reorderPlan, selectedIngredientIds]
  );

  const selectedPoCount = useMemo(
    () => new Set(selectedItems.map((i) => String(getChosenSupplier(i).supplier_id))).size,
    [selectedItems, getChosenSupplier]
  );

  const handleToggleSelectAll = () => {
    const allSelected =
      selectableIngredients.length > 0 &&
      selectableIngredients.every((i) => selectedIngredientIds.includes(i.id));
    setSelectedIngredientIds(allSelected ? [] : selectableIngredients.map((i) => i.id));
  };

  const handleToggleItemSelect = (id) => {
    setSelectedIngredientIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedIngredientIds([]);
  };

  const handleResetIngredientFilters = () => {
    setStatusFilter('ALL');
    setSearchTerm('');
    setSelectedCategory('ALL');
  };

  const buildPoItem = (item, sup) => {
    const buy = suggestedPurchase(item, sup);
    return {
      ingredient_id: item.id,
      quantity: buy.qty > 0 ? buy.qty : 1,
      unit_price: Number(sup.default_price) > 0 ? Number(sup.default_price) : 0,
      purchase_unit: buy.unit,
      conversion_factor: buy.conversionFactor,
    };
  };

  // One PO per supplier: each supplier accepts/declines/proposes a date on its own PO.
  const createPurchaseOrders = async (items) => {
    const groups = new Map();
    const unsized = [];
    items.filter(hasSupplier).forEach((item) => {
      const sup = getChosenSupplier(item);
      // Never send a PO whose quantity unit is unknown (it would be priced per pack but counted in grams).
      if (suggestedPurchase(item, sup).needsSetup) {
        unsized.push(item.name);
        return;
      }
      const key = String(sup.supplier_id);
      if (!groups.has(key)) groups.set(key, { sup, items: [] });
      groups.get(key).items.push(item);
    });
    if (unsized.length > 0) {
      showToast('error', `Skipped ${unsized.join(', ')}: set the supplier's pack size first.`);
    }
    if (groups.size === 0) return;
    // POs go straight to the suppliers, so show what will be sent (in a modal) before creating anything.
    setPoConfirm([...groups.values()]);
  };

  const sendPurchaseOrders = async () => {
    const groups = poConfirm;
    setPoConfirm(null);
    if (!groups?.length) return;

    setSubmittingPO(true);
    const created = [];
    const failed = [];
    const orderedIds = [];
    for (const { sup, items: groupItems } of groups) {
      const label = `${sup.supplier_name} (${groupItems.length} item${groupItems.length === 1 ? '' : 's'})`;
      try {
        await createPurchaseOrder({
          supplier_id: sup.supplier_id,
          expected_date: new Date(Date.now() + (Number(sup.lead_time_days) || 3) * 86400000).toLocaleDateString('en-CA', {
            timeZone: 'Asia/Manila',
          }),
          notes: `Restock order for ${groupItems.length} item(s).`,
          items: groupItems.map((item) => buildPoItem(item, sup)),
        });
        created.push(label);
        orderedIds.push(...groupItems.map((i) => i.id));
      } catch (err) {
        console.error('Failed to create purchase order:', err);
        failed.push(`${label}: ${err.message || 'failed'}`);
      }
    }
    setSubmittingPO(false);

    setSelectedIngredientIds((prev) => prev.filter((id) => !orderedIds.includes(id)));
    if (created.length > 0) fetchIngredientForecast();
    const createdMsg = created.length
      ? `Created ${created.length} PO${created.length === 1 ? '' : 's'}: ${created.join(', ')}.`
      : '';
    const failedMsg = failed.length ? ` Failed, not created: ${failed.join('; ')}.` : '';
    showToast(failed.length ? 'error' : 'success', (createdMsg + failedMsg).trim());
  };

  const handleOrderAllCritical = () =>
    createPurchaseOrders(reorderPlan.filter((item) => NEEDS_ORDER_ALERTS.includes(item.alert)));

  const handleOpenSingleItemPO = (item) => createPurchaseOrders([item]);

  const handleOpenBatchPO = () => createPurchaseOrders(selectedItems);

  return {
    activeTab,
    handleTabSwitch,
    infoModalOpen,
    setInfoModalOpen,
    canRefresh,
    refreshing,
    handleRefreshForecast,
    forecast,
    ingredientData,
    loadingIngredients,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    selectedIngredientIds,
    selectableIngredients,
    selectedPoCount,
    getChosenSupplier,
    handleChooseSupplier,
    ingPage,
    setIngPage,
    ingSortField,
    ingSortDirection,
    handleIngSort,
    categories,
    filteredIngredients,
    paginatedIngredients,
    fetchIngredientForecast,
    handleToggleSelectAll,
    handleToggleItemSelect,
    handleClearSelection,
    handleResetIngredientFilters,
    handleOrderAllCritical,
    handleOpenSingleItemPO,
    handleOpenBatchPO,
    productForecasts,
    loadingProducts,
    productSearch,
    setProductSearch,
    productCategory,
    setProductCategory,
    prodPage,
    setProdPage,
    prodSortField,
    prodSortDirection,
    handleProdSort,
    productCategories,
    filteredProducts,
    paginatedProducts,
    productSummary,
    fetchProductForecasts,
    detailProduct,
    setDetailProduct,
    submittingPO,
    poConfirm,
    setPoConfirm,
    sendPurchaseOrders,
    toast,
    setToast,
  };
};
