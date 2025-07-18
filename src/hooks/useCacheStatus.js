// ===================================================================
// src/hooks/useCacheStatus.js
// ===================================================================
import { useState, useEffect, useCallback } from 'react';
import { getCacheStatus, refreshCache } from '../utils';

export const useCacheStatus = (apiBaseUrl) => {
  const [cacheStatus, setCacheStatus] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load cache status
  const loadCacheStatus = useCallback(async () => {
    try {
      const status = await getCacheStatus(apiBaseUrl);
      setCacheStatus(status);
    } catch (err) {
      console.error('Error checking cache status:', err);
    }
  }, [apiBaseUrl]);

  // Handle cache refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshCache(apiBaseUrl);
      setTimeout(async () => {
        const status = await getCacheStatus(apiBaseUrl);
        setCacheStatus(status);
        setRefreshing(false);
      }, 2000);
    } catch (err) {
      console.error('Refresh failed:', err);
      setRefreshing(false);
    }
  }, [apiBaseUrl]);

  // Toggle details visibility
  const toggleDetails = useCallback(() => {
    setShowDetails(prev => !prev);
  }, []);

  // Check if should show cache status - now returns false by default
  // Cache status will only be shown in Admin Panel
  const shouldShow = false;

  useEffect(() => {
    loadCacheStatus();
  }, [loadCacheStatus]);

  return {
    cacheStatus,
    showDetails,
    refreshing,
    shouldShow,
    handleRefresh,
    toggleDetails,
    loadCacheStatus
  };
};