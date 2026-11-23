import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getIngredients,
  createIngredient,
  updateIngredient,
  archiveIngredient,
  restoreIngredient,
  deleteIngredient,
  getRawMaterialCategories,
  getCategoryShelfLife
} from '../../../api/inventoryApi';
import { checkDuplicateOrSimilar } from '../../../utils/productUtils';
import { INPUT_LIMITS, validateAmountInput } from '../../../utils/validationUtils';

export const RAW_MATERIAL_CATEGORIES = [
  'COFFEE & TEA BASES',
  'DAIRY & CREAMERS',
  'SWEETENERS & SYRUPS',
  'FLAVORING POWDERS',
  'SINKERS & TOPPINGS',
  'BEVERAGE ENHANCERS',
  'PACKAGING & SUPPLIES',
  'ADD-ONS'
];

export const useManageRawMaterials = () => {
  const [viewMode, setViewMode] = useState('ADD');
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    category: '',
    low_stock_alert: '',
    is_perishable: null,
    default_shelf_life_days: 30
  });

  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editAlert, setEditAlert] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editPurchaseUnit, setEditPurchaseUnit] = useState('Unit');
  const [editConversionFactor, setEditConversionFactor] = useState(1);
  const [editCost, setEditCost] = useState(0);
  const [editCategory, setEditCategory] = useState('');
  // null = use category default, true = perishable, false = does not expire
  const [editIsPerishable, setEditIsPerishable] = useState(null);
  const [categoryShelfLife, setCategoryShelfLife] = useState({});
  const [editShelfLifeDays, setEditShelfLifeDays] = useState(30);

  const [categoryObjects, setCategoryObjects] = useState(() =>
    RAW_MATERIAL_CATEGORIES.map((category) => ({ category, ingredient_count: 0 }))
  );

  const UNIT_CHOICES = ['KG', 'G', 'L', 'ML', 'PCS', 'PACK', 'BOTTLE', 'CAN'];

  const loadShelfLife = useCallback(() => (
    getCategoryShelfLife()
      .then((rows) => setCategoryShelfLife(Object.fromEntries((rows || []).map((r) => [r.category, r]))))
      .catch(() => {})
  ), []);

  const refreshCategories = useCallback(async () => {
    loadShelfLife();
    try {
      const data = await getRawMaterialCategories();
      if (Array.isArray(data)) {
        setCategoryObjects(data);
        return data;
      }
    } catch (err) {
      console.error('Failed to load raw material categories:', err);
    }
    return null;
  }, [loadShelfLife]);

  useEffect(() => { loadShelfLife(); }, [loadShelfLife]);

  const categories = useMemo(() => {
    return categoryObjects
      .map((item) => (typeof item === 'string' ? item : item?.category))
      .filter(Boolean);
  }, [categoryObjects]);

  useEffect(() => {
    if (categoryFilter !== 'ALL' && !categories.includes(categoryFilter)) {
      setCategoryFilter('ALL');
    }
  }, [categories, categoryFilter]);

  useEffect(() => {
    fetchIngredients();
    refreshCategories();
  }, [refreshCategories]);

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const data = await getIngredients({ includeArchived: true });
      setIngredients(data || []);
    } catch (err) {
      console.error('Failed to load ingredients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleAddIngredient = async (e, forceCreate = false) => {
    if (e) e.preventDefault();
    const newName = String(formData.name || '').trim().toUpperCase();
    const newUnit = String(formData.unit || '').trim().toUpperCase();
    const trimmedCategory = formData.category ? String(formData.category).trim() : null;
    const isPerishable = formData.is_perishable ?? null;

    if (!newName) {
      setMessage('Error: Ingredient name is required.');
      return;
    }
    if (newName.length > INPUT_LIMITS.NAME_MAX_LEN) {
      setMessage(`Error: Ingredient name must be ${INPUT_LIMITS.NAME_MAX_LEN} characters or less.`);
      return;
    }
    if (trimmedCategory && trimmedCategory.length > INPUT_LIMITS.CATEGORY_MAX_LEN) {
      setMessage(`Error: Category must be ${INPUT_LIMITS.CATEGORY_MAX_LEN} characters or less.`);
      return;
    }

    if (!UNIT_CHOICES.includes(newUnit)) {
      setMessage(`Error: Invalid unit. Must be one of: ${UNIT_CHOICES.join(', ')}`);
      return;
    }

    const alertCheck = validateAmountInput(formData.low_stock_alert, {
      label: 'Low stock alert',
      min: 0,
      max: INPUT_LIMITS.THRESHOLD_MAX
    });
    if (!alertCheck.valid) {
      setMessage('Error: ' + alertCheck.error);
      return;
    }

    let shelfLifeDays = null;
    if (isPerishable === true) {
      const shelfCheck = validateAmountInput(formData.default_shelf_life_days, {
        label: 'Default shelf life (days)',
        min: INPUT_LIMITS.SHELF_LIFE_DAYS_MIN,
        max: INPUT_LIMITS.SHELF_LIFE_DAYS_MAX
      });
      if (!shelfCheck.valid) {
        setMessage('Error: ' + shelfCheck.error);
        return;
      }
      shelfLifeDays = Math.round(shelfCheck.numericValue);
    }

    if (!forceCreate) {
      const similarityMatch = checkDuplicateOrSimilar(formData.name, ingredients, null, trimmedCategory);
      if (similarityMatch?.isHardDuplicate) {
        setMessage(`Error: "${similarityMatch.matchName}" already exists under category "${similarityMatch.matchCategory}". Duplicate items in the same category are not allowed.`);
        return;
      }
      if (similarityMatch) {
        setConfirmConfig({
          isOpen: true,
          title: similarityMatch.isDifferentCategory ? 'Same Name in Different Category' : 'Similar Ingredient Detected',
          message: similarityMatch.isDifferentCategory
            ? `WARNING: "${similarityMatch.matchName}" already exists in category "${similarityMatch.matchCategory}". Are you sure you want to add it under "${trimmedCategory || 'GENERAL'}"?`
            : `WARNING: The ingredient "${similarityMatch.matchName}" (${similarityMatch.matchCategory}) sounds very similar to what you're adding. Are you sure you want to proceed?`,
          onConfirm: () => {
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            handleAddIngredient(null, true);
          }
        });
        return;
      }
    }

    try {
      await createIngredient({
        name: newName,
        unit: newUnit,
        category: trimmedCategory,
        low_stock_alert: alertCheck.numericValue,
        stock_quantity: 0,
        is_perishable: isPerishable,
        default_shelf_life_days: shelfLifeDays,
        force_create: forceCreate
      });
      setMessage('Ingredient created successfully!');
      setFormData({
        name: '',
        unit: '',
        category: '',
        low_stock_alert: '',
        is_perishable: null,
        default_shelf_life_days: 30
      });
      fetchIngredients();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      if (err.payload?.is_hard_duplicate) {
        setMessage(err.message?.startsWith('Error:') ? err.message : 'Error: ' + err.message);
      } else if (err.payload?.is_duplicate_warning) {
        setConfirmConfig({
          isOpen: true,
          title: 'Duplicate Warning',
          message: err.message + '\n\nDo you still want to proceed?',
          onConfirm: () => {
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            handleAddIngredient(null, true);
          }
        });
      } else {
        setMessage('Error: ' + err.message);
      }
    }
  };

  const handleArchiveToggle = (id, isArchived) => {
    if (isProcessing) return;
    const ingredient = ingredients.find(i => i.id === id);
    const ingName = ingredient ? `"${ingredient.name}"` : 'this raw material';

    setConfirmConfig({
      isOpen: true,
      title: isArchived ? 'Restore Raw Material?' : 'Archive Raw Material?',
      message: isArchived
        ? `Are you sure you want to restore ${ingName}? It will become available again for inventory tracking and recipe deductions.`
        : `Are you sure you want to archive ${ingName}? It will be hidden from active inventory tracking, but purchase order records and history will be preserved.`,
      confirmText: isArchived ? 'Yes, Restore' : 'Yes, Archive',
      confirmColor: isArchived ? 'success' : 'danger',
      onConfirm: async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        setProcessingId(id);
        try {
          if (isArchived) {
            await restoreIngredient(id);
            setMessage(`Raw material ${ingName} restored successfully.`);
          } else {
            await archiveIngredient(id);
            setMessage(`Raw material ${ingName} archived.`);
          }
          setTimeout(() => setMessage(''), 3000);
          await fetchIngredients();
        } catch (err) {
          console.error('Archiving error:', err);
          setMessage('Error updating ingredient status: ' + (err.message || 'Please try again.'));
          setTimeout(() => setMessage(''), 4000);
        } finally {
          setIsProcessing(false);
          setProcessingId(null);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handlePermanentDeleteRawMaterial = (id) => {
    if (isProcessing) return;
    const ingredient = ingredients.find(i => i.id === id);
    const ingName = ingredient ? `"${ingredient.name}"` : 'this raw material';

    setConfirmConfig({
      isOpen: true,
      title: 'Permanently Delete Raw Material?',
      message: `Are you sure you want to PERMANENTLY delete ${ingName}? This item has been archived for at least 30 days. This action cannot be undone.`,
      confirmText: 'Yes, Delete Permanently',
      confirmColor: 'danger',
      onConfirm: async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        setProcessingId(id);
        try {
          await deleteIngredient(id);
          setMessage(`Raw material ${ingName} permanently deleted.`);
          setTimeout(() => setMessage(''), 3000);
          await fetchIngredients();
        } catch (err) {
          console.error('Delete error:', err);
          setMessage('Error deleting raw material: ' + (err.message || 'Please try again.'));
          setTimeout(() => setMessage(''), 5000);
        } finally {
          setIsProcessing(false);
          setProcessingId(null);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleUpdateIngredient = async (e, forceUpdate = false) => {
    if (e) e.preventDefault();
    if (!selectedIngredient) return;

    const updatedName = String(editName || '').trim().toUpperCase();
    const updatedUnit = String(editUnit || '').trim().toUpperCase();
    const trimmedCategory = editCategory ? String(editCategory).trim() : null;
    const trimmedPurchaseUnit = String(editPurchaseUnit || 'Unit').trim();

    if (!updatedName) {
      setMessage('Error: Ingredient name is required.');
      return;
    }
    if (updatedName.length > INPUT_LIMITS.NAME_MAX_LEN) {
      setMessage(`Error: Ingredient name must be ${INPUT_LIMITS.NAME_MAX_LEN} characters or less.`);
      return;
    }
    if (trimmedCategory && trimmedCategory.length > INPUT_LIMITS.CATEGORY_MAX_LEN) {
      setMessage(`Error: Category must be ${INPUT_LIMITS.CATEGORY_MAX_LEN} characters or less.`);
      return;
    }
    if (!UNIT_CHOICES.includes(updatedUnit)) {
      setMessage(`Error: Invalid unit. Must be one of: ${UNIT_CHOICES.join(', ')}`);
      return;
    }
    if (trimmedPurchaseUnit.length > 40) {
      setMessage('Error: Purchase unit must be 40 characters or less.');
      return;
    }

    const alertCheck = validateAmountInput(editAlert, {
      label: 'Low stock alert',
      min: 0,
      max: INPUT_LIMITS.THRESHOLD_MAX
    });
    if (!alertCheck.valid) {
      setMessage('Error: ' + alertCheck.error);
      return;
    }

    const factorCheck = validateAmountInput(editConversionFactor, {
      label: 'Conversion factor',
      min: INPUT_LIMITS.CONVERSION_FACTOR_MIN,
      max: INPUT_LIMITS.CONVERSION_FACTOR_MAX
    });
    if (!factorCheck.valid) {
      setMessage('Error: ' + factorCheck.error);
      return;
    }

    const costInput = editCost === '' || editCost === null || editCost === undefined ? 0 : editCost;
    const costCheck = validateAmountInput(costInput, {
      label: 'Purchase cost',
      min: 0,
      max: INPUT_LIMITS.PURCHASE_COST_MAX
    });
    if (!costCheck.valid) {
      setMessage('Error: ' + costCheck.error);
      return;
    }

    const isPerishable = editIsPerishable ?? null;
    let shelfLifeDays = null;
    if (isPerishable === true) {
      const shelfCheck = validateAmountInput(editShelfLifeDays, {
        label: 'Default shelf life (days)',
        min: INPUT_LIMITS.SHELF_LIFE_DAYS_MIN,
        max: INPUT_LIMITS.SHELF_LIFE_DAYS_MAX
      });
      if (!shelfCheck.valid) {
        setMessage('Error: ' + shelfCheck.error);
        return;
      }
      shelfLifeDays = Math.round(shelfCheck.numericValue);
    }

    if (!forceUpdate) {
      const similarityMatch = checkDuplicateOrSimilar(editName, ingredients, selectedIngredient.id, trimmedCategory);
      if (similarityMatch?.isHardDuplicate) {
        setMessage(`Error: "${similarityMatch.matchName}" already exists under category "${similarityMatch.matchCategory}". Duplicate items in the same category are not allowed.`);
        return;
      }
      if (similarityMatch) {
        setConfirmConfig({
          isOpen: true,
          title: similarityMatch.isDifferentCategory ? 'Same Name in Different Category' : 'Similar Ingredient Detected',
          message: similarityMatch.isDifferentCategory
            ? `WARNING: "${similarityMatch.matchName}" already exists in category "${similarityMatch.matchCategory}". Do you still want to update this material under "${trimmedCategory || 'GENERAL'}"?`
            : `WARNING: The name sounds very similar to an existing ingredient "${similarityMatch.matchName}" (${similarityMatch.matchCategory}). Do you still want to update?`,
          onConfirm: () => {
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            handleUpdateIngredient(null, true);
          }
        });
        return;
      }
    }

    try {
      await updateIngredient(selectedIngredient.id, {
        name: updatedName,
        unit: updatedUnit,
        category: trimmedCategory,
        low_stock_alert: alertCheck.numericValue,
        stock_quantity: parseFloat(editQuantity) || 0,
        purchase_unit: trimmedPurchaseUnit || 'Unit',
        conversion_factor: factorCheck.numericValue,
        cost_per_purchase_unit: costCheck.numericValue,
        is_perishable: isPerishable,
        default_shelf_life_days: shelfLifeDays,
        force_update: forceUpdate
      });
      setMessage('Ingredient details updated successfully!');
      fetchIngredients();
      setViewMode('ADD');
      setSelectedIngredient(null);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      if (err.payload?.is_hard_duplicate) {
        setMessage(err.message?.startsWith('Error:') ? err.message : 'Error: ' + err.message);
      } else if (err.payload?.is_duplicate_warning) {
        setConfirmConfig({
          isOpen: true,
          title: 'Duplicate Warning',
          message: err.message + '\n\nDo you still want to proceed?',
          onConfirm: () => {
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            handleUpdateIngredient(null, true);
          }
        });
      } else {
        setMessage('Error updating ingredient: ' + err.message);
      }
    }
  };

  const handleSetModify = (ingredient) => {
    setMessage('');
    setSelectedIngredient(ingredient);
    setEditName(ingredient.name);
    setEditCategory(ingredient.category || '');
    setEditUnit(ingredient.unit);
    setEditAlert(ingredient.low_stock_alert);
    setEditQuantity(ingredient.stock_quantity);
    setEditPurchaseUnit(ingredient.purchase_unit || 'Unit');
    setEditConversionFactor(ingredient.conversion_factor || 1);
    setEditCost(ingredient.cost_per_purchase_unit || 0);
    // Only an item-level override is editable here; otherwise it follows the category default.
    const override = ingredient.shelf_life_source === 'ITEM' ? ingredient.is_perishable !== false : null;
    setEditIsPerishable(override);
    setEditShelfLifeDays(override ? (ingredient.default_shelf_life_days ?? 30) : 30);
  };

  return {
    viewMode, setViewMode,
    ingredients, loading, message, setMessage,
    isProcessing, processingId,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    categoryFilter, setCategoryFilter,
    categories,
    categoryObjects,
    refreshCategories,
    RAW_MATERIAL_CATEGORIES,
    confirmConfig, setConfirmConfig,
    formData, handleInputChange,
    selectedIngredient, setSelectedIngredient,
    editName, setEditName,
    editUnit, setEditUnit,
    editAlert, setEditAlert,
    editQuantity, setEditQuantity,
    editPurchaseUnit, setEditPurchaseUnit,
    editConversionFactor, setEditConversionFactor,
    editCost, setEditCost,
    editCategory, setEditCategory,
    editIsPerishable, setEditIsPerishable,
    categoryShelfLife,
    editShelfLifeDays, setEditShelfLifeDays,
    UNIT_CHOICES,
    handleAddIngredient,
    handleArchiveToggle,
    handlePermanentDeleteRawMaterial,
    handleUpdateIngredient,
    handleSetModify,
    fetchIngredients
  };
};
