import { useState, useEffect } from 'react';
import { getIngredients, createIngredient, updateIngredient, archiveIngredient, restoreIngredient } from '../../../api/inventoryApi';

export const useManageRawMaterials = () => {
  const [viewMode, setViewMode] = useState('ADD');
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [formData, setFormData] = useState({ name: '', unit: '', low_stock_alert: '' });

  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editAlert, setEditAlert] = useState('');
  const [editQuantity, setEditQuantity] = useState('');

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

  const handleAddIngredient = async (e) => {
    if (e) e.preventDefault();
    const newName = formData.name.trim().toUpperCase();
    const newUnit = formData.unit.trim().toUpperCase();

    if (!UNIT_CHOICES.includes(newUnit)) {
      setMessage(`Error: Invalid unit. Must be one of: ${UNIT_CHOICES.join(', ')}`);
      return;
    }

    const isDuplicate = ingredients.some(i => i.name.toUpperCase() === newName);
    if (isDuplicate) {
      const proceed = window.confirm(`WARNING: An ingredient with the name "${formData.name.trim()}" already exists. Do you still want to add it?`);
      if (!proceed) return;
    }

    try {
      await createIngredient({
        name: newName,
        unit: newUnit,
        low_stock_alert: parseFloat(formData.low_stock_alert) || 0,
        stock_quantity: 0
      });
      setMessage('Ingredient created successfully!');
      setFormData({ name: '', unit: '', low_stock_alert: '' });
      fetchIngredients();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
  };

  const handleArchiveToggle = async (id, isArchived) => {
    try {
      if (isArchived) {
        await restoreIngredient(id);
      } else {
        await archiveIngredient(id);
      }
      fetchIngredients();
    } catch (err) {
      console.error('Archiving error:', err);
      alert('Error updating ingredient status');
    }
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
          alert(`Error: Invalid unit. Must be one of: ${UNIT_CHOICES.join(', ')}`);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          return;
        }

        const isDuplicate = ingredients.some(i => i.name.toUpperCase() === updatedName && i.id !== selectedIngredient.id);
        if (isDuplicate) {
          const proceed = window.confirm(`WARNING: An ingredient with the name "${editName.trim()}" already exists. Do you still want to update to this name?`);
          if (!proceed) {
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            return;
          }
        }

        try {
          await updateIngredient(selectedIngredient.id, {
            name: updatedName,
            unit: updatedUnit,
            low_stock_alert: parseFloat(editAlert),
            stock_quantity: parseFloat(editQuantity)
          });
          setMessage('Ingredient updated successfully!');
          setSelectedIngredient(null);
          fetchIngredients();
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          setTimeout(() => setMessage(''), 3000);
        } catch (err) {
          setMessage('Error updating ingredient: ' + err.message);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleSetModify = (ingredient) => {
    setSelectedIngredient(ingredient);
    setEditName(ingredient.name);
    setEditUnit(ingredient.unit);
    setEditAlert(ingredient.low_stock_alert);
    setEditQuantity(ingredient.stock_quantity);
  };

  return {
    viewMode, setViewMode,
    ingredients, loading, message, setMessage,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    confirmConfig, setConfirmConfig,
    formData, handleInputChange,
    selectedIngredient, setSelectedIngredient,
    editName, setEditName,
    editUnit, setEditUnit,
    editAlert, setEditAlert,
    editQuantity, setEditQuantity,
    UNIT_CHOICES,
    handleAddIngredient,
    handleArchiveToggle,
    handleUpdateIngredient,
    handleSetModify
  };
};
