// src/components/Performance/PerformanceDetail.jsx - FIXED with proper content separation
import React, { useState, useEffect, memo } from 'react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';
import { useMoments } from '../../hooks';
import { formatDate } from '../../utils';
import MomentDetailModal from '../Moment/MomentDetailModal';
import UploadModal from '../Moment/UploadModal';

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
  
  // ✅ FIXED: Upload for specific song (always contentType: 'song')
  const handleUploadSongMoment = (song, setInfo, songIndex) => {
    if (!user) {
      alert('Please log in to upload moments');
      return;
    }
    
    setUploadingMoment({ 
      type: 'song', // ✅ NEW: Explicitly mark as song upload
      performanceId: performance.id,
      performanceDate: performance.eventDate,
      venueName: performance.venue.name,
      venueCity: performance.venue.city.name,
      venueCountry: performance.venue.city.country?.name || '',
      songName: song.name,
      setName: setInfo?.name || '',
      songPosition: songIndex + 1,
      contentType: 'song' // ✅ FIXED: Always song for setlist uploads
    });
  };

  // ✅ NEW: Upload other content (user picks type)
  const handleUploadOtherContent = () => {
    if (!user) {
      alert('Please log in to upload moments');
      return;
    }
    
    setUploadingMoment({ 
      type: 'other', // ✅ NEW: Mark as other content upload
      performanceId: performance.id,
      performanceDate: performance.eventDate,
      venueName: performance.venue.name,
      venueCity: performance.venue.city.name,
      venueCountry: performance.venue.city.country?.name || '',
      songName: '', // ✅ User will fill this in
      setName: '',
      songPosition: 0,
      contentType: 'other' // ✅ Default to other, user will change
    });
  };

  // ✅ FIXED: Only get SONG moments (exclude intro/outro/etc)
  const getSongMoments = (songName) => {
    return moments.filter(moment => {
      // ✅ FIXED: Strict filtering for actual songs
      const isActualSong = !moment.contentType || moment.contentType === 'song';
      const matchesSongName = moment.songName === songName;
      return isActualSong && matchesSongName;
    });
  };

  // ✅ FIXED: Get OTHER content (intro, outro, soundcheck, etc)
  const getOtherContent = () => {
    return moments.filter(moment => {
      return moment.contentType && moment.contentType !== 'song';
    });
  };

  // ✅ NEW: Group other content by type
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

  console.log('🔍 Debug moments:', {
    totalMoments: moments.length,
    songMoments: songMoments.length,
    otherContent: otherContent.length,
    momentsSample: moments.slice(0, 3).map(m => ({
      songName: m.songName,
      contentType: m.contentType
    }))
  });

  return (
    <div>
      {/* Header */}
      <PerformanceHeader 
        performance={performance}
        songMoments={songMoments}
        otherContent={otherContent}
        onBack={onBack}
      />

      {/* ✅ NEW: Other Content Section (if any exists) */}
      {otherContent.length > 0 && (
        <OtherContentSection
          groupedContent={groupedOtherContent}
          showOtherContent={showOtherContent}
          setShowOtherContent={setShowOtherContent}
          onSelectMoment={setSelectedMoment}
        />
      )}

      {/* ✅ NEW: Upload Other Content Button */}
      {user && (
        <div className="mb-6">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-purple-800 mb-1">
                  📀 Additional Performance Content
                </h3>
                <p className="text-xs text-purple-700">
                  Upload intro, outro, soundcheck, crowd moments, or other non-song content
                </p>
              </div>
              <button
                onClick={handleUploadOtherContent}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <span>➕</span>
                Upload Other Content
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ FIXED: Main Setlist (ONLY actual songs) */}
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

// ✅ UPDATED: Header with clear separation
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
    
    {/* ✅ FIXED: Clear moment counts */}
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

// ✅ NEW: Other Content Section
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
      {/* Header */}
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

      {/* Content */}
      {showOtherContent && (
        <div className="p-4 pt-0 border-t border-purple-200/50">
          <p className="text-sm text-purple-700 mb-4">
            Intro, outro, soundcheck, and other non-song content from this performance
          </p>
          
          {/* Grouped Other Content */}
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

// ✅ FIXED: Main setlist display (ONLY shows actual songs from setlist.fm)
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

// ✅ UNCHANGED: SetCard component (now only deals with actual songs)
const SetCard = memo(({ 
  set, 
  user, 
  getSongMoments, 
  onUploadSongMoment, 
  onSelectMoment,
  expandedSongs,
  toggleSongMoments
}) => (
  <div className="border border-gray-200 rounded-lg bg-white shadow-sm p-4">
    {set.name && (
      <h4 className="text-lg font-semibold mb-3 text-blue-600">{set.name}</h4>
    )}
    
    <ol className="space-y-3">
      {set.song?.map((song, i) => {
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
    </ol>
  </div>
));

SetCard.displayName = 'SetCard';

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
  <li className="border-b border-gray-100 pb-3 last:border-b-0">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3 flex-1">
        <span className="text-sm text-gray-500 w-8">{songIndex + 1}.</span>
        
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
      <div className="mt-3 ml-11">
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
  </li>
));

SongItem.displayName = 'SongItem';

export default PerformanceDetail;