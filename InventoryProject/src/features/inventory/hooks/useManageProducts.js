import { useState, useEffect, useCallback, useRef } from 'react';
import { getAllProducts, createProduct, updateProduct, archiveProduct, restoreProduct, deleteProduct, receiveProductStock } from '../../../api/productsApi';
import { uploadCmsImage } from '../../../api/cmsApi';
import { checkDuplicateOrSimilar } from '../../../utils/productUtils';
import { INPUT_LIMITS, validateAmountInput } from '../../../utils/validationUtils';
import { getRecipesByProduct, createRecipe, updateRecipe, deleteRecipe } from '../../../api/recipesApi';
import { getIngredients } from '../../../api/inventoryApi';
import { getCategorySettings, extractCategoryNames } from '../../../api/categorySettingsApi';

export const useManageProducts = () => {
  const [viewMode, setViewMode] = useState('ADD'); 
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(() => extractCategoryNames([]));
  const [categorySettings, setCategorySettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE'); 
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const [formData, setFormData] = useState({ 
    name: '', 
    category: '', 
    price: '',
    image_url: '',
    track_stock: false,
    low_stock_threshold: 5,
    sizes: [],
    hiddenSizes: [],
    add_ons: []
  });

  const [selectedProduct, setSelectedProduct] = useState(null);
  const selectedProductRef = useRef(selectedProduct);
  useEffect(() => {
    selectedProductRef.current = selectedProduct;
  }, [selectedProduct]);
  const [recipe, setRecipe] = useState([]);
  const [allIngredients, setAllIngredients] = useState([]);
  const [newRecipeItem, setNewRecipeItem] = useState({
    ingredient_id: '',
    quantity: '',
    input_unit: '',
    size_quantities: {}
  });
  const [editPrice, setEditPrice] = useState('');
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editTrackStock, setEditTrackStock] = useState(false);
  const [editStockQty, setEditStockQty] = useState(0);
  const [editThreshold, setEditThreshold] = useState(5);
  const [editSizes, setEditSizes] = useState([]);
  const [editAddOns, setEditAddOns] = useState([]);
  const [editHiddenSizes, setEditHiddenSizes] = useState([]);

  const [newSize, setNewSize] = useState({ name: '', price_add: '', ingredient_id: '' });
  const [newAddOn, setNewAddOn] = useState({ name: '', price: '', ingredient_id: '', quantity: '', unit: '' });

  const fetchIngredients = useCallback(async () => {
    try {
      const data = await getIngredients();
      setAllIngredients(data || []);
    } catch (err) {
      console.error('Failed to load ingredients:', err);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await getCategorySettings();
      setCategorySettings(Array.isArray(data) ? data : []);
      const names = extractCategoryNames(data);
      setCategories(names);
      return names;
    } catch (err) {
      console.error('Failed to load categories:', err);
      return null;
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllProducts();
      setProducts(data || []);
      const currentSelected = selectedProductRef.current;
      if (currentSelected) {
        const prod = (data || []).find(p => p.id === currentSelected.id);
        if (prod) {
          setSelectedProduct(prod);
          setEditPrice(prod.price);
          setEditName(prod.name);
          setEditCategory(prod.category);
          setEditImageUrl(prod.image_url || '');
          setEditTrackStock(prod.track_stock || false);
          setEditStockQty(prod.stock_quantity || 0);
          setEditThreshold(prod.low_stock_threshold || 5);
        }
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchIngredients();
    fetchCategories();
  }, [fetchProducts, fetchIngredients, fetchCategories]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'category') {
      const targetUpper = String(value || '').trim().toUpperCase();
      const matched = categorySettings.find(
        (cs) => String(cs?.category || '').trim().toUpperCase() === targetUpper
      );
      setFormData((prev) => ({
        ...prev,
        category: value,
        sizes: [], // empty = inherit the category's sizes
        hiddenSizes: [],
        add_ons: Array.isArray(matched?.add_ons) ? matched.add_ons.map((a) => ({ ...a })) : []
      }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const validateSizeEntry = (sizeObj) => {
    const priceCheck = validateAmountInput(sizeObj.price_add === '' ? 0 : (sizeObj.price_add ?? 0), {
      label: `Size price add for ${sizeObj.name || 'size'}`,
      min: 0,
      max: INPUT_LIMITS.ADDON_PRICE_MAX
    });
    if (!priceCheck.valid) return { valid: false, error: priceCheck.error };

    const multVal =
      sizeObj.recipe_multiplier === '' || sizeObj.recipe_multiplier === null || sizeObj.recipe_multiplier === undefined
        ? 1
        : sizeObj.recipe_multiplier;
    const multCheck = validateAmountInput(multVal, {
      label: `Recipe multiplier for ${sizeObj.name || 'size'}`,
      min: 0.1,
      max: 10
    });
    if (!multCheck.valid) return { valid: false, error: multCheck.error };

    return {
      valid: true,
      normalized: {
        ...sizeObj,
        name: String(sizeObj.name || '').trim(),
        price_add: priceCheck.numericValue,
        recipe_multiplier: multCheck.numericValue,
        ingredient_id: sizeObj.ingredient_id || null,
        lid_ingredient_id: sizeObj.lid_ingredient_id || null,
        straw_ingredient_id: sizeObj.straw_ingredient_id || null,
        dine_in_no_cup: Boolean(sizeObj.dine_in_no_cup)
      }
    };
  };

  const validateAddOnEntry = (addonObj) => {
    const priceCheck = validateAmountInput(addonObj.price === '' ? 0 : (addonObj.price ?? 0), {
      label: `Add-on price for ${addonObj.name || 'add-on'}`,
      min: 0,
      max: INPUT_LIMITS.ADDON_PRICE_MAX
    });
    if (!priceCheck.valid) return { valid: false, error: priceCheck.error };

    const qtyCheck = validateAmountInput(addonObj.quantity === '' ? 0 : (addonObj.quantity ?? 0), {
      label: `Add-on quantity for ${addonObj.name || 'add-on'}`,
      min: 0,
      max: INPUT_LIMITS.RECIPE_QTY_MAX
    });
    if (!qtyCheck.valid) return { valid: false, error: qtyCheck.error };

    return {
      valid: true,
      normalized: {
        ...addonObj,
        name: String(addonObj.name || '').trim(),
        price: priceCheck.numericValue,
        quantity: qtyCheck.numericValue
      }
    };
  };

  const handleAddFormSize = (sizeObj) => {
    if (!sizeObj?.name?.trim()) return false;
    const res = validateSizeEntry(sizeObj);
    if (!res.valid) {
      setMessage('Error: ' + res.error);
      return false;
    }
    setFormData((prev) => ({ ...prev, sizes: [...(prev.sizes || []), res.normalized] }));
    return true;
  };

  const handleRemoveFormSize = (index) => {
    setFormData((prev) => ({
      ...prev,
      sizes: (prev.sizes || []).filter((_, i) => i !== index)
    }));
  };

  const handleUpdateFormSize = (index, patch) => {
    setFormData((prev) => ({
      ...prev,
      sizes: (prev.sizes || []).map((sz, i) => (i === index ? { ...sz, ...patch } : sz))
    }));
  };

  const handleAddFormAddOn = (addonObj) => {
    if (!addonObj?.name?.trim()) return false;
    const res = validateAddOnEntry(addonObj);
    if (!res.valid) {
      setMessage('Error: ' + res.error);
      return false;
    }
    setFormData((prev) => ({ ...prev, add_ons: [...(prev.add_ons || []), res.normalized] }));
    return true;
  };

  const handleRemoveFormAddOn = (index) => {
    setFormData((prev) => ({
      ...prev,
      add_ons: (prev.add_ons || []).filter((_, i) => i !== index)
    }));
  };

  const handleImageUpload = async (e, isEdit = false) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      // Goes through the server's validated upload endpoint (checks it's really an image)
      // instead of uploading straight to storage with the public anon key.
      const publicUrl = await uploadCmsImage(file, 'product');

      if (isEdit) {
        setEditImageUrl(publicUrl);
      } else {
        setFormData(prev => ({ ...prev, image_url: publicUrl }));
      }
    } catch (err) {
      console.error(err);
      setMessage('Error uploading image.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUploading(false);
    }
  };

  const handleReceiveProductStock = async (productId, qty) => {
    const qtyCheck = validateAmountInput(qty, {
      label: 'Receive quantity',
      min: INPUT_LIMITS.RECEIVE_QTY_MIN,
      max: INPUT_LIMITS.RECEIVE_QTY_MAX
    });
    if (!qtyCheck.valid) {
      setMessage('Error: ' + qtyCheck.error);
      setTimeout(() => setMessage(''), 4000);
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: 'Confirm Stock Receipt',
      message: `Are you sure you want to add ${qtyCheck.numericValue} units to the stock?`,
      onConfirm: async () => {
        try {
          await receiveProductStock(productId, qtyCheck.numericValue);
          setMessage('Stock received successfully!');
          fetchProducts();
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          setTimeout(() => setMessage(''), 3000);
        } catch (err) {
          setMessage('Error receiving stock: ' + err.message);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleAddProduct = async (e, forceCreate = false) => {
    if (e) e.preventDefault();
    const newName = String(formData.name || '').trim().toUpperCase();
    const trimmedCategory = String(formData.category || '').trim();

    if (!newName) {
      setMessage('Error: Product name is required.');
      return;
    }
    if (newName.length > INPUT_LIMITS.NAME_MAX_LEN) {
      setMessage(`Error: Product name must be ${INPUT_LIMITS.NAME_MAX_LEN} characters or less.`);
      return;
    }
    if (!trimmedCategory) {
      setMessage('Error: Please select a category.');
      return;
    }
    if (trimmedCategory.length > INPUT_LIMITS.CATEGORY_MAX_LEN) {
      setMessage(`Error: Category must be ${INPUT_LIMITS.CATEGORY_MAX_LEN} characters or less.`);
      return;
    }

    const priceCheck = validateAmountInput(formData.price, {
      label: 'Product price',
      min: INPUT_LIMITS.PRODUCT_PRICE_MIN,
      max: INPUT_LIMITS.PRODUCT_PRICE_MAX
    });
    if (!priceCheck.valid) {
      setMessage('Error: ' + priceCheck.error);
      return;
    }

    const thresholdInput = formData.track_stock
      ? formData.low_stock_threshold
      : (formData.low_stock_threshold === '' || formData.low_stock_threshold === null || formData.low_stock_threshold === undefined ? 0 : formData.low_stock_threshold);
    const thresholdCheck = validateAmountInput(thresholdInput, {
      label: 'Low stock threshold',
      min: 0,
      max: INPUT_LIMITS.THRESHOLD_MAX
    });
    if (!thresholdCheck.valid) {
      setMessage('Error: ' + thresholdCheck.error);
      return;
    }

    if (!forceCreate) {
      const similarityMatch = checkDuplicateOrSimilar(formData.name, products, null, trimmedCategory);
      if (similarityMatch?.isHardDuplicate) {
        setMessage(`Error: "${similarityMatch.matchName}" already exists under category "${similarityMatch.matchCategory}". Duplicate items in the same category are not allowed.`);
        return;
      }
      if (similarityMatch) {
        setConfirmConfig({
          isOpen: true,
          title: similarityMatch.isDifferentCategory ? 'Same Name in Different Category' : 'Similar Product Detected',
          message: similarityMatch.isDifferentCategory
            ? `WARNING: "${similarityMatch.matchName}" already exists in category "${similarityMatch.matchCategory}". Are you sure you want to add it under "${trimmedCategory}"?`
            : `WARNING: The product "${similarityMatch.matchName}" (${similarityMatch.matchCategory}) sounds very similar to what you're adding. Are you sure you want to proceed?`,
          onConfirm: () => {
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            handleAddProduct(null, true);
          }
        });
        return;
      }
    }

    const validatedSizes = [];
    for (const sz of formData.sizes || []) {
      const szRes = validateSizeEntry(sz);
      if (!szRes.valid) {
        setMessage('Error: ' + szRes.error);
        return;
      }
      validatedSizes.push(szRes.normalized);
    }

    const validatedAddOns = [];
    for (const ao of formData.add_ons || []) {
      const aoRes = validateAddOnEntry(ao);
      if (!aoRes.valid) {
        setMessage('Error: ' + aoRes.error);
        return;
      }
      validatedAddOns.push(aoRes.normalized);
    }

    try {
      await createProduct({
        name: newName,
        category: trimmedCategory,
        price: priceCheck.numericValue,
        image_url: formData.image_url,
        track_stock: formData.track_stock,
        stock_quantity: 0,
        low_stock_threshold: thresholdCheck.numericValue,
        sizes: validatedSizes,
        hidden_sizes: formData.hiddenSizes || [],
        add_ons: validatedAddOns,
        force_create: forceCreate
      });
      setMessage('Product created successfully!');
      setFormData({ 
        name: '', 
        category: '', 
        price: '', 
        image_url: '',
        track_stock: false, 
        low_stock_threshold: 5,
        sizes: [],
        hiddenSizes: [],
        add_ons: []
      });
      fetchProducts();
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
            handleAddProduct(null, true);
          }
        });
      } else {
        setMessage('Error: ' + err.message);
      }
    }
  };

  const handleArchiveToggle = (id, isArchived) => {
    if (isProcessing) return;
    const product = products.find(p => p.id === id);
    const prodName = product ? `"${product.name}"` : 'this product';

    setConfirmConfig({
      isOpen: true,
      title: isArchived ? 'Restore Product?' : 'Archive Product?',
      message: isArchived
        ? `Are you sure you want to restore ${prodName}? It will become active and available again on the POS register and online menus.`
        : `Are you sure you want to archive ${prodName}? It will be hidden from the POS register and menus, but historical sales records will remain preserved.`,
      confirmText: isArchived ? 'Yes, Restore' : 'Yes, Archive',
      confirmColor: isArchived ? 'success' : 'danger',
      onConfirm: async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        setProcessingId(id);
        try {
          if (isArchived) {
            await restoreProduct(id);
            setMessage(`Product ${prodName} restored successfully.`);
          } else {
            await archiveProduct(id);
            setMessage(`Product ${prodName} archived.`);
          }
          setTimeout(() => setMessage(''), 3000);
          await fetchProducts();
        } catch (err) {
          console.error('Archiving error:', err);
          setMessage('Error updating product status: ' + (err.message || 'Please try again.'));
          setTimeout(() => setMessage(''), 4000);
        } finally {
          setIsProcessing(false);
          setProcessingId(null);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handlePermanentDeleteProduct = (id) => {
    if (isProcessing) return;
    const product = products.find(p => p.id === id);
    const prodName = product ? `"${product.name}"` : 'this product';

    setConfirmConfig({
      isOpen: true,
      title: 'Permanently Delete Product?',
      message: `Are you sure you want to PERMANENTLY delete ${prodName}? This item has been archived for at least 30 days. This action cannot be undone.`,
      confirmText: 'Yes, Delete Permanently',
      confirmColor: 'danger',
      onConfirm: async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        setProcessingId(id);
        try {
          await deleteProduct(id);
          setMessage(`Product ${prodName} permanently deleted.`);
          setTimeout(() => setMessage(''), 3000);
          await fetchProducts();
        } catch (err) {
          console.error('Delete error:', err);
          setMessage('Error deleting product: ' + (err.message || 'Please try again.'));
          setTimeout(() => setMessage(''), 5000);
        } finally {
          setIsProcessing(false);
          setProcessingId(null);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleSetRecipe = async (product) => {
    setMessage('');
    setSelectedProduct(product);
    setEditPrice(product.price);
    setEditName(product.name);
    setEditCategory(product.category);
    setEditImageUrl(product.image_url || '');
    setEditTrackStock(product.track_stock || false);
    setEditStockQty(product.stock_quantity || 0);
    setEditThreshold(product.low_stock_threshold || 5);
    setEditSizes(product.sizes || []);
    setEditAddOns(product.add_ons || []);
    setEditHiddenSizes(Array.isArray(product.hidden_sizes) ? product.hidden_sizes : []);
    try {
      const data = await getRecipesByProduct(product.id);
      setRecipe(data || []);
    } catch (err) {
      console.error('Failed to load recipe:', err);
    }
  };

  const handleUpdateProduct = async (e, forceUpdate = false) => {
    if (e) e.preventDefault();
    if (!selectedProduct) return;

    const updatedName = String(editName || '').trim().toUpperCase();
    const trimmedCategory = String(editCategory || '').trim();

    if (!updatedName) {
      setMessage('Error: Product name is required.');
      return;
    }
    if (updatedName.length > INPUT_LIMITS.NAME_MAX_LEN) {
      setMessage(`Error: Product name must be ${INPUT_LIMITS.NAME_MAX_LEN} characters or less.`);
      return;
    }
    if (!trimmedCategory) {
      setMessage('Error: Please select a category.');
      return;
    }
    if (trimmedCategory.length > INPUT_LIMITS.CATEGORY_MAX_LEN) {
      setMessage(`Error: Category must be ${INPUT_LIMITS.CATEGORY_MAX_LEN} characters or less.`);
      return;
    }

    const priceCheck = validateAmountInput(editPrice, {
      label: 'Product price',
      min: INPUT_LIMITS.PRODUCT_PRICE_MIN,
      max: INPUT_LIMITS.PRODUCT_PRICE_MAX
    });
    if (!priceCheck.valid) {
      setMessage('Error: ' + priceCheck.error);
      return;
    }

    const thresholdInput = editTrackStock
      ? editThreshold
      : (editThreshold === '' || editThreshold === null || editThreshold === undefined ? 0 : editThreshold);
    const thresholdCheck = validateAmountInput(thresholdInput, {
      label: 'Low stock threshold',
      min: 0,
      max: INPUT_LIMITS.THRESHOLD_MAX
    });
    if (!thresholdCheck.valid) {
      setMessage('Error: ' + thresholdCheck.error);
      return;
    }

    // Name and category untouched: nothing to check (an archived twin must not block
    // editing price, sizes, etc.).
    const sameKey = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
    const identityUnchanged =
      sameKey(editName) === sameKey(selectedProduct.name) &&
      sameKey(trimmedCategory || 'GENERAL') === sameKey(selectedProduct.category || 'GENERAL');

    if (!forceUpdate && !identityUnchanged) {
      const similarityMatch = checkDuplicateOrSimilar(editName, products, selectedProduct.id, trimmedCategory);
      if (similarityMatch?.isHardDuplicate) {
        setMessage(`Error: "${similarityMatch.matchName}" already exists under category "${similarityMatch.matchCategory}". Duplicate items in the same category are not allowed.`);
        return;
      }
      if (similarityMatch) {
        setConfirmConfig({
          isOpen: true,
          title: similarityMatch.isDifferentCategory ? 'Same Name in Different Category' : 'Similar Product Detected',
          message: similarityMatch.isDifferentCategory
            ? `WARNING: "${similarityMatch.matchName}" already exists in category "${similarityMatch.matchCategory}". Do you still want to update this product under "${trimmedCategory}"?`
            : `WARNING: The name sounds very similar to an existing product "${similarityMatch.matchName}" (${similarityMatch.matchCategory}). Do you still want to update?`,
          onConfirm: () => {
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            handleUpdateProduct(null, true);
          }
        });
        return;
      }
    }

    const validatedSizes = [];
    for (const sz of editSizes || []) {
      const szRes = validateSizeEntry(sz);
      if (!szRes.valid) {
        setMessage('Error: ' + szRes.error);
        return;
      }
      validatedSizes.push(szRes.normalized);
    }

    const validatedAddOns = [];
    for (const ao of editAddOns || []) {
      const aoRes = validateAddOnEntry(ao);
      if (!aoRes.valid) {
        setMessage('Error: ' + aoRes.error);
        return;
      }
      validatedAddOns.push(aoRes.normalized);
    }

    try {
      await updateProduct(selectedProduct.id, {
        name: updatedName,
        category: trimmedCategory,
        price: priceCheck.numericValue,
        image_url: editImageUrl,
        track_stock: editTrackStock,
        stock_quantity: parseFloat(editStockQty) || 0,
        low_stock_threshold: thresholdCheck.numericValue,
        sizes: validatedSizes,
        hidden_sizes: editHiddenSizes || [],
        add_ons: validatedAddOns,
        force_update: forceUpdate
      });
      setMessage('Product details updated successfully!');
      fetchProducts();
      setViewMode('ADD');
      setSelectedProduct(null);
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
            handleUpdateProduct(null, true);
          }
        });
      } else {
        setMessage('Error updating product: ' + err.message);
      }
    }
  };

  const handleDeleteRecipeItem = async (recipeId) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Remove Ingredient',
      message: 'Are you sure you want to remove this ingredient from the recipe?',
      onConfirm: async () => {
        try {
          await deleteRecipe(recipeId);
          setRecipe(recipe.filter(r => r.id !== recipeId));
          setMessage('Ingredient removed from recipe');
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          setTimeout(() => setMessage(''), 2000);
        } catch (err) {
          setMessage('Error removing ingredient: ' + err.message);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleAddSize = (sizeObjOrEvent) => {
    const isEvent = Boolean(sizeObjOrEvent?.preventDefault);
    if (isEvent) sizeObjOrEvent.preventDefault();
    const target = isEvent ? newSize : sizeObjOrEvent;
    if (!target?.name?.trim()) return false;
    const res = validateSizeEntry(target);
    if (!res.valid) {
      setMessage('Error: ' + res.error);
      return false;
    }
    setEditSizes(prev => [...prev, res.normalized]);
    if (isEvent) {
      setNewSize({ name: '', price_add: '', ingredient_id: '' });
    }
    return true;
  };

  const handleRemoveSize = (index) => {
    setEditSizes(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateEditSize = (index, patch) => {
    setEditSizes(prev => prev.map((sz, i) => (i === index ? { ...sz, ...patch } : sz)));
  };

  const handleAddAddOn = (addonObjOrEvent) => {
    const isEvent = Boolean(addonObjOrEvent?.preventDefault);
    if (isEvent) addonObjOrEvent.preventDefault();
    const target = isEvent ? newAddOn : addonObjOrEvent;
    if (!target?.name?.trim()) return false;
    const res = validateAddOnEntry(target);
    if (!res.valid) {
      setMessage('Error: ' + res.error);
      return false;
    }
    setEditAddOns(prev => [...prev, res.normalized]);
    if (isEvent) {
      setNewAddOn({ name: '', price: '', ingredient_id: '', quantity: '', unit: '' });
    }
    return true;
  };

  const handleRemoveAddOn = (index) => {
    setEditAddOns(prev => prev.filter((_, i) => i !== index));
  };

  const parseSizeQuantitiesInput = (rawMap) => {
    const clean = {};
    if (!rawMap || typeof rawMap !== 'object') return { valid: true, map: null };
    for (const [sizeName, rawVal] of Object.entries(rawMap)) {
      if (rawVal === '' || rawVal === null || rawVal === undefined) continue;
      const check = validateAmountInput(rawVal, {
        label: `${sizeName} recipe quantity`,
        min: INPUT_LIMITS.RECIPE_QTY_MIN,
        max: INPUT_LIMITS.RECIPE_QTY_MAX
      });
      if (!check.valid) return { valid: false, error: check.error };
      clean[sizeName] = check.numericValue;
    }
    return { valid: true, map: Object.keys(clean).length > 0 ? clean : null };
  };

  const handleAddRecipeItem = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!newRecipeItem.ingredient_id) {
      setMessage('Error: Please select an ingredient.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const qtyCheck = validateAmountInput(newRecipeItem.quantity, {
      label: 'Recipe quantity',
      min: INPUT_LIMITS.RECIPE_QTY_MIN,
      max: INPUT_LIMITS.RECIPE_QTY_MAX
    });
    if (!qtyCheck.valid) {
      setMessage('Error: ' + qtyCheck.error);
      setTimeout(() => setMessage(''), 3500);
      return;
    }

    const sizeQtyRes = parseSizeQuantitiesInput(newRecipeItem.size_quantities);
    if (!sizeQtyRes.valid) {
      setMessage('Error: ' + sizeQtyRes.error);
      setTimeout(() => setMessage(''), 3500);
      return;
    }

    const qty = qtyCheck.numericValue;
    const ingredient = allIngredients.find(i => i.id === newRecipeItem.ingredient_id);
    const unit = (newRecipeItem.input_unit || ingredient?.unit || '').toUpperCase();

    try {
      setIsProcessing(true);
      await createRecipe({
        product_id: selectedProduct.id,
        ingredient_id: newRecipeItem.ingredient_id,
        quantity_used: qty,
        recipe_unit: unit,
        size_quantities: sizeQtyRes.map
      });

      setMessage(`Added ${qty} ${unit} of ${ingredient?.name || 'ingredient'} to recipe!`);
      setNewRecipeItem({ ingredient_id: '', quantity: '', input_unit: '', size_quantities: {} });
      const data = await getRecipesByProduct(selectedProduct.id);
      setRecipe(data || []);
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setMessage('Error adding ingredient: ' + err.message);
      setTimeout(() => setMessage(''), 3500);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateRecipeItem = async (recipeId, quantityUsed, recipeUnit, sizeQuantities = null) => {
    const qtyCheck = validateAmountInput(quantityUsed, {
      label: 'Recipe quantity',
      min: INPUT_LIMITS.RECIPE_QTY_MIN,
      max: INPUT_LIMITS.RECIPE_QTY_MAX
    });
    if (!qtyCheck.valid) {
      setMessage('Error: ' + qtyCheck.error);
      setTimeout(() => setMessage(''), 3500);
      return false;
    }

    const sizeQtyRes = parseSizeQuantitiesInput(sizeQuantities);
    if (!sizeQtyRes.valid) {
      setMessage('Error: ' + sizeQtyRes.error);
      setTimeout(() => setMessage(''), 3500);
      return false;
    }

    try {
      setIsProcessing(true);
      await updateRecipe(recipeId, {
        quantity_used: qtyCheck.numericValue,
        recipe_unit: recipeUnit,
        size_quantities: sizeQtyRes.map
      });
      setMessage('Recipe ingredient updated successfully');
      const data = await getRecipesByProduct(selectedProduct.id);
      setRecipe(data || []);
      setTimeout(() => setMessage(''), 2000);
      return true;
    } catch (err) {
      setMessage('Error updating recipe ingredient: ' + err.message);
      setTimeout(() => setMessage(''), 3500);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    viewMode, setViewMode,
    products, categories, categorySettings, fetchCategories, loading, uploading, message, setMessage,
    fetchProducts,
    isProcessing, processingId,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    categoryFilter, setCategoryFilter,
    confirmConfig, setConfirmConfig,
    formData, setFormData, handleInputChange, handleImageUpload,
    handleAddFormSize, handleRemoveFormSize, handleUpdateFormSize,
    handleAddFormAddOn, handleRemoveFormAddOn,
    selectedProduct, setSelectedProduct,
    recipe, allIngredients,
    newRecipeItem, setNewRecipeItem,
    newSize, setNewSize,
    newAddOn, setNewAddOn,
    editPrice, setEditPrice,
    editName, setEditName,
    editCategory, setEditCategory,
    editImageUrl, setEditImageUrl,
    editTrackStock, setEditTrackStock,
    editStockQty, setEditStockQty,
    editThreshold, setEditThreshold,
    editSizes, setEditSizes,
    editAddOns, setEditAddOns,
    editHiddenSizes, setEditHiddenSizes,
    handleAddSize, handleRemoveSize, handleUpdateEditSize,
    handleAddAddOn, handleRemoveAddOn,
    handleReceiveProductStock,
    handleAddProduct,
    handleArchiveToggle,
    handlePermanentDeleteProduct,
    handleSetRecipe,
    handleUpdateProduct,
    handleDeleteRecipeItem,
    handleAddRecipeItem,
    handleUpdateRecipeItem
  };
};
