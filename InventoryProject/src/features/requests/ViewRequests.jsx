import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getRequests, updateRequestStatus } from '../../api/requestsApi';
import Pagination from '../../components/shared/Pagination';
import RefreshButton from '../../components/shared/RefreshButton';

const ViewRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('PENDING');
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const totalPages = Math.max(1, Math.ceil(requests.length / itemsPerPage));
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return requests.slice(start, start + itemsPerPage);
  }, [requests, currentPage, itemsPerPage]);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getRequests({ status: filter === 'ALL' ? undefined : filter });
      setRequests(data || []);
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await updateRequestStatus(id, newStatus);
      fetchRequests();
      setError('');
    } catch (err) {
      setError('Error updating status: ' + err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Request Tracker</h1>
          <p className="m-0 mt-1 text-sm text-gray-500 font-medium">Review and approve staff requests for products and modifications.</p>
        </div>
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-sm font-bold">{error}</div>}

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full mb-8">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Staff Requests</h2>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm cursor-pointer flex-1 md:flex-none md:w-auto min-w-0"
            >
              <option value="ALL">All Requests</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <RefreshButton onRefresh={fetchRequests} loading={loading} className="shrink-0" />
          </div>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500 font-medium">Loading requests...</div>
          ) : requests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 whitespace-nowrap">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Requested By</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Details</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedRequests.map(req => {
                    const priority = req.details?.priority || 'NORMAL';
                    const subject = req.details?.product_name || req.details?.ingredient_name || 'General';
                    
                    return (
                      <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">
                          {new Date(req.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">{req.users?.name || 'Unknown'}</div>
                          <div className="text-xs text-gray-500 font-medium">{req.users?.role}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">{req.type.replace('_', ' ')}</div>
                          <div className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mt-1 border ${
                            priority === 'CRITICAL' || priority === 'HIGH' 
                              ? 'bg-red-50 text-red-700 border-red-200' 
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {priority}
                          </div>
                        </td>
                        <td className="px-6 py-4 min-w-[300px]">
                          <div className="text-sm font-bold text-gray-900 mb-1">{subject}</div>
                          <div className="text-xs text-gray-600 mb-3 whitespace-pre-wrap">{req.details?.description}</div>
                          
                          {req.type === 'NEW_PRODUCT' && req.details.new_product && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-medium text-gray-700">
                              <span className="font-bold text-gray-900 uppercase tracking-wider text-[10px] mr-2">Proposed:</span> 
                              ₱{req.details.new_product.price} | {req.details.new_product.category}
                            </div>
                          )}
                          {req.type === 'PRICE_CHANGE' && req.details.proposed_price && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-medium text-gray-700 flex items-center gap-2">
                              <span className="font-bold text-gray-900 uppercase tracking-wider text-[10px]">Price Change:</span> 
                              <span className="line-through text-gray-400">₱{req.details.old_price}</span> 
                              <svg className="w-3 h-3 text-zinc-400 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg> 
                              <span className="font-bold text-green-600">₱{req.details.proposed_price}</span>
                            </div>
                          )}
                          {req.type === 'RECIPE_CHANGE' && req.details.proposed_recipe && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-medium text-gray-700">
                              <div className="font-bold text-gray-900 uppercase tracking-wider text-[10px] mb-2">Proposed Recipe:</div>
                              <ul className="list-disc pl-4 m-0 flex flex-col gap-1">
                                {req.details.proposed_recipe.map((ing, idx) => (
                                  <li key={idx}><span className="font-bold text-gray-900">{ing.name}:</span> {ing.qty} {ing.unit}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            req.status === 'PENDING' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 
                            req.status === 'APPROVED' ? 'bg-green-50 text-green-700 border border-green-200' : 
                            'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {req.status === 'PENDING' && (
                            <div className="flex justify-end gap-2">
                              <button 
                                className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded text-xs font-bold uppercase tracking-wider transition-colors border border-green-200" 
                                onClick={() => handleUpdateStatus(req.id, 'APPROVED')}
                              >
                                Approve
                              </button>
                              <button 
                                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded text-xs font-bold uppercase tracking-wider transition-colors border border-red-200" 
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
            <div className="p-12 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
              <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <p className="m-0 text-sm font-medium">No requests found for this filter.</p>
            </div>
          )}

          {!loading && requests.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={requests.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(val) => {
                setItemsPerPage(val);
                setCurrentPage(1);
              }}
              itemsPerPageOptions={[10, 20, 50]}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewRequests;
