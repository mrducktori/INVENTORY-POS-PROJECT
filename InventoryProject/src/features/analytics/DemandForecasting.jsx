import React, { useState, useEffect } from 'react';
import { getDemandForecast } from '../../api/analyticsApi';

const DemandForecasting = () => {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchForecasts();
  }, []);

  const fetchForecasts = async () => {
    try {
      setLoading(true);
      const data = await getDemandForecast();
      setForecasts(data || []);
    } catch (err) {
      console.error("Failed to fetch forecasts:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-extrabold text-gray-900 tracking-tight">Demand Forecasting</h1>
        <p className="m-0 text-sm text-gray-500 font-medium">Advanced predictive analytics for your product inventory.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 border-t-4 border-t-blue-500">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Forecast Accuracy</div>
          <div className="text-2xl font-extrabold text-gray-900 mb-1">92%</div>
        </div>
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 border-t-4 border-t-green-500">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">High Growth Items</div>
          <div className="text-2xl font-extrabold text-gray-900 mb-1">
            {forecasts.filter(f => parseFloat(f.growthRate) > 5).length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 border-t-4 border-t-gray-900">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Analysis Period</div>
          <div className="text-2xl font-extrabold text-gray-900 mb-1">30 Days</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Product Demand Predictions (Next 7 Days)</h2>
          <button 
            className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" 
            onClick={fetchForecasts} 
            disabled={loading}
          >
            {loading ? 'Analyzing...' : 'Refresh Forecast'}
          </button>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-gray-500 bg-white border border-gray-200 border-dashed rounded-b-xl h-64 animate-pulse">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4"></div>
              <p className="m-0 font-medium">Generating predictions using historical sales data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Daily Avg</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">7-Day Forecast</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Growth</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[150px]">Confidence</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {forecasts.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{item.name}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold font-mono text-gray-900 text-right">{item.avgDailySales}</td>
                      <td className="px-6 py-4 text-sm font-extrabold font-mono text-blue-700 text-right">{item.predictedNext7Days} units</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 font-bold font-mono text-xs ${parseFloat(item.growthRate) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseFloat(item.growthRate) >= 0 ? '↑' : '↓'} {Math.abs(item.growthRate)}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${item.confidence >= 90 ? 'bg-green-500' : item.confidence >= 70 ? 'bg-blue-500' : 'bg-orange-500'}`} 
                              style={{ width: `${item.confidence}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-gray-600 w-8 text-right">{item.confidence}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${item.stockoutRisk === 'Low' ? 'bg-green-50 text-green-700 border-green-200' : item.stockoutRisk === 'Medium' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {item.stockoutRisk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden mt-6">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Forecasting Methodology</h2>
        </div>
        <div className="p-6">
          <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm leading-relaxed border border-blue-100">
            Our demand forecasting engine analyzes transaction history from the last 30 days to identify sales patterns, 
            day-of-week trends, and growth trajectories. The "7-Day Forecast" predicts total units required for the coming week, 
            helping you optimize stock levels and reduce wastage.
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemandForecasting;
