import React, { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, updateUserStatus } from '../../api/usersApi';


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
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Account Management</h1>
          <p className="m-0 mt-1 text-sm text-gray-500 font-medium">Create and manage system user accounts and roles.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-1/3">
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">{editingUserId ? 'Edit Account' : 'Create New Account'}</h2>
            </div>
            <div className="p-6">
              {message && (
                <div className={`p-4 mb-6 rounded-xl text-sm font-bold flex items-center shadow-sm border ${
                  message.includes('success') 
                    ? 'bg-green-50 text-green-800 border-green-200' 
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  {message}
                </div>
              )}
              <form onSubmit={handleSaveUser} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-700">Full Name</label>
                  <input 
                    type="text" 
                    name="name" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                    value={formData.name} 
                    onChange={handleInputChange} 
                    required 
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-700">Username</label>
                  <input 
                    type="text" 
                    name="username" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                    value={formData.username} 
                    onChange={handleInputChange} 
                    required 
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-700">Password {editingUserId && <span className="text-gray-400 font-medium">(Leave blank to keep current)</span>}</label>
                  <input 
                    type="password" 
                    name="password" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                    value={formData.password} 
                    onChange={handleInputChange} 
                    required={!editingUserId} 
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-700">Role</label>
                  <select 
                    name="role" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
                    value={formData.role} 
                    onChange={handleInputChange}
                  >
                    <option value="Staff">Staff</option>
                    <option value="Admin">Admin</option>
                    <option value="Owner">Owner</option>
                  </select>
                </div>
                
                <div className="flex gap-3 mt-2">
                  <button 
                    type="submit" 
                    className="flex-1 px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors shadow-sm"
                  >
                    {editingUserId ? 'Save Changes' : 'Create Account'}
                  </button>
                  {editingUserId && (
                    <button 
                      type="button" 
                      className="flex-1 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors shadow-sm" 
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="lg:w-2/3">
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full h-full flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Active Users</h2>
            </div>
            <div className="p-0 flex-1">
              {loading ? (
                <div className="p-8 text-center text-gray-500 font-medium">Loading users...</div>
              ) : users.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Username</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4"><strong className="text-sm font-bold text-gray-900">{u.name}</strong></td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-600">{u.username}</td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded">{u.role}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              u.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {u.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors"
                                onClick={() => handleEditClick(u)}
                              >
                                Edit
                              </button>
                              <button 
                                className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors border ${
                                  u.status === 'ACTIVE' 
                                    ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200' 
                                    : 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200'
                                }`}
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
                <div className="p-12 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 h-full">
                  <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                  <p className="m-0 text-sm font-medium">No user accounts found.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountManager;
