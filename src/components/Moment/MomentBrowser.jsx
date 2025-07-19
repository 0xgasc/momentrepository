// src/components/Moment/MomentBrowser.jsx
import React, { memo, useState, useEffect } from 'react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import { usePlatformSettings } from '../../contexts/PlatformSettingsContext';
import { createTimeoutSignal, formatShortDate } from '../../utils';
import { Play, Calendar, MapPin, User, Zap, Clock, ExternalLink } from 'lucide-react';
import MomentDetailModal from './MomentDetailModal';
import PullToRefresh from '../UI/PullToRefresh';

const MomentBrowser = memo(({ onSongSelect, onPerformanceSelect }) => {
  const { isWeb3Enabled } = usePlatformSettings();
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMoment, setSelectedMoment] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  
  const MOMENTS_PER_PAGE = 6;

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



  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  // Calculate pagination
  const totalPages = Math.ceil(moments.length / MOMENTS_PER_PAGE);
  const startIndex = currentPage * MOMENTS_PER_PAGE;
  const endIndex = startIndex + MOMENTS_PER_PAGE;
  const currentMoments = moments.slice(startIndex, endIndex);

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    // Add a small delay to show the refresh animation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Reload moments by triggering useEffect
    setCurrentPage(0);
    setMoments([]);
  };
  
  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
          currentPage={currentPage}
          totalPages={totalPages}
          momentsPerPage={MOMENTS_PER_PAGE}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, moments.length)}
          isWeb3Enabled={isWeb3Enabled}
        />

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
                />
              ))}
            </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={goToPrevPage}
                disabled={currentPage === 0}
                className={`px-4 py-2 rounded-lg font-medium transition-all mobile-touch-target ${
                  currentPage === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                }`}
                style={{ minHeight: '44px', minWidth: '100px' }}
              >
                ← Previous
              </button>
              
              <div className="text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg" style={{ minHeight: '44px', display: 'flex', alignItems: 'center' }}>
                Page {currentPage + 1} of {totalPages}
              </div>
              
              <button
                onClick={goToNextPage}
                disabled={currentPage >= totalPages - 1}
                className={`px-4 py-2 rounded-lg font-medium transition-all mobile-touch-target ${
                  currentPage >= totalPages - 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                }`}
                style={{ minHeight: '44px', minWidth: '100px' }}
              >
                Next →
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-2">No moments found</div>
            <div className="text-gray-400 text-sm">Be the first to upload a moment!</div>
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
const MomentHeader = memo(({ totalMoments, currentPage, totalPages, startIndex, endIndex, isWeb3Enabled }) => (
  <div className="mb-6">
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <Zap className="mr-2 text-blue-600" size={24} />
          Recent Moments
        </h2>
        <p className="text-gray-600 mt-1">
          {totalPages > 1 ? (
            <>Showing {startIndex + 1}-{endIndex} of {totalMoments} moments (6 at a time for performance)</>
          ) : (
            <>Latest uploads from UMO fans around the world</>
          )}
        </p>
      </div>
      <div className="text-right">
        {totalPages > 1 && (
          <div className="text-sm text-gray-500">
            Page {currentPage + 1} of {totalPages}
          </div>
        )}
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
  </div>
));

MomentHeader.displayName = 'MomentHeader';

// Individual Moment Card Component
const MomentCard = memo(({ moment, onSongSelect, onPerformanceSelect, onMomentSelect, isWeb3Enabled }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-200 moment-card" style={{ minHeight: '300px' }}>
      {/* Media Preview - Clickable */}
      {moment.mediaUrl && (
        <div 
          className="relative aspect-video bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => onMomentSelect(moment)}
        >
          {/* Show auto-playing video for all video moments */}
          {(moment.mediaType === 'video' || moment.fileName?.toLowerCase().match(/\.(mov|mp4|webm)$/)) ? (
            <div className="relative w-full h-full">
              <video
                src={moment.mediaUrl}
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
                // Removed noisy loading logs
                // onLoadStart={() => console.log('Video loading started for', moment.songName)}
                // onCanPlay={() => console.log('Video can play for', moment.songName)}
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
              src={moment.mediaUrl}
              alt={moment.songName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="text-gray-400" size={48} />
            </div>
          )}
          
          {/* Play button overlay for clarity - only show for non-video content */}
          {!(moment.mediaType === 'video' || moment.fileName?.toLowerCase().match(/\.(mov|mp4|webm)$/)) && (
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