import React, { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, updateUserStatus } from '../../api/usersApi';

import './AccountManager.css';

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
  const [editingUserId, setEditingUserId] = useState(null);

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

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (editingUserId) {
        await updateUser(editingUserId, formData);
        setMessage('User account updated successfully!');
      } else {
        await createUser(formData);
        setMessage('User account created successfully!');
      }
      handleCancelEdit();
      fetchUsers();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Error ${editingUserId ? 'updating' : 'creating'} user: ` + err.message);
    }
  };

  const handleEditClick = (user) => {
    setEditingUserId(user.id);
    setFormData({
      name: user.name,
      username: user.username,
      password: '', // Blank empty for update
      role: user.role
    });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setFormData({ name: '', username: '', password: '', role: 'Staff' });
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
            <h2>{editingUserId ? 'Edit Account' : 'Create New Account'}</h2>
          </div>
          <div className="card-body">
            {message && (
              <div className={`alert ${message.includes('success') ? 'alert-success' : 'alert-error'}`}>
                {message}
              </div>
            )}
            <form onSubmit={handleSaveUser}>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Username</label>
                <input type="text" name="username" value={formData.username} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Password {editingUserId && '(Leave blank to keep current)'}</label>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange} required={!editingUserId} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select name="role" value={formData.role} onChange={handleInputChange}>
                  <option value="Staff">Staff</option>
                  <option value="Admin">Admin</option>
                  <option value="Owner">Owner</option>
                </select>
              </div>
                <button type="submit" className="btn btn-primary" style={{ width: editingUserId ? '48%' : '100%' }}>
                  {editingUserId ? 'Save Changes' : 'Create Account'}
                </button>
                {editingUserId && (
                  <button type="button" className="btn btn-secondary" style={{ width: '48%', float: 'right' }} onClick={handleCancelEdit}>
                    Cancel
                  </button>
                )}
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
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button 
                              className="btn btn-small btn-secondary"
                              onClick={() => handleEditClick(u)}
                            >
                              Edit
                            </button>
                            <button 
                              className={`btn btn-small ${u.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'}`}
                              onClick={() => handleToggleStatus(u.id, u.status)}
                            >
                              {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
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
