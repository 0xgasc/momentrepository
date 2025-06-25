// ===================================================================
// src/hooks/useMoments.js
// ===================================================================
import { useState, useCallback } from 'react';
import { createTimeoutSignal } from '../utils';

export const useMoments = (apiBaseUrl) => {
  const [momentCounts, setMomentCounts] = useState({});
  const [loadingMoments, setLoadingMoments] = useState(false);
  const [moments, setMoments] = useState([]);
  const [loadingMomentDetails, setLoadingMomentDetails] = useState(false);

  // Fetch moments utility
  const fetchMoments = useCallback(async (endpoint, errorContext = 'moments') => {
    try {
      const response = await fetch(`${apiBaseUrl}/moments/${endpoint}`, {
        signal: createTimeoutSignal(8000),
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.moments || [];
      } else {
        console.warn(`Failed to load ${errorContext}: ${response.status}`);
        return [];
      }
    } catch (err) {
      console.error(`Error loading ${errorContext}:`, err);
      return [];
    }
  }, [apiBaseUrl]);

  // Load moment counts for performances
  const loadMomentCounts = useCallback(async (performances) => {
    if (performances.length === 0) return;
    
    setLoadingMoments(true);
    const newMomentCounts = {};
    
    const batchSize = 10;
    for (let i = 0; i < performances.length; i += batchSize) {
      const batch = performances.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (performance) => {
        try {
          const moments = await fetchMoments(`performance/${performance.id}`, `performance ${performance.id}`);
          newMomentCounts[performance.id] = moments.length;
        } catch (err) {
          newMomentCounts[performance.id] = 0;
        }
      }));
      
      if (i + batchSize < performances.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    setMomentCounts(prev => ({ ...prev, ...newMomentCounts }));
    setLoadingMoments(false);
  }, [fetchMoments]);

  // Load detailed moments for a specific endpoint
  const loadMomentDetails = useCallback(async (endpoint, errorContext) => {
    setLoadingMomentDetails(true);
    try {
      const momentList = await fetchMoments(endpoint, errorContext);
      setMoments(momentList);
      return momentList;
    } catch (err) {
      console.error('Error loading moment details:', err);
      return [];
    } finally {
      setLoadingMomentDetails(false);
    }
  }, [fetchMoments]);

  // Get moment count for a specific performance
  const getMomentCount = useCallback((performanceId) => {
    return momentCounts[performanceId] || 0;
  }, [momentCounts]);

  // Get moments for a specific song
  const getSongMoments = useCallback((songName) => {
    return moments.filter(moment => moment.songName === songName);
  }, [moments]);

  return {
    momentCounts,
    loadingMoments,
    moments,
    loadingMomentDetails,
    fetchMoments,
    loadMomentCounts,
    loadMomentDetails,
    getMomentCount,
    getSongMoments
  };
};