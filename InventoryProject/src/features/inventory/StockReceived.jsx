import React, { useState, useEffect, useMemo } from 'react';
import { getIngredients, receiveStock } from '../../api/inventoryApi';
import { getAllProducts, receiveProductStock } from '../../api/productsApi';
import { formatQuantity } from '../../utils/productUtils';
import { INPUT_LIMITS, validateAmountInput } from '../../utils/validationUtils';
import { getManilaDateOnly, addDaysManila } from '../../utils/dateUtils';
import SearchableIngredientSelect from '../../components/shared/SearchableIngredientSelect';
import OcrScannerPanel from '../../components/shared/OcrScannerPanel';
import Pagination from '../../components/shared/Pagination';


const StockReceived = () => {
  const [ingredients, setIngredients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [scannedQueue, setScannedQueue] = useState([]);
  const [activeScanIndex, setActiveScanIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Combined list of trackable items
  const activeIngredients = ingredients.filter(i => !i.is_archived);
  const trackableProducts = products.filter(p => p.track_stock && !p.is_archived);

  const allItems = useMemo(() => [
    ...activeIngredients.map(i => ({ ...i, itemType: 'ingredient' })),
    ...trackableProducts.map(p => ({ 
      ...p, 
      itemType: 'product', 
      low_stock_alert: p.low_stock_threshold,
      unit: 'pcs' // Products usually pcs
    }))
  ].sort((a, b) => a.name.localeCompare(b.name)), [activeIngredients, trackableProducts]);

  const filteredItems = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(i =>
      (i.name || '').toLowerCase().includes(q) ||
      (i.itemType || '').toLowerCase().includes(q)
    );
  }, [allItems, searchFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter]);

  const selectedItem = allItems.find(i => String(i.id) === String(selectedId));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ingData, prodData] = await Promise.all([
        getIngredients(),
        getAllProducts()
      ]);
      setIngredients(ingData || []);
      setProducts(prodData || []);
    } catch (err) {
      setMessage('Error loading data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyScannedRowToForm = (row, idx = 0) => {
    if (!row) return;
    setActiveScanIndex(idx);
    const chosen = allItems.find((i) => String(i.id) === String(row.matched_ingredient_id));
    setSelectedId(chosen ? chosen.id : row.matched_ingredient_id || '');
    const qtyClamped = Math.min(
      INPUT_LIMITS.RECEIVE_QTY_MAX,
      Math.max(INPUT_LIMITS.RECEIVE_QTY_MIN, parseFloat(row.quantity) || 1)
    );
    setQuantity(String(qtyClamped));
    if (row.expiry_date) {
      setExpiryDate(row.expiry_date);
    } else if (chosen && chosen.itemType === 'ingredient' && chosen.is_perishable !== false) {
      const shelfDays = Number(chosen.default_shelf_life_days) || 30;
      setExpiryDate(addDaysManila(getManilaDateOnly(), shelfDays));
    } else {
      setExpiryDate('');
    }
    setBatchCode((row.batch_code || '').slice(0, INPUT_LIMITS.BATCH_CODE_MAX_LEN));
  };

  const handleApplyOcrItems = (validatedItems = []) => {
    if (!validatedItems.length) return;
    setScannedQueue(validatedItems);
    applyScannedRowToForm(validatedItems[0], 0);
    setMessage(
      validatedItems.length > 1
        ? `Successfully loaded ${validatedItems.length} OCR items. Select any pill above the form to apply and log each line.`
        : `Successfully applied OCR values for ${validatedItems[0].matched_ingredient_name}.`
    );
  };

  const handleReceiveStock = async (e) => {
    e.preventDefault();
    if (!selectedId || !quantity || !selectedItem) {
      setMessage('Please select an item and enter a quantity.');
      return;
    }

    const qtyCheck = validateAmountInput(quantity, {
      label: 'Receive quantity',
      min: INPUT_LIMITS.RECEIVE_QTY_MIN,
      max: INPUT_LIMITS.RECEIVE_QTY_MAX
    });
    if (!qtyCheck.valid || qtyCheck.numericValue > INPUT_LIMITS.RECEIVE_QTY_MAX) {
      setMessage('Error: ' + qtyCheck.error);
      return;
    }

    const qty = qtyCheck.numericValue;
    const currentStock = parseFloat(selectedItem.stock_quantity) || 0;
    if (currentStock + qty > INPUT_LIMITS.STOCK_QTY_MAX) {
      setMessage(`Error: Resulting stock cannot exceed ${INPUT_LIMITS.STOCK_QTY_MAX.toLocaleString()}.`);
      return;
    }

    const trimmedBatch = batchCode.trim();
    if (trimmedBatch.length > INPUT_LIMITS.BATCH_CODE_MAX_LEN) {
      setMessage(`Error: Batch / lot code must be ${INPUT_LIMITS.BATCH_CODE_MAX_LEN} characters or less.`);
      return;
    }

    try {
      setSubmitting(true);
      if (selectedItem.itemType === 'ingredient') {
        await receiveStock(selectedId, qty, {
          expiry_date: expiryDate || null,
          batch_code: trimmedBatch || null
        });
      } else {
        await receiveProductStock(selectedId, qty);
      }
      
      setMessage(`Successfully added ${qty} ${selectedItem.unit || ''} to ${selectedItem.name}!`);
      setSelectedId('');
      setQuantity('');
      setExpiryDate('');
      setBatchCode('');
      setTimeout(() => setMessage(''), 4000);
      fetchData();
    } catch (err) {
      setMessage('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Stock Received</h1>
          <p className="m-0 mt-1 text-sm text-gray-500 font-medium">Log incoming deliveries for ingredients and direct-track products.</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 mb-8 rounded-xl text-sm font-bold flex items-center shadow-sm border ${
          message.includes('success') || message.includes('Successfully') 
            ? 'bg-green-50 text-green-800 border-green-200' 
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {message}
        </div>
      )}

      <OcrScannerPanel
        ingredients={activeIngredients}
        scanMode="STOCK_RECEIVE"
        onApplyItems={handleApplyOcrItems}
      />

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full mb-8">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Add Incoming Stock</h2>
        </div>
        <div className="p-6">
          {scannedQueue.length > 1 && (
            <div className="mb-5 p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
              <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Scanned Delivery Lines (Click to Populate Form)
              </div>
              <div className="flex flex-wrap gap-2">
                {scannedQueue.map((item, idx) => (
                  <button
                    key={`${item.matched_ingredient_id}-${idx}`}
                    type="button"
                    onClick={() => applyScannedRowToForm(item, idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      activeScanIndex === idx
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {idx + 1}. {item.matched_ingredient_name} ({item.quantity} {item.matched_unit || ''})
                  </button>
                ))}
              </div>
            </div>
          )}
          <form onSubmit={handleReceiveStock} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-700">Select Item (Ingredient or Product)</label>
              <SearchableIngredientSelect
                ingredients={allItems}
                value={selectedId}
                onChange={(id) => {
                  setSelectedId(id);
                  const chosen = allItems.find(i => String(i.id) === String(id));
                  if (chosen && chosen.itemType === 'ingredient' && chosen.is_perishable !== false) {
                    const shelfDays = Number(chosen.default_shelf_life_days) || 30;
                    setExpiryDate(addDaysManila(getManilaDateOnly(), shelfDays));
                  } else {
                    setExpiryDate('');
                  }
                  setBatchCode('');
                }}
                placeholder="Search or select ingredient or product..."
              />
            </div>

            {selectedItem && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-gray-600">Current: <strong className="text-gray-900">{formatQuantity(selectedItem.stock_quantity, selectedItem.unit)}</strong></span>
                  <span className="text-sm text-gray-600">Alert at: <strong className="text-gray-900">{formatQuantity(selectedItem.low_stock_alert, selectedItem.unit)}</strong></span>
                </div>
                <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  selectedItem.stock_quantity <= 0 ? 'bg-red-50 text-red-700 border border-red-200' :
                  selectedItem.stock_quantity <= selectedItem.low_stock_alert ? 'bg-red-50 text-red-600 border border-red-100' :
                  selectedItem.stock_quantity <= selectedItem.low_stock_alert * 1.5 ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {selectedItem.stock_quantity <= 0 ? 'OUT OF STOCK' :
                   selectedItem.stock_quantity <= selectedItem.low_stock_alert ? 'RESTOCK NEEDED' :
                   selectedItem.stock_quantity <= selectedItem.low_stock_alert * 1.5 ? 'LOW STOCK' : 'IN STOCK'}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-700">Quantity to Add ({selectedItem?.unit || 'unit'})</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="1000000"
                placeholder="Enter quantity received"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            {selectedItem?.itemType === 'ingredient' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-gray-700">Expiration Date</label>
                    {expiryDate && (
                      <button
                        type="button"
                        onClick={() => setExpiryDate('')}
                        className="text-xs font-semibold text-gray-500 hover:text-gray-900 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-700">Batch / Lot Code (Optional)</label>
                  <input
                    type="text"
                    maxLength={INPUT_LIMITS.BATCH_CODE_MAX_LEN}
                    placeholder="Auto-generated if blank"
                    value={batchCode}
                    onChange={(e) => setBatchCode(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                  />
                </div>
              </div>
            )}

            <button 
              type="submit" 
              className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors shadow-sm disabled:bg-gray-400 self-start" 
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Confirm Stock Receipt'}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Inventory Status Overview</h2>
            <p className="m-0 text-xs text-gray-500 font-medium mt-0.5">Showing {filteredItems.length} trackable items</p>
          </div>
          <div className="relative w-full sm:w-64">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search items or type..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs cursor-pointer"
                aria-label="Clear"
              >
                <svg className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500 font-medium">Loading...</div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-gray-400 font-medium">No items found matching your search.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Item Name</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Current Stock</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Low Alert</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedItems.map(item => (
                    <tr key={`${item.itemType}-${item.id}`} className={`transition-colors ${selectedId === String(item.id) ? 'bg-blue-50/50' : 'hover:bg-gray-50/50'}`}>
                      <td className="px-6 py-4"><span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-2 py-1 rounded">{item.itemType}</span></td>
                      <td className="px-6 py-4"><strong className="text-sm font-bold text-gray-900">{item.name}</strong></td>
                      <td className="px-6 py-4 text-sm font-extrabold text-gray-900 text-right">{formatQuantity(item.stock_quantity, item.unit)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-500 text-right">{formatQuantity(item.low_stock_alert, item.unit)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.stock_quantity <= 0 ? 'bg-red-50 text-red-700 border border-red-200' :
                          item.stock_quantity <= item.low_stock_alert ? 'bg-red-50 text-red-600 border border-red-100' :
                          item.stock_quantity <= item.low_stock_alert * 1.5 ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-green-50 text-green-700 border border-green-200'
                        }`}>
                          {item.stock_quantity <= 0 ? 'Out of Stock' :
                           item.stock_quantity <= item.low_stock_alert ? 'Restock Needed' :
                           item.stock_quantity <= item.low_stock_alert * 1.5 ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {!loading && filteredItems.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredItems.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(val) => {
                setItemsPerPage(val);
                setCurrentPage(1);
              }}
              itemsPerPageOptions={[10, 20, 50]}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default StockReceived;
