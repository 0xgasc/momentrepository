// src/components/UI/VideoHero.jsx - Hero player for random video/audio clips
import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { Play, Pause, Music, Loader2, ListMusic, SkipForward } from 'lucide-react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';
import { useTheaterQueue } from '../../contexts/TheaterQueueContext';
import UMOEffect from './UMOEffect';
import WaveformPlayer from './WaveformPlayer';
import VideoHeroComments from './VideoHeroComments';
// FavoriteButton moved to MediaControlCenter
import { transformMediaUrl } from '../../utils/mediaUrl';

// ASCII character map - from darkest to brightest
const ASCII_CHARS = ' .:-=+*#%@';

// Keep only trippy effect - removed redundant filter presets

const VideoHero = memo(({ onMomentClick, mediaFilters = { audio: true, video: true, linked: true, uploads: true }, customMoments = null, noAutoMinimize = false }) => {
  const { user, token } = useAuth();
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const hideTimerRef = useRef(null);
  const containerRef = useRef(null);

  const [moment, setMoment] = useState(null);
  const [allMoments, setAllMoments] = useState([]);
  // mediaFilters is controlled by parent (object with audio, video, linked, uploads)
  const [isYouTube, setIsYouTube] = useState(false);
  const [isAudio, setIsAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const [volume, setVolume] = useState(1); // Volume level 0-1
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const hasAutoMinimized = useRef(false);
  const [youtubeKey, setYoutubeKey] = useState(0);
  const [trippyEffect, setTrippyEffect] = useState(false);
  const [effectIntensity, setEffectIntensity] = useState(75); // Fixed at 75%
  const [asciiOutput, setAsciiOutput] = useState([]);
  const [isAsciiMode, setIsAsciiMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [isVerticalVideo, setIsVerticalVideo] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [ytProgress, setYtProgress] = useState({ currentTime: 0, duration: 0 });
  const [isYtLoading, setIsYtLoading] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [nativeProgress, setNativeProgress] = useState({ currentTime: 0, duration: 0 });
  const frameSkipRef = useRef(0);
  const ytPlayerRef = useRef(null);
  const ytProgressIntervalRef = useRef(null);
  const handleNextRef = useRef(null);
  const handlePrevRef = useRef(null);

  // YouTube bar drag/hover state
  const [ytDragging, setYtDragging] = useState(false);
  const [ytDragProgress, setYtDragProgress] = useState(0);
  const [ytHoverPos, setYtHoverPos] = useState(null);
  const ytDraggingRef = useRef(false);
  const ytBarRef = useRef(null);
  // Track if any seeker is being dragged (to suppress auto-hide)
  const seekerDraggingRef = useRef(false);

  // Mobile detection for performance optimization
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // YouTube IFrame API loader
  useEffect(() => {
    if (window.YT) return; // Already loaded
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(tag, firstScript);
  }, []);

  // YouTube progress tracking with end time enforcement
  useEffect(() => {
    if (!isYouTube) return;

    // Start progress tracking interval
    ytProgressIntervalRef.current = setInterval(() => {
      try {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
          const currentTime = ytPlayerRef.current.getCurrentTime() || 0;
          const duration = ytPlayerRef.current.getDuration() || 0;
          // Skip state update during drag to prevent playhead snap-back
          if (!ytDraggingRef.current) {
            setYtProgress({ currentTime, duration });
          }

          // Check if we've reached the moment's end time
          if (moment?.endTime && currentTime >= moment.endTime) {
            // Skip to next moment
            if (ytProgressIntervalRef.current) {
              clearInterval(ytProgressIntervalRef.current);
            }
            handleNextRef.current?.();
          }
        }
      } catch (e) {
        // Player not ready
      }
    }, 500);

    return () => {
      if (ytProgressIntervalRef.current) {
        clearInterval(ytProgressIntervalRef.current);
      }
    };
  }, [isYouTube, youtubeKey, moment?.endTime]);

  // Cleanup YT player on moment change
  useEffect(() => {
    // Reset loading and progress state for new moment
    setIsYtLoading(true);
    setYtProgress({ currentTime: 0, duration: 0 });

    return () => {
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {
          // Player might already be destroyed
        }
        ytPlayerRef.current = null;
      }
    };
  }, [moment?._id]);

  // Track native media (audio/video element) progress
  useEffect(() => {
    if (isYouTube) return;

    const updateProgress = () => {
      const mediaEl = isAudio ? audioRef.current : videoRef.current;
      if (mediaEl) {
        setNativeProgress({
          currentTime: mediaEl.currentTime || 0,
          duration: mediaEl.duration || 0
        });
      }
    };

    // Update every 500ms
    const interval = setInterval(updateProgress, 500);
    updateProgress(); // Initial call

    return () => clearInterval(interval);
  }, [isYouTube, isAudio, moment?._id]);

  // Auto-minimize on first load once playback starts (disabled on landing page and mobile)
  useEffect(() => {
    if (noAutoMinimize || isMobile) return;
    if (moment && isPlaying && !hasAutoMinimized.current && !isMinimized) {
      const timer = setTimeout(() => {
        if (!hasAutoMinimized.current) {
          hasAutoMinimized.current = true;
          setIsMinimized(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [moment, isPlaying, isMinimized, noAutoMinimize, isMobile]);

  // Theater queue context
  const {
    theaterQueue,
    currentQueueIndex,
    isPlayingFromQueue,
    addToQueue,
    playNextInQueue,
    playPrevInQueue,
    currentMoment: queueMoment,
    registerPlayerControls,
    updatePlayerState,
    setPlayingMoment
  } = useTheaterQueue();

  // Get YouTube video ID from URL
  const getYouTubeId = (url) => {
    if (!url) return null;
    // eslint-disable-next-line no-useless-escape
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
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

  // Sync the currently playing moment to context for MediaControlCenter
  useEffect(() => {
    if (moment && !isPlayingFromQueue) {
      setPlayingMoment(moment);
    }
  }, [moment, isPlayingFromQueue, setPlayingMoment]);

  // Detect content type from moment data
  const detectContentType = useCallback((m) => {
    if (!m) return { isYouTube: false, isAudio: false, isArchive: false };

    // Check for archive.org first
    // Archive identifiers start with "umo" followed by date (e.g., umo2013-03-18.skm140.flac24)
    // Use case-insensitive match for UMO/umo
    const isArchive = m.mediaSource === 'archive' ||
      m.mediaUrl?.includes('archive.org') ||
      m.externalVideoId?.match(/^umo\d{4}/i);
    if (isArchive) return { isYouTube: false, isAudio: true, isArchive: true };

    // Need mediaUrl for other checks
    if (!m.mediaUrl) return { isYouTube: false, isAudio: false, isArchive: false };

    // Check for YouTube (exclude archive.org patterns)
    const isYT = m.mediaSource === 'youtube' ||
      m.mediaUrl?.includes('youtube.com') ||
      m.mediaUrl?.includes('youtu.be') ||
      (m.externalVideoId && !m.externalVideoId.match(/^umo\d{4}/i));

    if (isYT) return { isYouTube: true, isAudio: false, isArchive: false };

    // Check file extension and content type
    const url = (m.mediaUrl || '').toLowerCase();
    const fileName = (m.fileName || '').toLowerCase();
    const contentType = (m.contentType || m.mediaType || '').toLowerCase();

    const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'];
    const videoExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v', '.quicktime'];

    // Check for audio first
    for (const ext of audioExtensions) {
      if (url.includes(ext) || fileName.includes(ext)) {
        return { isYouTube: false, isAudio: true };
      }
    }
    if (contentType.includes('audio/')) {
      return { isYouTube: false, isAudio: true };
    }

    // Check for video
    for (const ext of videoExtensions) {
      if (url.includes(ext) || fileName.includes(ext)) {
        return { isYouTube: false, isAudio: false };
      }
    }
    if (contentType.includes('video/') || contentType === 'video') {
      return { isYouTube: false, isAudio: false };
    }

    // Default: treat as video (most uploads are video)
    return { isYouTube: false, isAudio: false };
  }, []);

  // Filter moments based on media type and source toggles
  const filterMoments = useCallback((moments, filters) => {
    return moments.filter(m => {
      // Check media type (audio or video)
      const isAudioMoment = m._isAudio || m._isArchive;
      const isVideoMoment = !isAudioMoment;
      const matchesType = (filters.audio && isAudioMoment) || (filters.video && isVideoMoment);

      // Check source (linked or uploads)
      const isLinked = m._isYouTube || m._isArchive || m.mediaSource === 'vimeo' || m.mediaSource === 'youtube' || m.mediaSource === 'archive';
      const isUpload = m.mediaSource === 'upload' || (!m._isYouTube && !m._isArchive && m.mediaSource !== 'vimeo');
      const matchesSource = (filters.linked && isLinked) || (filters.uploads && isUpload);

      return matchesType && matchesSource;
    });
  }, []);

  // Memoized filtered moments
  const filteredMoments = useMemo(() =>
    filterMoments(allMoments, mediaFilters),
    [allMoments, mediaFilters, filterMoments]
  );

  // Fetch ALL moments and filter client-side (or use customMoments if provided)
  useEffect(() => {
    // If customMoments provided, use those instead of fetching
    if (customMoments && customMoments.length > 0) {
      // Filter to only playable content (has mediaUrl)
      const playable = customMoments.filter(m => m.mediaUrl);

      // Add type flags to each moment
      const withTypes = playable.map(m => {
        const { isYouTube: isYT, isAudio: isAud, isArchive } = detectContentType(m);
        return { ...m, _isYouTube: isYT, _isAudio: isAud, _isArchive: isArchive };
      });

      setAllMoments(withTypes);

      if (withTypes.length > 0) {
        const videos = withTypes.filter(m => !m._isAudio);
        const toSelect = videos.length > 0 ? videos : withTypes;
        const selected = selectRandomMoment(toSelect);
        setMoment(selected);
        setIsYouTube(selected._isYouTube);
        setIsAudio(selected._isAudio);
      } else {
        setError('No content available');
      }
      setIsLoading(false);
      return;
    }

    const fetchAllMoments = async () => {
      try {
        setIsLoading(true);
        const cacheBuster = Date.now();

        // Fetch all moments without filtering
        const response = await fetch(`${API_BASE_URL}/moments?_=${cacheBuster}`);

        if (!response.ok) {
          throw new Error('Failed to fetch moments');
        }

        const data = await response.json();
        const allData = data.moments || [];

        // Filter to only playable content (has mediaUrl)
        const playable = allData.filter(m => m.mediaUrl);

        // Add type flags to each moment
        const withTypes = playable.map(m => {
          const { isYouTube: isYT, isAudio: isAud, isArchive } = detectContentType(m);
          return { ...m, _isYouTube: isYT, _isAudio: isAud, _isArchive: isArchive };
        });

        setAllMoments(withTypes);

        if (withTypes.length > 0) {
          // Prefer video content over audio for hero
          const videos = withTypes.filter(m => !m._isAudio);
          const toSelect = videos.length > 0 ? videos : withTypes;
          const selected = selectRandomMoment(toSelect);
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
  }, [selectRandomMoment, detectContentType, customMoments]);

  // Handle filter change - select new moment if current doesn't match filter
  useEffect(() => {
    if (!moment) return;

    // If no content matches filter, stop playback
    if (filteredMoments.length === 0) {
      // Stop all media
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    // Check if current moment is in filtered list
    const currentInFiltered = filteredMoments.some(m => m._id === moment._id);
    if (!currentInFiltered) {
      const next = selectRandomMoment(filteredMoments);
      if (next) {
        setMoment(next);
        setIsYouTube(next._isYouTube);
        setIsAudio(next._isAudio);
        setYoutubeKey(prev => prev + 1);
      }
    }
  }, [mediaFilters, filteredMoments, moment, selectRandomMoment]);

  // Reset effects when media type changes
  useEffect(() => {
    // Reset ASCII mode when switching away from uploaded video
    if (isYouTube || isAudio) {
      setIsAsciiMode(false);
    }
    // Reset trippy effect when switching away from YouTube
    if (!isYouTube) {
      setTrippyEffect(false);
    }
  }, [isYouTube, isAudio]);

  // Sync with queue playback
  useEffect(() => {
    if (isPlayingFromQueue && queueMoment) {
      const { isYouTube: isYT, isAudio: isAud, isArchive } = detectContentType(queueMoment);
      setMoment({ ...queueMoment, _isYouTube: isYT, _isAudio: isAud, _isArchive: isArchive });
      setIsYouTube(isYT);
      setIsAudio(isAud);
      setIsPlaying(true);
      setIsMuted(false);
      setYoutubeKey(prev => prev + 1);
    }
  }, [isPlayingFromQueue, queueMoment, currentQueueIndex, detectContentType]);

  // Ensure playback continues after moment change (fixes skip stopping bug)
  useEffect(() => {
    if (!moment || isYouTube) return;

    const playMedia = async () => {
      // Small delay to ensure DOM has updated with new source
      await new Promise(r => setTimeout(r, 100));

      if (isAudio && audioRef.current) {
        audioRef.current.muted = isMuted;
        try {
          await audioRef.current.play();
          setIsPlaying(true);
          setAutoplayBlocked(false);
        } catch (e) {
          setIsPlaying(false);
          setAutoplayBlocked(true);
        }
      } else if (videoRef.current) {
        videoRef.current.muted = isMuted;
        try {
          await videoRef.current.play();
          setIsPlaying(true);
          setAutoplayBlocked(false);
        } catch (e) {
          setIsPlaying(false);
          setAutoplayBlocked(true);
        }
      }
    };

    if (isPlaying) {
      playMedia();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment?._id]); // Only trigger on moment ID change

  // ASCII character mapping function
  const getAsciiChar = useCallback((brightness) => {
    const index = Math.floor((brightness / 255) * (ASCII_CHARS.length - 1));
    return ASCII_CHARS[index];
  }, []);

  // Process video frame to ASCII
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended || !isAsciiMode) return;

    // Skip frames on mobile for better performance (process every 3rd frame)
    if (isMobile) {
      frameSkipRef.current = (frameSkipRef.current + 1) % 3;
      if (frameSkipRef.current !== 0) {
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Scale based on intensity - reduced on mobile for performance
    // Desktop: 60-140 columns, Mobile: 30-70 columns
    const baseCols = isMobile ? 30 : 60;
    const colMultiplier = isMobile ? 0.4 : 0.8;
    const cols = Math.floor(baseCols + (effectIntensity * colMultiplier));
    const aspectRatio = video.videoHeight / video.videoWidth;
    const rows = Math.floor(cols * aspectRatio * 0.5); // Half because chars are taller

    canvas.width = cols;
    canvas.height = rows;
    ctx.drawImage(video, 0, 0, cols, rows);

    const imageData = ctx.getImageData(0, 0, cols, rows);
    const pixels = imageData.data;

    const asciiRows = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const brightness = (r + g + b) / 3;
        const char = getAsciiChar(brightness);
        const color = `rgb(${r}, ${g}, ${b})`; // Keep colored ASCII on all devices
        row.push({ char, color });
      }
      asciiRows.push(row);
    }
    setAsciiOutput(asciiRows);
    animationRef.current = requestAnimationFrame(processFrame);
  }, [getAsciiChar, effectIntensity, isAsciiMode, isMobile]);

  // Reset ASCII and loading state when moment changes (fixes back-to-back video issue)
  useEffect(() => {
    setAsciiOutput([]);
    setIsVerticalVideo(false);
    // Reset loading state for new content
    if (moment && !moment._isYouTube) {
      setIsLoading(true);
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment?._id]);

  // Fix: Reset play state when moment or media type changes (prevents stuck play icon)
  useEffect(() => {
    if (!moment) return;

    // Reset all playback-related state
    setIsPlaying(false);
    setIsLoading(true);
    setIsYtLoading(true);
    setAutoplayBlocked(false);

    // Small delay then auto-play to ensure state is clean
    const timer = setTimeout(() => {
      setIsPlaying(true);
    }, 100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment?._id, isYouTube, isAudio]);

  // Start/stop ASCII processing
  useEffect(() => {
    if (isAsciiMode && !isYouTube && !isAudio && videoRef.current && moment) {
      // Wait for video to be ready
      const startProcessing = () => {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          animationRef.current = requestAnimationFrame(processFrame);
        } else {
          setTimeout(startProcessing, 100);
        }
      };
      startProcessing();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAsciiMode, isYouTube, isAudio, processFrame, moment?._id]);

  // Auto-hide controls after 2 seconds of no interaction
  const resetHideTimer = useCallback(() => {
    if (seekerDraggingRef.current) return; // Don't hide during drag
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(true);
    hideTimerRef.current = setTimeout(() => {
      if (!seekerDraggingRef.current) setShowControls(false);
    }, 2000);
  }, []);

  // Handle drag state from WaveformPlayer or YouTube bar
  const handleSeekerDragState = useCallback((dragging) => {
    seekerDraggingRef.current = dragging;
    if (dragging) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setShowControls(true);
    } else {
      resetHideTimer();
    }
  }, [resetHideTimer]);

  // Start hide timer when playing
  useEffect(() => {
    if (isPlaying) {
      resetHideTimer();
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isPlaying, resetHideTimer]);

  // Keep controls visible when paused
  useEffect(() => {
    if (!isPlaying) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setShowControls(true);
    }
  }, [isPlaying]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.log('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle next
  const handleNext = useCallback(() => {
    console.log('🎲 handleNext called', {
      filteredMomentsLength: filteredMoments.length,
      isPlayingFromQueue,
      currentMoment: moment?._id
    });

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }

    if (isPlayingFromQueue) {
      console.log('📼 Playing from queue');
      playNextInQueue();
    } else if (filteredMoments.length > 0) {
      const next = selectRandomMoment(filteredMoments, moment);
      console.log('🎯 Selected next moment:', next?._id);
      if (next) {
        setMoment(next);
        setIsYouTube(next._isYouTube);
        setIsAudio(next._isAudio);
        setIsPlaying(true);
        setYoutubeKey(prev => prev + 1);
      } else {
        console.warn('⚠️ selectRandomMoment returned null');
      }
    } else {
      console.warn('⚠️ No filtered moments available');
    }
  }, [filteredMoments, moment, selectRandomMoment, isPlayingFromQueue, playNextInQueue]);

  // Handle previous - go to previous in queue, or restart current track
  const handlePrev = useCallback(() => {
    // If more than 3 seconds in, restart current track (like Spotify)
    const currentTime = isAudio ? audioRef.current?.currentTime :
                        isYouTube ? ytPlayerRef.current?.getCurrentTime?.() :
                        videoRef.current?.currentTime;
    if (currentTime && currentTime > 3) {
      if (isAudio && audioRef.current) audioRef.current.currentTime = 0;
      else if (videoRef.current) videoRef.current.currentTime = 0;
      else if (isYouTube && ytPlayerRef.current) ytPlayerRef.current.seekTo(moment?.startTime || 0);
    } else if (isPlayingFromQueue) {
      playPrevInQueue();
    } else {
      // Not in queue, just restart
      if (isAudio && audioRef.current) audioRef.current.currentTime = 0;
      else if (videoRef.current) videoRef.current.currentTime = 0;
      else if (isYouTube && ytPlayerRef.current) ytPlayerRef.current.seekTo(moment?.startTime || 0);
    }
  }, [isAudio, isYouTube, isPlayingFromQueue, playPrevInQueue, moment?.startTime]);

  // Keep refs in sync for use in early useEffect
  useEffect(() => {
    handleNextRef.current = handleNext;
    handlePrevRef.current = handlePrev;
  }, [handleNext, handlePrev]);

  // Media Session API for lock screen controls (enhanced for background playback)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !moment) return;

    // Set metadata for lock screen display
    navigator.mediaSession.metadata = new MediaMetadata({
      title: moment.songName || 'Unknown Song',
      artist: 'Unknown Mortal Orchestra',
      album: moment.venueName || moment.venueCity || 'Live Performance',
      artwork: moment.thumbnailUrl ? [
        { src: transformMediaUrl(moment.thumbnailUrl), sizes: '96x96', type: 'image/jpeg' },
        { src: transformMediaUrl(moment.thumbnailUrl), sizes: '128x128', type: 'image/jpeg' },
        { src: transformMediaUrl(moment.thumbnailUrl), sizes: '256x256', type: 'image/jpeg' },
        { src: transformMediaUrl(moment.thumbnailUrl), sizes: '512x512', type: 'image/jpeg' }
      ] : []
    });

    // Set up action handlers
    navigator.mediaSession.setActionHandler('play', () => {
      if (!isPlaying) {
        if (isAudio && audioRef.current) {
          audioRef.current.play().catch(() => {});
        } else if (isYouTube && ytPlayerRef.current) {
          try { ytPlayerRef.current.playVideo(); } catch (e) {}
        } else if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
        setIsPlaying(true);
      }
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      if (isPlaying) {
        if (isAudio && audioRef.current) {
          audioRef.current.pause();
        } else if (isYouTube && ytPlayerRef.current) {
          try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
        } else if (videoRef.current) {
          videoRef.current.pause();
        }
        setIsPlaying(false);
      }
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      handleNextRef.current?.();
    });

    // Previous track handler
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      handlePrevRef.current?.();
    });

    // Seek handler for lock screen scrubbing
    try {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          if (isAudio && audioRef.current) {
            audioRef.current.currentTime = details.seekTime;
          } else if (videoRef.current) {
            videoRef.current.currentTime = details.seekTime;
          } else if (isYouTube && ytPlayerRef.current) {
            ytPlayerRef.current.seekTo(details.seekTime);
          }
        }
      });
    } catch (e) {
      // seekto not supported in all browsers
    }

    // Update playback state
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    return () => {
      // Clean up action handlers
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      } catch (e) {
        // Some browsers don't support null handlers
      }
    };
  }, [moment, isPlaying, isAudio, isYouTube]);

  // Update Media Session position state for lock screen progress bar
  useEffect(() => {
    if (!('mediaSession' in navigator) || !moment) return;

    const progress = isYouTube ? ytProgress : nativeProgress;
    if (progress.duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: progress.duration,
          playbackRate: 1,
          position: Math.min(progress.currentTime, progress.duration)
        });
      } catch (e) {
        // Position state not supported in all browsers
      }
    }
  }, [moment, isYouTube, ytProgress, nativeProgress]);

  // Prevent audio pause on visibility change (background playback support)
  useEffect(() => {
    const handleVisibilityChange = () => {
      // When page becomes hidden (screen lock, tab switch), don't pause audio
      // Native audio elements will continue playing by default
      // YouTube will pause itself (YouTube policy - can't override)
      if (document.hidden && isPlaying && !isYouTube) {
        // For native audio/video, ensure it keeps playing
        // Some browsers pause on visibility change, so we resume
        setTimeout(() => {
          if (isAudio && audioRef.current && audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
          } else if (videoRef.current && videoRef.current.paused) {
            // Video might pause on background, try to continue audio track
            videoRef.current.play().catch(() => {});
          }
        }, 100);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying, isAudio, isYouTube]);

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
    } else if (isYouTube && ytPlayerRef.current) {
      try {
        if (isPlaying) {
          ytPlayerRef.current.pauseVideo();
        } else {
          ytPlayerRef.current.playVideo();
        }
        setIsPlaying(!isPlaying);
      } catch (e) {
        console.log('YT play/pause error:', e);
      }
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
    } else if (isYouTube && ytPlayerRef.current) {
      try {
        if (newMuted) {
          ytPlayerRef.current.mute();
        } else {
          ytPlayerRef.current.unMute();
        }
      } catch (e) {
        console.log('YT mute error:', e);
      }
    } else if (videoRef.current) {
      videoRef.current.muted = newMuted;
    }
  };

  // Seek to specific time (segment-relative for YouTube with custom times)
  const seekTo = useCallback((time) => {
    if (isAudio && audioRef.current) {
      audioRef.current.currentTime = time;
    } else if (isYouTube && ytPlayerRef.current) {
      try {
        // Add startTime offset for YouTube with custom segments
        const actualTime = time + (moment?.startTime || 0);
        ytPlayerRef.current.seekTo(actualTime, true);
      } catch (e) {
        console.log('YT seek error:', e);
      }
    } else if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, [isAudio, isYouTube, moment?.startTime]);

  // Set volume (0-1)
  const setVolumeLevel = useCallback((vol) => {
    const clampedVol = Math.max(0, Math.min(1, vol));
    setVolume(clampedVol); // Update volume state
    if (isAudio && audioRef.current) {
      audioRef.current.volume = clampedVol;
    } else if (isYouTube && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.setVolume(clampedVol * 100);
      } catch (e) {
        console.log('YT volume error:', e);
      }
    } else if (videoRef.current) {
      videoRef.current.volume = clampedVol;
    }
    // Auto-unmute when setting volume
    if (clampedVol > 0 && isMuted) {
      setIsMuted(false);
      if (isAudio && audioRef.current) audioRef.current.muted = false;
      else if (isYouTube && ytPlayerRef.current) {
        try { ytPlayerRef.current.unMute(); } catch (e) {}
      } else if (videoRef.current) videoRef.current.muted = false;
    }
    // Auto-mute when volume is 0
    if (clampedVol === 0 && !isMuted) {
      setIsMuted(true);
    }
  }, [isAudio, isYouTube, isMuted]);

  // Register player controls with context - CRITICAL: Keep deps minimal to avoid re-creating controls
  useEffect(() => {
    registerPlayerControls({
      togglePlayPause: () => {
        // Read current state from refs/DOM instead of closures to avoid stale state
        if (audioRef.current) {
          if (audioRef.current.paused) {
            audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
          } else {
            audioRef.current.pause();
            setIsPlaying(false);
          }
        } else if (ytPlayerRef.current) {
          try {
            const playerState = ytPlayerRef.current.getPlayerState?.();
            if (playerState === 1) { // Playing
              ytPlayerRef.current.pauseVideo();
              setIsPlaying(false);
            } else {
              ytPlayerRef.current.playVideo();
              setIsPlaying(true);
            }
          } catch (e) {
            console.warn('YT player error:', e);
          }
        } else if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
          } else {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        }
      },
      seekTo,
      setVolume: setVolumeLevel,
      toggleMute: () => {
        // Read current muted state from DOM
        if (audioRef.current) {
          audioRef.current.muted = !audioRef.current.muted;
          setIsMuted(audioRef.current.muted);
        } else if (ytPlayerRef.current) {
          try {
            if (ytPlayerRef.current.isMuted?.()) {
              ytPlayerRef.current.unMute();
              setIsMuted(false);
            } else {
              ytPlayerRef.current.mute();
              setIsMuted(true);
            }
          } catch (e) {
            console.warn('YT mute error:', e);
          }
        } else if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted;
          setIsMuted(videoRef.current.muted);
        }
      },
      toggleFullscreen: () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
          if (containerRef.current.requestFullscreen) {
            containerRef.current.requestFullscreen();
          } else if (containerRef.current.webkitRequestFullscreen) {
            containerRef.current.webkitRequestFullscreen();
          }
          setIsFullscreen(true);
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
          setIsFullscreen(false);
        }
      },
      toggleEffect: (effectType) => {
        if (effectType === 'ascii') {
          setIsAsciiMode(prev => !prev);
        } else if (effectType === 'trippy') {
          setTrippyEffect(prev => !prev);
        }
      },
      setEffectIntensity: (intensity) => {
        setEffectIntensity(intensity);
      },
      openComments: () => {
        setShowCommentsPanel(true);
      },
      openInfo: () => {
        const activeMoment = queueMoment || moment;
        if (activeMoment && onMomentClick) {
          // Pause media when opening info modal to avoid audio conflicts
          if (audioRef.current) {
            audioRef.current.pause();
          } else if (ytPlayerRef.current) {
            try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
          } else if (videoRef.current) {
            videoRef.current.pause();
          }
          setIsPlaying(false);
          onMomentClick(activeMoment);
        }
      },
      playNext: handleNextRef.current,
      playRandom: handleNextRef.current,
      togglePiP: async () => {
        try {
          // For native video elements, use browser PiP API
          if (videoRef.current && document.pictureInPictureEnabled) {
            if (document.pictureInPictureElement) {
              await document.exitPictureInPicture();
              setIsPiPActive(false);
            } else {
              await videoRef.current.requestPictureInPicture();
              setIsPiPActive(true);
            }
          }
        } catch (err) {
          // PiP not supported or failed
        }
      },
      toggleMinimize: () => {
        console.log('🔽 VideoHero toggleMinimize called, current:', isMinimized);
        setIsMinimized(prev => {
          console.log('🔽 Setting isMinimized from', prev, 'to', !prev);
          return !prev;
        });
      }
    });
  // CRITICAL: Minimal deps - only re-register when these essential functions change
  }, [registerPlayerControls, seekTo, setVolumeLevel, moment, onMomentClick]);

  // Update player state in context when local state changes
  useEffect(() => {
    // Calculate time values based on media type
    let currentTime = 0;
    let duration = 0;

    if (isYouTube) {
      // For YouTube with custom start/end times, use segment-relative time
      const segmentStart = moment?.startTime || 0;
      const segmentEnd = moment?.endTime || ytProgress.duration;
      duration = segmentEnd - segmentStart;
      currentTime = Math.max(0, ytProgress.currentTime - segmentStart);
    } else {
      // For native audio/video elements
      currentTime = nativeProgress.currentTime;
      duration = nativeProgress.duration;
    }

    updatePlayerState({
      isPlaying,
      isMuted,
      isFullscreen,
      isPiPMode: isPiPActive,
      isMinimized,
      currentTime,
      duration,
      effectMode: isYouTube ? (trippyEffect ? 'trippy' : null) : (isAsciiMode ? 'ascii' : null),
      effectIntensity
    });
  }, [isPlaying, isMuted, isFullscreen, isPiPActive, isMinimized, ytProgress, nativeProgress, isYouTube, trippyEffect, isAsciiMode, effectIntensity, updatePlayerState, moment?.startTime, moment?.endTime]);

  // Listen for PiP exit
  useEffect(() => {
    const handlePiPExit = () => setIsPiPActive(false);
    document.addEventListener('leavepictureinpicture', handlePiPExit);
    return () => document.removeEventListener('leavepictureinpicture', handlePiPExit);
  }, []);

  // YouTube bar: get progress 0-1 from mouse/touch event
  const getYtProgressFromEvent = useCallback((e) => {
    if (!ytBarRef.current) return null;
    const rect = ytBarRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  // YouTube bar drag start
  const handleYtDragStart = useCallback((e) => {
    if (!ytPlayerRef.current || !ytProgress.duration) return;
    e.preventDefault();
    e.stopPropagation();
    ytDraggingRef.current = true;
    setYtDragging(true);
    const percent = getYtProgressFromEvent(e);
    if (percent !== null) setYtDragProgress(percent);
    handleSeekerDragState(true);
  }, [ytProgress.duration, getYtProgressFromEvent, handleSeekerDragState]);

  // YouTube bar drag listeners (window-level)
  useEffect(() => {
    if (!ytDragging) return;

    const segmentStart = moment?.startTime || 0;
    const segmentEnd = moment?.endTime || ytProgress.duration;
    const segmentDuration = segmentEnd - segmentStart;

    const handleMove = (e) => {
      e.preventDefault();
      const percent = getYtProgressFromEvent(e);
      if (percent !== null) setYtDragProgress(percent);
    };

    const handleEnd = () => {
      const finalProgress = ytDragProgress;
      ytDraggingRef.current = false;
      setYtDragging(false);
      handleSeekerDragState(false);

      // Commit seek
      const seekTime = segmentStart + (finalProgress * segmentDuration);
      try {
        ytPlayerRef.current?.seekTo(seekTime, true);
      } catch (err) {
        // Seek error
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [ytDragging, ytDragProgress, ytProgress.duration, moment?.startTime, moment?.endTime, getYtProgressFromEvent, handleSeekerDragState]);

  // Handle info click - pause playback before opening modal
  const handleInfoClick = (e) => {
    e.stopPropagation();
    if (moment && onMomentClick) {
      // Pause media when opening info modal
      if (isAudio && audioRef.current) {
        audioRef.current.pause();
      } else if (isYouTube && ytPlayerRef.current) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch (e) {
          // Player might not be ready
        }
      } else if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
      onMomentClick(moment);
    }
  };

  // Handle video loaded
  const handleVideoLoaded = () => {
    setIsLoading(false);
    if (videoRef.current) {
      // Detect vertical video
      setIsVerticalVideo(videoRef.current.videoHeight > videoRef.current.videoWidth);
      // Seek to startTime if defined
      if (moment?.startTime && videoRef.current.currentTime === 0) {
        videoRef.current.currentTime = moment.startTime;
      }
      videoRef.current.muted = isMuted;
      videoRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch(() => {
          setIsPlaying(false);
          setAutoplayBlocked(true);
        });
    }
  };

  if (error || (!isLoading && !moment)) {
    return null;
  }

  // Empty state when filter has no content
  // Check if any filters are off (not all enabled)
  const allFiltersOn = mediaFilters.audio && mediaFilters.video && mediaFilters.linked && mediaFilters.uploads;

  if (!isLoading && filteredMoments.length === 0 && !allFiltersOn) {
    // Build description of active filters
    const activeTypes = [];
    if (mediaFilters.audio && !mediaFilters.video) activeTypes.push('audio');
    if (mediaFilters.video && !mediaFilters.audio) activeTypes.push('video');
    const activeSources = [];
    if (mediaFilters.linked && !mediaFilters.uploads) activeSources.push('linked');
    if (mediaFilters.uploads && !mediaFilters.linked) activeSources.push('uploaded');

    const filterDesc = [...activeTypes, ...activeSources].join(' ') || 'matching';

    return (
      <div className="video-hero relative mb-4 sm:mb-6 overflow-hidden rounded-sm bg-gray-900/80 border border-gray-700/50">
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="text-gray-500 mb-2">
            <Music size={48} className="mx-auto mb-3 opacity-50" />
          </div>
          <p className="text-gray-400 text-lg">No {filterDesc} content yet</p>
          <p className="text-gray-500 text-sm mt-1">Try enabling more filters</p>
        </div>
      </div>
    );
  }

  // YouTube setup
  const youtubeId = isYouTube ? (moment?.externalVideoId || getYouTubeId(moment?.mediaUrl)) : null;
  const startTime = moment?.startTime || 0;

  // Calculate progress for minimized view (needs to be available before conditional)
  const getMinimizedProgress = () => {
    if (isYouTube && ytProgress.duration > 0) {
      const segmentStart = moment?.startTime || 0;
      const segmentEnd = moment?.endTime || ytProgress.duration;
      const segmentDuration = segmentEnd - segmentStart;
      const relativeTime = Math.max(0, ytProgress.currentTime - segmentStart);
      return segmentDuration > 0 ? Math.min(100, (relativeTime / segmentDuration) * 100) : 0;
    }
    if (isAudio && audioRef.current) {
      const duration = audioRef.current.duration || 0;
      const currentTime = audioRef.current.currentTime || 0;
      return duration > 0 ? (currentTime / duration) * 100 : 0;
    }
    if (!isAudio && !isYouTube && videoRef.current) {
      const duration = videoRef.current.duration || 0;
      const currentTime = videoRef.current.currentTime || 0;
      return duration > 0 ? (currentTime / duration) * 100 : 0;
    }
    return 0;
  };

  return (
    <>
      {/* Persistent audio element - always in DOM across minimize/maximize */}
      {isAudio && moment && (
        <audio
          key={`audio-persistent-${moment._id}`}
          ref={audioRef}
          src={transformMediaUrl(moment.mediaUrl)}
          crossOrigin="anonymous"
          muted={isMuted}
          preload="auto"
          onLoadedData={() => {
            setIsLoading(false);
            if (audioRef.current) {
              audioRef.current.muted = isMuted;
              audioRef.current.volume = volume;
              audioRef.current.play()
                .then(() => {
                  setIsPlaying(true);
                  setAutoplayBlocked(false);
                })
                .catch(() => {
                  setAutoplayBlocked(true);
                  setIsPlaying(false);
                });
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => {
            if (audioRef.current && updatePlayerState) {
              updatePlayerState({
                currentTime: audioRef.current.currentTime,
                duration: audioRef.current.duration || 0,
                isPlaying: !audioRef.current.paused,
                isMuted: audioRef.current.muted,
                volume: audioRef.current.volume
              });
            }
          }}
          onEnded={handleNext}
          onError={() => setError('Failed to load audio')}
          className="hidden"
        />
      )}

      {/* Player container - clips to minimized bar when minimized, video plays behind glass */}
      <div
        className="relative mb-4 sm:mb-6"
        style={isMinimized ? { height: '56px', overflow: 'hidden', borderRadius: '2px' } : undefined}
      >
      {/* Minimized overlay - simple info bar, NO controls (use ribbon instead) */}
      {isMinimized && (
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm border border-white/10 rounded-sm overflow-hidden cursor-pointer hover:bg-black/50 transition-colors"
          title="Click to expand player"
          onClick={() => setIsMinimized(false)}
          onTouchEnd={(e) => {
            e.preventDefault();
            setIsMinimized(false);
          }}
        >
          {/* Progress bar at top */}
          <div className="h-1 bg-white/20 w-full relative">
            <div
              className="h-full bg-yellow-500 transition-all duration-200"
              style={{ width: `${getMinimizedProgress()}%` }}
            />
          </div>

          <div className="relative flex items-center px-3 sm:px-4 py-2 sm:py-3 gap-3">
            {/* Song info section - click to view details */}
            <div
              className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); handleInfoClick(); }}
            >
              {moment && (
                <>
                  <div className="w-8 h-8 bg-white/10 rounded flex items-center justify-center flex-shrink-0">
                    {isAudio ? <Music size={12} className="text-yellow-400" /> : <Play size={12} className="text-yellow-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-white font-medium text-xs truncate">{moment.songName}</h3>
                    <p className="text-gray-500 text-[10px] truncate">{moment.venueName}</p>
                  </div>
                </>
              )}
            </div>

            {/* Mobile inline controls - play/pause and next */}
            <div className="flex sm:hidden items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
              >
                {isPlaying
                  ? <Pause size={16} className="text-yellow-400" />
                  : <Play size={16} className="text-yellow-400 ml-0.5" />
                }
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
              >
                <SkipForward size={14} className="text-gray-400" />
              </button>
            </div>

            {/* Queue indicator (desktop) */}
            {isPlayingFromQueue && (
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-yellow-900/30 border border-yellow-700/50 rounded pointer-events-none">
                <ListMusic size={10} className="text-yellow-400" />
                <span className="text-yellow-400 text-[10px] font-mono">{currentQueueIndex + 1}/{theaterQueue.length}</span>
              </div>
            )}

          {/* Visual hint: Use ribbon controls (desktop only) */}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-gray-400 pointer-events-none">
            Use ribbon controls →
          </div>
        </div>
        </div>
      )}

      {/* Full-size view - always in DOM, visible through glass when minimized */}
      <div
        ref={containerRef}
        className={`video-hero relative overflow-hidden rounded-sm bg-black ${isFullscreen ? 'fullscreen-mode' : ''}`}
        style={isMinimized ? { marginTop: '-40%' } : undefined}
        onMouseMove={resetHideTimer}
        onMouseEnter={() => setShowControls(true)}
        onTouchStart={resetHideTimer}
      >
        {/* Hidden canvas for ASCII processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Media filter moved to App.js - above hero */}

      {/* Minimize button removed - use ribbon controls instead */}

      {/* Loading spinner overlay */}
      {((isYouTube && isYtLoading) || (!isYouTube && !isAudio && isLoading)) && (
        <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={32} className="text-white animate-spin" />
            <span className="text-gray-300 text-sm">Loading...</span>
          </div>
        </div>
      )}

      {/* Audio Mode */}
      {isAudio && moment ? (
        <div className="relative w-full" style={{ paddingBottom: '56.25%', minHeight: '200px' }}>
          {/* Audio element is now at top level for persistence */}

          {/* Background - thumbnail or gradient */}
          <div className="absolute inset-0">
            {moment.thumbnailUrl ? (
              <>
                <img
                  src={transformMediaUrl(moment.thumbnailUrl)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/80 via-gray-900 to-black" />
            )}
          </div>

          {/* Center album art */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="relative">
              {moment.thumbnailUrl ? (
                <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-lg shadow-2xl overflow-hidden border-2 border-white/20 ${isPlaying ? 'animate-pulse' : ''}`}>
                  <img
                    src={transformMediaUrl(moment.thumbnailUrl)}
                    alt={moment.songName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-lg bg-gradient-to-br from-purple-600 to-purple-900 shadow-2xl flex items-center justify-center ${isPlaying ? 'animate-pulse' : ''}`}>
                  <Music size={48} className="text-white/80" />
                </div>
              )}

              {/* Play/Pause overlay on album art */}
              <button
                onClick={togglePlayPause}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors rounded-lg"
              >
                {isPlaying ? (
                  <Pause size={40} className="text-white drop-shadow-lg" />
                ) : (
                  <Play size={40} className="text-white ml-1 drop-shadow-lg" />
                )}
              </button>
            </div>
          </div>

          {/* Audio indicator badge */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-purple-600/90 backdrop-blur-sm px-2.5 py-1 rounded-full">
            <Music size={12} className="text-white" />
            <span className="text-white text-[10px] font-medium uppercase tracking-wide">Audio</span>
          </div>

          {/* Animated bars when playing */}
          {isPlaying && (
            <div className="absolute top-3 left-3 z-20 flex items-end gap-0.5 h-4">
              <div className="w-1 bg-purple-400 rounded-full animate-bounce" style={{ height: '60%', animationDuration: '0.5s' }} />
              <div className="w-1 bg-purple-400 rounded-full animate-bounce" style={{ height: '100%', animationDuration: '0.7s', animationDelay: '0.1s' }} />
              <div className="w-1 bg-purple-400 rounded-full animate-bounce" style={{ height: '40%', animationDuration: '0.6s', animationDelay: '0.2s' }} />
              <div className="w-1 bg-purple-400 rounded-full animate-bounce" style={{ height: '80%', animationDuration: '0.55s', animationDelay: '0.15s' }} />
            </div>
          )}

          {/* Autoplay blocked overlay */}
          {autoplayBlocked && !isPlaying && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 cursor-pointer"
              onClick={() => {
                setAutoplayBlocked(false);
                togglePlayPause();
              }}
            >
              <div className="bg-white/90 rounded-full p-4 shadow-lg mb-3">
                <Play size={32} className="text-gray-800 ml-1" />
              </div>
              <p className="text-white text-sm font-medium">Tap to play</p>
            </div>
          )}

          {/* Waveform seeker at bottom - always visible for audio */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 z-30" onClick={(e) => e.stopPropagation()}>
            <WaveformPlayer
              audioRef={audioRef}
              moment={moment}
              isPlaying={isPlaying}
              isVideo={false}
              simple={false}
              onSeek={seekTo}
              onDragStateChange={handleSeekerDragState}
            />
          </div>
        </div>
      ) : isYouTube && youtubeId ? (
        /* YouTube Mode with API control */
        <div className="relative w-full cursor-pointer" style={{ paddingBottom: '56.25%' }} onClick={togglePlayPause}>
          {/* Stable wrapper to prevent React removeChild errors when YouTube replaces DOM */}
          <div key={youtubeKey} className="absolute inset-0">
            <div
              id="yt-player-container"
              ref={(el) => {
                if (el && window.YT && window.YT.Player && !ytPlayerRef.current) {
                  ytPlayerRef.current = new window.YT.Player(el, {
                    videoId: youtubeId,
                    playerVars: {
                      autoplay: 1,
                      mute: 1,
                      controls: 0,
                      modestbranding: 1,
                      rel: 0,
                      showinfo: 0,
                      iv_load_policy: 3,
                      fs: 0,
                      disablekb: 1,
                      enablejsapi: 1,
                      start: startTime,
                      playsinline: 1
                    },
                    events: {
                      onReady: (e) => {
                        setIsYtLoading(false);
                        if (!isMuted) e.target.unMute();
                      },
                      onStateChange: (e) => {
                        if (e.data === window.YT.PlayerState.ENDED) handleNext();
                        // Update playing state based on YouTube player state
                        if (e.data === window.YT.PlayerState.PLAYING) {
                          setIsYtLoading(false);
                          setIsPlaying(true);
                        } else if (e.data === window.YT.PlayerState.PAUSED) {
                          setIsPlaying(false);
                        }
                      }
                    }
                  });
                }
              }}
              className="w-full h-full transition-all duration-300"
            />
          </div>

          {/* Top info banner - glassy, auto-hides with controls */}
          <div className={`absolute top-0 left-0 right-0 z-25 bg-black/30 backdrop-blur-xl pointer-events-none border-b border-white/10 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}>
            {moment && (
              <div className="px-4 py-3">
                <h3 className="text-white font-bold text-base sm:text-lg truncate drop-shadow-lg">
                  {moment.songName}
                </h3>
                <p className="text-gray-300 text-xs sm:text-sm truncate drop-shadow-md">
                  {moment.venueName}
                  {moment.venueCity && ` - ${moment.venueCity}`}
                  {moment.performanceDate && ` (${moment.performanceDate})`}
                </p>
              </div>
            )}
          </div>

          {!isPlaying && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
              <Play size={64} className="text-white opacity-80" />
            </div>
          )}

          {/* UMO Trippy Effect Overlay - only when trippy mode is on */}
          {trippyEffect && <UMOEffect intensity={effectIntensity} />}
        </div>
      ) : (
        /* Uploaded Video Mode */
        <div className="relative cursor-pointer" onClick={togglePlayPause}>
          {moment && !isYouTube && !isAudio && (
            <video
              key={`video-${moment._id}`}
              ref={videoRef}
              src={transformMediaUrl(moment.mediaUrl)}
              crossOrigin="anonymous"
              muted={isMuted}
              playsInline
              preload="auto"
              onLoadedData={handleVideoLoaded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={() => {
                if (videoRef.current && updatePlayerState) {
                  updatePlayerState({
                    currentTime: videoRef.current.currentTime,
                    duration: videoRef.current.duration || 0,
                    isPlaying: !videoRef.current.paused,
                    isMuted: videoRef.current.muted,
                    volume: videoRef.current.volume
                  });
                }
              }}
              onEnded={handleNext}
              className={`w-full ${isAsciiMode ? 'opacity-0' : ''} ${isFullscreen ? 'max-h-screen' : 'max-h-[280px] sm:max-h-[400px] md:max-h-[500px]'}`}
              style={{ objectFit: 'contain', backgroundColor: '#000' }}
            />
          )}

          {/* ASCII Overlay - for uploaded video with side reflections for vertical */}
          {isAsciiMode && !isYouTube && !isAudio && asciiOutput.length > 0 && (
            <div
              className="absolute inset-0 z-20 overflow-hidden bg-black flex items-center justify-center"
              style={{ fontFamily: 'monospace', lineHeight: '1' }}
            >
              {/* Left reflection for vertical videos */}
              {isVerticalVideo && (
                <pre className="text-[6px] sm:text-[8px] leading-none whitespace-pre opacity-30 transform scale-x-[-1]">
                  {asciiOutput.map((row, y) => (
                    <div key={`left-${y}`} style={{ display: 'flex' }}>
                      {row.map((cell, x) => (
                        <span key={x} style={{ color: cell.color }}>{cell.char}</span>
                      ))}
                    </div>
                  ))}
                </pre>
              )}

              {/* Main ASCII */}
              <pre className="text-[6px] sm:text-[8px] leading-none whitespace-pre">
                {asciiOutput.map((row, y) => (
                  <div key={y} style={{ display: 'flex' }}>
                    {row.map((cell, x) => (
                      <span key={x} style={{ color: cell.color }}>
                        {cell.char}
                      </span>
                    ))}
                  </div>
                ))}
              </pre>

              {/* Right reflection for vertical videos */}
              {isVerticalVideo && (
                <pre className="text-[6px] sm:text-[8px] leading-none whitespace-pre opacity-30 transform scale-x-[-1]">
                  {asciiOutput.map((row, y) => (
                    <div key={`right-${y}`} style={{ display: 'flex' }}>
                      {row.map((cell, x) => (
                        <span key={x} style={{ color: cell.color }}>{cell.char}</span>
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </div>
          )}

          {/* Paused overlay */}
          {!isPlaying && !isAsciiMode && !autoplayBlocked && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none z-10">
              <Play size={64} className="text-white opacity-80" />
            </div>
          )}

          {/* Autoplay blocked overlay */}
          {autoplayBlocked && !isPlaying && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setAutoplayBlocked(false);
                togglePlayPause();
              }}
            >
              <div className="bg-white/90 rounded-full p-4 shadow-lg mb-3">
                <Play size={32} className="text-gray-800 ml-1" />
              </div>
              <p className="text-white text-sm font-medium">Tap to play</p>
            </div>
          )}
        </div>
      )}

      {/* Minimal overlay with waveform only - controls moved to MediaControlCenter */}
      {!isYouTube && moment && showControls && (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur-sm border-t border-white/10 px-3 py-2 z-30" onClick={(e) => e.stopPropagation()}>
          <WaveformPlayer
            audioRef={isAudio ? audioRef : null}
            videoRef={!isAudio ? videoRef : null}
            moment={moment}
            isPlaying={isPlaying}
            isVideo={!isAudio}
            simple={!isAudio}
            onSeek={seekTo}
            onDragStateChange={handleSeekerDragState}
          />
        </div>
      )}

      {/* YouTube progress bar overlay only */}
      {isYouTube && ytProgress.duration > 0 && showControls && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 z-30" onClick={(e) => e.stopPropagation()}>
          {(() => {
            const segmentStart = moment?.startTime || 0;
            const segmentEnd = moment?.endTime || ytProgress.duration;
            const segmentDuration = segmentEnd - segmentStart;
            const relativeTime = Math.max(0, ytProgress.currentTime - segmentStart);
            const actualProgress = segmentDuration > 0 ? Math.min(1, relativeTime / segmentDuration) : 0;
            const displayProg = ytDragging ? ytDragProgress : actualProgress;
            const displayPercent = displayProg * 100;
            const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
            const tooltipPos = ytDragging ? ytDragProgress : ytHoverPos;

            return (
              <div className="space-y-2">
                {/* Time display */}
                <div className="flex items-center justify-between text-[11px] text-white/80 font-mono px-0.5">
                  <span>{formatTime(ytDragging ? ytDragProgress * segmentDuration : relativeTime)}</span>
                  <span>{formatTime(segmentDuration)}</span>
                </div>
                {/* Progress bar with larger hit target */}
                <div
                  ref={ytBarRef}
                  className="relative py-3 cursor-pointer group select-none"
                  onMouseDown={handleYtDragStart}
                  onTouchStart={handleYtDragStart}
                  onMouseMove={(e) => {
                    if (!ytDraggingRef.current) {
                      const percent = getYtProgressFromEvent(e);
                      if (percent !== null) setYtHoverPos(percent);
                    }
                  }}
                  onMouseLeave={() => {
                    if (!ytDraggingRef.current) setYtHoverPos(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Time tooltip on hover/drag */}
                  {tooltipPos !== null && segmentDuration > 0 && (
                    <div
                      className="absolute z-50 px-2 py-0.5 bg-black/90 text-white text-[11px] font-mono rounded shadow-lg border border-white/10 pointer-events-none whitespace-nowrap"
                      style={{
                        left: `${tooltipPos * 100}%`,
                        top: '-4px',
                        transform: 'translateX(-50%)'
                      }}
                    >
                      {formatTime(tooltipPos * segmentDuration)}
                    </div>
                  )}
                  {/* Thin bar track */}
                  <div className="relative h-1 bg-white/20 rounded-full group-hover:h-1.5 transition-all">
                    {/* Buffer indicator */}
                    <div
                      className="absolute top-0 left-0 h-full bg-white/30 rounded-full"
                      style={{ width: `${Math.min(100, displayPercent + 15)}%` }}
                    />
                    {/* Progress fill */}
                    <div
                      className="absolute top-0 left-0 h-full bg-red-500 rounded-full"
                      style={{ width: `${displayPercent}%`, transition: ytDragging ? 'none' : 'width 0.1s ease' }}
                    />
                    {/* Hover line */}
                    {ytHoverPos !== null && !ytDragging && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-white/50 pointer-events-none"
                        style={{ left: `${ytHoverPos * 100}%` }}
                      />
                    )}
                    {/* Playhead dot */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full shadow-lg transition-opacity scale-0 group-hover:scale-100"
                      style={{
                        left: `calc(${displayPercent}% - 6px)`,
                        opacity: ytDragging ? 1 : undefined
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Comments Panel */}
      <VideoHeroComments
        momentId={moment?._id}
        user={user}
        token={token}
        isOpen={showCommentsPanel}
        onClose={() => setShowCommentsPanel(false)}
        momentName={moment?.songName}
      />
      </div>
      </div>
    </>
  );
});

VideoHero.displayName = 'VideoHero';

export default VideoHero;
