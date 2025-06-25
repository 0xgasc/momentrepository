// src/components/Cache/CacheStatusDisplay.jsx
import React, { memo } from 'react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import { useCacheStatus } from '../../hooks';

const CacheStatusDisplay = memo(() => {
  const { 
    cacheStatus, 
    showDetails, 
    refreshing, 
    shouldShow, 
    handleRefresh, 
    toggleDetails 
  } = useCacheStatus(API_BASE_URL);

  if (!shouldShow) return null;

  return (
    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="text-blue-600 mr-3">📊</div>
          <div>
            <div className="font-medium text-blue-900">
              {!cacheStatus.hasCache ? 'Building UMO Database...' : 'Cache Update Available'}
            </div>
            <div className="text-sm text-blue-700">
              {!cacheStatus.hasCache 
                ? 'First-time setup: Loading all UMO performance data'
                : `Last updated: ${cacheStatus.lastUpdated ? new Date(cacheStatus.lastUpdated).toLocaleDateString() : 'Unknown'}`
              }
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDetails}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            {showDetails ? 'Hide' : 'Details'}
          </button>
          {cacheStatus.hasCache && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>
      </div>
      
      {showDetails && cacheStatus.stats && (
        <div className="mt-3 pt-3 border-t border-blue-200 text-sm text-blue-700">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>Performances: {cacheStatus.stats.totalPerformances || 0}</div>
            <div>Songs: {cacheStatus.stats.totalSongs || 0}</div>
            <div>API Calls Used: {cacheStatus.stats.apiCallsUsed || 0}</div>
            <div>Date Range: {cacheStatus.stats.dateRange?.earliest} - {cacheStatus.stats.dateRange?.latest}</div>
          </div>
        </div>
      )}
    </div>
  );
});

CacheStatusDisplay.displayName = 'CacheStatusDisplay';

export default CacheStatusDisplay;