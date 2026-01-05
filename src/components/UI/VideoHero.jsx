// src/components/UI/VideoHero.jsx - Hero player for random video/audio clips
import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipForward, Info, ListPlus, ListMusic, Music, Minimize2, Maximize2 } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import { useTheaterQueue } from '../../contexts/TheaterQueueContext';

const VideoHero = memo(({ onMomentClick }) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const iframeRef = useRef(null);

  const [moment, setMoment] = useState(null);
  const [allMoments, setAllMoments] = useState([]);
  const [isYouTube, setIsYouTube] = useState(false);
  const [isAudio, setIsAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [youtubeKey, setYoutubeKey] = useState(0);

  // Theater queue context
  const {
    theaterQueue,
    currentQueueIndex,
    isPlayingFromQueue,
    addToQueue,
    isInQueue,
    playNextInQueue,
    playPrevInQueue,
    currentMoment: queueMoment
  } = useTheaterQueue();

  // Get YouTube video ID from URL
  const getYouTubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  };

  // Check if URL is actual video (not audio)
  const isActualVideoUrl = (url, fileName, contentType) => {
    if (!url) return false;
    if (contentType?.startsWith('video/')) return true;
    if (contentType?.startsWith('audio/')) return false;

    const videoExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];
    const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'];
    const checkString = (fileName || url).toLowerCase();

    for (const ext of audioExtensions) {
      if (checkString.includes(ext)) return false;
    }
    for (const ext of videoExtensions) {
      if (checkString.includes(ext)) return true;
    }
    return true;
  };

  // Select random moment
  const selectRandomMoment = useCallback((moments, excludeCurrent = null) => {
    if (moments.length === 0) return null;
    let availableMoments = moments;
    if (excludeCurrent && moments.length > 1) {
      availableMoments = moments.filter(m => m._id !== excludeCurrent._id);
    }
    const randomIndex = Math.floor(Math.random() * availableMoments.length);
    return availableMoments[randomIndex];
  }, []);

  // Fetch all moments (video + audio)
  useEffect(() => {
    const fetchAllMoments = async () => {
      try {
        setIsLoading(true);
        const cacheBuster = Date.now();

        const [videoRes, audioRes] = await Promise.all([
          fetch(`${API_BASE_URL}/moments?mediaType=video&_=${cacheBuster}`),
          fetch(`${API_BASE_URL}/moments?mediaType=audio&_=${cacheBuster}`)
        ]);

        const videoData = videoRes.ok ? await videoRes.json() : { moments: [] };
        const audioData = audioRes.ok ? await audioRes.json() : { moments: [] };

        const videoMoments = videoData.moments || [];
        const audioMoments = audioData.moments || [];

        // Uploaded videos
        const uploadedVideos = videoMoments.filter(m =>
          m.mediaSource === 'upload' &&
          m.mediaUrl &&
          !m.mediaUrl.includes('youtube') &&
          !m.mediaUrl.includes('youtu.be') &&
          isActualVideoUrl(m.mediaUrl, m.fileName, m.contentType)
        );

        // YouTube videos
        const youtubeVideos = videoMoments.filter(m =>
          (m.mediaSource === 'youtube' || m.mediaUrl?.includes('youtube') || m.mediaUrl?.includes('youtu.be')) &&
          (m.externalVideoId || getYouTubeId(m.mediaUrl))
        );

        // Audio moments
        const validAudio = audioMoments.filter(m =>
          m.mediaUrl && m.mediaSource === 'upload'
        );

        // Combine with type flags
        const combined = [
          ...uploadedVideos.map(m => ({ ...m, _isYouTube: false, _isAudio: false })),
          ...youtubeVideos.map(m => ({ ...m, _isYouTube: true, _isAudio: false })),
          ...validAudio.map(m => ({ ...m, _isYouTube: false, _isAudio: true }))
        ];

        setAllMoments(combined);

        if (combined.length > 0) {
          const selected = selectRandomMoment(combined);
          setMoment(selected);
          setIsYouTube(selected._isYouTube);
          setIsAudio(selected._isAudio);
        } else {
          setError('No content available');
        }
      } catch (err) {
        console.error('Error fetching moments:', err);
        setError('Failed to load');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllMoments();
  }, [selectRandomMoment]);

  // Sync with queue playback
  useEffect(() => {
    if (isPlayingFromQueue && queueMoment) {
      const isYT = queueMoment.mediaSource === 'youtube' || queueMoment.mediaUrl?.includes('youtube') || queueMoment.mediaUrl?.includes('youtu.be');
      const isAud = queueMoment.mediaType === 'audio';
      setMoment({ ...queueMoment, _isYouTube: isYT, _isAudio: isAud });
      setIsYouTube(isYT);
      setIsAudio(isAud);
      setIsPlaying(true);
      setIsMuted(false);
      setYoutubeKey(prev => prev + 1);
    }
  }, [isPlayingFromQueue, queueMoment, currentQueueIndex]);

  // Handle next
  const handleNext = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }

    if (isPlayingFromQueue) {
      playNextInQueue();
    } else if (allMoments.length > 0) {
      const next = selectRandomMoment(allMoments, moment);
      if (next) {
        setMoment(next);
        setIsYouTube(next._isYouTube);
        setIsAudio(next._isAudio);
        setIsPlaying(true);
        setYoutubeKey(prev => prev + 1);
      }
    }
  }, [allMoments, moment, selectRandomMoment, isPlayingFromQueue, playNextInQueue]);

  // Add to queue
  const handleAddToQueue = useCallback(() => {
    if (moment) {
      addToQueue(moment);
    }
  }, [moment, addToQueue]);

  // Toggle play/pause
  const togglePlayPause = () => {
    if (isAudio && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } else if (isYouTube && iframeRef.current) {
      setIsPlaying(!isPlaying);
      setYoutubeKey(prev => prev + 1);
    } else if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  // Toggle mute
  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);

    if (isAudio && audioRef.current) {
      audioRef.current.muted = newMuted;
    } else if (isYouTube && iframeRef.current) {
      iframeRef.current.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: newMuted ? 'mute' : 'unMute',
        args: []
      }), '*');
    } else if (videoRef.current) {
      videoRef.current.muted = newMuted;
    }
  };

  // Handle info click
  const handleInfoClick = (e) => {
    e.stopPropagation();
    if (moment && onMomentClick) {
      onMomentClick(moment);
    }
  };

  // Handle video loaded
  const handleVideoLoaded = () => {
    setIsLoading(false);
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  if (error || (!isLoading && !moment)) {
    return null;
  }

  // YouTube setup
  const youtubeId = isYouTube ? (moment?.externalVideoId || getYouTubeId(moment?.mediaUrl)) : null;
  const startTime = moment?.startTime || 0;
  const youtubeUrl = youtubeId
    ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${youtubeId}&controls=0&modestbranding=1&rel=0&enablejsapi=1&start=${startTime}`
    : null;

  // Minimized view
  if (isMinimized) {
    return (
      <div className="mb-6 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={handleInfoClick}>
            {moment && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-800 rounded flex items-center justify-center">
                  {isAudio ? <Music size={16} className="text-yellow-400" /> : <Play size={16} className="text-yellow-400" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-white font-medium text-sm truncate">
                    {moment.songName}
                  </h3>
                  <p className="text-gray-500 text-xs truncate">
                    {moment.venueName}
                  </p>
                </div>
              </div>
            )}
          </div>

          {isPlayingFromQueue && (
            <div className="flex items-center gap-2 px-3 py-1 bg-yellow-900/30 border border-yellow-700/50 rounded mr-3">
              <ListMusic size={14} className="text-yellow-400" />
              <span className="text-yellow-400 text-xs font-mono">
                {currentQueueIndex + 1}/{theaterQueue.length}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
              className="bg-gray-800 hover:bg-gray-700 rounded-full p-2 transition-colors"
            >
              {isPlaying ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="bg-gray-800 hover:bg-gray-700 rounded-full p-2 transition-colors"
            >
              <SkipForward size={14} className="text-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
              className="bg-yellow-600/50 hover:bg-yellow-600/70 rounded-full p-2 transition-colors"
            >
              <Maximize2 size={14} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="video-hero relative mb-6 overflow-hidden rounded-lg bg-black">
      {/* Minimize button */}
      <button
        onClick={() => setIsMinimized(true)}
        className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 flex items-center gap-2 transition-all hover:scale-105"
      >
        <Minimize2 size={14} className="text-white" />
        <span className="text-white text-xs font-medium">Minimize</span>
      </button>

      {/* Audio Mode */}
      {isAudio && moment ? (
        <div className="relative w-full" style={{ paddingBottom: '40%', minHeight: '250px' }}>
          <audio
            key={`audio-${moment._id}`}
            ref={audioRef}
            src={moment.mediaUrl}
            crossOrigin="anonymous"
            loop
            muted={isMuted}
            preload="auto"
            onLoadedData={() => {
              setIsLoading(false);
              if (audioRef.current) {
                audioRef.current.muted = isMuted;
                audioRef.current.play()
                  .then(() => setIsPlaying(true))
                  .catch(() => setIsPlaying(false));
              }
            }}
            onEnded={handleNext}
          />

          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900" />

          {/* Audio indicator */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-purple-600/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <Music size={14} className="text-white" />
            <span className="text-white text-xs font-medium">Audio</span>
          </div>

          {/* Play/Pause button */}
          <button
            onClick={togglePlayPause}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-15 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full p-4 transition-all hover:scale-110"
          >
            {isPlaying ? (
              <Pause size={32} className="text-white" />
            ) : (
              <Play size={32} className="text-white ml-1" />
            )}
          </button>

          {/* Song info */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 z-10 pointer-events-none">
            <h3 className="text-white font-bold text-base sm:text-lg truncate">
              {moment.songName}
            </h3>
            <p className="text-gray-300 text-xs sm:text-sm truncate">
              {moment.venueName} {moment.performanceDate && `• ${moment.performanceDate}`}
            </p>
          </div>
        </div>
      ) : isYouTube && youtubeId ? (
        /* YouTube Mode */
        <div className="relative w-full cursor-pointer" style={{ paddingBottom: '56.25%' }} onClick={togglePlayPause}>
          <iframe
            key={youtubeKey}
            ref={iframeRef}
            className="absolute top-0 left-0 w-full h-full"
            src={youtubeUrl}
            title={moment?.songName || 'Video'}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />

          {/* Top info banner */}
          <div className="absolute top-0 left-0 right-0 z-25 bg-gradient-to-b from-black via-black/80 to-transparent pointer-events-none" style={{ height: '80px' }}>
            {moment && (
              <div className="px-4 py-3">
                <h3 className="text-white font-bold text-base sm:text-lg truncate drop-shadow-lg">
                  {moment.songName}
                </h3>
                <p className="text-gray-300 text-xs sm:text-sm truncate drop-shadow-md">
                  {moment.venueName} {moment.performanceDate && `• ${moment.performanceDate}`}
                </p>
              </div>
            )}
          </div>

          {!isPlaying && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
              <Play size={64} className="text-white opacity-80" />
            </div>
          )}
        </div>
      ) : (
        /* Uploaded Video Mode */
        <div className="relative">
          {moment && !isYouTube && !isAudio && (
            <video
              key={`video-${moment._id}`}
              ref={videoRef}
              src={moment.mediaUrl}
              crossOrigin="anonymous"
              muted={isMuted}
              loop
              playsInline
              preload="auto"
              onLoadedData={handleVideoLoaded}
              onEnded={handleNext}
              className="w-full"
              style={{ maxHeight: '400px', objectFit: 'contain', backgroundColor: '#000' }}
            />
          )}

          <div className="relative cursor-pointer" onClick={togglePlayPause}>
            {!isPlaying && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none z-10">
                <Play size={64} className="text-white opacity-80" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 z-30">
        <div className="flex items-center justify-between">
          {/* Song info for video mode */}
          {!isAudio && moment && (
            <div className="flex-1 min-w-0 mr-4">
              <h3 className="text-white font-bold text-sm sm:text-base truncate">
                {moment.songName}
              </h3>
              <p className="text-gray-300 text-xs truncate">
                {moment.venueName}
              </p>
            </div>
          )}

          {/* Queue indicator */}
          {isPlayingFromQueue && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-900/40 border border-yellow-600/50 rounded-full mr-3">
              <ListMusic size={14} className="text-yellow-400" />
              <span className="text-yellow-400 text-xs font-mono font-medium">
                {currentQueueIndex + 1}/{theaterQueue.length}
              </span>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
              className="bg-white/20 hover:bg-white/30 rounded-full p-2.5 sm:p-2 transition-colors"
              style={{ minWidth: '40px', minHeight: '40px' }}
            >
              {isPlaying ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-white ml-0.5" />}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              className={`rounded-full p-2.5 sm:p-2 transition-colors ${
                isMuted ? 'bg-orange-500 hover:bg-orange-400 animate-pulse' : 'bg-white/20 hover:bg-white/30'
              }`}
              style={{ minWidth: '40px', minHeight: '40px' }}
              title={isMuted ? 'Click for sound' : 'Mute'}
            >
              {isMuted ? <VolumeX size={18} className="text-white" /> : <Volume2 size={18} className="text-white" />}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="bg-white/20 hover:bg-white/30 rounded-full p-2.5 sm:p-2 transition-colors"
              style={{ minWidth: '40px', minHeight: '40px' }}
              title="Next random"
            >
              <SkipForward size={18} className="text-white" />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); handleAddToQueue(); }}
              className={`rounded-full p-2.5 sm:p-2 transition-colors ${
                moment && isInQueue(moment._id)
                  ? 'bg-yellow-600/50 hover:bg-yellow-600/70'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
              style={{ minWidth: '40px', minHeight: '40px' }}
              title={moment && isInQueue(moment._id) ? 'In queue' : 'Add to queue'}
            >
              <ListPlus size={18} className="text-white" />
            </button>

            <button
              onClick={handleInfoClick}
              className="bg-blue-600/50 hover:bg-blue-600/70 rounded-full p-2.5 sm:p-2 transition-colors"
              style={{ minWidth: '40px', minHeight: '40px' }}
              title="View details"
            >
              <Info size={18} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

VideoHero.displayName = 'VideoHero';

export default VideoHero;
