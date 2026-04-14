import React, { useState, useEffect } from 'react';
import { getRequests, updateRequestStatus } from '../api/requestsApi';
import '../styles/Inventory.css';

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
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Staff Requests</h2>
          <select 
            value={filter} 
            onChange={e => setFilter(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '3px', background: 'white', color: 'black', border: 'none' }}
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
                  {requests.map(req => (
                    <tr key={req.id}>
                      <td>{new Date(req.created_at).toLocaleDateString()}</td>
                      <td>{req.users?.name || 'Unknown'}</td>
                      <td><strong>{req.type.replace('_', ' ')}</strong></td>
                      <td>{req.details?.description || JSON.stringify(req.details)}</td>
                      <td>
                        <span className={`status ${req.status === 'PENDING' ? 'low' : req.status === 'APPROVED' ? 'normal' : 'critical'}`}>
                          {req.status}
                        </span>
                      </td>
                      <td>
                        {req.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: '5px' }}>
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
                  ))}
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
