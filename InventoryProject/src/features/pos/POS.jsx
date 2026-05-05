import React from "react";
import { filterProducts, formatQuantity } from "../../utils/productUtils";
import CategoryFilter from '../../components/shared/CategoryFilter';
import ProductCard from "./components/ProductCard";
import Cart from "./components/Cart";
import OngoingOrders from "./components/OngoingOrders";
import PaymentModal from "./components/PaymentModal";
import { usePOS } from "./usePOS";
import "./POS.css";

const POS = () => {
  const {
    products,
    cart,
    searchTerm,
    setSearchTerm,
    category,
    setCategory,
    loading,
    saleComplete,
    recipeProduct,
    setRecipeProduct,
    ongoingOrders,
    activeTab,
    setActiveTab,
    recipeLoading,
    currentRecipe,
    showOptions,
    setShowOptions,
    selectedProduct,
    productOptions,
    setProductOptions,
    openOptions,
    handleAddWithOptions,
    toggleAddOn,
    updateQty,
    removeFromCart,
    clearCart,
    calculateTotal,
    handleCompleteSale,
    handleCompleteOrder,
    handleCancelOrder,
    handleEditOrder,
    showPaymentModal,
    setShowPaymentModal,
    paymentOrder,
    confirmPayment
  } = usePOS();

  const filteredProducts = filterProducts(products, category, searchTerm);

  return (
    <div className="pos-container">
      {saleComplete && (
        <div className="success-banner">
          ✓ Transaction completed successfully!
        </div>
      )}

      {/* LEFT - Products */}
      <div className="pos-left">
        <div className="pos-header">
          <h2>Point of Sale</h2>
          <input
            type="text"
            placeholder="Search products..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <CategoryFilter category={category} setCategory={setCategory} />

        <div className="pos-products">
          {loading ? (
            <div className="loading">Loading products...</div>
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => openOptions(product)}
                onViewRecipe={(p) => setRecipeProduct(p)}
              />
            ))
          ) : (
            <div className="no-products">No products found</div>
          )}
        </div>
      </div>

      {/* RIGHT - Cart/Ongoing Orders */}
      <div className="pos-right">
        {/* Tabs */}
        <div className="pos-tabs">
          <button
            className={`tab-btn ${activeTab === 'cart' ? 'active' : ''}`}
            onClick={() => setActiveTab('cart')}
          >
            Transaction ({cart.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'ongoing' ? 'active' : ''}`}
            onClick={() => setActiveTab('ongoing')}
          >
            Ongoing Orders ({ongoingOrders.length})
          </button>
        </div>

        {/* Cart Tab */}
        {activeTab === 'cart' && (
          <>
            <Cart
              cart={cart}
              total={calculateTotal()}
              onUpdateQty={updateQty}
              onRemove={removeFromCart}
            />

            <div className="pos-buttons">
              <button
                className="complete-btn"
                onClick={handleCompleteSale}
                disabled={cart.length === 0}
              >
                Create Order
              </button>
              <button
                className="clear-btn"
                onClick={clearCart}
                disabled={cart.length === 0}
              >
                Clear Cart
              </button>
            </div>
          </>
        )}

        {/* Ongoing Orders Tab */}
        {activeTab === 'ongoing' && (
          <OngoingOrders
            orders={ongoingOrders}
            onComplete={handleCompleteOrder}
            onCancel={handleCancelOrder}
            onEdit={handleEditOrder}
          />
        )}
      </div>

      {/* Options Modal */}
      {showOptions && selectedProduct && (
        <div className="recipe-modal-overlay" onClick={() => setShowOptions(false)}>
          <div className="recipe-modal options-modal" onClick={e => e.stopPropagation()}>
            <div className="recipe-modal-header">
              <h3>Customize: {selectedProduct.name}</h3>
              <button className="recipe-modal-close" onClick={() => setShowOptions(false)}>✕</button>
            </div>
            <div className="recipe-modal-body">
              {/* Quantity */}
              <div className="option-group">
                <label>Quantity</label>
                <div className="qty-picker">
                  <button onClick={() => setProductOptions(p => ({...p, qty: Math.max(1, p.qty - 1)}))}>−</button>
                  <input type="number" value={productOptions.qty} readOnly />
                  <button onClick={() => setProductOptions(p => ({...p, qty: p.qty + 1}))}>+</button>
                </div>
              </div>

              {/* Cup Size & Add-ons - Only for Drinks */}
              {["COFFEE", "FRAPPE", "MILK TEA", "SODA", "FRUIT DRINKS"].includes(selectedProduct.category?.toUpperCase()) && (
                <>
                  <div className="option-group">
                    <label>Cup Size</label>
                    <div className="size-picker">
                      {(selectedProduct.sizes?.length > 0 ? selectedProduct.sizes.map(s => s.name) : ["12 oz", "16 oz", "22 oz"]).map(size => (
                        <button 
                          key={size}
                          className={productOptions.cupSize === size ? "active" : ""}
                          onClick={() => setProductOptions(p => ({...p, cupSize: size}))}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="option-group">
                    <label>Add-ons</label>
                    <div className="addons-grid">
                      {(() => {
                        let addonsToList = selectedProduct.add_ons?.length > 0 
                          ? selectedProduct.add_ons.map(a => a.name)
                          : ["Pearl", "Nata", "Jelly", "Pudding", "Extra Sugar", "Extra Ice"];
                        
                        return addonsToList.map(addon => (
                          <button 
                            key={addon}
                            className={productOptions.addOns.includes(addon) ? "active" : ""}
                            onClick={() => toggleAddOn(addon)}
                          >
                            {addon}
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="recipe-modal-footer">
              <button className="recipe-close-btn" onClick={() => setShowOptions(false)}>Cancel</button>
              <button className="complete-btn" onClick={handleAddWithOptions}>
                {(() => {
                  let displayPrice = parseFloat(selectedProduct.price);
                  if (["COFFEE", "FRAPPE", "MILK TEA", "SODA", "FRUIT DRINKS"].includes(selectedProduct.category?.toUpperCase())) {
                    if (selectedProduct.sizes && selectedProduct.sizes.length > 0) {
                      const sz = selectedProduct.sizes.find(s => s.name === productOptions.cupSize);
                      if (sz) displayPrice += parseFloat(sz.price_add || 0);
                    } else {
                      if (productOptions.cupSize === "16 oz") displayPrice += 10;
                      if (productOptions.cupSize === "22 oz") displayPrice += 20;
                    }

                    productOptions.addOns.forEach(addonName => {
                      if (selectedProduct.add_ons && selectedProduct.add_ons.length > 0) {
                        const ao = selectedProduct.add_ons.find(a => a.name === addonName);
                        if (ao) displayPrice += parseFloat(ao.price || 0);
                      }
                    });
                  }
                  return `Add to Transaction (₱${(displayPrice * productOptions.qty).toFixed(2)})`;
                })()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ingredients Info Modal */}
      {recipeProduct && (
        <div className="recipe-modal-overlay" onClick={() => setRecipeProduct(null)}>
          <div className="recipe-modal" onClick={e => e.stopPropagation()}>
            <div className="recipe-modal-header">
              <h3>Ingredients: {recipeProduct.name}</h3>
              <button className="recipe-modal-close" onClick={() => setRecipeProduct(null)}>✕</button>
            </div>
            <div className="recipe-modal-body">
              {recipeLoading ? (
                <div className="loading">Loading recipe details...</div>
              ) : currentRecipe.length > 0 ? (
                <div className="recipe-description-list" style={{ textAlign: 'left', padding: '10px 20px', lineHeight: '1.8' }}>
                  <p style={{ marginBottom: '15px', color: '#666', fontSize: '14px' }}>
                    This product is prepared using the following ingredients:
                  </p>
                  <ul style={{ listStyleType: 'disc', paddingLeft: '20px' }}>
                    {currentRecipe.map((r, i) => {
                      const displayUnit = (r.recipe_unit || r.ingredients?.unit || '').toUpperCase();
                      const formattedQty = `${r.quantity_used} ${displayUnit}`;
                      const formattedStock = formatQuantity(r.ingredients?.stock_quantity, r.ingredients?.unit);
                        
                      return (
                        <li key={i} style={{ marginBottom: '8px' }}>
                          <strong>{formattedQty}</strong> of <strong>{r.ingredients?.name}</strong>
                          <span style={{ marginLeft: '10px', fontSize: '12px', color: (r.ingredients?.stock_quantity || 0) < 10 ? '#c62828' : '#2e7d32' }}>
                            ({formattedStock} currently in stock)
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <div className="empty" style={{ padding: '20px', color: '#666' }}>
                  No recipe data found or this is a direct-stock item.
                </div>
              )}
            </div>
            <div className="recipe-modal-footer">
              <button className="recipe-close-btn" onClick={() => setRecipeProduct(null)}>Close</button>
              <button className="complete-btn btn-small" onClick={() => { openOptions(recipeProduct); setRecipeProduct(null); }}>
                + Customize & Add
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Payment Modal */}
      {showPaymentModal && paymentOrder && (
        <PaymentModal 
          order={paymentOrder}
          onConfirm={confirmPayment}
          onClose={() => setShowPaymentModal(false)}
        />
      )}
    </div>
  );
};

export default POS;
