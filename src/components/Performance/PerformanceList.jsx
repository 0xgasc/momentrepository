// src/components/Performance/PerformanceList.jsx
import React, { useEffect, memo, useMemo } from 'react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import { usePerformances, useMoments } from '../../hooks';
import { formatShortDate } from '../../utils';
import PullToRefresh from '../UI/PullToRefresh';

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
    showOnlyWithMoments,
    loadInitialPerformances,
    loadMorePerformances,
    clearSearch,
    handleSearchChange,
    setShowOnlyWithMoments
  } = usePerformances(API_BASE_URL);

  const { 
    momentCounts, 
    loadingMoments, 
    loadMomentCounts 
  } = useMoments(API_BASE_URL);

  // Filter performances based on moments toggle
  const filteredPerformances = useMemo(() => {
    if (!showOnlyWithMoments) {
      return displayedPerformances;
    }
    
    // Filter to only show performances that have moments
    return displayedPerformances.filter(performance => {
      const count = momentCounts[performance.id];
      return count && count > 0;
    });
  }, [displayedPerformances, showOnlyWithMoments, momentCounts]);

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

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    // Add a small delay to show the refresh animation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Clear search and reload initial performances
    clearSearch();
    return loadInitialPerformances();
  };

  return (
    <PullToRefresh 
      onRefresh={handleRefresh}
      pullText="Pull down to refresh performances"
      releaseText="Release to refresh performances"
      refreshingText="Loading latest performances..."
    >
      <div className="mb-8">
      {/* Header with Search */}
      <PerformanceHeader 
        citySearch={citySearch}
        searching={searching}
        onSearchChange={handleSearchChange}
        onClearSearch={clearSearch}
        loadingMoments={loadingMoments}
        isSearchMode={isSearchMode}
        resultCount={filteredPerformances.length}
        totalCount={displayedPerformances.length}
        showOnlyWithMoments={showOnlyWithMoments}
        onToggleMomentsFilter={setShowOnlyWithMoments}
      />
      
      {/* Performance Grid */}
      <PerformanceGrid 
        performances={filteredPerformances}
        momentCounts={momentCounts}
        onPerformanceSelect={onPerformanceSelect}
      />
      
      {/* No Results */}
      {filteredPerformances.length === 0 && !loading && !searching && (
        <NoResultsState 
          isSearchMode={isSearchMode}
          searchQuery={citySearch}
          onClearSearch={clearSearch}
        />
      )}
      
      {/* Load More Button - NOW WORKS FOR SEARCH TOO! */}
      {hasMore && !searching && (
        <LoadMoreButton 
          loading={loadingMore}
          onClick={loadMorePerformances}
          isSearchMode={isSearchMode}
          searchQuery={citySearch}
        />
      )}
      </div>
    </PullToRefresh>
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
  resultCount,
  totalCount,
  showOnlyWithMoments,
  onToggleMomentsFilter
}) => (
  <>
    {/* Header with Search */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <div>
        <h3 className="text-xl font-bold">Latest Performances</h3>
      </div>
      
      <div className="relative w-full sm:w-96">
        <input
          type="text"
          value={citySearch}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by city, venue, song name, or year..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 search-input"
          style={{ minHeight: '48px', fontSize: '16px' }} // Prevents zoom on iOS
        />
        <div className="absolute right-3 top-2 flex items-center gap-1">
          {searching && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          )}
          {citySearch && (
            <button
              onClick={onClearSearch}
              className="text-gray-400 hover:text-gray-600 ml-1 mobile-touch-target"
              style={{ minWidth: '32px', minHeight: '32px', padding: '6px', fontSize: '18px' }}
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

    {/* Moments filter toggle */}
    <div className="mb-4 flex items-center justify-end">
      <label className="flex items-center cursor-pointer mobile-touch-target" style={{ minHeight: '44px', padding: '8px' }}>
        <input
          type="checkbox"
          checked={showOnlyWithMoments}
          onChange={(e) => onToggleMomentsFilter(e.target.checked)}
          className="mr-3"
          style={{ minWidth: '20px', minHeight: '20px' }}
        />
        <span className="text-sm text-gray-700">With moments only</span>
      </label>
    </div>
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
      className="performance-card mobile-touch-target"
      style={{
        padding: '1rem',
        minHeight: '80px', // Mobile-friendly touch target
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderRadius: '12px',
        border: '1px solid rgba(64, 64, 64, 0.3)',
        textAlign: 'left',
        width: '100%',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(184, 134, 11, 0.03)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center'
      }}
      onMouseEnter={(e) => {
        e.target.style.transform = 'translateY(-2px)';
        e.target.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(184, 134, 11, 0.08)';
        e.target.style.borderColor = 'rgba(100, 100, 100, 0.5)';
      }}
      onMouseLeave={(e) => {
        e.target.style.transform = 'translateY(0)';
        e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(184, 134, 11, 0.03)';
        e.target.style.borderColor = 'rgba(64, 64, 64, 0.3)';
      }}
    >
      <div style={{
        fontWeight: '600',
        color: 'rgba(245, 245, 220, 0.95)',
        marginBottom: '0.5rem',
        fontSize: '1rem',
        lineHeight: '1.4'
      }}>
        {setlist.venue.name}
      </div>
      <div style={{
        fontSize: '0.875rem',
        color: 'rgba(245, 245, 220, 0.8)',
        marginBottom: '0.25rem'
      }}>
        {setlist.venue.city.name}
        {setlist.venue.city.country && (
          <span style={{ color: 'rgba(245, 245, 220, 0.6)' }}>, {setlist.venue.city.country.name}</span>
        )}
      </div>
      <div style={{
        fontSize: '0.875rem',
        color: 'rgba(160, 160, 160, 0.9)',
        fontWeight: '500',
        marginBottom: '0.5rem'
      }}>
        {formatShortDate(setlist.eventDate)}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{
          fontSize: '0.75rem',
          color: 'rgba(245, 245, 220, 0.7)'
        }}>
          {songCount} song{songCount !== 1 ? 's' : ''}
        </div>
        {momentCount > 0 ? (
          <div style={{
            fontSize: '0.75rem',
            color: 'rgba(16, 185, 129, 0.9)',
            fontWeight: '500'
          }}>
            {momentCount} moment{momentCount !== 1 ? 's' : ''} uploaded
          </div>
        ) : (
          <div style={{
            fontSize: '0.75rem',
            color: 'rgba(245, 245, 220, 0.5)'
          }}>
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

const LoadMoreButton = memo(({ loading, onClick, isSearchMode, searchQuery }) => (
  <div className="text-center mt-8">
    <button
      onClick={onClick}
      disabled={loading}
      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mobile-touch-target"
      style={{ minHeight: '48px', minWidth: '200px' }}
    >
      {loading ? (
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Loading more...
        </div>
      ) : (
        isSearchMode ? `Load More Results for "${searchQuery}"` : 'Load More Performances'
      )}
    </button>
  </div>
));

LoadMoreButton.displayName = 'LoadMoreButton';

export default PerformanceList;