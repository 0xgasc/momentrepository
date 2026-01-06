// src/hooks/useUpcomingShows.js
import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../components/Auth/AuthProvider';

export const useUpcomingShows = (token) => {
  const [shows, setShows] = useState({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchShows = useCallback(async (includePast = false) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/api/upcoming-shows?includesPast=${includePast}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch shows');
      }

      const data = await response.json();
      setShows({
        upcoming: data.upcoming || [],
        past: data.past || []
      });
    } catch (err) {
      console.error('Failed to fetch upcoming shows:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const createShow = useCallback(async (showData) => {
    if (!token) return { error: 'Login required' };

    try {
      const response = await fetch(`${API_BASE_URL}/api/upcoming-shows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(showData)
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || 'Failed to create show' };
      }

      await fetchShows(true);
      return { success: true };
    } catch (err) {
      return { error: 'Network error' };
    }
  }, [token, fetchShows]);

  const updateShow = useCallback(async (showId, showData) => {
    if (!token) return { error: 'Login required' };

    try {
      const response = await fetch(`${API_BASE_URL}/api/upcoming-shows/${showId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(showData)
      });

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || 'Failed to update show' };
      }

      await fetchShows(true);
      return { success: true };
    } catch (err) {
      return { error: 'Network error' };
    }
  }, [token, fetchShows]);

  const deleteShow = useCallback(async (showId) => {
    if (!token) return { error: 'Login required' };

    try {
      const response = await fetch(`${API_BASE_URL}/api/upcoming-shows/${showId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        return { error: 'Failed to delete show' };
      }

      await fetchShows(true);
      return { success: true };
    } catch (err) {
      return { error: 'Network error' };
    }
  }, [token, fetchShows]);

  return {
    shows,
    upcoming: shows.upcoming,
    past: shows.past,
    loading,
    error,
    fetchShows,
    createShow,
    updateShow,
    deleteShow
  };
};

export default useUpcomingShows;
