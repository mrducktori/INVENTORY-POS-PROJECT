import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../api/logsApi';
import '../styles/Inventory.css';
import '../styles/AuditLogs.css';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    actionType: ''
  });

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await getAuditLogs(filters);
      setLogs(data);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Audit Logs</h1>
        <p>Track administrative and staff activities across the system.</p>
      </div>

      <div className="audit-controls">
        <div className="form-group audit-form-group">
          <label>Start Date</label>
          <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} />
        </div>
        <div className="form-group audit-form-group">
          <label>End Date</label>
          <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} />
        </div>
        <div className="form-group audit-form-group">
          <label>Action Type</label>
          <select name="actionType" value={filters.actionType} onChange={handleFilterChange}>
            <option value="">All Actions</option>
            <option value="SALE">SALE</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="REFUND">REFUND</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Staff</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="audit-table-loading">Loading logs...</td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map(log => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.users?.name || 'System'}</td>
                    <td><span className="badge audit-badge-dark">{log.action_type || log.action}</span></td>
                    <td>{log.entity_type ? `${log.entity_type} #${log.entity_id || ''}` : 'N/A'}</td>
                    <td>{log.details || JSON.stringify(log.new_value)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty-state">No audit logs found for the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
