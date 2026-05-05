import { useState, useEffect } from 'react';
import { getDemandForecast } from '../api/analyticsApi';

/**
 * Hook to fetch demand forecast for products.
 * Uses real historical data processed by the backend.
 */
export const useDemandForecast = (productId = null) => {
  const [forecast, setForecast] = useState(null);
  const [allForecasts, setAllForecasts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        setLoading(true);
        const data = await getDemandForecast();
        setAllForecasts(data || []);
        
        if (productId) {
          const item = data.find(f => f.id === productId);
          setForecast(item || null);
        }
      } catch (err) {
        console.error("Failed to fetch demand forecast:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
  }, [productId]);

  return { forecast, allForecasts, loading };
};
