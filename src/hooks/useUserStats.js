// src/hooks/useUserStats.js
import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../components/Auth/AuthProvider';

export const useUserStats = (userId) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/users/${userId}/stats`);

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch user stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { stats, loading, error, fetchStats };
};

export default useUserStats;
