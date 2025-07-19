// src/components/Song/SongBrowser.jsx
import React, { memo } from 'react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import { useSongDatabase } from '../../hooks';
import { formatShortDate } from '../../utils';

const SongBrowser = memo(({ onSongSelect }) => {
  const {
    displayedSongs,
    loading,
    error,
    sortBy,
    sortDirection,
    momentProgress,
    searchQuery,
    showOnlyWithMoments,
    totalMoments,
    songsWithMoments,
    toggleSortDirection,
    clearSearch,
    handleSearchChange,
    handleSortChange,
    toggleShowOnlyWithMoments
  } = useSongDatabase(API_BASE_URL);

  if (loading) {
    return <LoadingState momentProgress={momentProgress} />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  return (
    <div className="mb-8">
      {/* Header with Search and Sort */}
      <SongHeader 
        totalMoments={totalMoments}
        songsWithMoments={songsWithMoments}
        searchQuery={searchQuery}
        displayedSongs={displayedSongs}
        showOnlyWithMoments={showOnlyWithMoments}
        onSearchChange={handleSearchChange}
        onClearSearch={clearSearch}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        onToggleSortDirection={toggleSortDirection}
        onToggleShowOnlyWithMoments={toggleShowOnlyWithMoments}
      />

      {/* Search Results Info */}
      {searchQuery.trim() && (
        <SearchResultsInfo 
          searchQuery={searchQuery}
          resultCount={displayedSongs.length}
          sortBy={sortBy}
          onClearSearch={clearSearch}
        />
      )}
      
      {/* Song Grid */}
      <SongGrid 
        songs={displayedSongs}
        onSongSelect={onSongSelect}
      />
      
      {/* No Results */}
      {displayedSongs.length === 0 && !loading && (
        <NoResultsState 
          searchQuery={searchQuery}
          onClearSearch={clearSearch}
        />
      )}
    </div>
  );
});

SongBrowser.displayName = 'SongBrowser';

// Sub-components
const LoadingState = memo(({ momentProgress }) => (
  <div className="mb-8">
    <div className="text-center py-8">
      <div className="inline-flex flex-col items-center umo-text-secondary">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-3"></div>
        <div className="text-lg font-medium mb-2 umo-text-primary">
          {momentProgress.total > 0 ? 'Loading moment counts...' : 'Loading song database...'}
        </div>
        {momentProgress.total > 0 && (
          <div className="text-sm">
            {momentProgress.current} of {momentProgress.total} songs processed
            <div className="w-64 bg-gray-600 h-2 mt-2" style={{ borderRadius: '4px' }}>
              <div 
                className="bg-blue-600 h-2 transition-all duration-300" 
                style={{ width: `${(momentProgress.current / momentProgress.total) * 100}%`, borderRadius: '4px' }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
));

LoadingState.displayName = 'LoadingState';

const ErrorState = memo(({ error }) => (
  <div className="mb-8">
    <div className="umo-card p-4">
      <p className="umo-text-primary">⚠️ {error}</p>
    </div>
  </div>
));

ErrorState.displayName = 'ErrorState';

const SongHeader = memo(({ 
  totalMoments, 
  songsWithMoments, 
  searchQuery, 
  displayedSongs,
  showOnlyWithMoments,
  onSearchChange,
  onClearSearch,
  sortBy,
  sortDirection,
  onSortChange,
  onToggleSortDirection,
  onToggleShowOnlyWithMoments
}) => (
  <div className="mb-6">
    {/* Title */}
    <div className="mb-4">
      <h3 className="umo-heading umo-heading--lg">Song Database</h3>
    </div>
    
    {/* Controls - Better Spacing */}
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
      {/* Left side - Filter Toggle */}
      <div className="flex items-center">
        <label className="flex items-center gap-2 text-sm umo-text-primary cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyWithMoments}
            onChange={(e) => onToggleShowOnlyWithMoments(e.target.checked)}
            className="border-gray-400"
            style={{ minWidth: '20px', minHeight: '20px' }}
          />
          Songs with moments only
        </label>
      </div>

      {/* Center - Search Bar */}
      <div className="relative w-full max-w-md">
        <input
          type="text"
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search songs, venues, or cities..."
          className="umo-input w-full px-4 py-2 text-sm"
        />
        <div className="absolute right-3 top-2 flex items-center gap-1">
          {searchQuery && (
            <button
              onClick={onClearSearch}
              className="umo-text-muted hover:umo-text-primary"
              title="Clear search"
              style={{ minWidth: '32px', minHeight: '32px', padding: '6px', fontSize: '18px' }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Right side - Sort Controls */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium umo-text-primary">Sort:</span>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="umo-select px-3 py-2 text-sm"
        >
          <option value="alphabetical">Alphabetical</option>
          <option value="mostPerformed">Most Performed</option>
          <option value="mostMoments">Most Moments</option>
          <option value="lastPerformed">Last Performed</option>
          <option value="firstPerformed">First Performed</option>
          <option value="mostVenues">Most Venues</option>
        </select>
        
        <button
          onClick={onToggleSortDirection}
          className="umo-btn umo-btn--secondary px-3 py-2 text-sm"
          title={`Sort ${sortDirection === 'asc' ? 'Descending' : 'Ascending'}`}
        >
          {sortDirection === 'asc' ? '↑' : '↓'}
        </button>
      </div>
    </div>
  </div>
));

SongHeader.displayName = 'SongHeader';

const SearchResultsInfo = memo(({ searchQuery, resultCount, sortBy, onClearSearch }) => (
  <div className="mb-4 text-sm">
    {resultCount === 0 ? (
      <div className="umo-text-primary">
        No songs found matching "{searchQuery}"
      </div>
    ) : (
      <div className="umo-text-primary">
        Found {resultCount} song{resultCount !== 1 ? 's' : ''} matching "{searchQuery}"
        {sortBy !== 'alphabetical' && (
          <span className="umo-text-muted"> (sorted by {sortBy.replace(/([A-Z])/g, ' $1').toLowerCase()})</span>
        )}
      </div>
    )}
  </div>
));

SearchResultsInfo.displayName = 'SearchResultsInfo';

const SongGrid = memo(({ songs, onSongSelect }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {songs.map((song) => (
      <SongCard 
        key={song.songName}
        song={song}
        onSelect={() => onSongSelect(song)}
      />
    ))}
  </div>
));

SongGrid.displayName = 'SongGrid';

const SongCard = memo(({ song, onSelect }) => (
  <button
    onClick={onSelect}
    className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 hover:border-blue-300 text-left group"
  >
    <div className="font-medium text-gray-900 mb-3 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
      {song.songName}
    </div>
    
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-blue-600 font-medium">
          {song.totalPerformances} show{song.totalPerformances !== 1 ? 's' : ''}
        </span>
        {song.totalMoments > 0 ? (
          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
            {song.totalMoments} moment{song.totalMoments !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded-full">
            No moments yet
          </span>
        )}
      </div>
      
      <div className="text-gray-500 text-xs">
        {song.venues.length} venue{song.venues.length !== 1 ? 's' : ''} • {song.cities.length} cit{song.cities.length !== 1 ? 'ies' : 'y'}
      </div>
      
      <div className="text-gray-500 text-xs">
        {song.firstPerformed === song.lastPerformed ? (
          <span>Only: {formatShortDate(song.lastPerformed)}</span>
        ) : (
          <span>{formatShortDate(song.firstPerformed)} - {formatShortDate(song.lastPerformed)}</span>
        )}
      </div>
    </div>
  </button>
));

SongCard.displayName = 'SongCard';

const NoResultsState = memo(({ searchQuery, onClearSearch }) => (
  <div className="text-center py-8 text-gray-500">
    {searchQuery.trim() ? (
      <>
        <div className="text-4xl mb-4">🔍</div>
        <h3 className="text-lg font-medium mb-2">No songs found</h3>
        <p className="mb-4">No songs match your search "{searchQuery}"</p>
        <button
          onClick={onClearSearch}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Clear Search
        </button>
      </>
    ) : (
      'No songs found'
    )}
  </div>
));

NoResultsState.displayName = 'NoResultsState';

export default SongBrowser;