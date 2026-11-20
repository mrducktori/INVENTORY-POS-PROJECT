import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  getDemandForecast,
  getIngredientDepletionForecast,
  getAIForecast,
} from '../../../api/analyticsApi';
import { getSuppliers, createPurchaseOrder } from '../../../api/purchasingApi';

export const ING_PAGE_SIZE = 15;
export const PROD_PAGE_SIZE = 15;

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

/**
 * Custom hook encapsulating state, data fetching, filtering, sorting,
 * pagination, selection, and PO / projection modal handlers for DemandForecasting.
 */
export const useDemandForecasting = () => {
  const [activeTab, setActiveTab] = useState(getInitialTab); // 'ingredients' | 'products'

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('coftea_forecasting_tab', tab);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#Forecasting/${tab}`);
      }
    } catch {
      /* ignore storage/history errors */
    }
  };

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
  const [infoGuideTab, setInfoGuideTab] = useState(activeTab); // 'ingredients' | 'products'

  const openInfoGuide = (tabKey) => {
    setInfoGuideTab(tabKey || activeTab);
    setInfoModalOpen(true);
  };

  // Ingredient Depletion State
  const [ingredientData, setIngredientData] = useState({
    summary: {
      totalIngredients: 0,
      criticalCount: 0,
      lowStockCount: 0,
      healthyCount: 0,
      totalRestockCapitalRequired: 0,
    },
    ingredients: [],
  });
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'LOW_STOCK' | 'HEALTHY'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedIngredientIds, setSelectedIngredientIds] = useState([]);
  const [ingPage, setIngPage] = useState(1);
  const [ingSortField, setIngSortField] = useState('days_remaining');
  const [ingSortDirection, setIngSortDirection] = useState('asc'); // critical runouts first

  // Product Demand State
  const [productForecasts, setProductForecasts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('ALL');
  const [prodPage, setProdPage] = useState(1);
  const [prodSortField, setProdSortField] = useState('predictedNext7Days');
  const [prodSortDirection, setProdSortDirection] = useState('desc'); // highest demand first

  const handleIngSort = (field) => {
    if (ingSortField === field) {
      setIngSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setIngSortField(field);
      if (field === 'days_remaining' || field === 'name' || field === 'supplier_name') {
        setIngSortDirection('asc');
      } else {
        setIngSortDirection('desc');
      }
    }
  };

  const handleProdSort = (field) => {
    if (prodSortField === field) {
      setProdSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setProdSortField(field);
      if (field === 'name' || field === 'category') {
        setProdSortDirection('asc');
      } else {
        setProdSortDirection('desc');
      }
    }
  };

  // Monthly Projection Modal State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiSelectedProduct, setAiSelectedProduct] = useState(null);
  const [aiTargetYear, setAiTargetYear] = useState(() => new Date().getFullYear());
  const [aiTargetMonth, setAiTargetMonth] = useState(() => new Date().getMonth() + 1);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  // Suppliers & PO Modal State
  const [suppliers, setSuppliers] = useState([]);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poTargetSupplierId, setPoTargetSupplierId] = useState('');
  const [poPoolItems, setPoPoolItems] = useState([]);
  const [poItems, setPoItems] = useState([]);
  const [poExpectedDate, setPoExpectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [poNotes, setPoNotes] = useState('');
  const [submittingPO, setSubmittingPO] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  const fetchIngredientForecast = useCallback(
    async (refresh = false) => {
      try {
        setLoadingIngredients(true);
        const res = await getIngredientDepletionForecast(refresh);
        if (res && res.ingredients) {
          setIngredientData(res);
        }
      } catch (err) {
        console.error('Failed to fetch ingredient forecast:', err);
        showToast('error', 'Failed to load ingredient forecast.');
      } finally {
        setLoadingIngredients(false);
      }
    },
    [showToast]
  );

  const fetchSuppliersList = useCallback(async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(data || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    }
  }, []);

  const fetchProductForecasts = useCallback(
    async (refresh = false) => {
      try {
        setLoadingProducts(true);
        const data = await getDemandForecast(refresh);
        setProductForecasts(data || []);
      } catch (err) {
        console.error('Failed to fetch product forecasts:', err);
        showToast('error', 'Failed to load product demand forecast.');
      } finally {
        setLoadingProducts(false);
      }
    },
    [showToast]
  );

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

  const handleTabSwitch = (tab) => {
    handleTabChange(tab);
  };

  const runMonthlyForecast = async (productId, year, month) => {
    try {
      setAiLoading(true);
      const res = await getAIForecast({
        productId,
        year: parseInt(year, 10),
        month: parseInt(month, 10),
      });
      setAiResult(res);
    } catch (err) {
      console.error('Failed to run monthly forecast:', err);
      showToast('error', err.message || 'Could not load monthly projection.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleOpenMonthlyModal = (product) => {
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth() + 1;
    setAiTargetYear(currYear);
    setAiTargetMonth(currMonth);
    setAiSelectedProduct(product);
    setAiResult(null);
    setAiModalOpen(true);
    runMonthlyForecast(product.id, currYear, currMonth);
  };

  const handleSelectAiYear = (yr) => {
    setAiTargetYear(yr);
    runMonthlyForecast(aiSelectedProduct?.id, yr, aiTargetMonth);
  };

  const handleSelectAiMonth = (mNum) => {
    setAiTargetMonth(mNum);
    runMonthlyForecast(aiSelectedProduct?.id, aiTargetYear, mNum);
  };

  // Ingredient Categories
  const categories = useMemo(() => {
    const set = new Set();
    ingredientData.ingredients.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort();
  }, [ingredientData.ingredients]);

  // Filtered Ingredients
  const filteredIngredients = useMemo(() => {
    return ingredientData.ingredients.filter((item) => {
      if (
        statusFilter === 'CRITICAL' &&
        item.urgency_status !== 'CRITICAL' &&
        item.urgency_status !== 'OUT_OF_STOCK'
      ) {
        return false;
      }
      if (statusFilter === 'LOW_STOCK' && item.urgency_status !== 'LOW_STOCK') {
        return false;
      }
      if (statusFilter === 'HEALTHY' && item.urgency_status !== 'HEALTHY') {
        return false;
      }
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        const matchSup = item.supplier_name?.toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchSup) return false;
      }
      return true;
    });
  }, [ingredientData.ingredients, statusFilter, selectedCategory, searchTerm]);

  // Reset ingredient pagination when filter or sort changes
  useEffect(() => {
    setIngPage(1);
  }, [statusFilter, selectedCategory, searchTerm, ingSortField, ingSortDirection]);

  // Sorted Ingredients
  const sortedIngredients = useMemo(() => {
    const list = [...filteredIngredients];
    list.sort((a, b) => {
      const aVal = a[ingSortField];
      const bVal = b[ingSortField];

      if (ingSortField === 'days_remaining') {
        const aDays = aVal === null || aVal === undefined ? 999999 : Number(aVal);
        const bDays = bVal === null || bVal === undefined ? 999999 : Number(bVal);
        return ingSortDirection === 'asc' ? aDays - bDays : bDays - aDays;
      }

      if (ingSortField === 'suggested_purchase_qty') {
        const aQty = Number(a.suggested_purchase_qty) || 0;
        const bQty = Number(b.suggested_purchase_qty) || 0;
        return ingSortDirection === 'asc' ? aQty - bQty : bQty - aQty;
      }

      if (ingSortField === 'avg_daily_burn_rate') {
        const aBurn = Number(a.avg_daily_burn_rate) || 0;
        const bBurn = Number(b.avg_daily_burn_rate) || 0;
        return ingSortDirection === 'asc' ? aBurn - bBurn : bBurn - aBurn;
      }

      if (ingSortField === 'stock_quantity') {
        const aStock = Number(a.stock_quantity) || 0;
        const bStock = Number(b.stock_quantity) || 0;
        return ingSortDirection === 'asc' ? aStock - bStock : bStock - aStock;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string' && isNaN(Number(aVal))) {
        return ingSortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return ingSortDirection === 'asc' ? numA - numB : numB - numA;
    });
    return list;
  }, [filteredIngredients, ingSortField, ingSortDirection]);

  const paginatedIngredients = useMemo(() => {
    const start = (ingPage - 1) * ING_PAGE_SIZE;
    return sortedIngredients.slice(start, start + ING_PAGE_SIZE);
  }, [sortedIngredients, ingPage]);

  // Product Categories & Filtering
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

  // Sorted Products
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    list.sort((a, b) => {
      if (prodSortField === 'predictedNext30Days') {
        const a30 = a.predictedNext30Days || Math.round((Number(a.predictedNext7Days) || 0) * 4.3);
        const b30 = b.predictedNext30Days || Math.round((Number(b.predictedNext7Days) || 0) * 4.3);
        return prodSortDirection === 'asc' ? a30 - b30 : b30 - a30;
      }

      if (prodSortField === 'growthRate') {
        const rateA = parseFloat(a.growthRate) || 0;
        const rateB = parseFloat(b.growthRate) || 0;
        return prodSortDirection === 'asc' ? rateA - rateB : rateB - rateA;
      }

      if (prodSortField === 'seasonalIndex') {
        const sA = parseFloat(a.seasonalIndex) || 1.0;
        const sB = parseFloat(b.seasonalIndex) || 1.0;
        return prodSortDirection === 'asc' ? sA - sB : sB - sA;
      }

      if (prodSortField === 'avgDailySales') {
        const aDaily = Number(a.avgDailySales) || 0;
        const bDaily = Number(b.avgDailySales) || 0;
        return prodSortDirection === 'asc' ? aDaily - bDaily : bDaily - aDaily;
      }

      if (prodSortField === 'predictedNext7Days') {
        const a7 = Number(a.predictedNext7Days) || 0;
        const b7 = Number(b.predictedNext7Days) || 0;
        return prodSortDirection === 'asc' ? a7 - b7 : b7 - a7;
      }

      const aVal = a[prodSortField];
      const bVal = b[prodSortField];

      if (typeof aVal === 'string' && typeof bVal === 'string' && isNaN(Number(aVal))) {
        return prodSortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return prodSortDirection === 'asc' ? numA - numB : numB - numA;
    });
    return list;
  }, [filteredProducts, prodSortField, prodSortDirection]);

  const paginatedProducts = useMemo(() => {
    const start = (prodPage - 1) * PROD_PAGE_SIZE;
    return sortedProducts.slice(start, start + PROD_PAGE_SIZE);
  }, [sortedProducts, prodPage]);

  // Product Summary Metrics
  const productSummary = useMemo(() => {
    const total7DayUnits = productForecasts.reduce(
      (sum, p) => sum + (Number(p.predictedNext7Days) || 0),
      0
    );
    const topProduct =
      productForecasts.length > 0
        ? [...productForecasts].sort(
            (a, b) => (Number(b.predictedNext7Days) || 0) - (Number(a.predictedNext7Days) || 0)
          )[0]
        : null;
    const trendingUpCount = productForecasts.filter((p) => parseFloat(p.growthRate) > 5).length;
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
    const unitPrice = item.unit_price > 0 ? item.unit_price : 0;
    const purchaseUnit = item.purchase_unit || item.unit;
    const conversionFactor = item.conversion_factor || 1;
    return {
      ingredient_id: item.id,
      name: item.name,
      quantity: item.suggested_purchase_qty > 0 ? item.suggested_purchase_qty : 1,
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
      (item) => item.urgency_status === 'CRITICAL' || item.urgency_status === 'OUT_OF_STOCK'
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
    setPoNotes(`Reorder for ${item.name} (Current stock: ${item.stock_quantity} ${item.unit}).`);
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
    infoGuideTab,
    setInfoGuideTab,
    openInfoGuide,
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
    aiModalOpen,
    setAiModalOpen,
    aiSelectedProduct,
    aiTargetYear,
    aiTargetMonth,
    aiLoading,
    aiResult,
    handleOpenMonthlyModal,
    handleSelectAiYear,
    handleSelectAiMonth,
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
