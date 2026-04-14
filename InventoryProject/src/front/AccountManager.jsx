import React, { useState, useEffect } from 'react';
import { getUsers, createUser, updateUserStatus } from '../api/usersApi';
import '../styles/Inventory.css';

const AccountManager = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'Staff'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await createUser(formData);
      setMessage('User account created successfully!');
      setFormData({ name: '', username: '', password: '', role: 'Staff' });
      fetchUsers();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error creating user: ' + err.message);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await updateUserStatus(id, newStatus);
      fetchUsers();
    } catch (err) {
      alert('Error updating user status: ' + err.message);
    }
  };

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Account Management</h1>
        <p>Create and manage system user accounts and roles.</p>
      </div>

      <div className="form-row">
        <div className="card">
          <div className="card-header">
            <h2>Create New Account</h2>
          </div>
          <div className="card-body">
            {message && (
              <div className={`alert ${message.includes('success') ? 'alert-success' : 'alert-error'}`}>
                {message}
              </div>
            )}
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Username</label>
                <input type="text" name="username" value={formData.username} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select name="role" value={formData.role} onChange={handleInputChange}>
                  <option value="Staff">Staff</option>
                  <option value="Admin">Admin</option>
                  <option value="Owner">Owner</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Create Account
              </button>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Active Users</h2>
          </div>
          <div className="card-body">
            {loading ? (
              <p>Loading users...</p>
            ) : users.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td><strong>{u.name}</strong></td>
                        <td>{u.username}</td>
                        <td>{u.role}</td>
                        <td>
                          <span className={`status ${u.status === 'ACTIVE' ? 'normal' : 'critical'}`}>
                            {u.status}
                          </span>
                        </td>
                        <td>
                          <button 
                            className={`btn btn-small ${u.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'}`}
                            onClick={() => handleToggleStatus(u.id, u.status)}
                          >
                            {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>No user accounts found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountManager;
