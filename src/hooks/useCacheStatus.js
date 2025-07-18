// ===================================================================
// src/hooks/useCacheStatus.js
// ===================================================================
import { useState, useEffect, useCallback } from 'react';
import { getCacheStatus, refreshCache } from '../utils';

export const useCacheStatus = (apiBaseUrl) => {
  const [cacheStatus, setCacheStatus] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState(null);

  // Load cache status
  const loadCacheStatus = useCallback(async () => {
    try {
      const status = await getCacheStatus(apiBaseUrl);
      setCacheStatus(status);
    } catch (err) {
      console.error('Error checking cache status:', err);
    }
  }, [apiBaseUrl]);

  // Check refresh status
  const checkRefreshStatus = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/cache/refresh/status`);
      if (response.ok) {
        const data = await response.json();
        setRefreshStatus(data.refreshStatus);
        setCacheStatus(data.cacheStats);
      }
    } catch (err) {
      console.error('Error checking refresh status:', err);
    }
  }, [apiBaseUrl]);

  // Handle cache refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshCache(apiBaseUrl);
      
      // Poll for status updates
      const pollStatus = async () => {
        await checkRefreshStatus();
        if (refreshStatus?.inProgress) {
          setTimeout(pollStatus, 2000); // Check every 2 seconds
        } else {
          setRefreshing(false);
        }
      };
      
      setTimeout(pollStatus, 1000); // Start polling after 1 second
      
    } catch (err) {
      console.error('Refresh failed:', err);
      setRefreshing(false);
    }
  }, [apiBaseUrl, refreshStatus, checkRefreshStatus]);

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
    refreshStatus,
    shouldShow,
    handleRefresh,
    toggleDetails,
    loadCacheStatus,
    checkRefreshStatus
  };
};