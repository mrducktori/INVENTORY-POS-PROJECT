import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createRequest, getRequests } from '../../api/requestsApi';
import { getCurrentUser } from '../../api/authApi';
import { getProducts } from '../../api/posApi';
import { getIngredients } from '../../api/inventoryApi';
import { getRecipesByProduct } from '../../api/recipesApi';
import SearchableIngredientSelect from '../../components/shared/SearchableIngredientSelect';
import Pagination from '../../components/shared/Pagination';


const RequestProduct = () => {
  const getInitialTab = () => {
    if (typeof window !== 'undefined' && window.location.hash.includes('/')) {
      const sub = window.location.hash.split('/')[1];
      if (sub === 'SUBMIT' || sub === 'HISTORY') return sub;
    }
    try {
      const saved = localStorage.getItem('coftea_request_tab');
      if (saved === 'SUBMIT' || saved === 'HISTORY') return saved;
    } catch { /* ignore storage/history errors */ }
    return 'SUBMIT';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab); // 'SUBMIT' | 'HISTORY'

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('coftea_request_tab', tab);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#RequestProduct/${tab}`);
      }
    } catch { /* ignore storage/history errors */ }
  };

  useEffect(() => {
    try {
      localStorage.setItem('coftea_request_tab', activeTab);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#RequestProduct/${activeTab}`);
      }
    } catch { /* ignore storage/history errors */ }
  }, [activeTab]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Data for dropdowns
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);

  // Form State
  const [type, setType] = useState('NEW_PRODUCT');
  const [priority, setPriority] = useState('NORMAL');
  const [description, setDescription] = useState('');
  
  // Structured Form Data
  const [newProduct, setNewProduct] = useState({ name: '', category: '', price: '' });
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [proposedRecipe, setProposedRecipe] = useState([]); // List of { ingredient_id, name, qty, unit }
  const [newRecipeItem, setNewRecipeItem] = useState({ ingredient_id: '', quantity: '' });
  
  // History State
  const [history, setHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(10);

  const historyTotalPages = Math.max(1, Math.ceil(history.length / historyItemsPerPage));
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyItemsPerPage;
    return history.slice(start, start + historyItemsPerPage);
  }, [history, historyPage, historyItemsPerPage]);

  const user = getCurrentUser();
  const userId = user?.id;

  const fetchDropdownData = useCallback(async () => {
    try {
      const [prodData, ingData] = await Promise.all([
        getProducts(),
        getIngredients()
      ]);
      setProducts(prodData || []);
      setIngredients(ingData || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const data = await getRequests({ requested_by: userId });
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDropdownData();
    if (activeTab === 'HISTORY') {
      fetchHistory();
    }
  }, [activeTab, fetchDropdownData, fetchHistory]);

  const handleProductSelect = async (productId) => {
    setSelectedProductId(productId);
    if (type === 'PRICE_CHANGE') {
      const prod = products.find(p => p.id === productId);
      setNewPrice(prod?.price || '');
    } else if (type === 'RECIPE_CHANGE') {
      try {
        const data = await getRecipesByProduct(productId);
        const mapped = (data || []).map(r => ({
          ingredient_id: r.ingredient_id,
          name: r.ingredients?.name,
          qty: r.quantity_used,
          unit: r.ingredients?.unit
        }));
        setProposedRecipe(mapped);
      } catch (err) {
        console.error('Failed to load recipe:', err);
      }
    }
  };

  const addIngredientToProposed = () => {
    if (!newRecipeItem.ingredient_id || !newRecipeItem.quantity) return;
    const ing = ingredients.find(i => i.id === newRecipeItem.ingredient_id);
    if (!ing) return;

    setProposedRecipe([...proposedRecipe, {
      ingredient_id: ing.id,
      name: ing.name,
      qty: parseFloat(newRecipeItem.quantity),
      unit: ing.unit
    }]);
    setNewRecipeItem({ ingredient_id: '', quantity: '' });
  };

  const removeIngredientFromProposed = (id) => {
    setProposedRecipe(proposedRecipe.filter(item => item.ingredient_id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      type,
      requested_by: user.id,
      details: {
        description,
        priority,
        requestedDate: new Date().toISOString(),
      }
    };

    if (type === 'NEW_PRODUCT') {
      payload.details.new_product = { ...newProduct, price: parseFloat(newProduct.price) };
    } else if (type === 'PRICE_CHANGE') {
      const prod = products.find(p => p.id === selectedProductId);
      payload.details.product_id = selectedProductId;
      payload.details.product_name = prod?.name;
      payload.details.old_price = prod?.price;
      payload.details.proposed_price = parseFloat(newPrice);
    } else if (type === 'RECIPE_CHANGE') {
      const prod = products.find(p => p.id === selectedProductId);
      payload.details.product_id = selectedProductId;
      payload.details.product_name = prod?.name;
      payload.details.proposed_recipe = proposedRecipe;
    }

    try {
      setLoading(true);
      await createRequest(payload);
      setMessage('Request submitted successfully!');
      resetForm();
      handleTabChange('HISTORY');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error submitting request: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDescription('');
    setNewProduct({ name: '', category: '', price: '' });
    setSelectedProductId('');
    setNewPrice('');
    setProposedRecipe([]);
    setPriority('NORMAL');
  };

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Staff Request Center</h1>
          <p className="m-0 mt-1 text-sm text-gray-500 font-medium">Submit structured requests for product additions or modifications.</p>
        </div>
        <div className="flex bg-gray-200 p-1 rounded-xl shadow-inner">
          <button 
            className={`px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${
              activeTab === 'SUBMIT' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => handleTabChange('SUBMIT')}
          >
            New Request
          </button>
          <button 
            className={`px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${
              activeTab === 'HISTORY' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => handleTabChange('HISTORY')}
          >
            My History
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-xl text-sm font-bold flex items-center shadow-sm border ${
          message.includes('success') 
            ? 'bg-green-50 text-green-800 border-green-200' 
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {message}
        </div>
      )}

      {activeTab === 'SUBMIT' ? (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden max-w-4xl mx-auto w-full mb-8">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">{type.replace('_', ' ')} FORM</h2>
          </div>
          <div className="p-6 md:p-8">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-700">Request Category</label>
                  <select 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
                    value={type} 
                    onChange={e => { setType(e.target.value); resetForm(); }}
                  >
                    <option value="NEW_PRODUCT">Add New Item</option>
                    <option value="PRICE_CHANGE">Modify Pricing</option>
                    <option value="RECIPE_CHANGE">Modify Recipe</option>
                    <option value="OTHER">General Feedback</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-700">Urgency</label>
                  <select 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
                    value={priority} 
                    onChange={e => setPriority(e.target.value)}
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div className="animate-[fadeIn_0.3s_ease-out] flex flex-col gap-6">
                {type === 'NEW_PRODUCT' && (
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-gray-700">Proposed Item Name</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                        value={newProduct.name} 
                        onChange={e => setNewProduct({...newProduct, name: e.target.value})} 
                        placeholder="e.g. Spanish Latte"
                        required 
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">Category</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                          value={newProduct.category} 
                          onChange={e => setNewProduct({...newProduct, category: e.target.value})} 
                          placeholder="e.g. COFFEE"
                          required 
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">Suggested Price (₱)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                          value={newProduct.price} 
                          onChange={e => setNewProduct({...newProduct, price: e.target.value})} 
                          required 
                        />
                      </div>
                    </div>
                  </div>
                )}

                {(type === 'PRICE_CHANGE' || type === 'RECIPE_CHANGE') && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-700">Select Existing Product</label>
                    <select 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
                      value={selectedProductId} 
                      onChange={e => handleProductSelect(e.target.value)}
                      required
                    >
                      <option value="">-- Choose product --</option>
                      {products.filter(p => !p.is_archived).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}

                {type === 'PRICE_CHANGE' && selectedProductId && (
                  <div className="flex flex-col gap-2 animate-[fadeIn_0.3s_ease-out]">
                    <label className="text-sm font-bold text-gray-700">Proposed New Price (₱)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                      value={newPrice} 
                      onChange={e => setNewPrice(e.target.value)} 
                      required 
                    />
                    <small className="text-xs text-gray-500 font-medium">Current price: ₱{products.find(p => p.id === selectedProductId)?.price}</small>
                  </div>
                )}

                {type === 'RECIPE_CHANGE' && selectedProductId && (
                  <div className="animate-[fadeIn_0.3s_ease-out] border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                      <h3 className="m-0 text-sm font-bold text-gray-900 uppercase tracking-wider">Proposed Recipe Changes</h3>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                          <tr className="bg-gray-50/50 border-b border-gray-100">
                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Ingredient</th>
                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Proposed Qty</th>
                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-16 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {proposedRecipe.map(item => (
                            <tr key={item.ingredient_id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 text-sm font-bold text-gray-900">{item.name}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number" 
                                    step="0.01" 
                                    className="w-24 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    value={item.qty} 
                                    onChange={e => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setProposedRecipe(proposedRecipe.map(i => i.ingredient_id === item.ingredient_id ? {...i, qty: val} : i));
                                    }}
                                  /> 
                                  <span className="text-sm text-gray-500 font-medium">{item.unit}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button 
                                  type="button" 
                                  className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                  onClick={() => removeIngredientFromProposed(item.ingredient_id)}
                                 aria-label="Clear"><svg className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-3 items-center">
                      <div className="flex-1 min-w-[220px]">
                        <SearchableIngredientSelect
                          ingredients={ingredients.filter(ing => !proposedRecipe.some(p => p.ingredient_id === ing.id))}
                          value={newRecipeItem.ingredient_id}
                          onChange={(id) => setNewRecipeItem({ ...newRecipeItem, ingredient_id: id })}
                          placeholder="Search ingredient to add..."
                        />
                      </div>
                      <input 
                        type="number" 
                        placeholder="Qty" 
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 shadow-sm"
                        value={newRecipeItem.quantity} 
                        onChange={e => setNewRecipeItem({...newRecipeItem, quantity: e.target.value})}
                      />
                      <button 
                        type="button" 
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm"
                        onClick={addIngredientToProposed}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 mt-4 pt-6 border-t border-gray-100">
                <label className="text-sm font-bold text-gray-700">Justification / Notes</label>
                <textarea
                  rows="3"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm resize-y"
                  placeholder="Why is this change necessary?"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                ></textarea>
              </div>

              <div className="pt-4 flex justify-end">
                <button 
                  type="submit" 
                  className="px-8 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors shadow-md disabled:opacity-50 flex items-center justify-center min-w-[200px]" 
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full mb-8 flex flex-col h-full min-h-[400px]">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Your Request History</h2>
          </div>
          <div className="p-0 flex-1">
            {loading ? (
              <div className="p-8 text-center text-gray-500 font-medium">Loading history...</div>
            ) : history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Date</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-40">Type</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Subject</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-32 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedHistory.map(req => (
                      <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-500">{new Date(req.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{req.type.replace('_', ' ')}</td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-gray-900">{req.details.product_name || req.details.new_product?.name || 'General'}</div>
                          <div className="text-xs text-gray-500 truncate max-w-xs md:max-w-md">{req.details.description}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            req.status === 'APPROVED' ? 'bg-green-50 text-green-700 border border-green-200' : 
                            req.status === 'REJECTED' ? 'bg-red-50 text-red-700 border border-red-200' : 
                            'bg-yellow-50 text-yellow-700 border border-yellow-200'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                <Pagination
                  currentPage={historyPage}
                  totalPages={historyTotalPages}
                  totalItems={history.length}
                  itemsPerPage={historyItemsPerPage}
                  onPageChange={setHistoryPage}
                  onItemsPerPageChange={(val) => {
                    setHistoryItemsPerPage(val);
                    setHistoryPage(1);
                  }}
                  itemsPerPageOptions={[10, 20, 50]}
                />
              </div>
            ) : (
              <div className="p-12 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 h-full">
                <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                <p className="m-0 text-sm font-medium">No request history found.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestProduct;
