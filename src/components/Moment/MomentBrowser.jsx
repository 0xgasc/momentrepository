// src/components/Moment/MomentBrowser.jsx
import React, { memo, useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import { usePlatformSettings } from '../../contexts/PlatformSettingsContext';
import { useTheaterQueue } from '../../contexts/TheaterQueueContext';
import { createTimeoutSignal, formatShortDate } from '../../utils';
import { Play, Calendar, MapPin, User, Clock, HelpCircle, X, ListPlus, Check, Music } from 'lucide-react';
import MomentDetailModal from './MomentDetailModal';
import PullToRefresh from '../UI/PullToRefresh';
import { transformMediaUrl } from '../../utils/mediaUrl';

const MomentBrowser = memo(({ onSongSelect, onPerformanceSelect, mediaFilter = 'all' }) => {
  const { isWeb3Enabled } = usePlatformSettings();
  const { addToQueue, isInQueue } = useTheaterQueue();
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMoment, setSelectedMoment] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Search and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('random');
  const [sortDirection, setSortDirection] = useState('desc');
  const [randomSeed, setRandomSeed] = useState(() => Math.random());

  // Mobile detection and adaptive page size
  const [isMobile, setIsMobile] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load fewer on mobile (3 vs 6), use "load more" pattern
  const MOMENTS_PER_LOAD = isMobile ? 3 : 6;

  useEffect(() => {
    const fetchMoments = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/moments`, {
          signal: createTimeoutSignal(8000),
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setMoments(data.moments || []);
          
        } else {
          throw new Error(`Failed to load moments: ${response.status}`);
        }
      } catch (err) {
        console.error('Error loading moments:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMoments();
  }, []);

  // Helper to detect if moment is YouTube/linked
  const isYouTubeMoment = useCallback((m) => {
    return m.mediaSource === 'youtube' ||
      m.mediaUrl?.includes('youtube.com') ||
      m.mediaUrl?.includes('youtu.be') ||
      m.externalVideoId;
  }, []);

  // Helper to detect if moment is audio
  const isAudioMoment = useCallback((m) => {
    const fileName = m.fileName?.toLowerCase() || '';
    const mediaType = m.mediaType?.toLowerCase() || '';
    const contentType = m.contentType?.toLowerCase() || '';
    return mediaType.includes('audio') ||
      contentType.includes('audio') ||
      fileName.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/);
  }, []);

  // Filter and sort moments
  const filteredAndSortedMoments = useMemo(() => {
    let result = [...moments];

    // Apply media type filter from hero
    if (mediaFilter !== 'all') {
      result = result.filter(m => {
        const isYT = isYouTubeMoment(m);
        const isAudio = isAudioMoment(m);

        if (mediaFilter === 'clips') return m.mediaSource === 'upload' && !isAudio;
        if (mediaFilter === 'audio') return isAudio;
        if (mediaFilter === 'linked') return isYT || m.mediaSource === 'vimeo';
        return true;
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(moment =>
        (moment.songName && moment.songName.toLowerCase().includes(query)) ||
        (moment.venueName && moment.venueName.toLowerCase().includes(query)) ||
        (moment.venueCity && moment.venueCity.toLowerCase().includes(query)) ||
        (moment.user?.displayName && moment.user.displayName.toLowerCase().includes(query)) ||
        (moment.momentDescription && moment.momentDescription.toLowerCase().includes(query))
      );
    }

    // Sort moments
    if (sortBy === 'random') {
      // Seeded shuffle for consistent random order during session
      result.sort((a, b) => {
        const hashA = (a._id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const hashB = (b._id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        return Math.sin(hashA * randomSeed) - Math.sin(hashB * randomSeed);
      });
    } else {
      result.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'newest':
            comparison = new Date(b.createdAt) - new Date(a.createdAt);
            break;
          case 'oldest':
            comparison = new Date(a.createdAt) - new Date(b.createdAt);
            break;
          case 'songName':
            comparison = (a.songName || '').localeCompare(b.songName || '');
            break;
          case 'venue':
            comparison = (a.venueName || '').localeCompare(b.venueName || '');
            break;
          case 'performanceDate':
            comparison = new Date(b.performanceDate || 0) - new Date(a.performanceDate || 0);
            break;
          default:
            comparison = 0;
        }
        return sortDirection === 'asc' ? -comparison : comparison;
      });
    }

    return result;
  }, [moments, searchQuery, sortBy, sortDirection, randomSeed, mediaFilter, isYouTubeMoment, isAudioMoment]);

  // Reset loaded count when search/sort/filter changes
  useEffect(() => {
    setLoadedCount(MOMENTS_PER_LOAD);
    setCurrentPage(0);
  }, [searchQuery, sortBy, sortDirection, mediaFilter, MOMENTS_PER_LOAD]);

  // Search handlers
  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleSortChange = useCallback((value) => {
    setSortBy(value);
    // Reshuffle when selecting random
    if (value === 'random') {
      setRandomSeed(Math.random());
    }
  }, []);

  const toggleSortDirection = useCallback(() => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  const loadMore = useCallback(() => {
    setLoadedCount(prev => prev + MOMENTS_PER_LOAD);
  }, [MOMENTS_PER_LOAD]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  // Use "load more" pattern - show up to loadedCount moments
  const currentMoments = filteredAndSortedMoments.slice(0, loadedCount || MOMENTS_PER_LOAD);
  const hasMore = currentMoments.length < filteredAndSortedMoments.length;
  const totalMomentsCount = filteredAndSortedMoments.length;

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    // Add a small delay to show the refresh animation
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reload moments by triggering useEffect
    setLoadedCount(MOMENTS_PER_LOAD);
    setMoments([]);
  };

  return (
    <>
      <PullToRefresh 
        onRefresh={handleRefresh}
        pullText="Pull down to refresh moments"
        releaseText="Release to refresh moments"
        refreshingText="Loading latest moments..."
      >
        <div className="mb-8">
        {/* Header */}
        <MomentHeader
          totalMoments={moments.length}
          filteredCount={filteredAndSortedMoments.length}
          showingCount={currentMoments.length}
          isWeb3Enabled={isWeb3Enabled}
          onShowHelp={() => setShowHelpModal(true)}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onClearSearch={clearSearch}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          onToggleSortDirection={toggleSortDirection}
        />

        {/* Search Results Info */}
        {searchQuery.trim() && (
          <div className="mb-4 text-sm">
            {filteredAndSortedMoments.length === 0 ? (
              <div className="text-gray-700">
                No moments found matching "{searchQuery}"
              </div>
            ) : (
              <div className="text-gray-700">
                Found {filteredAndSortedMoments.length} moment{filteredAndSortedMoments.length !== 1 ? 's' : ''} matching "{searchQuery}"
                {sortBy !== 'newest' && (
                  <span className="text-gray-500"> (sorted by {sortBy.replace(/([A-Z])/g, ' $1').toLowerCase()})</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Moments Grid */}
        {currentMoments.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {currentMoments.map((moment) => (
                <MomentCard
                  key={moment._id}
                  moment={moment}
                  onSongSelect={onSongSelect}
                  onPerformanceSelect={onPerformanceSelect}
                  onMomentSelect={(moment) => {
                    setSelectedMoment(moment);
                    window.scrollTo(0, 0);
                  }}
                  isWeb3Enabled={isWeb3Enabled}
                  addToQueue={addToQueue}
                  isInQueue={isInQueue}
                />
              ))}
            </div>
            
            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={loadMore}
                  className="px-4 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded transition-colors"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            {searchQuery.trim() ? (
              <>
                <div className="text-4xl mb-4">🔍</div>
                <div className="text-gray-700 text-lg mb-2">No moments found</div>
                <div className="text-gray-500 text-sm mb-4">No moments match your search "{searchQuery}"</div>
                <button
                  onClick={clearSearch}
                  className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors"
                >
                  Clear Search
                </button>
              </>
            ) : (
              <>
                <div className="text-gray-500 text-lg mb-2">No moments found</div>
                <div className="text-gray-400 text-sm">Be the first to upload a moment!</div>
              </>
            )}
          </div>
        )}
        </div>
      </PullToRefresh>

      {/* Moment Detail Modal - MOVED OUTSIDE PullToRefresh */}
      {selectedMoment && (
        <MomentDetailModal
          moment={selectedMoment}
          onClose={() => {
            setSelectedMoment(null);
          }}
        />
      )}

      {/* Upload Help Modal */}
      {showHelpModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowHelpModal(false)}
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <div
            className="rounded-sm shadow-xl max-w-lg w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#ffffff',
              border: '1px solid rgba(0, 0, 0, 0.1)'
            }}
          >
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors mobile-touch-target"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <X size={24} />
            </button>

            <h3 className="text-2xl font-bold text-gray-800 mb-4 pr-8">
              How to Upload Moments
            </h3>

            <div className="space-y-4 text-gray-700">
              <div className="flex items-start">
                <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-semibold mb-1">Create an Account & Log In</p>
                  <p className="text-sm text-gray-600">
                    You need to be logged in with an account to upload moments
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-semibold mb-1">Navigate to a Show or Song</p>
                  <p className="text-sm text-gray-600">
                    Browse to a specific performance or song page that you want to upload a moment for
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-semibold mb-1">Click "Upload Moment"</p>
                  <p className="text-sm text-gray-600">
                    You'll see an "Upload Moment" button on the show or song page - click it to start uploading your video or photo
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-sm border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>💡 Tip:</strong> Moments can be videos or photos from UMO concerts. Share your favorite performances with fans worldwide!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="mt-6 w-full bg-blue-600 text-white py-3 rounded-sm hover:bg-blue-700 transition-colors font-medium mobile-touch-target"
              style={{ minHeight: '44px' }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
});

MomentBrowser.displayName = 'MomentBrowser';

// Loading State Component
const LoadingState = memo(() => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
    <div className="text-lg font-medium text-gray-700 mb-2">Loading Recent Moments...</div>
    <div className="text-sm text-gray-500">Fetching the latest uploads from fans</div>
  </div>
));

LoadingState.displayName = 'LoadingState';

// Error State Component
const ErrorState = memo(({ error }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="text-red-500 text-6xl mb-4">⚠️</div>
    <div className="text-xl font-medium text-gray-800 mb-2">Failed to Load Moments</div>
    <div className="text-gray-600 text-center max-w-md">
      {error || 'There was an error loading the moments. Please try again later.'}
    </div>
  </div>
));

ErrorState.displayName = 'ErrorState';

// Header Component
const MomentHeader = memo(({
  totalMoments,
  filteredCount,
  showingCount,
  isWeb3Enabled,
  onShowHelp,
  searchQuery,
  onSearchChange,
  onClearSearch,
  sortBy,
  sortDirection,
  onSortChange,
  onToggleSortDirection
}) => (
  <div className="mb-6">
    {/* Title Row */}
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold text-gray-800">
          Recent Moments
        </h2>
        <button
          onClick={onShowHelp}
          className="text-gray-400 hover:text-blue-600 transition-colors p-1"
          title="How to upload moments"
        >
          <HelpCircle size={18} />
        </button>
      </div>
      <div className="text-right">
        {/* Only show NFT legend if Web3 is enabled */}
        {isWeb3Enabled() && (
          <div className="flex items-center justify-end mt-2 text-xs text-gray-400 space-x-3">
            <div className="flex items-center">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1 animate-pulse"></div>
              <span>minting now</span>
            </div>
            <div className="flex items-center">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1"></div>
              <span>tokenized</span>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Search and Sort Controls */}
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
      {/* Left side - Results count */}
      <div className="text-sm text-gray-600">
        {searchQuery.trim() ? (
          <>Showing {showingCount} of {filteredCount} matches ({totalMoments} total)</>
        ) : (
          <>Latest uploads from UMO fans around the world</>
        )}
      </div>

      {/* Center - Search Bar */}
      <div className="relative w-full max-w-md">
        <input
          type="text"
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search songs, venues, cities, or uploaders..."
          className="w-full px-4 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        />
        <div className="absolute right-3 top-2 flex items-center gap-1">
          {searchQuery && (
            <button
              onClick={onClearSearch}
              className="text-gray-400 hover:text-gray-600"
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
        <span className="text-sm font-medium text-gray-700">Sort:</span>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="random">Random</option>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="songName">Song Name</option>
          <option value="venue">Venue</option>
          <option value="performanceDate">Performance Date</option>
        </select>

        <button
          onClick={onToggleSortDirection}
          className="px-3 py-2 text-sm border border-gray-300 rounded-sm hover:bg-gray-100 transition-colors"
          title={`Sort ${sortDirection === 'asc' ? 'Descending' : 'Ascending'}`}
        >
          {sortDirection === 'asc' ? '↑' : '↓'}
        </button>
      </div>
    </div>
  </div>
));

MomentHeader.displayName = 'MomentHeader';

// Individual Moment Card Component
const MomentCard = memo(({ moment, onSongSelect, onPerformanceSelect, onMomentSelect, isWeb3Enabled, addToQueue, isInQueue }) => {
  // Check if this moment is already in queue
  const momentInQueue = isInQueue ? isInQueue(moment._id) : false;

  const handleAddToQueue = (e) => {
    e.stopPropagation();
    if (addToQueue && !momentInQueue) {
      addToQueue(moment);
    }
  };

  return (
    <div className="bg-white rounded-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-200 moment-card group" style={{ minHeight: '300px' }}>
      {/* Media Preview - Clickable */}
      {moment.mediaUrl && (
        <div
          className="relative aspect-video bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => onMomentSelect(moment)}
        >
          {/* Add to Queue Button - appears on hover */}
          <button
            onClick={handleAddToQueue}
            className={`absolute bottom-2 right-2 z-10 rounded-full p-2 transition-all duration-200 ${
              momentInQueue
                ? 'bg-yellow-600/90 text-white'
                : 'bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-yellow-600/90'
            }`}
            title={momentInQueue ? 'Already in queue' : 'Add to queue'}
            disabled={momentInQueue}
          >
            {momentInQueue ? <Check size={16} /> : <ListPlus size={16} />}
          </button>

          {/* Show auto-playing video for all video moments */}
          {(moment.mediaType === 'video' || moment.fileName?.toLowerCase().match(/\.(mov|mp4|webm)$/)) ? (
            <div className="relative w-full h-full">
              <video
                src={transformMediaUrl(moment.mediaUrl)}
                className="w-full h-full object-cover pointer-events-none"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                onError={(e) => {
                  console.log('Video error for', moment.songName, ':', {
                    error: e.target.error,
                    networkState: e.target.networkState,
                    readyState: e.target.readyState,
                    src: e.target.src,
                    mediaType: moment.mediaType
                  });
                }}
              >
                Your browser does not support the video tag.
              </video>
              {/* NFT Edition Badge - subtle bottom left */}
              {isWeb3Enabled() && moment.hasNFTEdition && moment.nftCardUrl && (
                <div className="absolute bottom-2 left-2 flex items-center">
                  {moment.isMintingActive ? (
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  ) : (
                    <div className="w-2 h-2 bg-gray-400 rounded-full opacity-60"></div>
                  )}
                </div>
              )}
            </div>
          ) : moment.mediaType?.startsWith('image') ? (
            <img
              src={transformMediaUrl(moment.mediaUrl)}
              alt={moment.songName}
              className="w-full h-full object-cover"
            />
          ) : (moment.mediaType === 'audio' || moment.fileName?.toLowerCase().match(/\.(mp3|wav|ogg|flac)$/)) ? (
            /* Audio Card Preview */
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 via-gray-900 to-black p-4">
              <Music size={48} className="text-purple-400 mb-3" />
              <div className="text-sm text-gray-300 font-medium truncate max-w-full px-2 text-center">
                {moment.songName}
              </div>
              {/* Play button overlay for audio */}
              <div className="absolute bottom-3 left-3 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                <Play className="text-white ml-0.5" size={20} />
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="text-gray-400" size={48} />
            </div>
          )}

          {/* Play button overlay for clarity - only show for images and unknown content */}
          {!(moment.mediaType === 'video' || moment.mediaType === 'audio' || moment.fileName?.toLowerCase().match(/\.(mov|mp4|webm|mp3|wav|ogg|flac)$/)) && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black bg-opacity-20">
              <div className="bg-white bg-opacity-90 rounded-full p-3">
                <Play className="text-gray-800" size={24} />
              </div>
            </div>
          )}

        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Song Name - Click opens modal */}
        <div
          onClick={() => onMomentSelect(moment)}
          className="text-lg font-semibold text-gray-800 cursor-pointer hover:text-blue-600 transition-colors mb-2"
        >
          {moment.songName || 'Unknown Song'}
        </div>

        {/* Performance Details - Click opens modal */}
        {moment.venueName && (
          <div
            onClick={() => onMomentSelect(moment)}
            className="flex items-center text-sm text-gray-600 cursor-pointer hover:text-blue-600 transition-colors mb-2"
          >
            <MapPin size={14} className="mr-1" />
            {moment.venueName}
            {moment.venueCity && `, ${moment.venueCity}`}
          </div>
        )}

        {/* Date */}
        {moment.performanceDate && (
          <div className="flex items-center text-sm text-gray-500 mb-3">
            <Calendar size={14} className="mr-1" />
            {formatShortDate(moment.performanceDate)}
          </div>
        )}

        {/* Description - Only show if it's not a test string */}
        {moment.momentDescription && !moment.momentDescription.toLowerCase().includes('test') && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {moment.momentDescription}
          </p>
        )}

        {/* Footer - Upload info in one line */}
        <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t">
          <div className="flex items-center">
            <Clock size={12} className="mr-1" />
            {(() => {
              const uploadDate = new Date(moment.createdAt);
              const now = new Date();
              const diffInDays = Math.floor((now - uploadDate) / (1000 * 60 * 60 * 24));
              
              if (diffInDays === 0) return 'Today';
              if (diffInDays === 1) return 'Yesterday';
              if (diffInDays < 7) return `${diffInDays} days ago`;
              if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
              
              return uploadDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: uploadDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
              });
            })()}
            {moment.user?.displayName && (
              <>
                <span className="mx-1">•</span>
                <User size={12} className="mr-1" />
                {moment.user.displayName}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

MomentCard.displayName = 'MomentCard';

export default MomentBrowser;