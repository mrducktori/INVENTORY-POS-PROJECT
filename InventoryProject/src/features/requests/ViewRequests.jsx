import React, { useState, useEffect } from 'react';
import { getRequests, updateRequestStatus } from '../../api/requestsApi';

import './ViewRequests.css';

const ViewRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('PENDING');

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await getRequests({ status: filter === 'ALL' ? undefined : filter });
      setRequests(data || []);
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await updateRequestStatus(id, newStatus);
      fetchRequests();
    } catch (err) {
      alert('Error updating status: ' + err.message);
    }
  };

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Request Tracker</h1>
        <p>Review and approve staff requests for products and modifications.</p>
      </div>

      <div className="card">
        <div className="card-header requests-header">
          <h2>Staff Requests</h2>
          <select 
            value={filter} 
            onChange={e => setFilter(e.target.value)}
            className="requests-filter"
          >
            <option value="ALL">All Requests</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div className="card-body">
          {loading ? (
            <p>Loading...</p>
          ) : requests.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Requested By</th>
                    <th>Type</th>
                    <th>Details</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                    {requests.map(req => {
                      const priority = req.details?.priority || 'NORMAL';
                      const subject = req.details?.product_name || req.details?.ingredient_name || 'General';
                      
                      return (
                        <tr key={req.id}>
                          <td>{new Date(req.created_at).toLocaleDateString()}</td>
                          <td>
                            <div><strong>{req.users?.name || 'Unknown'}</strong></div>
                            <div style={{fontSize: '11px', color: '#666'}}>{req.users?.role}</div>
                          </td>
                          <td>
                            <strong>{req.type.replace('_', ' ')}</strong>
                            <div className={`badge ${priority === 'CRITICAL' || priority === 'HIGH' ? 'critical' : 'info'}`} style={{fontSize: '10px', marginTop: '4px'}}>
                              {priority}
                            </div>
                          </td>
                          <td>
                            <div style={{fontWeight: '600'}}>{subject}</div>
                            <div style={{fontSize: '12px', color: '#444', marginBottom: '8px'}}>{req.details?.description}</div>
                            
                            {/* Structured Proposals */}
                            {req.type === 'NEW_PRODUCT' && req.details.new_product && (
                              <div className="proposal-box">
                                <span className="proposal-label">Proposed:</span> 
                                ₱{req.details.new_product.price} | {req.details.new_product.category}
                              </div>
                            )}
                            {req.type === 'PRICE_CHANGE' && req.details.proposed_price && (
                              <div className="proposal-box">
                                <span className="proposal-label">Price Change:</span> 
                                <span className="old-value">₱{req.details.old_price}</span> → 
                                <span className="new-value">₱{req.details.proposed_price}</span>
                              </div>
                            )}
                            {req.type === 'RECIPE_CHANGE' && req.details.proposed_recipe && (
                              <div className="proposal-box">
                                <span className="proposal-label">Proposed Recipe:</span>
                                <ul style={{margin: '4px 0', paddingLeft: '16px', fontSize: '11px'}}>
                                  {req.details.proposed_recipe.map((ing, idx) => (
                                    <li key={idx}>{ing.name}: {ing.qty} {ing.unit}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </td>

                          <td>
                            <span className={`status ${req.status === 'PENDING' ? 'low' : req.status === 'APPROVED' ? 'normal' : 'critical'}`}>
                              {req.status}
                            </span>
                          </td>
                          <td>
                            {req.status === 'PENDING' && (
                              <div className="requests-action-group">
                                <button 
                                  className="btn btn-small btn-success" 
                                  onClick={() => handleUpdateStatus(req.id, 'APPROVED')}
                                >
                                  Approve
                                </button>
                                <button 
                                  className="btn btn-small btn-danger" 
                                  onClick={() => handleUpdateStatus(req.id, 'REJECTED')}
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No requests found for this filter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewRequests;
