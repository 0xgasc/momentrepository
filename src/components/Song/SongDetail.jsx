// src/components/Song/SongDetail.jsx - UPDATED with performance navigation
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
  const [expandedPerformances, setExpandedPerformances] = useState(new Set()); // Track which performances are expanded
  const { user } = useAuth();
  
  // Use the hook instead of manual state management
  const { moments, loadingMomentDetails: loading, loadMomentDetails } = useMoments(API_BASE_URL);

  useEffect(() => {
    // Use the hook's method
    loadMomentDetails(`song/${encodeURIComponent(songData.songName)}`, `song "${songData.songName}"`);
  }, [songData.songName, loadMomentDetails]);

  const handleUploadMoment = (performance) => {
    if (!user) {
      alert('Please log in to upload moments');
      return;
    }
    
    setUploadingMoment({ 
      performanceId: performance.id,
      performanceDate: performance.date,
      venueName: performance.venue,
      venueCity: performance.city,
      venueCountry: performance.country || '',
      songName: songData.songName,
      setName: performance.setName || '',
      songPosition: performance.songPosition || 1
    });
  };

  // NEW: Handle performance click - fetch full performance and navigate
  const handlePerformanceClick = async (performance) => {
    if (!onPerformanceSelect) {
      console.warn('No onPerformanceSelect handler provided');
      return;
    }

    try {
      console.log(`🎸 Loading full performance: ${performance.id}`);
      
      // Fetch the full performance data from cache
      const response = await fetch(`${API_BASE_URL}/cached/performance/${performance.id}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Loaded performance:`, data.performance);
        
        // Navigate to performance detail view
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

  // ✅ NEW: Toggle expanded state for a performance
  const togglePerformanceExpanded = (performanceId) => {
    const newExpanded = new Set(expandedPerformances);
    if (newExpanded.has(performanceId)) {
      newExpanded.delete(performanceId);
    } else {
      newExpanded.add(performanceId);
    }
    setExpandedPerformances(newExpanded);
  };

  const groupedPerformances = useMemo(() => {
    switch (viewMode) {
      case 'byVenue':
        const byVenue = {};
        songData.performances.forEach(perf => {
          const key = `${perf.venue} (${perf.city})`;
          if (!byVenue[key]) byVenue[key] = [];
          byVenue[key].push(perf);
        });
        return Object.entries(byVenue).sort(([a], [b]) => a.localeCompare(b));
        
      case 'byYear':
        const byYear = {};
        songData.performances.forEach(perf => {
          const year = perf.date.split('-')[2] || 'Unknown';
          if (!byYear[year]) byYear[year] = [];
          byYear[year].push(perf);
        });
        return Object.entries(byYear).sort(([a], [b]) => b.localeCompare(a));
        
      case 'chronological':
      default:
        return [['All Performances', songData.performances]];
    }
  }, [songData.performances, viewMode]);

  const getPerformanceMoments = (performanceId) => {
    return moments.filter(moment => moment.performanceId === performanceId);
  };

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

  return (
    <div>
      {/* Header */}
      <SongDetailHeader 
        songData={songData}
        moments={moments}
        onBack={onBack}
      />

      {/* Controls */}
      <SongDetailControls 
        viewMode={viewMode}
        setViewMode={setViewMode}
        showPositions={showPositions}
        setShowPositions={setShowPositions}
      />

      {/* Performances List */}
      <PerformancesList 
        groupedPerformances={groupedPerformances}
        viewMode={viewMode}
        showPositions={showPositions}
        user={user}
        getPerformanceMoments={getPerformanceMoments}
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

// Sub-components
const SongDetailHeader = memo(({ songData, moments, onBack }) => (
  <div className="mb-6">
    <button
      onClick={onBack}
      className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
    >
      ← Back to song search
    </button>
    
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <h2 className="text-2xl sm:text-3xl font-bold mb-4">{songData.songName}</h2>
      
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
          <div className="text-2xl font-bold text-orange-600">{moments.length}</div>
          <div className="text-sm text-gray-600">Moments</div>
        </div>
      </div>
      
      {/* Date Range */}
      <div className="mt-4 text-center text-gray-600 space-y-2">
        <div className="text-sm">
          First performed: <strong>{formatDate(songData.firstPerformed)}</strong>
          {songData.firstPerformed !== songData.lastPerformed && (
            <> • Last performed: <strong>{formatDate(songData.lastPerformed)}</strong></>
          )}
        </div>
      </div>
    </div>
  </div>
));

SongDetailHeader.displayName = 'SongDetailHeader';

const SongDetailControls = memo(({ viewMode, setViewMode, showPositions, setShowPositions }) => (
  <div className="mb-6 space-y-4">
    {/* View Mode Toggle */}
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700">View:</span>
      <div className="bg-white rounded-lg border border-gray-200 p-1 inline-flex">
        {[
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

    {/* Show Positions Toggle */}
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={showPositions}
          onChange={(e) => setShowPositions(e.target.checked)}
          className="rounded border-gray-300"
        />
        Show song positions in setlist
      </label>
    </div>

    {/* NEW: Instructions */}
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <p className="text-sm text-blue-800">
        💡 <strong>Tip:</strong> Click on any performance date/venue to view the complete setlist for that show!
      </p>
    </div>
  </div>
));

SongDetailControls.displayName = 'SongDetailControls';

const PerformancesList = memo(({ 
  groupedPerformances, 
  viewMode, 
  showPositions, 
  user, 
  getPerformanceMoments, 
  onUploadMoment, 
  onSelectMoment,
  onPerformanceClick,
  expandedPerformances,
  togglePerformanceExpanded
}) => (
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
              const performanceMoments = getPerformanceMoments(performance.id);
              const isExpanded = expandedPerformances.has(performance.id);
              
              return (
                <div key={`${performance.id}-${index}`} className="border-b border-gray-100 pb-3 last:border-b-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      {/* UPDATED: Make performance info clickable */}
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
                          {/* NEW: Click indicator */}
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
                          
                          {/* ✅ CLICKABLE EXPANDABLE MOMENTS BADGE */}
                          {performanceMoments.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering performance click
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

                  {/* ✅ EXPANDABLE MOMENTS: Only show when expanded */}
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
));

PerformancesList.displayName = 'PerformancesList';

export default SongDetail;