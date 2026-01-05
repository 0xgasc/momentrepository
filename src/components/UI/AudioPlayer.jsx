// src/components/UI/AudioPlayer.jsx - Audio player with timestamp comments
import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, MessageCircle, Send, X } from 'lucide-react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';

// Timestamp comment marker component
const TimestampMarker = memo(({ comment, position, onClick, isActive }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick(comment);
    }}
    className={`absolute top-0 w-1 h-full transition-all hover:w-2 ${
      isActive ? 'bg-yellow-400 w-2' : 'bg-yellow-500/60 hover:bg-yellow-400'
    }`}
    style={{ left: `${position}%` }}
    title={`${comment.user?.displayName || 'User'}: ${comment.text}`}
  />
));

TimestampMarker.displayName = 'TimestampMarker';

const AudioPlayer = memo(({
  src,
  title,
  artist,
  onDownload,
  compact = false,
  sourceType,
  className = '',
  autoPlay = false,
  momentId // For timestamp comments
}) => {
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const { user } = useAuth();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Timestamp comments state
  const [timestampComments, setTimestampComments] = useState([]);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentTimestamp, setCommentTimestamp] = useState(null);
  const [activeComment, setActiveComment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Generate unique waveform pattern based on src/momentId
  const [waveformBars, setWaveformBars] = useState([]);

  // Generate waveform on src change
  useEffect(() => {
    // Create a seeded random based on src string
    const seed = (src || momentId || title || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const seededRandom = (i) => {
      const x = Math.sin(seed + i * 9999) * 10000;
      return x - Math.floor(x);
    };

    // Generate 60 bars with unique heights
    const bars = Array.from({ length: 60 }, (_, i) => {
      // Create organic-looking waveform with multiple sine waves + randomness
      const base = 25;
      const wave1 = Math.sin(i * 0.3 + seed * 0.01) * 20;
      const wave2 = Math.sin(i * 0.7 + seed * 0.02) * 15;
      const wave3 = Math.sin(i * 0.15 + seed * 0.005) * 10;
      const random = seededRandom(i) * 30;
      return Math.max(15, Math.min(95, base + wave1 + wave2 + wave3 + random));
    });

    setWaveformBars(bars);
  }, [src, momentId, title]);

  // Fetch timestamp comments
  useEffect(() => {
    if (!momentId) return;

    const fetchComments = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/moments/${momentId}/timestamp-comments`);
        const data = await response.json();
        if (data.success) {
          setTimestampComments(data.comments || []);
        }
      } catch (err) {
        console.error('Failed to load timestamp comments:', err);
      }
    };

    fetchComments();
  }, [momentId]);

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error('Audio play error:', err);
        setError('Failed to play audio');
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoading(false);
      if (autoPlay) {
        audioRef.current.play().catch(err => {
          console.error('Auto-play failed:', err);
        });
      }
    }
  };

  const handleSeek = (e) => {
    if (!progressRef.current || !audioRef.current || !duration) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = percent * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Right-click to add timestamp comment
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    if (!progressRef.current || !duration || !user) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const timestamp = percent * duration;

    setCommentTimestamp(timestamp);
    setShowCommentInput(true);
  }, [duration, user]);

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleError = () => {
    setError('Failed to load audio');
    setIsLoading(false);
  };

  // Add timestamp comment
  const handleAddTimestampComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !user || commentTimestamp === null || !momentId) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/moments/${momentId}/timestamp-comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: commentText,
          timestamp: commentTimestamp
        })
      });

      const data = await response.json();
      if (data.success) {
        setTimestampComments([...timestampComments, data.comment]);
        setCommentText('');
        setShowCommentInput(false);
        setCommentTimestamp(null);
      }
    } catch (err) {
      console.error('Failed to add timestamp comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Jump to timestamp when clicking comment
  const handleCommentClick = (comment) => {
    if (audioRef.current && comment.timestamp !== undefined) {
      audioRef.current.currentTime = comment.timestamp;
      setCurrentTime(comment.timestamp);
      setActiveComment(comment);

      // Auto-dismiss after 3 seconds
      setTimeout(() => setActiveComment(null), 3000);
    }
  };

  // Source type badge
  const getSourceBadge = () => {
    if (!sourceType || sourceType === 'unknown') return null;
    const badges = {
      soundboard: { label: 'SBD', color: 'bg-emerald-600' },
      audience: { label: 'AUD', color: 'bg-blue-600' },
      matrix: { label: 'MTX', color: 'bg-purple-600' }
    };
    const badge = badges[sourceType];
    if (!badge) return null;
    return (
      <span className={`${badge.color} text-white text-xs px-2 py-0.5 rounded font-mono`}>
        {badge.label}
      </span>
    );
  };

  // UMO-styled horizontal player
  return (
    <div className={`audio-player-umo ${className}`}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleError}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        preload="metadata"
      />

      {/* Main horizontal player layout */}
      <div className="flex items-center gap-3 bg-gray-900 rounded-lg p-3 border border-gray-700">
        {/* Play button */}
        <button
          onClick={handlePlayPause}
          className="flex-shrink-0 w-12 h-12 bg-yellow-500 hover:bg-yellow-400 rounded-full flex items-center justify-center text-black transition-all shadow-lg"
          disabled={isLoading || error}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause size={22} />
          ) : (
            <Play size={22} className="ml-0.5" />
          )}
        </button>

        {/* Waveform / Progress section */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 mb-1">
            {getSourceBadge()}
            <span className="text-sm font-medium text-white truncate">{title || 'Audio Track'}</span>
            {artist && <span className="text-xs text-gray-500 truncate hidden sm:inline">• {artist}</span>}
          </div>

          {/* Waveform/Progress bar with timestamp markers */}
          <div
            ref={progressRef}
            className="relative h-10 bg-gray-800 rounded cursor-pointer group"
            onClick={handleSeek}
            onContextMenu={handleContextMenu}
          >
            {/* Dynamic waveform visualization - unique per track */}
            <div className="absolute inset-0 flex items-end justify-around gap-px px-1">
              {waveformBars.map((height, i) => {
                const progress = duration ? currentTime / duration : 0;
                const barProgress = i / waveformBars.length;
                const isPast = barProgress <= progress;

                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t transition-colors duration-150 ${
                      isPast ? 'bg-yellow-400' : 'bg-yellow-600/40'
                    }`}
                    style={{ height: `${height}%` }}
                  />
                );
              })}
            </div>

            {/* Progress fill */}
            <div
              className="absolute inset-y-0 left-0 bg-yellow-500/30 rounded-l"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />

            {/* Timestamp comment markers */}
            {timestampComments.map((comment, idx) => (
              <TimestampMarker
                key={comment._id || idx}
                comment={comment}
                position={duration ? (comment.timestamp / duration) * 100 : 0}
                onClick={handleCommentClick}
                isActive={activeComment?._id === comment._id}
              />
            ))}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
              style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />

            {/* Time tooltip on hover */}
            <div className="absolute bottom-full left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div
                className="absolute -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-black/80 text-white text-xs rounded font-mono"
                style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              >
                {formatTime(currentTime)}
              </div>
            </div>
          </div>

          {/* Time display */}
          <div className="flex justify-between text-xs text-gray-500 mt-1 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span className="text-gray-600 hidden sm:inline">
              {user ? 'Right-click to add comment' : ''}
            </span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Volume control */}
          <div className="relative">
            <button
              onClick={toggleMute}
              onMouseEnter={() => setShowVolumeSlider(true)}
              className="text-gray-400 hover:text-yellow-400 transition-colors p-1.5"
            >
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            {showVolumeSlider && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-gray-800 rounded shadow-lg"
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer"
                  style={{ transform: 'rotate(-90deg)', width: '60px' }}
                />
              </div>
            )}
          </div>

          {/* Comment count */}
          {momentId && (
            <div className="flex items-center gap-1 text-gray-500 text-xs">
              <MessageCircle size={14} />
              <span className="font-mono">{timestampComments.length}</span>
            </div>
          )}

          {/* Download button */}
          {onDownload && (
            <button
              onClick={onDownload}
              className="text-gray-400 hover:text-yellow-400 transition-colors p-1.5"
              title="Download"
            >
              <Download size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Active timestamp comment display */}
      {activeComment && (
        <div className="mt-2 px-3 py-2 bg-gray-800/80 border border-yellow-500/30 rounded-lg flex items-start gap-2">
          <div className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded font-mono">
            {formatTime(activeComment.timestamp)}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs text-gray-400">{activeComment.user?.displayName || 'User'}:</span>
            <p className="text-sm text-gray-200 truncate">{activeComment.text}</p>
          </div>
          <button
            onClick={() => setActiveComment(null)}
            className="text-gray-500 hover:text-gray-300 p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Add timestamp comment input */}
      {showCommentInput && (
        <form onSubmit={handleAddTimestampComment} className="mt-2 flex items-center gap-2">
          <div className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded font-mono flex-shrink-0">
            @ {formatTime(commentTimestamp)}
          </div>
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment at this timestamp..."
            maxLength={200}
            autoFocus
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
          />
          <button
            type="submit"
            disabled={!commentText.trim() || submitting}
            className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-500 text-black rounded text-sm transition-colors"
          >
            <Send size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCommentInput(false);
              setCommentText('');
              setCommentTimestamp(null);
            }}
            className="px-3 py-2 text-gray-400 hover:text-gray-200 text-sm"
          >
            <X size={16} />
          </button>
        </form>
      )}

      {/* Timestamp comments list */}
      {timestampComments.length > 0 && !compact && (
        <div className="mt-3 max-h-32 overflow-y-auto space-y-1">
          {timestampComments
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((comment, idx) => (
              <button
                key={comment._id || idx}
                onClick={() => handleCommentClick(comment)}
                className="w-full flex items-center gap-2 px-2 py-1.5 bg-gray-800/50 hover:bg-gray-800 rounded text-left transition-colors group"
              >
                <span className="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 text-xs rounded font-mono group-hover:bg-yellow-500/20">
                  {formatTime(comment.timestamp)}
                </span>
                <span className="text-xs text-gray-500">{comment.user?.displayName || 'User'}</span>
                <span className="text-sm text-gray-300 truncate flex-1">{comment.text}</span>
              </button>
            ))}
        </div>
      )}

      {error && (
        <div className="mt-2 text-center text-red-400 text-sm">{error}</div>
      )}
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
