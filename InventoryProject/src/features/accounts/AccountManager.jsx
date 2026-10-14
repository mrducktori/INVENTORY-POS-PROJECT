import React, { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, updateUserStatus } from '../../api/usersApi';
import { getCurrentUser, logoutUser } from '../../api/authApi';


const AccountManager = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'Staff',
    supplier_id: ''
  });
  const [editingUserId, setEditingUserId] = useState(null);
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // 'save' or 'status'
  const [statusTarget, setStatusTarget] = useState(null);

  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    fetchUsers();
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { getSuppliers } = await import('../../api/purchasingApi.js');
      const data = await getSuppliers();
      setSuppliers(data || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    }
  };

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
    if (name === 'username') {
      setFormData({ ...formData, [name]: value.replace(/\s/g, '') });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setConfirmAction('save');
    setShowConfirmModal(true);
  };

  const executeSaveUser = async () => {
    setShowConfirmModal(false);
    try {
      if (editingUserId) {
        const updatedUser = await updateUser(editingUserId, formData);
        setMessage('User account updated successfully!');
        
        // If editing own account, update local storage
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.id === editingUserId) {
          localStorage.setItem('user', JSON.stringify({ ...currentUser, name: updatedUser.name, username: updatedUser.username, role: updatedUser.role }));
        }
      } else {
        await createUser(formData);
        setMessage('User account created successfully!');
      }

      if (formData.role === 'Owner' && (!editingUserId || formData.role !== users.find(u => u.id === editingUserId)?.role)) {
        // If they transferred ownership, demote them to Admin in local storage so the UI updates
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.role === 'Owner') {
          localStorage.setItem('user', JSON.stringify({ ...currentUser, role: 'Admin' }));
        }
        setTimeout(() => window.location.reload(), 1500);
      } else {
        handleCancelEdit();
        fetchUsers();
        setTimeout(() => setMessage(''), 3000);
      }
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

  const handleToggleStatusClick = (id, currentStatus) => {
    setStatusTarget({ id, currentStatus });
    setConfirmAction('status');
    setShowConfirmModal(true);
  };

  const executeToggleStatus = async () => {
    setShowConfirmModal(false);
    if (!statusTarget) return;
    
    try {
      const newStatus = statusTarget.currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await updateUserStatus(statusTarget.id, newStatus);
      fetchUsers();
    } catch (err) {
      setMessage('Error updating user status: ' + err.message);
      setTimeout(() => setMessage(''), 3000);
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                    value={formData.role} 
                    onChange={handleInputChange}
                    disabled={editingUserId === getCurrentUser()?.id && getCurrentUser()?.role === 'Owner'}
                  >
                    <option value="Staff">Staff</option>
                    <option value="Admin">Admin</option>
                    <option value="Supplier">Supplier</option>
                    {getCurrentUser()?.role === 'Owner' && <option value="Owner">Owner</option>}
                  </select>
                  {editingUserId === getCurrentUser()?.id && getCurrentUser()?.role === 'Owner' && (
                    <p className="text-xs text-gray-500 font-bold mt-1">You cannot demote yourself directly. You must assign the Owner role to another user first.</p>
                  )}
                  {formData.role === 'Owner' && formData.role !== users.find(u => u.id === editingUserId)?.role && (
                    <p className="text-sm text-red-600 font-bold mt-1">Warning: Assigning this role will transfer Ownership to this user and you will become an Admin.</p>
                  )}
                </div>
                
                {formData.role === 'Supplier' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-700">Link to Supplier</label>
                    <select 
                      name="supplier_id" 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer"
                      value={formData.supplier_id} 
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Select a Supplier</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
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
                              {!(u.role === 'Owner' && getCurrentUser()?.role !== 'Owner') ? (
                                <>
                                  <button 
                                    className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-xs md:text-sm font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors"
                                    onClick={() => handleEditClick(u)}
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    className={`px-3 py-1.5 rounded text-xs md:text-sm font-bold uppercase tracking-wider transition-colors border ${
                                      u.status === 'ACTIVE' 
                                        ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200' 
                                        : 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200'
                                    }`}
                                    onClick={() => handleToggleStatusClick(u.id, u.status)}
                                  >
                                    {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs md:text-sm text-gray-400 font-bold italic px-3 py-1.5">Owner Protected</span>
                              )}
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

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-sm shadow-2xl animate-[slideUp_0.3s_ease-out]">
            <div className="w-12 h-12 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mb-6">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="m-0 text-xl font-bold text-gray-900 mb-2">Confirm Action</h3>
            <p className="m-0 text-sm text-gray-500 mb-8">
              {confirmAction === 'save' 
                ? `Are you sure you want to ${editingUserId ? 'save changes to this' : 'create this new'} account? Please double-check the details.` 
                : `Are you sure you want to ${statusTarget?.currentStatus === 'ACTIVE' ? 'deactivate' : 'activate'} this user account?`}
            </p>
            <div className="flex gap-3 w-full">
              <button 
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-200 transition-colors"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button 
                className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors shadow-sm"
                onClick={confirmAction === 'save' ? executeSaveUser : executeToggleStatus}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AccountManager;
