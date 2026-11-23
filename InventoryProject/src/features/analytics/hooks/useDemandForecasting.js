import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getForecast, refreshForecast } from '../../../api/analyticsApi';
import { getReorderPlan } from '../../../api/inventoryApi';
import { getSuppliers, createPurchaseOrder } from '../../../api/purchasingApi';
import { getCurrentUser } from '../../../utils/authUtils';

export const ING_PAGE_SIZE = 15;
export const PROD_PAGE_SIZE = 15;

export const NEEDS_ORDER_ALERTS = ['OUT_OF_STOCK', 'REORDER_NOW'];

export const doesItemMatchSupplier = (item, supplierId) => {
  if (!supplierId || !item) return false;
  const target = String(supplierId);
  if (Array.isArray(item.available_suppliers) && item.available_suppliers.length > 0) {
    return item.available_suppliers.some((s) => String(s.supplier_id) === target);
  }
  return Boolean(item.supplier_id && String(item.supplier_id) === target);
};

const getItemSupplierIds = (item) => {
  if (!item) return [];
  const ids = (item.available_suppliers || []).map((s) => String(s.supplier_id)).filter(Boolean);
  if (ids.length === 0 && item.supplier_id) {
    ids.push(String(item.supplier_id));
  }
  return ids;
};

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

  // Suppliers & PO Modal State
  const [suppliers, setSuppliers] = useState([]);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poTargetSupplierId, setPoTargetSupplierId] = useState('');
  const [poPoolItems, setPoPoolItems] = useState([]);
  const [poItems, setPoItems] = useState([]);
  const [poExpectedDate, setPoExpectedDate] = useState(() =>
    new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  );
  const [poNotes, setPoNotes] = useState('');
  const [submittingPO, setSubmittingPO] = useState(false);
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

  const fetchSuppliersList = useCallback(async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(data || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    }
  }, []);

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
    fetchSuppliersList();
  }, [fetchIngredientForecast, fetchSuppliersList]);

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

  // Lock batch table selection to one common supplier so PO creation has no supplier conflicts
  const lockedSupplier = useMemo(() => {
    if (selectedIngredientIds.length === 0) return null;
    const selectedItems = ingredientData.ingredients.filter((i) =>
      selectedIngredientIds.includes(i.id)
    );
    if (selectedItems.length === 0) return null;

    let commonIds = getItemSupplierIds(selectedItems[0]);
    for (let idx = 1; idx < selectedItems.length; idx += 1) {
      const nextSet = new Set(getItemSupplierIds(selectedItems[idx]));
      commonIds = commonIds.filter((id) => nextSet.has(id));
    }

    const primaryId = selectedItems[0].supplier_id
      ? String(selectedItems[0].supplier_id)
      : getItemSupplierIds(selectedItems[0])[0] || null;
    const lockedId = primaryId && commonIds.includes(primaryId) ? primaryId : commonIds[0] || primaryId;
    if (!lockedId) return null;

    const matchedSup = suppliers.find((s) => String(s.id) === lockedId);
    const matchedName =
      matchedSup?.name ||
      selectedItems.find((i) => String(i.supplier_id) === lockedId)?.supplier_name ||
      selectedItems
        .flatMap((i) => i.available_suppliers || [])
        .find((s) => String(s.supplier_id) === lockedId)?.supplier_name ||
      'Selected Supplier';

    return { id: lockedId, name: matchedName };
  }, [selectedIngredientIds, ingredientData.ingredients, suppliers]);

  // Selection helpers
  const handleToggleSelectAll = () => {
    const firstVisibleWithSupplier = sortedIngredients.find(
      (i) => i.supplier_id || (Array.isArray(i.available_suppliers) && i.available_suppliers.length > 0)
    );
    const targetSupplierId = lockedSupplier?.id || firstVisibleWithSupplier?.supplier_id || getItemSupplierIds(firstVisibleWithSupplier)[0] || null;

    const selectableItems = targetSupplierId
      ? filteredIngredients.filter((i) => doesItemMatchSupplier(i, targetSupplierId))
      : filteredIngredients;

    const allSelectableSelected =
      selectableItems.length > 0 &&
      selectableItems.every((i) => selectedIngredientIds.includes(i.id));

    if (allSelectableSelected) {
      setSelectedIngredientIds([]);
    } else {
      setSelectedIngredientIds(selectableItems.map((item) => item.id));
    }
  };

  const handleToggleItemSelect = (id) => {
    if (selectedIngredientIds.includes(id)) {
      setSelectedIngredientIds((prev) => prev.filter((x) => x !== id));
      return;
    }

    const clickedItem = ingredientData.ingredients.find((i) => i.id === id);
    if (lockedSupplier?.id && !doesItemMatchSupplier(clickedItem, lockedSupplier.id)) {
      showToast(
        'error',
        `Only items from ${lockedSupplier.name} can be combined into one Purchase Order.`
      );
      return;
    }

    setSelectedIngredientIds((prev) => [...prev, id]);
  };

  const handleClearSelection = () => {
    setSelectedIngredientIds([]);
  };

  const handleResetIngredientFilters = () => {
    setStatusFilter('ALL');
    setSearchTerm('');
    setSelectedCategory('ALL');
  };

  const mapToPoItem = (item) => {
    const unitPrice = Number(item.cost_per_purchase_unit) > 0 ? Number(item.cost_per_purchase_unit) : 0;
    const purchaseUnit = item.purchase_unit || item.unit;
    const conversionFactor = Number(item.conversion_factor) > 0 ? Number(item.conversion_factor) : 1;
    // suggested_order_qty is in the stock unit; the PO is counted in purchase units.
    const suggestedPurchaseQty = Math.ceil((Number(item.suggested_order_qty) || 0) / conversionFactor);
    return {
      ingredient_id: item.id,
      name: item.name,
      quantity: suggestedPurchaseQty > 0 ? suggestedPurchaseQty : 1,
      unit_price: unitPrice,
      purchase_unit: purchaseUnit,
      conversion_factor: conversionFactor,
      base_unit_price: unitPrice,
      base_purchase_unit: purchaseUnit,
      base_conversion_factor: conversionFactor,
      supplier_id: item.supplier_id || null,
      available_suppliers: item.available_suppliers || [],
      stock_quantity: item.stock_quantity,
      unit: item.unit,
    };
  };

  const applySupplierToItems = (items, supplierId) => {
    if (!supplierId) return items;
    return items.map((item) => {
      const match = (item.available_suppliers || []).find(
        (s) => String(s.supplier_id) === String(supplierId)
      );
      if (!match) {
        return {
          ...item,
          unit_price: item.base_unit_price,
          purchase_unit: item.base_purchase_unit,
          conversion_factor: item.base_conversion_factor,
        };
      }
      return {
        ...item,
        unit_price: match.default_price > 0 ? match.default_price : item.base_unit_price,
        purchase_unit: match.default_purchase_unit || item.base_purchase_unit,
        conversion_factor:
          match.default_conversion_factor > 0
            ? match.default_conversion_factor
            : item.base_conversion_factor,
      };
    });
  };

  const getItemsForSupplier = (pool, supplierId) => {
    const hasAnyLinkedSupplier = pool.some((item) => getItemSupplierIds(item).length > 0);
    if (!hasAnyLinkedSupplier) {
      return applySupplierToItems(pool, supplierId);
    }
    const matching = pool.filter((item) => doesItemMatchSupplier(item, supplierId));
    return applySupplierToItems(matching, supplierId);
  };

  const handleSelectPoSupplier = (supplierId) => {
    const idStr = String(supplierId);
    setPoTargetSupplierId(idStr);
    const sourcePool = poPoolItems.length > 0 ? poPoolItems : poItems;
    const nextItems = getItemsForSupplier(sourcePool, idStr);
    setPoItems(nextItems);

    if (sourcePool.length > 1) {
      setSelectedIngredientIds(nextItems.map((i) => i.ingredient_id));
      const supName = suppliers.find((s) => String(s.id) === idStr)?.name;
      setPoNotes((prevNotes) => {
        const isCritical = prevNotes.toLowerCase().includes('critical');
        const label = isCritical ? 'critical raw material(s)' : 'item(s)';
        const base = isCritical ? 'Restock order' : 'Batch restock order';
        return `${base} for ${nextItems.length} ${label}${supName ? ` (${supName})` : ''}.`;
      });
    }
  };

  const handleOrderAllCritical = () => {
    const criticalItems = ingredientData.ingredients.filter(
      (item) => NEEDS_ORDER_ALERTS.includes(item.alert)
    );
    if (criticalItems.length === 0) return;

    const lockedMatchesCritical =
      lockedSupplier?.id && criticalItems.some((i) => doesItemMatchSupplier(i, lockedSupplier.id));
    const firstSupplierId = lockedMatchesCritical
      ? lockedSupplier.id
      : criticalItems.find((i) => getItemSupplierIds(i).length > 0)?.supplier_id ||
        getItemSupplierIds(criticalItems.find((i) => getItemSupplierIds(i).length > 0))[0];

    const targetId = firstSupplierId
      ? String(firstSupplierId)
      : suppliers[0]?.id
        ? String(suppliers[0].id)
        : '';

    const pool = criticalItems.map(mapToPoItem);
    const scopedItems = getItemsForSupplier(pool, targetId);
    setPoPoolItems(pool);
    setPoTargetSupplierId(targetId);
    setPoItems(scopedItems);
    setSelectedIngredientIds(scopedItems.map((i) => i.ingredient_id));
    setPoNotes(`Restock order for ${scopedItems.length} critical raw material(s).`);
    setPoModalOpen(true);
  };

  const handleOpenSingleItemPO = (item) => {
    const firstId = item.supplier_id || getItemSupplierIds(item)[0];
    const targetId = firstId
      ? String(firstId)
      : suppliers[0]?.id
        ? String(suppliers[0].id)
        : '';
    const pool = [mapToPoItem(item)];
    setPoPoolItems(pool);
    setPoTargetSupplierId(targetId);
    setPoItems(applySupplierToItems(pool, targetId));
    setPoNotes(`Reorder for ${item.name} (Usable stock: ${item.usable_stock} ${item.unit}).`);
    setPoModalOpen(true);
  };

  const handleOpenBatchPO = () => {
    if (selectedIngredientIds.length === 0) return;
    const selectedItems = ingredientData.ingredients.filter((item) =>
      selectedIngredientIds.includes(item.id)
    );
    const firstSupplierId =
      lockedSupplier?.id ||
      selectedItems.find((i) => getItemSupplierIds(i).length > 0)?.supplier_id ||
      getItemSupplierIds(selectedItems.find((i) => getItemSupplierIds(i).length > 0))[0];
    const targetId = firstSupplierId
      ? String(firstSupplierId)
      : suppliers[0]?.id
        ? String(suppliers[0].id)
        : '';
    const pool = selectedItems.map(mapToPoItem);
    const scopedItems = getItemsForSupplier(pool, targetId);
    setPoPoolItems(pool);
    setPoTargetSupplierId(targetId);
    setPoItems(scopedItems);
    setPoNotes(`Batch restock order (${scopedItems.length} items).`);
    setPoModalOpen(true);
  };

  const handleUpdatePoItemQty = (index, value) => {
    const val = Math.max(1, parseInt(value, 10) || 1);
    const targetIngId = poItems[index]?.ingredient_id;
    setPoItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], quantity: val };
      return copy;
    });
    if (targetIngId) {
      setPoPoolItems((prev) =>
        prev.map((item) =>
          item.ingredient_id === targetIngId ? { ...item, quantity: val } : item
        )
      );
    }
  };

  const handleRemovePoItem = (index) => {
    const targetIngId = poItems[index]?.ingredient_id;
    setPoItems((prev) => prev.filter((_, idx) => idx !== index));
    if (targetIngId) {
      setPoPoolItems((prev) => prev.filter((item) => item.ingredient_id !== targetIngId));
    }
  };

  const calculatePoTotal = () => {
    return poItems.reduce((acc, curr) => acc + curr.quantity * curr.unit_price, 0);
  };

  const handleConfirmSubmitPO = async () => {
    if (!poTargetSupplierId) {
      showToast('error', 'Please select a supplier.');
      return;
    }
    if (poItems.length === 0) {
      showToast('error', 'Please include at least one item.');
      return;
    }

    try {
      setSubmittingPO(true);
      await createPurchaseOrder({
        supplier_id: poTargetSupplierId,
        expected_date: poExpectedDate || null,
        notes: poNotes,
        items: poItems.map((item) => ({
          ingredient_id: item.ingredient_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          purchase_unit: item.purchase_unit,
          conversion_factor: item.conversion_factor,
        })),
      });

      const orderedIds = new Set(poItems.map((i) => i.ingredient_id));
      const remainingPool = poPoolItems.filter((i) => !orderedIds.has(i.ingredient_id));
      const nextItemWithSupplier = remainingPool.find((i) => getItemSupplierIds(i).length > 0);
      const nextSupplierId = nextItemWithSupplier
        ? nextItemWithSupplier.supplier_id || getItemSupplierIds(nextItemWithSupplier)[0]
        : null;

      if (remainingPool.length > 0 && nextSupplierId) {
        const nextIdStr = String(nextSupplierId);
        const nextScoped = getItemsForSupplier(remainingPool, nextIdStr);
        setPoPoolItems(remainingPool);
        setPoTargetSupplierId(nextIdStr);
        setPoItems(nextScoped);
        setSelectedIngredientIds(nextScoped.map((i) => i.ingredient_id));
        setPoNotes(`Restock order for ${nextScoped.length} critical raw material(s).`);
        showToast(
          'success',
          `PO created (${poItems.length} item(s)). Loaded next supplier with ${nextScoped.length} remaining item(s).`
        );
        fetchIngredientForecast();
      } else {
        showToast('success', `Purchase order created for ${poItems.length} item(s).`);
        setPoModalOpen(false);
        setPoPoolItems([]);
        setSelectedIngredientIds([]);
        fetchIngredientForecast();
      }
    } catch (err) {
      console.error('Failed to create purchase order:', err);
      showToast('error', err.message || 'Failed to create purchase order.');
    } finally {
      setSubmittingPO(false);
    }
  };

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
    lockedSupplier,
    doesItemMatchSupplier,
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
    suppliers,
    poModalOpen,
    setPoModalOpen,
    poTargetSupplierId,
    setPoTargetSupplierId,
    handleSelectPoSupplier,
    poPoolItems,
    poItems,
    poExpectedDate,
    setPoExpectedDate,
    poNotes,
    setPoNotes,
    submittingPO,
    handleUpdatePoItemQty,
    handleRemovePoItem,
    calculatePoTotal,
    handleConfirmSubmitPO,
    toast,
    setToast,
  };
};
