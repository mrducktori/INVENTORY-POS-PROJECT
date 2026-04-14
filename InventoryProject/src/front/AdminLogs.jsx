import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../api/auditApi';
import '../styles/Inventory.css';

const AdminLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [filterAction]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await getAuditLogs({ action: filterAction });
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Admin Logs</h1>
        <p>Comprehensive audit trail of all administrative actions and system modifications.</p>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>System Audit Trail</h2>
          <input
            type="text"
            placeholder="Search action..."
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '3px', border: 'none', fontSize: '12px', width: '200px' }}
          />
        </div>
        <div className="card-body">
          {loading ? (
            <p>Loading records...</p>
          ) : logs.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td>
                        <strong>{log.users?.name || 'Unknown'}</strong><br/>
                        <span style={{ fontSize: '11px', color: '#666' }}>({log.users?.role || 'System'})</span>
                      </td>
                      <td>
                        <span className="status normal">{log.action}</span>
                      </td>
                      <td style={{ color: '#555', maxWidth: '300px', wordWrap: 'break-word' }}>
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No audit logs found matching criteria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLogs;
