// src/components/Performance/PerformanceDetail.jsx
import React, { useState, useEffect, memo } from 'react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';
import { useMoments } from '../../hooks';
import { formatDate } from '../../utils';
import MomentDetailModal from '../Moment/MomentDetailModal';
import UploadModal from '../Moment/UploadModal';

const PerformanceDetail = memo(({ performance, onBack }) => {
  const [uploadingMoment, setUploadingMoment] = useState(null);
  const [selectedMoment, setSelectedMoment] = useState(null);
  const { user } = useAuth();
  
  // Use the hook instead of manual state management
  const { moments, loadingMomentDetails: loading, loadMomentDetails } = useMoments(API_BASE_URL);

  useEffect(() => {
    // Use the hook's method
    loadMomentDetails(`performance/${performance.id}`, `performance ${performance.id}`);
  }, [performance.id, loadMomentDetails]);
  

  const handleUploadMoment = (song, setInfo, songIndex) => {
    if (!user) {
      alert('Please log in to upload moments');
      return;
    }
    
    setUploadingMoment({ 
      performanceId: performance.id,
      performanceDate: performance.eventDate,
      venueName: performance.venue.name,
      venueCity: performance.venue.city.name,
      venueCountry: performance.venue.city.country?.name || '',
      songName: song.name,
      setName: setInfo?.name || '',
      songPosition: songIndex + 1
    });
  };

  const getSongMoments = (songName) => {
    return moments.filter(moment => moment.songName === songName);
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

  return (
    <div>
      {/* Header */}
      <PerformanceHeader 
        performance={performance}
        moments={moments}
        onBack={onBack}
      />

      {/* Setlist */}
      <SetlistDisplay 
        performance={performance}
        user={user}
        getSongMoments={getSongMoments}
        onUploadMoment={handleUploadMoment}
        onSelectMoment={setSelectedMoment}
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

// Sub-components
const PerformanceHeader = memo(({ performance, moments, onBack }) => (
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
    {moments.length > 0 && (
      <p className="text-sm text-blue-600 mt-2">
        {moments.length} moment{moments.length !== 1 ? 's' : ''} uploaded for this show
      </p>
    )}
  </div>
));

PerformanceHeader.displayName = 'PerformanceHeader';

const SetlistDisplay = memo(({ 
  performance, 
  user, 
  getSongMoments, 
  onUploadMoment, 
  onSelectMoment 
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
      {performance.sets.set.map((set, index) => (
        <SetCard 
          key={index}
          set={set}
          user={user}
          getSongMoments={getSongMoments}
          onUploadMoment={(song, songIndex) => onUploadMoment(song, set, songIndex)}
          onSelectMoment={onSelectMoment}
        />
      ))}
    </div>
  );
});

SetlistDisplay.displayName = 'SetlistDisplay';

const SetCard = memo(({ 
  set, 
  user, 
  getSongMoments, 
  onUploadMoment, 
  onSelectMoment 
}) => (
  <div className="border border-gray-200 rounded-lg bg-white shadow-sm p-4">
    {set.name && (
      <h4 className="text-lg font-semibold mb-3 text-blue-600">{set.name}</h4>
    )}
    
    <ol className="space-y-3">
      {set.song?.map((song, i) => {
        const songMoments = getSongMoments(song.name);
        
        return (
          <SongItem 
            key={`${song.name}-${i}`}
            song={song}
            songIndex={i}
            songMoments={songMoments}
            user={user}
            onUploadMoment={() => onUploadMoment(song, i)}
            onSelectMoment={onSelectMoment}
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
  onUploadMoment, 
  onSelectMoment 
}) => (
  <li className="border-b border-gray-100 pb-3 last:border-b-0">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3 flex-1">
        <span className="text-sm text-gray-500 w-8">{songIndex + 1}.</span>
        
        <div className="flex items-center gap-3 flex-1">
          <span className="font-medium text-gray-900">{song.name}</span>
          
          {songMoments.length > 0 && (
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
              {songMoments.length} moment{songMoments.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {user && (
          <button
            onClick={onUploadMoment}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            Upload Moment
          </button>
        )}
      </div>
    </div>

    {/* Show moments for this song */}
    {songMoments.length > 0 && (
      <div className="mt-3 ml-11">
        <div className="flex flex-wrap gap-2">
          {songMoments.map((moment) => (
            <button
              key={moment._id}
              onClick={() => onSelectMoment(moment)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded border transition-colors"
            >
              by {moment.user?.displayName || 'Anonymous'}
              {moment.momentType && (
                <span className="ml-2 text-xs text-gray-500">
                  ({moment.momentType})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    )}
  </li>
));

SongItem.displayName = 'SongItem';

export default PerformanceDetail;