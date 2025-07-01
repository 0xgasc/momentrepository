// src/components/Performance/PerformanceDetail.jsx - COMPLETE with sleek dropdown
import React, { useState, useEffect, memo } from 'react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';
import { useMoments } from '../../hooks';
import { formatDate } from '../../utils';
import MomentDetailModal from '../Moment/MomentDetailModal';
import UploadModal from '../Moment/UploadModal';

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
  const [showOtherContent, setShowOtherContent] = useState(false);

  const { user } = useAuth();
  
  const { moments, loadingMomentDetails: loading, loadMomentDetails } = useMoments(API_BASE_URL);

  useEffect(() => {
    loadMomentDetails(`performance/${performance.id}`, `performance ${performance.id}`);
  }, [performance.id, loadMomentDetails]);
  
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

  if (loading) {
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
        performance={performance}
        songMoments={songMoments}
        otherContent={otherContent}
        onBack={onBack}
      />

      {/* ✅ SLEEK: Simple Upload Other Content Button */}
      {user && (
        <div className="mb-6 flex justify-center">
          <button
            onClick={() => handleUploadOtherContent('other')}
            className="group flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
          >
            <span className="text-lg">📀</span>
            <span>Upload Other Content</span>
            <span className="text-xs bg-white/20 px-2 py-1 rounded ml-1">
              Intro • Outro • Crowd • etc.
            </span>
          </button>
        </div>
      )}

      {/* ✅ Other Content Section (if any exists) */}
      {otherContent.length > 0 && (
        <OtherContentSection
          groupedContent={groupedOtherContent}
          showOtherContent={showOtherContent}
          setShowOtherContent={setShowOtherContent}
          onSelectMoment={setSelectedMoment}
        />
      )}

      {/* ✅ Main Setlist (ONLY actual songs) */}
      <MainSetlistDisplay 
        performance={performance}
        user={user}
        getSongMoments={getSongMoments}
        onUploadSongMoment={handleUploadSongMoment}
        onSelectMoment={setSelectedMoment}
        expandedSongs={expandedSongs}
        toggleSongMoments={toggleSongMoments}
      />

      {/* Modals */}
      {uploadingMoment && user && (
        <UploadModal
          uploadingMoment={uploadingMoment}
          onClose={() => setUploadingMoment(null)}
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

// ✅ Other Content Section
const OtherContentSection = memo(({ 
  groupedContent, 
  showOtherContent, 
  setShowOtherContent,
  onSelectMoment
}) => {
  const totalOtherMoments = Object.values(groupedContent).reduce((sum, moments) => sum + moments.length, 0);

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
    <div className="mb-6 border border-purple-200 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 shadow-sm">
      <div 
        className="p-4 cursor-pointer flex items-center justify-between hover:bg-purple-100/50 transition-colors rounded-t-lg"
        onClick={() => setShowOtherContent(!showOtherContent)}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-purple-800">
            📀 Other Performance Content
          </h3>
          <span className="px-2 py-1 text-xs bg-purple-200 text-purple-800 rounded-full">
            {totalOtherMoments} moment{totalOtherMoments !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-purple-600 text-lg">
          {showOtherContent ? '▼' : '▶'}
        </span>
      </div>

      {showOtherContent && (
        <div className="p-4 pt-0 border-t border-purple-200/50">
          <p className="text-sm text-purple-700 mb-4">
            Intro, outro, soundcheck, and other non-song content from this performance
          </p>
          
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
        </div>
      )}
    </div>
  );
});

OtherContentSection.displayName = 'OtherContentSection';

// ✅ Main setlist display with filtering
const MainSetlistDisplay = memo(({ 
  performance, 
  user, 
  getSongMoments, 
  onUploadSongMoment, 
  onSelectMoment,
  expandedSongs,
  toggleSongMoments
}) => {
  if (!performance.sets?.set) {
    return (
      <div className="text-center py-8 text-gray-500">
        No setlist available for this performance
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-xl font-bold text-gray-900">🎵 Setlist</h3>
        <div className="h-px flex-1 bg-gray-200"></div>
        <div className="text-sm text-gray-500">
          Songs from setlist.fm
        </div>
      </div>
      
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
  );
});

MainSetlistDisplay.displayName = 'MainSetlistDisplay';

// ✅ SetCard with filtering and updated message
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
  const filteredItems = set.song?.filter(song => !isActualSong(song.name)) || [];
  
  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm p-4">
      {set.name && (
        <h4 className="text-lg font-semibold mb-3 text-blue-600">{set.name}</h4>
      )}
      
      {/* ✅ UPDATED: Sleeker filtered content notice */}
      {filteredItems.length > 0 && (
        <div className="mb-4 p-3 bg-purple-50 border-l-4 border-purple-400 rounded-r-lg">
          <div className="flex items-start gap-2">
            <span className="text-purple-600 text-sm">📀</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-800 mb-1">
                Non-song content filtered from setlist:
              </p>
              <div className="flex flex-wrap gap-1 mb-2">
                {filteredItems.map((item, i) => (
                  <span key={i} className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                    {item.name}
                  </span>
                ))}
              </div>
              <p className="text-xs text-purple-600">
                💡 Upload these using the button above
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Show actual songs only */}
      {actualSongs.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <p className="text-lg">🎵</p>
          <p>No actual songs in this set</p>
          <p className="text-xs mt-1">(All items filtered as non-song content)</p>
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

// ✅ SongItem without positions/counters
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

        {user && (
          <button
            onClick={onUploadSongMoment}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            Upload Moment
          </button>
        )}
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
                  {moment.user?.displayName || 'Unknown'}
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

export default PerformanceDetail;