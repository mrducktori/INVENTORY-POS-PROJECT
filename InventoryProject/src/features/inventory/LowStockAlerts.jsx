import React, { useState, useEffect } from 'react';
import { getLowStockAlerts } from '../../api/inventoryApi';


const LowStockAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');


  useEffect(() => {
    fetchLowStockAlerts();
    // Refresh every 30 seconds
    const interval = setInterval(fetchLowStockAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchLowStockAlerts = async () => {
    try {
      setLoading(true);
      const data = await getLowStockAlerts();
      setAlerts(data || []);
    } catch (err) {
      console.error('Error loading alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverity = (current, alert_level) => {
    if (current === 0) return 'critical';
    if (current <= alert_level * 0.5) return 'critical';
    if (current <= alert_level) return 'warning';
    return 'low';
  };

  const filteredAlerts = alerts.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );



  const getCriticalCount = () => alerts.filter(a => getSeverity(a.stock_quantity, a.low_stock_alert) === 'critical').length;
  const getWarningCount = () => alerts.filter(a => getSeverity(a.stock_quantity, a.low_stock_alert) === 'warning').length;

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Low Stock Alerts</h1>
          <p className="m-0 mt-1 text-sm text-gray-500 font-medium">Items running low on inventory</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Low Stock Items</div>
          <div className="text-3xl font-extrabold text-gray-900">{alerts.length}</div>
        </div>
        <div className="bg-white border border-red-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
          <div className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-2">Critical Alert</div>
          <div className="text-3xl font-extrabold text-red-700">
            {getCriticalCount()}
          </div>
        </div>
        <div className="bg-white border border-orange-200 p-6 rounded-xl shadow-sm flex flex-col justify-center">
          <div className="text-sm font-semibold text-orange-600 uppercase tracking-wider mb-2">Warning Level</div>
          <div className="text-3xl font-extrabold text-orange-700">
            {getWarningCount()}
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="p-4 mb-8 bg-orange-50 text-orange-800 border border-orange-200 rounded-xl text-sm font-bold flex items-center shadow-sm">
          {alerts.length} item(s) are below low stock threshold
        </div>
      )}

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full mb-8">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Low Stock Items</h2>
          <div className="flex w-full md:w-auto">
            <input 
              type="text" 
              placeholder="Search items..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
            />
          </div>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500 font-medium">Loading...</div>
          ) : filteredAlerts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Ingredient</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Unit</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Current Stock</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Alert Level</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Shortage</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAlerts.map(alert => {
                    const shortage = alert.low_stock_alert - alert.stock_quantity;
                    const severity = getSeverity(alert.stock_quantity, alert.low_stock_alert);

                    return (
                      <tr key={alert.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4"><strong className="text-sm font-bold text-gray-900">{alert.name}</strong></td>
                        <td className="px-6 py-4 text-sm text-gray-500 font-medium">{alert.unit}</td>
                        <td className="px-6 py-4 text-sm font-extrabold text-gray-900 text-right">{alert.stock_quantity}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-500 text-right">{alert.low_stock_alert}</td>
                        <td className="px-6 py-4 text-sm font-bold text-red-600 text-right">
                          -{shortage.toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            severity === 'critical' ? 'bg-red-50 text-red-700 border border-red-200' :
                            severity === 'warning' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                            'bg-yellow-50 text-yellow-700 border border-yellow-200'
                          }`}>
                            {severity === 'critical' ? 'CRITICAL' : severity === 'warning' ? 'WARNING' : 'LOW'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 flex flex-col items-center justify-center text-green-600 bg-green-50/50">
              <svg className="w-12 h-12 mb-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <p className="m-0 text-sm font-bold">All ingredients are at healthy stock levels!</p>
            </div>
          )}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Recommended Actions</h2>
          </div>
          <div className="p-6">
            <ul className="m-0 p-0 list-none space-y-3">
              {getCriticalCount() > 0 && (
                <li className="text-sm font-bold text-red-600 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-600"></span> ORDER IMMEDIATELY: {getCriticalCount()} item(s) at critical level
                </li>
              )}
              {getWarningCount() > 0 && (
                <li className="text-sm font-bold text-orange-600 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-600"></span> PLAN ORDER: {getWarningCount()} item(s) approaching critical level
                </li>
              )}
              {alerts.length > 2 && (
                <li className="text-sm font-medium text-blue-600 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span> Consider increasing order frequency
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default LowStockAlerts;
