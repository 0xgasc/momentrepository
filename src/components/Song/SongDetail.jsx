// src/components/Song/SongDetail.jsx - UPDATED with non-song content separation
import React, { useState, useEffect, useMemo, memo } from 'react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';
import { useMoments } from '../../hooks';
import { formatDate, formatShortDate } from '../../utils';
import MomentDetailModal from '../Moment/MomentDetailModal';
import UploadModal from '../Moment/UploadModal';

const SongDetail = memo(({ songData, onBack, onPerformanceSelect }) => {
  const [selectedMoment, setSelectedMoment] = useState(null);
  const [uploadingMoment, setUploadingMoment] = useState(null);
  const [viewMode, setViewMode] = useState('chronological');
  const [showPositions, setShowPositions] = useState(false);
  const [expandedPerformances, setExpandedPerformances] = useState(new Set());
  const [showNonSongMoments, setShowNonSongMoments] = useState(false); // ✅ NEW: Toggle for non-song moments
  const [showOnlyWithMoments, setShowOnlyWithMoments] = useState(false); // ✅ NEW: Toggle to show only performances with moments
  const { user } = useAuth();
  
  const { moments, loadingMomentDetails: loading, loadMomentDetails } = useMoments(API_BASE_URL);

  useEffect(() => {
    loadMomentDetails(`song/${encodeURIComponent(songData.songName)}`, `song "${songData.songName}"`);
  }, [songData.songName, loadMomentDetails]);

  const handleUploadMoment = (performance) => {
    if (!user) {
      alert('Please log in to upload moments');
      return;
    }
    
    setUploadingMoment({ 
      type: 'song', // ✅ FIXED: Add type field for UploadModal detection
      performanceId: performance.id,
      performanceDate: performance.date,
      venueName: performance.venue,
      venueCity: performance.city,
      venueCountry: performance.country || '',
      songName: songData.songName,
      setName: performance.setName || '',
      songPosition: performance.songPosition || 1,
      contentType: 'song' // ✅ NEW: Explicitly set as song content
    });
  };

  const handlePerformanceClick = async (performance) => {
    if (!onPerformanceSelect) {
      console.warn('No onPerformanceSelect handler provided');
      return;
    }

    try {
      console.log(`🎸 Loading full performance: ${performance.id}`);
      
      const response = await fetch(`${API_BASE_URL}/cached/performance/${performance.id}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Loaded performance:`, data.performance);
        onPerformanceSelect(data.performance);
      } else {
        console.error('❌ Failed to load performance:', response.status);
        alert('Failed to load performance details. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error loading performance:', error);
      alert('Error loading performance. Please check your connection.');
    }
  };

  const togglePerformanceExpanded = (performanceId) => {
    const newExpanded = new Set(expandedPerformances);
    if (newExpanded.has(performanceId)) {
      newExpanded.delete(performanceId);
    } else {
      newExpanded.add(performanceId);
    }
    setExpandedPerformances(newExpanded);
  };

  // ✅ NEW: Separate song moments from non-song moments
  const getSongMoments = () => {
    return moments.filter(moment => 
      !moment.contentType || moment.contentType === 'song'
    );
  };

  const getNonSongMoments = () => {
    return moments.filter(moment => 
      moment.contentType && moment.contentType !== 'song'
    );
  };

  // ✅ UPDATED: Filter performance moments to only include songs
  const getPerformanceSongMoments = (performanceId) => {
    return getSongMoments().filter(moment => moment.performanceId === performanceId);
  };

  // ✅ NEW: Get non-song moments by content type
  const getGroupedNonSongMoments = () => {
    const nonSongMoments = getNonSongMoments();
    const grouped = {};
    
    nonSongMoments.forEach(moment => {
      const type = moment.contentType || 'other';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(moment);
    });
    
    return grouped;
  };

  // ✅ NEW: Get content type display info
  const getContentTypeInfo = (contentType) => {
    const types = {
      intro: { emoji: '🎭', label: 'Intro/Outro', color: 'bg-purple-100 text-purple-800' },
      jam: { emoji: '🎸', label: 'Jam/Improv', color: 'bg-orange-100 text-orange-800' },
      crowd: { emoji: '👥', label: 'Crowd Moments', color: 'bg-blue-100 text-blue-800' },
      other: { emoji: '🎪', label: 'Other Content', color: 'bg-gray-100 text-gray-800' }
    };
    return types[contentType] || types.other;
  };

  const groupedPerformances = useMemo(() => {
    // Filter performances based on whether they have moments (if toggle is enabled)
    const filteredPerformances = showOnlyWithMoments 
      ? songData.performances.filter(perf => getPerformanceSongMoments(perf.id).length > 0)
      : songData.performances;

    switch (viewMode) {
      case 'byVenue':
        const byVenue = {};
        filteredPerformances.forEach(perf => {
          const key = `${perf.venue} (${perf.city})`;
          if (!byVenue[key]) byVenue[key] = [];
          byVenue[key].push(perf);
        });
        return Object.entries(byVenue).sort(([a], [b]) => a.localeCompare(b));
        
      case 'byYear':
        const byYear = {};
        filteredPerformances.forEach(perf => {
          const year = perf.date.split('-')[2] || 'Unknown';
          if (!byYear[year]) byYear[year] = [];
          byYear[year].push(perf);
        });
        return Object.entries(byYear).sort(([a], [b]) => b.localeCompare(a));
        
      case 'chronological':
      default:
        return [['All Performances', filteredPerformances]];
    }
  }, [songData.performances, viewMode, showOnlyWithMoments, getPerformanceSongMoments]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center text-gray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
          Loading "{songData.songName}" details...
        </div>
      </div>
    );
  }

  const songMoments = getSongMoments();
  const nonSongMoments = getNonSongMoments();
  const groupedNonSongMoments = getGroupedNonSongMoments();

  return (
    <div>
      {/* Header */}
      <SongDetailHeader 
        songData={songData}
        songMoments={songMoments}
        nonSongMoments={nonSongMoments}
        onBack={onBack}
      />

      {/* ✅ NEW: Non-Song Moments Section (if any exist with same name) */}
      {nonSongMoments.length > 0 && (
        <NonSongMomentsSection
          songName={songData.songName}
          groupedMoments={groupedNonSongMoments}
          showNonSongMoments={showNonSongMoments}
          setShowNonSongMoments={setShowNonSongMoments}
          onSelectMoment={setSelectedMoment}
          getContentTypeInfo={getContentTypeInfo}
        />
      )}

      {/* Controls */}
      <SongDetailControls 
        viewMode={viewMode}
        setViewMode={setViewMode}
        showPositions={showPositions}
        setShowPositions={setShowPositions}
        showOnlyWithMoments={showOnlyWithMoments}
        setShowOnlyWithMoments={setShowOnlyWithMoments}
      />

      {/* ✅ UPDATED: Song Performances List (only actual song performances) */}
      <SongPerformancesList 
        groupedPerformances={groupedPerformances}
        viewMode={viewMode}
        showPositions={showPositions}
        user={user}
        getPerformanceSongMoments={getPerformanceSongMoments}
        onUploadMoment={handleUploadMoment}
        onSelectMoment={setSelectedMoment}
        onPerformanceClick={handlePerformanceClick}
        expandedPerformances={expandedPerformances}
        togglePerformanceExpanded={togglePerformanceExpanded}
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

SongDetail.displayName = 'SongDetail';

// ✅ UPDATED: Header with separate song and non-song moment counts
const SongDetailHeader = memo(({ songData, songMoments, nonSongMoments, onBack }) => (
  <div className="mb-6">
    <button
      onClick={onBack}
      className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
    >
      ← Back to song search
    </button>
    
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="flex items-end gap-4 mb-4">
        <h2 className="text-2xl sm:text-3xl font-bold">{songData.songName}</h2>
        <div className="text-xs text-gray-500 pb-1">
          First performed: <strong>{formatDate(songData.firstPerformed)}</strong>
          {songData.firstPerformed !== songData.lastPerformed && (
            <> • Last performed: <strong>{formatDate(songData.lastPerformed)}</strong></>
          )}
        </div>
      </div>
      
      {/* Song Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-600">{songData.totalPerformances}</div>
          <div className="text-sm text-gray-600">Performances</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-600">{songData.venues.length}</div>
          <div className="text-sm text-gray-600">Venues</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-purple-600">{songData.cities.length}</div>
          <div className="text-sm text-gray-600">Cities</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-orange-600">{songMoments.length}</div>
          <div className="text-sm text-gray-600">Song Moments</div>
        </div>
      </div>
      
      {/* ✅ NEW: Additional info for non-song moments */}
      {nonSongMoments.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 text-center">
            📀 {nonSongMoments.length} additional moment{nonSongMoments.length !== 1 ? 's' : ''} with this name (non-song content)
          </div>
        </div>
      )}
      
    </div>
  </div>
));

SongDetailHeader.displayName = 'SongDetailHeader';

// ✅ NEW: Non-Song Moments Section
const NonSongMomentsSection = memo(({ 
  songName,
  groupedMoments, 
  showNonSongMoments, 
  setShowNonSongMoments,
  onSelectMoment,
  getContentTypeInfo
}) => {
  const totalNonSongMoments = Object.values(groupedMoments).reduce((sum, moments) => sum + moments.length, 0);

  return (
    <div className="mb-6 border border-gray-200 rounded-lg bg-gradient-to-r from-gray-50 to-slate-50 shadow-sm">
      {/* Header */}
      <div 
        className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-100/50 transition-colors rounded-t-lg"
        onClick={() => setShowNonSongMoments(!showNonSongMoments)}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-800">
            📀 Non-Song Content Named "{songName}"
          </h3>
          <span className="px-2 py-1 text-xs bg-gray-200 text-gray-800 rounded-full">
            {totalNonSongMoments} moment{totalNonSongMoments !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-gray-600 text-lg">
          {showNonSongMoments ? '▼' : '▶'}
        </span>
      </div>

      {/* Content */}
      {showNonSongMoments && (
        <div className="p-4 pt-0 border-t border-gray-200/50">
          <p className="text-sm text-gray-700 mb-4">
            These moments have the same name as this song but are categorized as non-song content (intro, jam, crowd, etc.)
          </p>
          
          {/* Grouped Non-Song Moments */}
          <div className="space-y-3">
            {Object.entries(groupedMoments).map(([contentType, moments]) => {
              const typeInfo = getContentTypeInfo(contentType);
              
              return (
                <div key={contentType} className="bg-white/70 rounded-lg p-3 border border-gray-200/50">
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
                            flex items-center gap-2 max-w-[250px]
                          `}
                        >
                          <div className="flex flex-col items-start text-left">
                            <div className="text-xs opacity-80 truncate max-w-[200px]">
                              {moment.venueName} • {formatShortDate(moment.performanceDate)}
                            </div>
                            <div className="font-semibold truncate max-w-[200px]">
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

NonSongMomentsSection.displayName = 'NonSongMomentsSection';

// ✅ UNCHANGED: Controls remain the same
const SongDetailControls = memo(({ viewMode, setViewMode, showPositions, setShowPositions, showOnlyWithMoments, setShowOnlyWithMoments }) => (
  <div className="mb-6 space-y-4">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-4">
        <h3 className="text-xl font-bold text-gray-900">🎵 Song Performance History</h3>
        
        {/* View Mode Toggle - moved inline with title */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">View:</span>
          <div className="bg-white rounded-lg border border-gray-200 p-1 inline-flex">
            {[
              ...(showOnlyWithMoments ? [{ key: 'moments', label: '🎬 Moments' }] : []),
              { key: 'chronological', label: '📅 Chronological' },
              { key: 'byVenue', label: '🏟️ By Venue' },
              { key: 'byYear', label: '📆 By Year' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  viewMode === key 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="h-px flex-1 bg-gray-200 ml-4"></div>
    </div>

    <div className="flex items-center gap-6">
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={showPositions}
          onChange={(e) => setShowPositions(e.target.checked)}
          className="rounded border-gray-300"
        />
        Show song positions in setlist
      </label>
      
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={showOnlyWithMoments}
          onChange={(e) => {
            setShowOnlyWithMoments(e.target.checked);
            // If turning off the toggle while in moments view, switch to chronological
            if (!e.target.checked && viewMode === 'moments') {
              setViewMode('chronological');
            }
          }}
          className="rounded border-gray-300"
        />
        Show only performances with moments
      </label>
    </div>

  </div>
));

SongDetailControls.displayName = 'SongDetailControls';

// ✅ RENAMED: SongPerformancesList (was PerformancesList)
const SongPerformancesList = memo(({ 
  groupedPerformances, 
  viewMode, 
  showPositions, 
  user, 
  getPerformanceSongMoments, // ✅ UPDATED: Uses filtered function
  onUploadMoment, 
  onSelectMoment,
  onPerformanceClick,
  expandedPerformances,
  togglePerformanceExpanded
}) => {
  // For moments view, collect all moments from all performances
  if (viewMode === 'moments') {
    const allMoments = [];
    groupedPerformances.forEach(([groupName, performances]) => {
      performances.forEach(performance => {
        const performanceMoments = getPerformanceSongMoments(performance.id);
        allMoments.push(...performanceMoments);
      });
    });

    return <SongMomentsView moments={allMoments} onMomentSelect={onSelectMoment} />;
  }

  // Default performance list view
  return (
    <div className="space-y-6">
      {groupedPerformances.map(([groupName, performances]) => (
      <div key={groupName} className="border border-gray-200 rounded-lg bg-white shadow-sm">
        {viewMode !== 'chronological' && (
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h4 className="font-semibold text-gray-900">
              {groupName} <span className="text-sm text-gray-500">({performances.length} performance{performances.length !== 1 ? 's' : ''})</span>
            </h4>
          </div>
        )}
        
        <div className="p-4">
          <div className="space-y-3">
            {performances.map((performance, index) => {
              const performanceMoments = getPerformanceSongMoments(performance.id); // ✅ UPDATED: Only song moments
              const isExpanded = expandedPerformances.has(performance.id);
              
              return (
                <div key={`${performance.id}-${index}`} className="border-b border-gray-100 pb-3 last:border-b-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <button 
                        onClick={() => onPerformanceClick(performance)}
                        className="text-left hover:bg-blue-50 rounded-lg p-2 -m-2 transition-colors group w-full"
                      >
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h5 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                            {performance.venue}
                          </h5>
                          <span className="text-sm text-gray-500">
                            {performance.city}{performance.country ? `, ${performance.country}` : ''}
                          </span>
                          <span className="text-sm font-medium text-blue-600 group-hover:text-blue-800">
                            {formatShortDate(performance.date)}
                          </span>
                          <span className="text-xs text-gray-400 group-hover:text-blue-500">
                            Click to view full setlist →
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                          {performance.setName && (
                            <span>Set: {performance.setName}</span>
                          )}
                          {showPositions && performance.songPosition && (
                            <span>Position: #{performance.songPosition}</span>
                          )}
                          
                          {performanceMoments.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePerformanceExpanded(performance.id);
                              }}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <span>{performanceMoments.length} moment{performanceMoments.length !== 1 ? 's' : ''}</span>
                              <span className="text-xs">
                                {isExpanded ? '▼' : '▶'}
                              </span>
                            </button>
                          )}
                        </div>
                      </button>
                    </div>
                    
                    {user && (
                      <button
                        onClick={() => onUploadMoment(performance)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors ml-4 flex-shrink-0"
                      >
                        Upload Moment
                      </button>
                    )}
                  </div>

                  {performanceMoments.length > 0 && isExpanded && (
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-2">
                        {performanceMoments.map((moment) => {
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
                                px-2 py-1 rounded-md border font-medium transition-all duration-200
                                bg-gradient-to-r ${rarityColors.bg} ${rarityColors.text}
                                hover:scale-105 hover:shadow-md transform
                                text-xs min-w-[60px] h-7 flex items-center justify-center
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
              );
            })}
          </div>
        </div>
      </div>
    ))}
    </div>
  );
});

SongPerformancesList.displayName = 'SongPerformancesList';

// ✅ NEW: Song Moment Card for moments view
const SongMomentCard = memo(({ moment, onMomentSelect }) => {
  const rarityColors = {
    legendary: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
    mythic: 'bg-gradient-to-r from-purple-400 to-pink-600',
    epic: 'bg-gradient-to-r from-purple-500 to-purple-700',
    rare: 'bg-gradient-to-r from-red-400 to-red-600',
    uncommon: 'bg-gradient-to-r from-blue-400 to-blue-600',
    common: 'bg-gradient-to-r from-gray-400 to-gray-600',
    basic: 'bg-gradient-to-r from-gray-300 to-gray-500'
  };

  const rarityColor = rarityColors[moment.rarityTier] || rarityColors.basic;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-200">
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
              >
                Your browser does not support the video tag.
              </video>
              {/* NFT Edition Badge - subtle bottom left */}
              {moment.hasNFTEdition && (
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
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <div className="text-gray-500">
                <span className="text-2xl">🎵</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Rarity Badge */}
        <div className={`inline-block px-2 py-1 rounded-full text-xs font-bold text-white mb-2 ${rarityColor}`}>
          {moment.rarityTier || 'basic'}
        </div>

        {/* Performance Info */}
        <div className="mb-2">
          <div className="font-medium text-gray-900 text-sm truncate">
            {moment.venueName}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span>{moment.venueCity}</span>
            <span>•</span>
            <span>{formatShortDate(moment.performanceDate)}</span>
          </div>
        </div>

        {/* Uploader */}
        <div className="text-xs text-gray-600 flex items-center gap-1">
          <span>by</span>
          <span className="font-medium">{moment.user?.displayName || 'Unknown'}</span>
        </div>

        {/* Description preview */}
        {moment.momentDescription && (
          <div className="text-xs text-gray-500 mt-2 line-clamp-2">
            {moment.momentDescription}
          </div>
        )}
      </div>
    </div>
  );
});

SongMomentCard.displayName = 'SongMomentCard';

// ✅ NEW: Paginated moments view for Song Performance History
const SongMomentsView = memo(({ moments, onMomentSelect }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const MOMENTS_PER_PAGE = 6;
  
  // Calculate pagination
  const totalPages = Math.ceil(moments.length / MOMENTS_PER_PAGE);
  const startIndex = currentPage * MOMENTS_PER_PAGE;
  const endIndex = startIndex + MOMENTS_PER_PAGE;
  const currentMoments = moments.slice(startIndex, endIndex);
  
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

  // Reset to first page when moments change
  useEffect(() => {
    setCurrentPage(0);
  }, [moments.length]);

  return (
    <div className="space-y-6">
      <div className="text-center text-gray-600 text-sm mb-4">
        {totalPages > 1 ? (
          <>Showing {startIndex + 1}-{Math.min(endIndex, moments.length)} of {moments.length} moments (6 at a time for performance)</>
        ) : (
          <>Showing {moments.length} moment{moments.length !== 1 ? 's' : ''} with video previews</>
        )}
      </div>
      
      {currentMoments.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentMoments.map((moment) => (
              <SongMomentCard
                key={moment._id}
                moment={moment}
                onMomentSelect={onMomentSelect}
              />
            ))}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={goToPrevPage}
                disabled={currentPage === 0}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  currentPage === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                }`}
              >
                ← Previous
              </button>
              
              <div className="text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg">
                Page {currentPage + 1} of {totalPages}
              </div>
              
              <button
                onClick={goToNextPage}
                disabled={currentPage >= totalPages - 1}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  currentPage >= totalPages - 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                }`}
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg mb-2">No moments found</div>
          <div className="text-gray-400 text-sm">Upload the first moment for this song!</div>
        </div>
      )}
    </div>
  );
});

SongMomentsView.displayName = 'SongMomentsView';

export default SongDetail;