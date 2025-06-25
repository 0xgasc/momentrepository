// src/components/Performance/PerformanceList.jsx
import React, { useEffect, memo } from 'react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import { usePerformances, useMoments } from '../../hooks';
import { formatShortDate } from '../../utils';

const PerformanceList = memo(({ onPerformanceSelect }) => {
  const {
    displayedPerformances,
    loading,
    loadingMore,
    searching,
    error,
    hasMore,
    citySearch,
    isSearchMode,
    loadInitialPerformances,
    loadMorePerformances,
    clearSearch,
    handleSearchChange
  } = usePerformances(API_BASE_URL);

  const { 
    momentCounts, 
    loadingMoments, 
    loadMomentCounts 
  } = useMoments(API_BASE_URL);

  // Load moment counts when performances change
  useEffect(() => {
    if (displayedPerformances.length > 0 && !loading && !searching) {
      const performancesToLoad = displayedPerformances.filter(p => !(p.id in momentCounts));
      if (performancesToLoad.length > 0) {
        loadMomentCounts(performancesToLoad);
      }
    }
  }, [displayedPerformances, loading, searching, momentCounts, loadMomentCounts]);

  if (loading) {
    return <LoadingState />;
  }

  if (error && !displayedPerformances.length) {
    return <ErrorState error={error} onRetry={loadInitialPerformances} />;
  }

  return (
    <div className="mb-8">
      {/* Header with Search */}
      <PerformanceHeader 
        citySearch={citySearch}
        searching={searching}
        onSearchChange={handleSearchChange}
        onClearSearch={clearSearch}
        loadingMoments={loadingMoments}
        isSearchMode={isSearchMode}
        resultCount={displayedPerformances.length}
      />
      
      {/* Performance Grid */}
      <PerformanceGrid 
        performances={displayedPerformances}
        momentCounts={momentCounts}
        onPerformanceSelect={onPerformanceSelect}
      />
      
      {/* No Results */}
      {displayedPerformances.length === 0 && !loading && !searching && (
        <NoResultsState 
          isSearchMode={isSearchMode}
          searchQuery={citySearch}
          onClearSearch={clearSearch}
        />
      )}
      
      {/* Load More Button */}
      {hasMore && !isSearchMode && !searching && (
        <LoadMoreButton 
          loading={loadingMore}
          onClick={loadMorePerformances}
        />
      )}
    </div>
  );
});

PerformanceList.displayName = 'PerformanceList';

// Sub-components for better organization
const LoadingState = memo(() => (
  <div className="mb-8">
    <h3 className="text-xl font-bold mb-4">Latest Performances</h3>
    <div className="text-center py-8">
      <div className="inline-flex items-center text-gray-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
        Loading performances...
      </div>
    </div>
  </div>
));

LoadingState.displayName = 'LoadingState';

const ErrorState = memo(({ error, onRetry }) => (
  <div className="mb-8">
    <h3 className="text-xl font-bold mb-4">Latest Performances</h3>
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
      <p className="mb-2">⚠️ {error}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
      >
        Retry
      </button>
    </div>
  </div>
));

ErrorState.displayName = 'ErrorState';

const PerformanceHeader = memo(({ 
  citySearch, 
  searching, 
  onSearchChange, 
  onClearSearch,
  loadingMoments,
  isSearchMode,
  resultCount
}) => (
  <>
    {/* Header with Search */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <div>
        <h3 className="text-xl font-bold">Latest Performances</h3>
      </div>
      
      <div className="relative w-full sm:w-80">
        <input
          type="text"
          value={citySearch}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search all UMO shows by city or venue..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="absolute right-3 top-2 flex items-center gap-1">
          {searching && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          )}
          {citySearch && (
            <button
              onClick={onClearSearch}
              className="text-gray-400 hover:text-gray-600 ml-1"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>

    {/* Loading moments indicator */}
    {loadingMoments && (
      <div className="mb-4 text-sm text-blue-600 flex items-center">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
        Loading moment counts...
      </div>
    )}

    {/* Search results info */}
    {isSearchMode && (
      <div className="mb-4 text-sm">
        {searching ? (
          <div className="flex items-center text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span>Searching for "{citySearch}"...</span>
          </div>
        ) : (
          <div className="text-blue-600">
            Found {resultCount} performances matching "{citySearch}"
          </div>
        )}
      </div>
    )}
  </>
));

PerformanceHeader.displayName = 'PerformanceHeader';

const PerformanceGrid = memo(({ performances, momentCounts, onPerformanceSelect }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {performances.map((setlist) => (
      <PerformanceCard 
        key={setlist.id}
        setlist={setlist}
        momentCount={momentCounts[setlist.id] || 0}
        onSelect={() => onPerformanceSelect(setlist)}
      />
    ))}
  </div>
));

PerformanceGrid.displayName = 'PerformanceGrid';

const PerformanceCard = memo(({ setlist, momentCount, onSelect }) => {
  const songCount = setlist.sets?.set?.reduce((total, set) => total + (set.song?.length || 0), 0) || 0;
  
  return (
    <button
      onClick={onSelect}
      className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 hover:border-blue-300 text-left group"
    >
      <div className="font-medium text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
        {setlist.venue.name}
      </div>
      <div className="text-sm text-gray-600 mb-1">
        {setlist.venue.city.name}
        {setlist.venue.city.country && (
          <span className="text-gray-500">, {setlist.venue.city.country.name}</span>
        )}
      </div>
      <div className="text-sm text-blue-600 font-medium mb-2">
        {formatShortDate(setlist.eventDate)}
      </div>
      
      <div className="space-y-1">
        <div className="text-xs text-gray-500">
          {songCount} song{songCount !== 1 ? 's' : ''}
        </div>
        {momentCount > 0 ? (
          <div className="text-xs text-green-600 font-medium">
            {momentCount} moment{momentCount !== 1 ? 's' : ''} uploaded
          </div>
        ) : (
          <div className="text-xs text-gray-400">
            No moments yet
          </div>
        )}
      </div>
    </button>
  );
});

PerformanceCard.displayName = 'PerformanceCard';

const NoResultsState = memo(({ isSearchMode, searchQuery, onClearSearch }) => (
  <div className="text-center py-12 text-gray-500">
    {isSearchMode ? (
      <>
        No performances found matching "{searchQuery}"
        <br />
        <button
          onClick={onClearSearch}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Show all performances
        </button>
      </>
    ) : (
      'No performances available'
    )}
  </div>
));

NoResultsState.displayName = 'NoResultsState';

const LoadMoreButton = memo(({ loading, onClick }) => (
  <div className="text-center mt-8">
    <button
      onClick={onClick}
      disabled={loading}
      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Loading more...
        </div>
      ) : (
        'Load More Performances'
      )}
    </button>
  </div>
));

LoadMoreButton.displayName = 'LoadMoreButton';

export default PerformanceList;