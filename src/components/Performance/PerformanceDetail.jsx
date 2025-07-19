// src/components/Performance/PerformanceDetail.jsx - UPDATED with banner upload button
import React, { useState, useEffect, memo } from 'react';
import { ChevronDown, ChevronUp, Upload, Play, Calendar, MapPin, User, Clock } from 'lucide-react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';
import { useMoments, useNotifications } from '../../hooks';
import { formatDate } from '../../utils';
import MomentDetailModal from '../Moment/MomentDetailModal';
import UploadModal from '../Moment/UploadModal';
import LazyMedia from '../UI/LazyMedia';

// ✅ Function to determine if a song name is actually a song
const isActualSong = (songName) => {
  if (!songName || typeof songName !== 'string') {
    return false;
  }
  
  const name = songName.toLowerCase().trim();
  
  // List of patterns that indicate non-song content that setlist.fm might include
  const nonSongPatterns = [
    /^intro$/i,
    /^outro$/i,
    /^soundcheck$/i,
    /^tuning$/i,
    /^banter$/i,
    /^crowd$/i,
    /^applause$/i,
    /^announcement$/i,
    /^speech$/i,
    /^talk$/i,
    /.*\s+intro$/i,  // "Show Intro", "Set Intro"
    /.*\s+outro$/i,  // "Show Outro", "Set Outro"
    /^warm.?up$/i,   // "Warmup", "Warm-up"
    /^encore\s+intro$/i,
    /^mic\s+check$/i,
    /^between\s+songs$/i,
    /^\d+$/i,        // Just numbers
    /^setlist$/i,    // Sometimes they put "Setlist" as an item
    /^tease$/i       // Song teases
  ];
  
  // Return false if it matches any non-song pattern
  return !nonSongPatterns.some(pattern => pattern.test(name));
};

const PerformanceDetail = memo(({ performance, onBack }) => {
  const [uploadingMoment, setUploadingMoment] = useState(null);
  const [selectedMoment, setSelectedMoment] = useState(null);
  const [expandedSongs, setExpandedSongs] = useState(new Set());
  const [showMomentsPane, setShowMomentsPane] = useState(true);
  const [showSetlist, setShowSetlist] = useState(true);
  const [showOtherContent, setShowOtherContent] = useState(false);
  const [fullPerformance, setFullPerformance] = useState(performance);
  const [loading, setLoading] = useState(false);

  const { user } = useAuth();
  const { refreshNotifications } = useNotifications(API_BASE_URL);
  
  const { moments, loadingMomentDetails, loadMomentDetails } = useMoments(API_BASE_URL);

  // Check if we need to fetch full performance data (e.g., when coming from a moment)
  useEffect(() => {
    const needsFullData = !performance.sets?.set || performance.sets.set.length === 0;
    const isFromMoment = performance.id?.startsWith('moment-');
    
    if (needsFullData && isFromMoment) {
      const fetchFullPerformance = async () => {
        setLoading(true);
        try {
          // Search for performance by venue and date in the cache
          const response = await fetch(`${API_BASE_URL}/cached/performances?search=${encodeURIComponent(performance.venue.name)}`);
          if (response.ok) {
            const data = await response.json();
            
            // Find matching performance by venue and date
            const matchingPerf = data.performances?.find(p => 
              p.venue?.name === performance.venue.name &&
              p.eventDate === performance.eventDate
            );
            
            if (matchingPerf) {
              setFullPerformance(matchingPerf);
            }
          }
        } catch (error) {
          console.error('Failed to fetch full performance data:', error);
        } finally {
          setLoading(false);
        }
      };
      
      fetchFullPerformance();
    }
  }, [performance]);

  useEffect(() => {
    loadMomentDetails(`performance/${fullPerformance.id}`, `performance ${fullPerformance.id}`);
  }, [fullPerformance.id, loadMomentDetails]);
  
  // ✅ Upload for specific song (always contentType: 'song')
  const handleUploadSongMoment = (song, setInfo, songIndex) => {
    if (!user) {
      alert('Please log in to upload moments');
      return;
    }
    
    setUploadingMoment({ 
      type: 'song',
      performanceId: performance.id,
      performanceDate: performance.eventDate,
      venueName: performance.venue.name,
      venueCity: performance.venue.city.name,
      venueCountry: performance.venue.city.country?.name || '',
      songName: song.name,
      setName: setInfo?.name || '',
      songPosition: songIndex + 1,
      contentType: 'song'
    });
  };

  // ✅ Upload other content (user picks type in modal)
  const handleUploadOtherContent = (contentType = 'other') => {
    if (!user) {
      alert('Please log in to upload moments');
      return;
    }
    
    setUploadingMoment({ 
      type: 'other',
      performanceId: performance.id,
      performanceDate: performance.eventDate,
      venueName: performance.venue.name,
      venueCity: performance.venue.city.name,
      venueCountry: performance.venue.city.country?.name || '',
      songName: '',
      setName: '',
      songPosition: 0,
      contentType: contentType // ✅ Default type, user will select in modal
    });
  };

  // ✅ Only get SONG moments (exclude intro/outro/etc)
  const getSongMoments = (songName) => {
    return moments.filter(moment => {
      const isActualSong = !moment.contentType || moment.contentType === 'song';
      const matchesSongName = moment.songName === songName;
      return isActualSong && matchesSongName;
    });
  };

  // ✅ Get OTHER content (intro, outro, soundcheck, etc)
  const getOtherContent = () => {
    return moments.filter(moment => {
      return moment.contentType && moment.contentType !== 'song';
    });
  };

  // ✅ Group other content by type
  const getGroupedOtherContent = () => {
    const otherMoments = getOtherContent();
    const grouped = {};
    
    otherMoments.forEach(moment => {
      const type = moment.contentType || 'other';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(moment);
    });
    
    return grouped;
  };

  const toggleSongMoments = (songName) => {
    const newExpanded = new Set(expandedSongs);
    if (newExpanded.has(songName)) {
      newExpanded.delete(songName);
    } else {
      newExpanded.add(songName);
    }
    setExpandedSongs(newExpanded);
  };

  if (loading || loadingMomentDetails) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center text-gray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
          Loading performance details...
        </div>
      </div>
    );
  }

  const songMoments = moments.filter(m => !m.contentType || m.contentType === 'song');
  const otherContent = getOtherContent();
  const groupedOtherContent = getGroupedOtherContent();

  return (
    <div>
      {/* Header */}
      <PerformanceHeader 
        performance={fullPerformance}
        songMoments={songMoments}
        otherContent={otherContent}
        onBack={onBack}
      />

      {/* NEW: Collapsible Moments Pane */}
      <EventMomentsPane
        moments={[...songMoments, ...otherContent]}
        showMomentsPane={showMomentsPane}
        setShowMomentsPane={setShowMomentsPane}
        onSelectMoment={setSelectedMoment}
      />

      {/* ✅ Main Setlist (ONLY actual songs) - EXPANDABLE */}
      <MainSetlistDisplay 
        performance={fullPerformance}
        user={user}
        getSongMoments={getSongMoments}
        onUploadSongMoment={handleUploadSongMoment}
        onSelectMoment={setSelectedMoment}
        expandedSongs={expandedSongs}
        toggleSongMoments={toggleSongMoments}
        showSetlist={showSetlist}
        setShowSetlist={setShowSetlist}
      />

      {/* ✅ UPDATED: Other Content Section - EXPANDABLE, collapsed by default */}
      <OtherContentSection
        user={user}
        groupedContent={groupedOtherContent}
        otherContent={otherContent}
        showOtherContent={showOtherContent}
        setShowOtherContent={setShowOtherContent}
        onSelectMoment={setSelectedMoment}
        onUploadOtherContent={handleUploadOtherContent}
      />

      {/* Modals */}
      {uploadingMoment && user && (
        <UploadModal
          uploadingMoment={uploadingMoment}
          onClose={() => {
            setUploadingMoment(null);
            // Refresh moments data after upload
            loadMomentDetails(`performance/${performance.id}`, `performance ${performance.id}`);
          }}
          refreshNotifications={refreshNotifications}
        />
      )}

      {selectedMoment && (
        <MomentDetailModal 
          moment={selectedMoment} 
          onClose={() => setSelectedMoment(null)} 
        />
      )}
    </div>
  );
});

PerformanceDetail.displayName = 'PerformanceDetail';

// ✅ Header remains the same
const PerformanceHeader = memo(({ performance, songMoments, otherContent, onBack }) => (
  <div className="mb-6">
    <button
      onClick={onBack}
      className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
    >
      ← Back to latest performances
    </button>
    <h2 className="text-2xl sm:text-3xl font-bold">{performance.venue.name}</h2>
    <p className="text-gray-600">
      {performance.venue.city.name}{performance.venue.city.country ? `, ${performance.venue.city.country.name}` : ''} • {formatDate(performance.eventDate)}
    </p>
    
    <div className="mt-2 flex items-center gap-4 text-sm">
      {songMoments.length > 0 && (
        <span className="text-blue-600">
          🎵 {songMoments.length} song moment{songMoments.length !== 1 ? 's' : ''}
        </span>
      )}
      {otherContent.length > 0 && (
        <span className="text-purple-600">
          📀 {otherContent.length} other moment{otherContent.length !== 1 ? 's' : ''}
        </span>
      )}
      {songMoments.length === 0 && otherContent.length === 0 && (
        <span className="text-gray-500">No moments uploaded yet</span>
      )}
    </div>
  </div>
));

PerformanceHeader.displayName = 'PerformanceHeader';

// ✅ UPDATED: Other Content Section - Expandable, collapsed by default
const OtherContentSection = memo(({ 
  user,
  groupedContent, 
  otherContent,
  showOtherContent,
  setShowOtherContent,
  onSelectMoment,
  onUploadOtherContent
}) => {
  const totalOtherMoments = Object.values(groupedContent).reduce((sum, moments) => sum + moments.length, 0);
  const hasUploadedMoments = totalOtherMoments > 0;

  const getContentTypeInfo = (contentType) => {
    const types = {
      intro: { emoji: '🎭', label: 'Intro/Outro', color: 'bg-purple-100 text-purple-800' },
      jam: { emoji: '🎸', label: 'Jam/Improv', color: 'bg-orange-100 text-orange-800' },
      crowd: { emoji: '👥', label: 'Crowd Moments', color: 'bg-blue-100 text-blue-800' },
      other: { emoji: '🎪', label: 'Other Content', color: 'bg-gray-100 text-gray-800' }
    };
    return types[contentType] || types.other;
  };

  return (
    <div className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header - Only title and expand/collapse button */}
      <button
        onClick={() => setShowOtherContent(!showOtherContent)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-800">
            📀 Other Performance Content
            {hasUploadedMoments && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({totalOtherMoments})
              </span>
            )}
          </h3>
        </div>
        {showOtherContent ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {/* Collapsible Content */}
      {showOtherContent && (
        <div className="border-t border-gray-200 p-4">
          {/* Upload section with description */}
          <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
            <div className="flex items-center justify-between gap-4 mb-2">
              <p className="text-sm text-purple-700">
                Upload intro, outro, soundcheck, crowd reactions, and other non-song content from this performance.
                {hasUploadedMoments && (
                  <span className="font-medium"> ({totalOtherMoments} uploaded)</span>
                )}
              </p>
              
              {/* Upload button */}
              {user && (
                <button
                  onClick={() => onUploadOtherContent('other')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white font-normal rounded-md hover:bg-purple-700 transition-all duration-200 text-sm whitespace-nowrap"
                >
                  <span className="text-sm">📀</span>
                  <span>Upload</span>
                </button>
              )}
            </div>
          </div>

          {/* Show uploaded content if it exists */}
          {hasUploadedMoments && (
            <div className="space-y-4">
              {Object.entries(groupedContent).map(([contentType, moments]) => {
              const typeInfo = getContentTypeInfo(contentType);
              
              return (
                <div key={contentType} className="bg-white/70 rounded-lg p-3 border border-purple-200/50">
                  <h4 className={`text-sm font-semibold mb-2 inline-flex items-center gap-2 px-2 py-1 rounded-full ${typeInfo.color}`}>
                    <span>{typeInfo.emoji}</span>
                    {typeInfo.label}
                    <span className="text-xs">({moments.length})</span>
                  </h4>
                  
                  <div className="flex flex-wrap gap-2">
                    {moments.map((moment) => {
                      const rarityColors = {
                        legendary: { bg: 'from-yellow-400 to-orange-400', text: 'text-yellow-900' },
                        epic: { bg: 'from-purple-400 to-pink-400', text: 'text-purple-900' },
                        rare: { bg: 'from-red-400 to-pink-400', text: 'text-red-900' },
                        uncommon: { bg: 'from-blue-400 to-cyan-400', text: 'text-blue-900' },
                        common: { bg: 'from-gray-300 to-gray-400', text: 'text-gray-700' }
                      }[moment.rarityTier || 'common'] || { bg: 'from-gray-300 to-gray-400', text: 'text-gray-700' };

                      return (
                        <button
                          key={moment._id}
                          onClick={() => onSelectMoment(moment)}
                          className={`
                            px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all duration-200
                            bg-gradient-to-r ${rarityColors.bg} ${rarityColors.text}
                            hover:scale-105 hover:shadow-md transform
                            flex items-center gap-2 max-w-[200px]
                          `}
                        >
                          <div className="flex flex-col items-start text-left">
                            <div className="font-semibold truncate max-w-[150px]">
                              {moment.songName}
                            </div>
                            <div className="text-xs opacity-80 truncate max-w-[150px]">
                              {moment.user?.displayName || 'Unknown'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

OtherContentSection.displayName = 'OtherContentSection';

// ✅ Main setlist display with filtering and collapsible
const MainSetlistDisplay = memo(({ 
  performance, 
  user, 
  getSongMoments, 
  onUploadSongMoment, 
  onSelectMoment,
  expandedSongs,
  toggleSongMoments,
  showSetlist,
  setShowSetlist
}) => {
  if (!performance.sets?.set) {
    return (
      <div className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm">
        <button
          onClick={() => setShowSetlist(!showSetlist)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-800">🎵 Setlist</h3>
          </div>
          {showSetlist ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {showSetlist && (
          <div className="border-t border-gray-200 p-4">
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-3">🎵</div>
              <p className="text-lg font-medium mb-2">No setlist available for this performance</p>
              <p className="text-sm mb-4">Help improve the archive by adding the setlist!</p>
              <a
                href="https://setlist.fm"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Go to setlist.fm to update the setlist!
                <span>↗</span>
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Count total songs in setlist
  const totalSongs = performance.sets.set.reduce((total, set) => {
    return total + (set.song?.filter(song => song.name)?.length || 0);
  }, 0);

  // Count actual songs (filtered)
  const totalActualSongs = performance.sets.set.reduce((total, set) => {
    const actualSongs = set.song?.filter(song => isActualSong(song.name)) || [];
    return total + actualSongs.length;
  }, 0);

  return (
    <div className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <button
        onClick={() => setShowSetlist(!showSetlist)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-800">
            🎵 Setlist {totalActualSongs > 0 ? `(${totalActualSongs} songs)` : ''}
          </h3>
          <span className="text-sm text-gray-500">from setlist.fm</span>
        </div>
        {showSetlist ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {/* Collapsible Content */}
      {showSetlist && (
        <div className="border-t border-gray-200 p-4">
          {totalActualSongs === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-3">🎵</div>
              <p className="text-lg font-medium mb-2">No songs found in setlist</p>
              <p className="text-sm mb-4">Help improve the archive by adding the setlist!</p>
              <a
                href="https://setlist.fm"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Go to setlist.fm to update the setlist!
                <span>↗</span>
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              {performance.sets.set.map((set, index) => (
                <SetCard 
                  key={index}
                  set={set}
                  user={user}
                  getSongMoments={getSongMoments}
                  onUploadSongMoment={onUploadSongMoment}
                  onSelectMoment={onSelectMoment}
                  expandedSongs={expandedSongs}
                  toggleSongMoments={toggleSongMoments}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

MainSetlistDisplay.displayName = 'MainSetlistDisplay';

// ✅ UPDATED: SetCard - REMOVED filtered content notification
const SetCard = memo(({ 
  set, 
  user, 
  getSongMoments, 
  onUploadSongMoment, 
  onSelectMoment,
  expandedSongs,
  toggleSongMoments
}) => {
  // ✅ FILTER: Only show actual songs in the setlist
  const actualSongs = set.song?.filter(song => isActualSong(song.name)) || [];
  
  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm p-4">
      {set.name && (
        <h4 className="text-lg font-semibold mb-3 text-blue-600">{set.name}</h4>
      )}
      
      {/* ✅ REMOVED: No more filtered content notification */}
      
      {/* Show actual songs only */}
      {actualSongs.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <div className="text-3xl mb-2">🎵</div>
          <p className="font-medium mb-1">No songs found in this set</p>
          <p className="text-xs mb-3">(All items filtered as non-song content)</p>
          <a
            href="https://setlist.fm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
          >
            Update on setlist.fm
            <span>↗</span>
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {actualSongs.map((song, i) => {
            const songMoments = getSongMoments(song.name);
            const isExpanded = expandedSongs.has(song.name);
            
            return (
              <SongItem 
                key={`${song.name}-${i}`}
                song={song}
                songIndex={i}
                songMoments={songMoments}
                user={user}
                onUploadSongMoment={() => onUploadSongMoment(song, set, i)}
                onSelectMoment={onSelectMoment}
                isExpanded={isExpanded}
                toggleExpanded={() => toggleSongMoments(song.name)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

SetCard.displayName = 'SetCard';

// ✅ SongItem with inline upload buttons
const SongItem = memo(({ 
  song, 
  songIndex, 
  songMoments, 
  user, 
  onUploadSongMoment, 
  onSelectMoment,
  isExpanded,
  toggleExpanded
}) => (
  <div className="border-b border-gray-100 pb-3 last:border-b-0">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3 flex-1">
        <div className="flex items-center gap-3 flex-1">
          <span className="font-medium text-gray-900">{song.name}</span>
          
          {/* Inline upload button right next to song title */}
          {user && (
            <button
              onClick={onUploadSongMoment}
              className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
              title="Upload moment for this song"
            >
              <span>📹</span>
              <span>Upload</span>
            </button>
          )}
          
          {songMoments.length > 0 && (
            <button
              onClick={toggleExpanded}
              className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>{songMoments.length} moment{songMoments.length !== 1 ? 's' : ''}</span>
              <span className="text-xs">
                {isExpanded ? '▼' : '▶'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>

    {songMoments.length > 0 && isExpanded && (
      <div className="mt-3">
        <div className="flex flex-wrap gap-2">
          {songMoments.map((moment) => {
            const rarityColors = {
              legendary: { bg: 'from-yellow-400 to-orange-400', text: 'text-yellow-900' },
              epic: { bg: 'from-purple-400 to-pink-400', text: 'text-purple-900' },
              rare: { bg: 'from-red-400 to-pink-400', text: 'text-red-900' },
              uncommon: { bg: 'from-blue-400 to-cyan-400', text: 'text-blue-900' },
              common: { bg: 'from-gray-300 to-gray-400', text: 'text-gray-700' }
            }[moment.rarityTier || 'common'] || { bg: 'from-gray-300 to-gray-400', text: 'text-gray-700' };

            return (
              <button
                key={moment._id}
                onClick={() => onSelectMoment(moment)}
                className={`
                  px-3 py-1.5 rounded-md border-2 text-xs font-medium transition-all duration-200
                  bg-gradient-to-r ${rarityColors.bg} ${rarityColors.text}
                  hover:scale-105 hover:shadow-md transform
                  flex items-center justify-center text-center
                  min-w-[80px] max-w-[120px]
                `}
              >
                <div className="truncate">
                  by {moment.user?.displayName || 'Unknown'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    )}
  </div>
));

SongItem.displayName = 'SongItem';

// NEW: Event Moments Pane Component with Pagination
const EventMomentsPane = memo(({ moments, showMomentsPane, setShowMomentsPane, onSelectMoment }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const momentsPerPage = 4;
  const momentsCount = moments.length;
  const totalPages = Math.ceil(momentsCount / momentsPerPage);
  
  // Get current page moments
  const startIndex = (currentPage - 1) * momentsPerPage;
  const currentMoments = moments.slice(startIndex, startIndex + momentsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Reset to page 1 when moments change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [moments.length]);

  // Auto-hide pane when no moments
  if (momentsCount === 0) {
    return null;
  }

  return (
    <div className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <button
        onClick={() => setShowMomentsPane(!showMomentsPane)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Play className="text-blue-600" size={20} />
          <h3 className="text-lg font-semibold text-gray-800">
            Event Moments ({momentsCount})
          </h3>
        </div>
        {showMomentsPane ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {/* Collapsible Content */}
      {showMomentsPane && (
        <div className="border-t border-gray-200 p-4">
          {momentsCount > 0 ? (
            <>
              {/* Moments Grid - 4 columns for smaller cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {currentMoments.map((moment) => (
                  <EventMomentCard
                    key={moment._id}
                    moment={moment}
                    onSelect={() => onSelectMoment(moment)}
                  />
                ))}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Previous
                  </button>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({momentsCount} total moments)
                    </span>
                  </div>
                  
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Play size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-lg mb-2">No moments yet for this event</p>
              <p className="text-sm">Be the first to upload a moment from this show!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

EventMomentsPane.displayName = 'EventMomentsPane';

// NEW: Event Moment Card Component - Smaller, no uploader/timestamp
const EventMomentCard = memo(({ moment, onSelect }) => {
  return (
    <div 
      className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer"
      onClick={onSelect}
      style={{ minHeight: '180px' }}
    >
      {/* Media Preview */}
      {moment.mediaUrl && (
        <div className="relative aspect-video bg-gray-100 hover:opacity-90 transition-opacity">
          {(moment.mediaType === 'video' || moment.fileName?.toLowerCase().match(/\.(mov|mp4|webm)$/)) ? (
            <LazyMedia
              src={moment.mediaUrl}
              type="video"
              alt={moment.songName}
              className="w-full h-full object-cover"
              autoPlay={false}
              muted={true}
              controls={false}
              preload="none"
              adaptiveQuality={true}
              mobileOptimized={true}
              hoverToPlay={true}
              style={{ backgroundColor: '#000' }}
              placeholder={
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <Play className="w-6 h-6 text-white/70" />
                  </div>
                </div>
              }
            />
          ) : moment.mediaType?.startsWith('image') ? (
            <img
              src={moment.mediaUrl}
              alt={moment.songName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="text-gray-400" size={32} />
            </div>
          )}
        </div>
      )}

      {/* Content - Simplified */}
      <div className="p-2">
        {/* Song Name */}
        <div className="text-xs font-semibold text-gray-800 mb-1 truncate">
          {moment.songName || 'Unknown Song'}
        </div>

        {/* Content Type (if not song) */}
        {moment.contentType && moment.contentType !== 'song' && (
          <div className="text-xs text-blue-600 font-medium capitalize">
            {moment.contentType}
          </div>
        )}

        {/* Description (if exists) - Only show first line */}
        {moment.momentDescription && !moment.momentDescription.toLowerCase().includes('test') && (
          <p className="text-xs text-gray-600 truncate">
            {moment.momentDescription}
          </p>
        )}
      </div>
    </div>
  );
});

EventMomentCard.displayName = 'EventMomentCard';

export default PerformanceDetail;