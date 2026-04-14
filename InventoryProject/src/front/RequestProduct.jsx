import React, { useState } from 'react';
import { createRequest } from '../api/requestsApi';
import { getCurrentUser } from '../api/authApi';
import '../styles/Inventory.css';

const RequestProduct = () => {
  const [type, setType] = useState('NEW_PRODUCT');
  const [details, setDetails] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    
    if (!details.trim()) {
      setMessage('Please provide details for your request.');
      return;
    }

    try {
      await createRequest({
        type,
        details: { description: details, requestedDate: new Date().toISOString() },
        requested_by: user.id
      });
      setMessage('Request submitted successfully!');
      setDetails('');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error submitting request: ' + err.message);
    }
  };

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Request Product Modification</h1>
        <p>Submit requests for new products or changes to existing products to administrators.</p>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <div className="card-header">
          <h2>Submit Request</h2>
        </div>
        <div className="card-body">
          {message && (
            <div className={`alert ${message.includes('success') ? 'alert-success' : 'alert-error'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Request Type</label>
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="NEW_PRODUCT">New Product Suggestion</option>
                <option value="PRICE_CHANGE">Price Change Request</option>
                <option value="RECIPE_CHANGE">Recipe Modification</option>
                <option value="RESTOCK">Urgent Restock Request</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Detailed Explanation</label>
              <textarea
                rows="6"
                placeholder="Please describe why this change or addition is needed..."
                value={details}
                onChange={e => setDetails(e.target.value)}
              ></textarea>
            </div>

            <button type="submit" className="btn btn-primary">Submit Request</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RequestProduct;
