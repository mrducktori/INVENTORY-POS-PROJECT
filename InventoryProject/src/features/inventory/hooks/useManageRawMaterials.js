import { useState, useEffect } from 'react';
import { getIngredients, createIngredient, updateIngredient, archiveIngredient, restoreIngredient } from '../../../api/inventoryApi';
import { checkDuplicateOrSimilar } from '../../../utils/productUtils';

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

  const [formData, setFormData] = useState({ name: '', unit: '', category: '', low_stock_alert: '' });

  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editAlert, setEditAlert] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editPurchaseUnit, setEditPurchaseUnit] = useState('Unit');
  const [editConversionFactor, setEditConversionFactor] = useState(1);
  const [editCost, setEditCost] = useState(0);
  const [editCategory, setEditCategory] = useState('');

  const UNIT_CHOICES = ['KG', 'G', 'L', 'ML', 'PCS', 'PACK', 'BOTTLE', 'CAN'];

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const data = await getIngredients();
      setIngredients(data || []);
    } catch (err) {
      console.error('Failed to load ingredients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddIngredient = async (e, forceCreate = false, skipConfirm = false) => {
    if (e) e.preventDefault();
    const newName = formData.name.trim().toUpperCase();
    const newUnit = formData.unit.trim().toUpperCase();

    if (!UNIT_CHOICES.includes(newUnit)) {
      setMessage(`Error: Invalid unit. Must be one of: ${UNIT_CHOICES.join(', ')}`);
      return;
    }

    if (!skipConfirm) {
      setConfirmConfig({
        isOpen: true,
        title: 'Confirm Add',
        message: `Are you sure you want to add "${newName}" as a new raw material?`,
        onConfirm: () => {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          handleAddIngredient(null, forceCreate, true);
        }
      });
      return;
    }

    if (!forceCreate) {
      const similarityMatch = checkDuplicateOrSimilar(formData.name, ingredients);
      if (similarityMatch) {
        setConfirmConfig({
          isOpen: true,
          title: similarityMatch.isExactMatch ? 'Duplicate Detected' : 'Similar Ingredient Detected',
          message: similarityMatch.isExactMatch 
            ? `WARNING: An ingredient with the exact name "${similarityMatch.matchName}" already exists. Do you still want to add it?`
            : `WARNING: The ingredient "${similarityMatch.matchName}" sounds very similar to what you're adding. Are you sure you want to proceed?`,
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
        category: formData.category ? formData.category.trim() : null,
        low_stock_alert: parseFloat(formData.low_stock_alert) || 0,
        stock_quantity: 0,
        force_create: forceCreate
      });
      setMessage('Ingredient created successfully!');
      setFormData({ name: '', unit: '', category: '', low_stock_alert: '' });
      fetchIngredients();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      if (err.payload?.is_duplicate_warning) {
        setConfirmConfig({
          isOpen: true,
          title: 'Duplicate Detected',
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

  const handleUpdateIngredient = async (e) => {
    if (e) e.preventDefault();
    
    setConfirmConfig({
      isOpen: true,
      title: 'Confirm Update',
      message: `Are you sure you want to save changes to "${selectedIngredient.name}"?`,
      onConfirm: async () => {
        const updatedName = editName.trim().toUpperCase();
        const updatedUnit = editUnit.trim().toUpperCase();

        if (!UNIT_CHOICES.includes(updatedUnit)) {
          setMessage(`Error: Invalid unit. Must be one of: ${UNIT_CHOICES.join(', ')}`);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          setTimeout(() => setMessage(''), 3000);
          return;
        }

        const proceedWithUpdate = async () => {
          try {
            await updateIngredient(selectedIngredient.id, {
              name: updatedName,
              unit: updatedUnit,
              low_stock_alert: parseFloat(editAlert) || 0,
              stock_quantity: parseFloat(editQuantity) || 0,
              purchase_unit: editPurchaseUnit || 'Unit',
              conversion_factor: parseFloat(editConversionFactor) || 1,
              cost_per_purchase_unit: parseFloat(editCost) || 0
            });
            setMessage('Ingredient details updated successfully!');
            fetchIngredients();
            setViewMode('ADD');
            setSelectedIngredient(null);
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            setTimeout(() => setMessage(''), 3000);
          } catch (err) {
            if (err.message.includes('already exists')) {
              setMessage('WARNING: ' + err.message);
              setTimeout(() => setMessage(''), 3000);
            } else {
              setMessage('Error updating ingredient: ' + err.message);
              setTimeout(() => setMessage(''), 3000);
            }
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
        };

        const similarityMatch = checkDuplicateOrSimilar(editName, ingredients, selectedIngredient.id);
        if (similarityMatch) {
          const message = similarityMatch.isExactMatch 
            ? `WARNING: An ingredient with the name "${similarityMatch.matchName}" already exists. Do you still want to update to this name?`
            : `WARNING: The name sounds very similar to an existing ingredient "${similarityMatch.matchName}". Do you still want to update?`;
          
          setConfirmConfig({
            isOpen: true,
            title: similarityMatch.isExactMatch ? 'Duplicate Detected' : 'Similar Ingredient Detected',
            message: message,
            onConfirm: proceedWithUpdate
          });
          return;
        }

        proceedWithUpdate();
      }
    });
  };

  const handleSetModify = (ingredient) => {
    setSelectedIngredient(ingredient);
    setEditName(ingredient.name);
    setEditCategory(ingredient.category || '');
    setEditUnit(ingredient.unit);
    setEditAlert(ingredient.low_stock_alert);
    setEditQuantity(ingredient.stock_quantity);
    setEditPurchaseUnit(ingredient.purchase_unit || 'Unit');
    setEditConversionFactor(ingredient.conversion_factor || 1);
    setEditCost(ingredient.cost_per_purchase_unit || 0);
  };

  return {
    viewMode, setViewMode,
    ingredients, loading, message, setMessage,
    isProcessing, processingId,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    categoryFilter, setCategoryFilter,
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
    UNIT_CHOICES,
    handleAddIngredient,
    handleArchiveToggle,
    handleUpdateIngredient,
    handleSetModify
  };
};
