import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../config/supabaseClient';
import { getAllProducts, createProduct, updateProduct, archiveProduct, restoreProduct, deleteProduct, receiveProductStock } from '../../../api/productsApi';
import { checkDuplicateOrSimilar } from '../../../utils/productUtils';
import { INPUT_LIMITS, validateAmountInput } from '../../../utils/validationUtils';
import { getRecipesByProduct, createRecipe, updateRecipe, deleteRecipe } from '../../../api/recipesApi';
import { getIngredients } from '../../../api/inventoryApi';
import { getCategorySettings, extractCategoryNames } from '../../../api/categorySettingsApi';

export const useManageProducts = () => {
  const [viewMode, setViewMode] = useState('ADD'); 
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(() => extractCategoryNames([]));
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
    low_stock_threshold: 5
  });

  const [selectedProduct, setSelectedProduct] = useState(null);
  const selectedProductRef = useRef(selectedProduct);
  useEffect(() => {
    selectedProductRef.current = selectedProduct;
  }, [selectedProduct]);
  const [recipe, setRecipe] = useState([]);
  const [allIngredients, setAllIngredients] = useState([]);
  const [newRecipeItem, setNewRecipeItem] = useState({ ingredient_id: '', quantity: '', input_unit: '' });
  const [editPrice, setEditPrice] = useState('');
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editTrackStock, setEditTrackStock] = useState(false);
  const [editStockQty, setEditStockQty] = useState(0);
  const [editThreshold, setEditThreshold] = useState(5);
  const [editSizes, setEditSizes] = useState([]);
  const [editAddOns, setEditAddOns] = useState([]);

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
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleImageUpload = async (e, isEdit = false) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `product-${Date.now()}-${Math.random()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('cms-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('cms-images')
        .getPublicUrl(filePath);

      if (isEdit) {
        setEditImageUrl(data.publicUrl);
      } else {
        setFormData(prev => ({ ...prev, image_url: data.publicUrl }));
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

    // Frontend composite duplicate check
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

    try {
      await createProduct({
        name: newName,
        category: trimmedCategory,
        price: priceCheck.numericValue,
        image_url: formData.image_url,
        track_stock: formData.track_stock,
        stock_quantity: 0,
        low_stock_threshold: thresholdCheck.numericValue,
        force_create: forceCreate
      });
      setMessage('Product created successfully!');
      setFormData({ 
        name: '', 
        category: '', 
        price: '', 
        image_url: '',
        track_stock: false, 
        low_stock_threshold: 5 
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

    if (!forceUpdate) {
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

    try {
      await updateProduct(selectedProduct.id, {
        name: updatedName,
        category: trimmedCategory,
        price: priceCheck.numericValue,
        image_url: editImageUrl,
        track_stock: editTrackStock,
        stock_quantity: parseFloat(editStockQty) || 0,
        low_stock_threshold: thresholdCheck.numericValue,
        sizes: editSizes,
        add_ons: editAddOns,
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

  const handleAddSize = (e) => {
    if (e) e.preventDefault();
    if (!newSize.name) return;
    const priceAdd = newSize.price_add === '' ? 0 : newSize.price_add;
    const priceCheck = validateAmountInput(priceAdd, {
      label: 'Size add-on price',
      min: 0,
      max: INPUT_LIMITS.ADDON_PRICE_MAX
    });
    if (!priceCheck.valid) {
      setMessage('Error: ' + priceCheck.error);
      return;
    }
    setEditSizes(prev => [...prev, { ...newSize, price_add: priceCheck.numericValue }]);
    setNewSize({ name: '', price_add: '', ingredient_id: '' });
  };

  const handleRemoveSize = (index) => {
    setEditSizes(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddAddOn = (e) => {
    if (e) e.preventDefault();
    if (!newAddOn.name) return;
    const priceCheck = validateAmountInput(newAddOn.price === '' ? 0 : newAddOn.price, {
      label: 'Add-on price',
      min: 0,
      max: INPUT_LIMITS.ADDON_PRICE_MAX
    });
    if (!priceCheck.valid) {
      setMessage('Error: ' + priceCheck.error);
      return;
    }
    const qtyCheck = validateAmountInput(newAddOn.quantity === '' ? 0 : newAddOn.quantity, {
      label: 'Add-on quantity',
      min: 0,
      max: INPUT_LIMITS.RECIPE_QTY_MAX
    });
    if (!qtyCheck.valid) {
      setMessage('Error: ' + qtyCheck.error);
      return;
    }
    setEditAddOns(prev => [...prev, { 
      ...newAddOn, 
      price: priceCheck.numericValue,
      quantity: qtyCheck.numericValue
    }]);
    setNewAddOn({ name: '', price: '', ingredient_id: '', quantity: '', unit: '' });
  };

  const handleRemoveAddOn = (index) => {
    setEditAddOns(prev => prev.filter((_, i) => i !== index));
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

    const qty = qtyCheck.numericValue;
    const ingredient = allIngredients.find(i => i.id === newRecipeItem.ingredient_id);
    const unit = (newRecipeItem.input_unit || ingredient?.unit || '').toUpperCase();

    try {
      setIsProcessing(true);
      await createRecipe({
        product_id: selectedProduct.id,
        ingredient_id: newRecipeItem.ingredient_id,
        quantity_used: qty,
        recipe_unit: unit
      });

      setMessage(`Added ${qty} ${unit} of ${ingredient?.name || 'ingredient'} to recipe!`);
      setNewRecipeItem({ ingredient_id: '', quantity: '', input_unit: '' });
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

  const handleUpdateRecipeItem = async (recipeId, quantityUsed, recipeUnit) => {
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

    try {
      setIsProcessing(true);
      await updateRecipe(recipeId, {
        quantity_used: qtyCheck.numericValue,
        recipe_unit: recipeUnit
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
    products, categories, fetchCategories, loading, uploading, message, setMessage,
    fetchProducts,
    isProcessing, processingId,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    categoryFilter, setCategoryFilter,
    confirmConfig, setConfirmConfig,
    formData, setFormData, handleInputChange, handleImageUpload,
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
    handleAddSize, handleRemoveSize,
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
