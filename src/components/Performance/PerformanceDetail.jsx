// src/components/Performance/PerformanceDetail.jsx - Dashboard Layout Refactor
import React, { useState, useEffect, memo } from 'react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';
import { useMoments, useNotifications } from '../../hooks';
import MomentDetailModal from '../Moment/MomentDetailModal';
import UploadModal from '../Moment/UploadModal';

// Import new dashboard panels
import { ShowHeaderPanel, MediaGalleryPanel, SetlistPanel, UploadPanel, CommunityPanel } from './panels';

const PerformanceDetail = memo(({ performance, onBack, onViewUserProfile, onNavigateToSong }) => {
  const [uploadingMoment, setUploadingMoment] = useState(null);
  const [selectedMoment, setSelectedMoment] = useState(null);
  const [fullPerformance, setFullPerformance] = useState(performance);
  const [loading, setLoading] = useState(false);

  const { user, token } = useAuth();
  const { refreshNotifications } = useNotifications(API_BASE_URL);
  const { moments, loadingMomentDetails, loadMomentDetails } = useMoments(API_BASE_URL);

  // Check if we need to fetch full performance data
  useEffect(() => {
    const fetchFullPerformance = async () => {
      setLoading(true);
      try {
        // Case 1: We only have an ID (from URL navigation)
        if (performance.id && !performance.venue) {
          console.log('🎸 Fetching performance by ID:', performance.id);
          const response = await fetch(`${API_BASE_URL}/cached/performance/${performance.id}`);
          if (response.ok) {
            const data = await response.json();
            if (data.performance) {
              console.log('✅ Loaded performance:', data.performance.venue?.name);
              setFullPerformance(data.performance);
            }
          }
          return;
        }

        // Case 2: From moment (need to search by venue)
        const needsFullData = !performance.sets?.set || performance.sets.set.length === 0;
        const isFromMoment = performance.id?.startsWith('moment-');

        if (needsFullData && isFromMoment) {
          const response = await fetch(`${API_BASE_URL}/cached/performances?search=${encodeURIComponent(performance.venue.name)}`);
          if (response.ok) {
            const data = await response.json();
            const matchingPerf = data.performances?.find(p =>
              p.venue?.name === performance.venue.name &&
              p.eventDate === performance.eventDate
            );
            if (matchingPerf) {
              setFullPerformance(matchingPerf);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch full performance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFullPerformance();
  }, [performance]);

  useEffect(() => {
    loadMomentDetails(`performance/${fullPerformance.id}`, `performance ${fullPerformance.id}`);
  }, [fullPerformance.id, loadMomentDetails]);

  // Upload handlers
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
      songName: song?.name || '',
      setName: setInfo?.name || '',
      songPosition: songIndex + 1,
      contentType: 'song'
    });
  };

  const handleUploadOtherContent = () => {
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
      contentType: 'other'
    });
  };

  // Separate song moments from other content
  const songMoments = moments.filter(m => !m.contentType || m.contentType === 'song');
  const otherContent = moments.filter(m => m.contentType && m.contentType !== 'song');
  const allMoments = [...songMoments, ...otherContent];

  // Extract all songs from setlist for upload panel
  const allSongs = (fullPerformance?.sets?.set || []).flatMap(set =>
    (set.song || []).filter(song => isActualSong(song.name))
  );

  // Check if show is today or in the past (can upload moments)
  const isShowDayOrPast = (() => {
    if (!fullPerformance?.eventDate) return false;
    // Parse DD-MM-YYYY format from setlist.fm
    const [day, month, year] = fullPerformance.eventDate.split('-');
    const showDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    showDate.setHours(0, 0, 0, 0);
    return showDate <= today;
  })();

  // Show loading when fetching data or when venue info not yet available
  if (loading || loadingMomentDetails || !fullPerformance?.venue) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
          <span>Loading performance...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="performance-dashboard">
      {/* Header Panel */}
      <ShowHeaderPanel
        performance={fullPerformance}
        songMoments={songMoments}
        otherContent={otherContent}
        onBack={onBack}
      />

      {/* Media Gallery - All moments in horizontal scroll */}
      {allMoments.length > 0 && (
        <MediaGalleryPanel
          moments={allMoments}
          onSelectMoment={setSelectedMoment}
          title="Moments from this show"
        />
      )}

      {/* Community Panel - Guestbook, Chat (upcoming only), RSVP */}
      <div className="mb-6">
        <CommunityPanel
          performance={fullPerformance}
          user={user}
          token={token}
          onViewUserProfile={onViewUserProfile}
        />
      </div>

      {/* Main Content Grid: Setlist + Upload */}
      <div className={`grid grid-cols-1 ${isShowDayOrPast ? 'lg:grid-cols-3' : ''} gap-6`}>
        {/* Setlist Panel - Takes 2/3 width on desktop (or full width for future shows) */}
        <div className={isShowDayOrPast ? 'lg:col-span-2' : ''}>
          <SetlistPanel
            performance={fullPerformance}
            moments={songMoments}
            onSelectMoment={setSelectedMoment}
            onSongSelect={onNavigateToSong}
          />
        </div>

        {/* Upload Panel - Only show on show day or after */}
        {isShowDayOrPast && (
          <div className="lg:col-span-1">
            <UploadPanel
              performance={fullPerformance}
              songs={allSongs}
              user={user}
              onUploadSong={handleUploadSongMoment}
              onUploadOther={handleUploadOtherContent}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {uploadingMoment && user && (
        <UploadModal
          uploadingMoment={uploadingMoment}
          onClose={() => {
            setUploadingMoment(null);
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

// Helper function to determine if a song name is actually a song
const isActualSong = (songName) => {
  if (!songName || typeof songName !== 'string') return false;

  const name = songName.toLowerCase().trim();
  const nonSongPatterns = [
    /^intro$/i, /^outro$/i, /^soundcheck$/i, /^tuning$/i,
    /^banter$/i, /^crowd$/i, /^applause$/i, /^announcement$/i,
    /^speech$/i, /^talk$/i, /.*\s+intro$/i, /.*\s+outro$/i,
    /^warm.?up$/i, /^encore\s+intro$/i, /^mic\s+check$/i,
    /^between\s+songs$/i, /^\d+$/i, /^setlist$/i, /^tease$/i
  ];

  return !nonSongPatterns.some(pattern => pattern.test(name));
};

export default PerformanceDetail;
