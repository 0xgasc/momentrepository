// src/components/UI/VideoHero.jsx - Hero player for random video/audio clips
import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipForward, Info, ListPlus, ListMusic, Music, Minimize2, Maximize2, Droplet, MessageSquare, Loader2 } from 'lucide-react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';
import { useTheaterQueue } from '../../contexts/TheaterQueueContext';
import UMOEffect from './UMOEffect';
import WaveformPlayer from './WaveformPlayer';
import VideoHeroComments from './VideoHeroComments';
import FavoriteButton from './FavoriteButton';
import { transformMediaUrl } from '../../utils/mediaUrl';

// ASCII character map - from darkest to brightest
const ASCII_CHARS = ' .:-=+*#%@';

// Keep only trippy effect - removed redundant filter presets

const VideoHero = memo(({ onMomentClick, mediaFilters = { audio: true, video: true, linked: true, uploads: true }, customMoments = null }) => {
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [youtubeKey, setYoutubeKey] = useState(0);
  const [trippyEffect, setTrippyEffect] = useState(false);
  const [effectIntensity, setEffectIntensity] = useState(50);
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
  const frameSkipRef = useRef(0);
  const ytPlayerRef = useRef(null);
  const ytProgressIntervalRef = useRef(null);
  const handleNextRef = useRef(null);

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
          setYtProgress({ currentTime, duration });

          // Check if we've reached the moment's end time
          if (moment?.endTime && currentTime >= moment.endTime) {
            console.log('VideoHero: Reached end time', moment.endTime, 'at', currentTime);
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

  // Theater queue context
  const {
    theaterQueue,
    currentQueueIndex,
    isPlayingFromQueue,
    addToQueue,
    isInQueue,
    playNextInQueue,
    currentMoment: queueMoment
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
      console.log('VideoHero: Using customMoments:', customMoments.length);

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

        console.log('VideoHero: Fetched', allData.length, 'moments');

        // Filter to only playable content (has mediaUrl)
        const playable = allData.filter(m => m.mediaUrl);

        // Add type flags to each moment
        const withTypes = playable.map(m => {
          const { isYouTube: isYT, isAudio: isAud, isArchive } = detectContentType(m);
          return { ...m, _isYouTube: isYT, _isAudio: isAud, _isArchive: isArchive };
        });

        console.log('VideoHero: Playable moments:', withTypes.length);
        console.log('VideoHero: Videos:', withTypes.filter(m => !m._isYouTube && !m._isAudio && !m._isArchive).length);
        console.log('VideoHero: YouTube:', withTypes.filter(m => m._isYouTube).length);
        console.log('VideoHero: Audio:', withTypes.filter(m => m._isAudio).length);
        console.log('VideoHero: Archive:', withTypes.filter(m => m._isArchive).length);

        setAllMoments(withTypes);

        if (withTypes.length > 0) {
          // Prefer video content over audio for hero
          const videos = withTypes.filter(m => !m._isAudio);
          const toSelect = videos.length > 0 ? videos : withTypes;
          const selected = selectRandomMoment(toSelect);
          setMoment(selected);
          setIsYouTube(selected._isYouTube);
          setIsAudio(selected._isAudio);
          console.log('VideoHero: Selected moment:', selected.songName, 'isYouTube:', selected._isYouTube, 'isAudio:', selected._isAudio);
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
      console.log('VideoHero: Queue playing:', queueMoment.songName, 'isYouTube:', isYT, 'isAudio:', isAud);
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
          console.log('VideoHero: Audio autoplay blocked');
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
          console.log('VideoHero: Video autoplay blocked');
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
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(true);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2000);
  }, []);

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
    } else if (filteredMoments.length > 0) {
      const next = selectRandomMoment(filteredMoments, moment);
      if (next) {
        setMoment(next);
        setIsYouTube(next._isYouTube);
        setIsAudio(next._isAudio);
        setIsPlaying(true);
        setYoutubeKey(prev => prev + 1);
      }
    }
  }, [filteredMoments, moment, selectRandomMoment, isPlayingFromQueue, playNextInQueue]);

  // Keep ref in sync for use in early useEffect
  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

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

  // Handle YouTube seek
  // eslint-disable-next-line no-unused-vars
  const handleYtSeek = useCallback((e) => {
    if (!ytPlayerRef.current || !ytProgress.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const seekTime = percentage * ytProgress.duration;
    try {
      ytPlayerRef.current.seekTo(seekTime, true);
    } catch (err) {
      console.log('YT seek error:', err);
    }
  }, [ytProgress.duration]);

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

  // Minimized view - mobile optimized
  if (isMinimized) {
    return (
      <div className="mb-4 sm:mb-6 bg-gray-900 border border-gray-700 rounded-sm overflow-hidden">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={handleInfoClick}>
            {moment && (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-800 rounded flex items-center justify-center flex-shrink-0">
                  {isAudio ? <Music size={14} className="text-yellow-400" /> : <Play size={14} className="text-yellow-400" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-white font-medium text-xs sm:text-sm truncate">{moment.songName}</h3>
                  <p className="text-gray-500 text-xs truncate">{moment.venueName}</p>
                </div>
              </div>
            )}
          </div>

          {isPlayingFromQueue && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-yellow-900/30 border border-yellow-700/50 rounded mr-2">
              <ListMusic size={12} className="text-yellow-400" />
              <span className="text-yellow-400 text-xs font-mono">{currentQueueIndex + 1}/{theaterQueue.length}</span>
            </div>
          )}

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
              className="bg-gray-800 hover:bg-gray-700 rounded-full p-2 transition-colors"
              style={{ minWidth: '36px', minHeight: '36px' }}
            >
              {isPlaying ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              className={`rounded-full p-2 transition-colors ${
                isMuted ? 'bg-orange-500 hover:bg-orange-400' : 'bg-gray-800 hover:bg-gray-700'
              }`}
              style={{ minWidth: '36px', minHeight: '36px' }}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={14} className="text-white" /> : <Volume2 size={14} className="text-white" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="bg-gray-800 hover:bg-gray-700 rounded-full p-2 transition-colors"
              style={{ minWidth: '36px', minHeight: '36px' }}
            >
              <SkipForward size={14} className="text-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
              className="bg-yellow-600/50 hover:bg-yellow-600/70 rounded-full p-2 transition-colors"
              style={{ minWidth: '36px', minHeight: '36px' }}
            >
              <Maximize2 size={14} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`video-hero relative mb-4 sm:mb-6 overflow-hidden rounded-sm bg-black ${isFullscreen ? 'fullscreen-mode' : ''}`}
      onMouseMove={resetHideTimer}
      onMouseEnter={() => setShowControls(true)}
      onTouchStart={resetHideTimer}
    >
      {/* Hidden canvas for ASCII processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Media filter moved to App.js - above hero */}

      {/* Minimize button - top right, fades with controls */}
      <button
        onClick={() => setIsMinimized(true)}
        className={`absolute top-2 right-2 sm:top-3 sm:right-3 z-30 bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/20 rounded-full p-2 transition-all duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ minWidth: '36px', minHeight: '36px' }}
        title="Minimize"
      >
        <Minimize2 size={14} className="text-white" />
      </button>

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
        <div className="relative w-full" style={{ paddingBottom: '45%', minHeight: '200px' }}>
          <audio
            key={`audio-${moment._id}`}
            ref={audioRef}
            src={transformMediaUrl(moment.mediaUrl)}
            crossOrigin="anonymous"
            muted={isMuted}
            preload="auto"
            onLoadedData={() => {
              setIsLoading(false);
              if (audioRef.current) {
                audioRef.current.muted = isMuted;
                audioRef.current.play()
                  .then(() => {
                    setIsPlaying(true);
                    setAutoplayBlocked(false);
                  })
                  .catch(() => {
                    setIsPlaying(false);
                    setAutoplayBlocked(true);
                  });
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

          {/* Autoplay blocked overlay */}
          {autoplayBlocked && !isPlaying && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 cursor-pointer"
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

          {/* Song info - glassy */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/30 backdrop-blur-xl p-4 z-10 pointer-events-none border-t border-white/10">
            <h3 className="text-white font-bold text-base sm:text-lg truncate drop-shadow-lg">
              {moment.songName}
            </h3>
            <p className="text-gray-300 text-xs sm:text-sm truncate drop-shadow-md">
              {moment.venueName}
              {moment.venueCity && ` - ${moment.venueCity}`}
              {moment.performanceDate && ` (${moment.performanceDate})`}
            </p>
          </div>
          {/* No effects for audio */}
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
                        // Also mark as loaded once video starts playing
                        if (e.data === window.YT.PlayerState.PLAYING) setIsYtLoading(false);
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

      {/* Bottom controls - glassy effect */}
      <div className={`absolute bottom-0 left-0 right-0 bg-black/30 backdrop-blur-xl p-3 sm:p-4 z-30 transition-opacity duration-300 border-t border-white/10 ${
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        {/* WaveformPlayer - simple mode for video, full waveform for audio */}
        {!isYouTube && moment && (
          <div className="mb-2">
            <WaveformPlayer
              audioRef={isAudio ? audioRef : null}
              videoRef={!isAudio ? videoRef : null}
              moment={moment}
              isPlaying={isPlaying}
              isVideo={!isAudio}
              simple={!isAudio}
            />
          </div>
        )}

        {/* YouTube progress bar / seeker - scoped to moment's start/end time */}
        {isYouTube && ytProgress.duration > 0 && (
          <div className="mb-2">
            {(() => {
              // Calculate moment-scoped progress
              const segmentStart = moment?.startTime || 0;
              const segmentEnd = moment?.endTime || ytProgress.duration;
              const segmentDuration = segmentEnd - segmentStart;
              const relativeTime = Math.max(0, ytProgress.currentTime - segmentStart);
              const progressPercent = segmentDuration > 0 ? Math.min(100, (relativeTime / segmentDuration) * 100) : 0;

              return (
                <>
                  <div
                    className="relative h-1.5 bg-gray-700/50 rounded-full cursor-pointer group"
                    onClick={(e) => {
                      // Seek within segment bounds
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const percentage = clickX / rect.width;
                      const seekTime = segmentStart + (percentage * segmentDuration);
                      try {
                        ytPlayerRef.current?.seekTo(seekTime, true);
                      } catch (err) {
                        console.log('YT seek error:', err);
                      }
                    }}
                  >
                    {/* Progress fill */}
                    <div
                      className="absolute top-0 left-0 h-full bg-red-500 rounded-full transition-all duration-150"
                      style={{ width: `${progressPercent}%` }}
                    />
                    {/* Hover indicator */}
                    <div className="absolute top-0 left-0 h-full w-full opacity-0 group-hover:opacity-100 bg-white/10 rounded-full" />
                    {/* Playhead */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ left: `calc(${progressPercent}% - 6px)` }}
                    />
                  </div>
                  {/* Time display - relative to segment */}
                  <div className="flex justify-between text-xs text-gray-400 mt-1 font-mono">
                    <span>{Math.floor(relativeTime / 60)}:{String(Math.floor(relativeTime % 60)).padStart(2, '0')}</span>
                    <span>{Math.floor(segmentDuration / 60)}:{String(Math.floor(segmentDuration % 60)).padStart(2, '0')}</span>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Song info */}
        {moment && (
          <div className="mb-2">
            <h3 className="text-white font-bold text-sm sm:text-base truncate drop-shadow-lg">{moment.songName}</h3>
            <p className="text-gray-300 text-xs truncate drop-shadow-md">
              {moment.venueName}
              {moment.venueCity && ` - ${moment.venueCity}`}
              {moment.performanceDate && ` (${moment.performanceDate})`}
            </p>
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center justify-between gap-2">
          {/* Queue indicator */}
          {isPlayingFromQueue && (
            <div className="flex items-center gap-1 px-2 py-1 bg-yellow-900/40 border border-yellow-600/50 rounded-full">
              <ListMusic size={12} className="text-yellow-400" />
              <span className="text-yellow-400 text-xs font-mono">{currentQueueIndex + 1}/{theaterQueue.length}</span>
            </div>
          )}

          {/* Spacer when no queue */}
          {!isPlayingFromQueue && <div className="flex-1" />}

          {/* Main controls */}
          <div className="flex items-center gap-1">
            {/* Effect controls - different for each media type */}
            {/* Audio: No effects */}
            {/* Uploaded Video: ASCII mode toggle */}
            {!isYouTube && !isAudio && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAsciiMode(!isAsciiMode);
                  }}
                  className={`rounded-full p-2 transition-colors ${
                    isAsciiMode ? 'bg-purple-600 hover:bg-purple-500' : 'bg-white/20 hover:bg-white/30'
                  }`}
                  style={{ minWidth: '36px', minHeight: '36px' }}
                  title="ASCII mode"
                >
                  <Droplet size={16} className="text-white" />
                </button>
                {isAsciiMode && (
                  <div className="hidden sm:flex items-center bg-black/60 rounded-full px-2 py-1">
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={effectIntensity}
                      onChange={(e) => setEffectIntensity(Number(e.target.value))}
                      className="w-16 h-1 accent-purple-500 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
              </>
            )}

            {/* YouTube: Trippy effect toggle + intensity slider */}
            {isYouTube && (
              <>
                {/* Trippy effect toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTrippyEffect(!trippyEffect);
                  }}
                  className={`rounded-full p-2 transition-colors ${
                    trippyEffect ? 'bg-purple-600 hover:bg-purple-500' : 'bg-white/20 hover:bg-white/30'
                  }`}
                  style={{ minWidth: '36px', minHeight: '36px' }}
                  title="Effect overlay"
                >
                  <Droplet size={16} className="text-white" />
                </button>
                {/* Intensity slider - shows when effect is active */}
                {trippyEffect && (
                  <div className="hidden sm:flex items-center bg-black/60 rounded-full px-2 py-1 gap-1.5">
                    <span className="text-white/60 text-[10px] font-mono">{effectIntensity}%</span>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={effectIntensity}
                      onChange={(e) => setEffectIntensity(Number(e.target.value))}
                      className="w-16 h-1 accent-purple-500 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
              </>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
              className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-colors"
              style={{ minWidth: '36px', minHeight: '36px' }}
            >
              {isPlaying ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white ml-0.5" />}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              className={`rounded-full p-2 transition-colors ${
                isMuted ? 'bg-orange-500 hover:bg-orange-400' : 'bg-white/20 hover:bg-white/30'
              }`}
              style={{ minWidth: '36px', minHeight: '36px' }}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={16} className="text-white" /> : <Volume2 size={16} className="text-white" />}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-colors"
              style={{ minWidth: '36px', minHeight: '36px' }}
              title="Next"
            >
              <SkipForward size={16} className="text-white" />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); handleAddToQueue(); }}
              className={`rounded-full p-2 transition-colors ${
                moment && isInQueue(moment._id) ? 'bg-yellow-600/50' : 'bg-white/20 hover:bg-white/30'
              }`}
              style={{ minWidth: '36px', minHeight: '36px' }}
              title={moment && isInQueue(moment._id) ? 'In queue' : 'Add to queue'}
            >
              <ListPlus size={16} className="text-white" />
            </button>

            {moment?._id && (
              <FavoriteButton momentId={moment._id} size="md" />
            )}

            <button
              onClick={(e) => { e.stopPropagation(); setShowCommentsPanel(true); }}
              className="bg-blue-600/50 hover:bg-blue-600/70 rounded-full p-2 transition-colors"
              style={{ minWidth: '36px', minHeight: '36px' }}
              title="Comments"
            >
              <MessageSquare size={16} className="text-white" />
            </button>

            <button
              onClick={handleInfoClick}
              className="bg-blue-600/50 hover:bg-blue-600/70 rounded-full p-2 transition-colors"
              style={{ minWidth: '36px', minHeight: '36px' }}
              title="Details"
            >
              <Info size={16} className="text-white" />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
              className={`rounded-full p-2 transition-colors ${
                isFullscreen ? 'bg-green-600 hover:bg-green-500' : 'bg-white/20 hover:bg-white/30'
              }`}
              style={{ minWidth: '36px', minHeight: '36px' }}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              <Maximize2 size={16} className="text-white" />
            </button>
          </div>
        </div>
      </div>

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
  );
});

VideoHero.displayName = 'VideoHero';

export default VideoHero;
