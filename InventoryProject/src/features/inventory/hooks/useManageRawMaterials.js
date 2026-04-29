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

  const [formData, setFormData] = useState({ name: '', unit: '', low_stock_alert: '', stock_quantity: '0' });

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
    try {
      await createIngredient({
        name: formData.name.trim().toUpperCase(),
        unit: formData.unit.trim().toUpperCase(),
        low_stock_alert: parseFloat(formData.low_stock_alert) || 0,
        stock_quantity: parseFloat(formData.stock_quantity) || 0
      });
      setMessage('Ingredient created successfully!');
      setFormData({ name: '', unit: '', low_stock_alert: '', stock_quantity: '0' });
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
        try {
          await updateIngredient(selectedIngredient.id, {
            name: editName.trim().toUpperCase(),
            unit: editUnit.trim().toUpperCase(),
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
