// src/components/UI/VideoHero.jsx - Hero player for random video/audio clips
import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipForward, Info, ListPlus, ListMusic, Music, Minimize2, Maximize2, Droplet } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import { useTheaterQueue } from '../../contexts/TheaterQueueContext';
import UMOEffect from './UMOEffect';

// ASCII character map - from darkest to brightest
const ASCII_CHARS = ' .:-=+*#%@';

const VideoHero = memo(({ onMomentClick }) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const iframeRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const hideTimerRef = useRef(null);

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
  const [trippyEffect, setTrippyEffect] = useState(false);
  const [effectIntensity, setEffectIntensity] = useState(50);
  const [asciiOutput, setAsciiOutput] = useState([]);
  const [isAsciiMode, setIsAsciiMode] = useState(false);
  const [showControls, setShowControls] = useState(true);

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
    if (!m || !m.mediaUrl) return { isYouTube: false, isAudio: false };

    // Check for YouTube
    const isYT = m.mediaSource === 'youtube' ||
      m.mediaUrl?.includes('youtube.com') ||
      m.mediaUrl?.includes('youtu.be') ||
      m.externalVideoId;

    if (isYT) return { isYouTube: true, isAudio: false };

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

  // Fetch ALL moments and filter client-side
  useEffect(() => {
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
          const { isYouTube: isYT, isAudio: isAud } = detectContentType(m);
          return { ...m, _isYouTube: isYT, _isAudio: isAud };
        });

        console.log('VideoHero: Playable moments:', withTypes.length);
        console.log('VideoHero: Videos:', withTypes.filter(m => !m._isYouTube && !m._isAudio).length);
        console.log('VideoHero: YouTube:', withTypes.filter(m => m._isYouTube).length);
        console.log('VideoHero: Audio:', withTypes.filter(m => m._isAudio).length);

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
  }, [selectRandomMoment, detectContentType]);

  // Sync with queue playback
  useEffect(() => {
    if (isPlayingFromQueue && queueMoment) {
      const { isYouTube: isYT, isAudio: isAud } = detectContentType(queueMoment);
      setMoment({ ...queueMoment, _isYouTube: isYT, _isAudio: isAud });
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
        } catch (e) {
          console.log('VideoHero: Audio autoplay blocked');
          setIsPlaying(false);
        }
      } else if (videoRef.current) {
        videoRef.current.muted = isMuted;
        try {
          await videoRef.current.play();
          setIsPlaying(true);
        } catch (e) {
          console.log('VideoHero: Video autoplay blocked');
          setIsPlaying(false);
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

    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Scale based on intensity (higher = more columns/detail)
    const cols = Math.floor(60 + (effectIntensity * 0.8)); // 60-140 columns
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
        const color = `rgb(${r}, ${g}, ${b})`; // Colored ASCII
        row.push({ char, color });
      }
      asciiRows.push(row);
    }
    setAsciiOutput(asciiRows);
    animationRef.current = requestAnimationFrame(processFrame);
  }, [getAsciiChar, effectIntensity, isAsciiMode]);

  // Start/stop ASCII processing
  useEffect(() => {
    if (isAsciiMode && !isYouTube && !isAudio && videoRef.current) {
      animationRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAsciiMode, isYouTube, isAudio, processFrame]);

  // Auto-hide controls after 3 seconds of no interaction
  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(true);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
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
    ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&modestbranding=1&rel=0&enablejsapi=1&start=${startTime}`
    : null;

  // Minimized view - mobile optimized
  if (isMinimized) {
    return (
      <div className="mb-4 sm:mb-6 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
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
      className="video-hero relative mb-4 sm:mb-6 overflow-hidden rounded-lg bg-black"
      onMouseMove={resetHideTimer}
      onMouseEnter={() => setShowControls(true)}
      onTouchStart={resetHideTimer}
    >
      {/* Hidden canvas for ASCII processing */}
      <canvas ref={canvasRef} className="hidden" />

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

      {/* Audio Mode */}
      {isAudio && moment ? (
        <div className="relative w-full" style={{ paddingBottom: '45%', minHeight: '200px' }}>
          <audio
            key={`audio-${moment._id}`}
            ref={audioRef}
            src={moment.mediaUrl}
            crossOrigin="anonymous"
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

          {/* UMO Trippy Effect Overlay */}
          {trippyEffect && <UMOEffect intensity={effectIntensity} />}
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

          {/* UMO Trippy Effect Overlay */}
          {trippyEffect && <UMOEffect intensity={effectIntensity} />}
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
              playsInline
              preload="auto"
              onLoadedData={handleVideoLoaded}
              onEnded={handleNext}
              className={`w-full ${isAsciiMode ? 'opacity-0' : ''}`}
              style={{ maxHeight: '350px', objectFit: 'contain', backgroundColor: '#000' }}
            />
          )}

          {/* ASCII Overlay - for uploaded video */}
          {isAsciiMode && !isYouTube && !isAudio && asciiOutput.length > 0 && (
            <div
              className="absolute inset-0 z-20 overflow-hidden bg-black flex items-center justify-center"
              style={{ fontFamily: 'monospace', lineHeight: '1' }}
            >
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
            </div>
          )}

          <div className="relative cursor-pointer" onClick={togglePlayPause}>
            {!isPlaying && !isAsciiMode && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none z-10">
                <Play size={64} className="text-white opacity-80" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom controls - fade on hover */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 sm:p-4 z-30 transition-opacity duration-300 ${
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        {/* Song info */}
        {moment && (
          <div className="mb-2">
            <h3 className="text-white font-bold text-sm sm:text-base truncate">{moment.songName}</h3>
            <p className="text-gray-400 text-xs truncate">{moment.venueName}</p>
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
            {/* Effect toggle - ASCII for uploads, trippy for YouTube */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isYouTube) {
                  setTrippyEffect(!trippyEffect);
                } else {
                  setIsAsciiMode(!isAsciiMode);
                }
              }}
              className={`rounded-full p-2 transition-colors ${
                (isYouTube ? trippyEffect : isAsciiMode) ? 'bg-purple-600 hover:bg-purple-500' : 'bg-white/20 hover:bg-white/30'
              }`}
              style={{ minWidth: '36px', minHeight: '36px' }}
              title={isYouTube ? 'Trippy effect' : 'ASCII mode'}
            >
              <Droplet size={16} className="text-white" />
            </button>

            {/* Intensity slider - hidden on mobile, shown when effect active */}
            {(isYouTube ? trippyEffect : isAsciiMode) && (
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

            <button
              onClick={handleInfoClick}
              className="bg-blue-600/50 hover:bg-blue-600/70 rounded-full p-2 transition-colors"
              style={{ minWidth: '36px', minHeight: '36px' }}
              title="Details"
            >
              <Info size={16} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

VideoHero.displayName = 'VideoHero';

export default VideoHero;
