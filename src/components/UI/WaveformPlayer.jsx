// src/components/UI/WaveformPlayer.jsx
// SoundCloud-style waveform player with timed comments
import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { Send, X } from 'lucide-react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';

// Generate pseudo-random waveform data based on moment ID for consistency
const generateWaveform = (bars, seed = 0) => {
  const data = [];
  let seedValue = seed;
  const pseudoRandom = () => {
    seedValue = (seedValue * 1103515245 + 12345) & 0x7fffffff;
    return seedValue / 0x7fffffff;
  };

  for (let i = 0; i < bars; i++) {
    // Create organic-looking waveform with peaks and valleys
    const base = 0.3 + pseudoRandom() * 0.4;
    const peak = Math.sin(i / bars * Math.PI * 2) * 0.2;
    const noise = (pseudoRandom() - 0.5) * 0.3;
    data.push(Math.max(0.1, Math.min(1, base + peak + noise)));
  }
  return data;
};

// Format time as MM:SS
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const WaveformPlayer = memo(({ audioRef, videoRef, moment, isPlaying, onSeek, isVideo = false, externalTime, externalDuration, simple = false }) => {
  // Support both audio and video elements, or external time for YouTube
  const mediaRef = videoRef || audioRef;
  const isExternalTime = externalTime !== undefined || externalDuration !== undefined;
  // Combine progress state to reduce re-renders
  const [playbackState, setPlaybackState] = useState({
    progress: 0,
    currentTime: externalTime || 0,
    duration: externalDuration || 0
  });
  const [comments, setComments] = useState([]);
  const [hoveredComment, setHoveredComment] = useState(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentInputPos, setCommentInputPos] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const waveformRef = useRef(null);
  const lastUpdateRef = useRef(0); // For throttling updates
  const { user } = useAuth();

  // Destructure for easier access
  const { progress, currentTime, duration } = playbackState;

  // Generate consistent waveform based on moment ID
  const waveformData = useMemo(() => {
    const seed = moment?._id ?
      moment._id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) :
      Date.now();
    return generateWaveform(64, seed);
  }, [moment?._id]);

  // RESET playback state immediately when moment changes
  useEffect(() => {
    // Reset to zero state when switching tracks
    setPlaybackState({
      progress: 0,
      currentTime: 0,
      duration: 0
    });
    // Also reset throttle ref so first update comes through immediately
    lastUpdateRef.current = 0;
  }, [moment?._id]);

  // Fetch timed comments for this moment
  useEffect(() => {
    if (!moment?._id) return;

    const fetchComments = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/moments/${moment._id}/timestamp-comments`);
        if (response.ok) {
          const data = await response.json();
          // Handle both array and { comments: [] } response formats
          const commentsArray = data.comments || data;
          setComments(Array.isArray(commentsArray) ? commentsArray : []);
        }
      } catch (error) {
        console.log('Failed to fetch timed comments:', error);
      }
    };

    fetchComments();
  }, [moment?._id]);

  // Update from external time props (for YouTube) - throttled to reduce glitching
  useEffect(() => {
    if (isExternalTime && externalDuration > 0) {
      const now = Date.now();
      // Throttle updates to max 4 per second for smooth animation
      if (now - lastUpdateRef.current < 250) return;
      lastUpdateRef.current = now;

      setPlaybackState({
        progress: (externalTime || 0) / externalDuration,
        currentTime: externalTime || 0,
        duration: externalDuration
      });
    }
  }, [isExternalTime, externalTime, externalDuration]);

  // Update progress from media currentTime (for audio/video elements)
  useEffect(() => {
    if (isExternalTime) return; // Skip if using external time
    const media = mediaRef?.current;
    if (!media) return;

    const updateProgress = () => {
      if (media.duration && !isNaN(media.duration)) {
        const now = Date.now();
        // Throttle updates to max 4 per second
        if (now - lastUpdateRef.current < 250) return;
        lastUpdateRef.current = now;

        setPlaybackState({
          progress: media.currentTime / media.duration,
          currentTime: media.currentTime,
          duration: media.duration
        });
      }
    };

    const handleLoadedMetadata = () => {
      setPlaybackState(prev => ({
        ...prev,
        duration: media.duration
      }));
    };

    media.addEventListener('timeupdate', updateProgress);
    media.addEventListener('loadedmetadata', handleLoadedMetadata);

    // Initial values
    if (media.duration && !isNaN(media.duration)) {
      setPlaybackState({
        progress: media.currentTime / media.duration,
        currentTime: media.currentTime,
        duration: media.duration
      });
    }

    return () => {
      media.removeEventListener('timeupdate', updateProgress);
      media.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [mediaRef, isExternalTime, moment?._id]); // Added moment._id to re-attach listeners on track change

  // Handle click to seek
  const handleSeek = useCallback((e) => {
    if (!waveformRef.current || !duration) return;
    // For external time (YouTube), we need mediaRef OR onSeek callback
    if (!isExternalTime && !mediaRef?.current) return;

    const rect = waveformRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = percent * duration;

    // Update media element if available
    if (mediaRef?.current) {
      mediaRef.current.currentTime = newTime;
    }

    // Update local state immediately for responsiveness
    setPlaybackState(prev => ({
      ...prev,
      progress: percent,
      currentTime: newTime
    }));

    // Callback for external handling (YouTube seek)
    if (onSeek) onSeek(newTime);
  }, [mediaRef, duration, onSeek, isExternalTime]);

  // Handle double-click to add comment
  const handleDoubleClick = useCallback((e) => {
    if (!user || !waveformRef.current || !duration) return;

    const rect = waveformRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    setCommentInputPos(percent);
    setShowCommentInput(true);
    setCommentText('');
  }, [user, duration]);

  // Submit timed comment
  const handleSubmitComment = async () => {
    if (!commentText.trim() || !user || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const timestamp = commentInputPos * duration;
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/moments/${moment._id}/timestamp-comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: commentText.trim(),
          timestamp: timestamp
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newComment = data.comment || data;
        setComments(prev => [...prev, newComment]);
        setShowCommentInput(false);
        setCommentText('');
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel comment input
  const handleCancelComment = () => {
    setShowCommentInput(false);
    setCommentText('');
  };

  return (
    <div className="waveform-player w-full">
      {/* Time display - smaller for simple mode */}
      <div className={`flex justify-between text-gray-400 font-mono ${simple ? 'text-[10px] mb-1' : 'text-xs mb-2'}`}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Waveform/Progress container */}
      <div
        ref={waveformRef}
        className={`relative cursor-pointer select-none ${simple ? 'h-6' : 'h-16'}`}
        onClick={handleSeek}
        onDoubleClick={handleDoubleClick}
        title={user ? "Click to seek, double-click to add comment" : "Click to seek"}
      >
        {simple ? (
          /* Simple mode: mini waveform style for video */
          <>
            {/* Background - subtle bars pattern */}
            <div className="absolute inset-0 flex items-end gap-[2px] px-1">
              {Array.from({ length: 48 }).map((_, i) => {
                const barProgress = i / 48;
                const isPlayed = barProgress < progress;
                // Create wave-like heights
                const height = 30 + Math.sin(i * 0.5) * 20 + Math.cos(i * 0.3) * 15 + (i % 3) * 10;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm transition-all duration-150 ${
                      isPlayed
                        ? 'bg-gradient-to-t from-purple-500 via-fuchsia-400 to-cyan-400'
                        : 'bg-blue-500/60'
                    }`}
                    style={{ height: `${Math.min(100, height)}%` }}
                  />
                );
              })}
            </div>
            {/* Playhead line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
              style={{ left: `${progress * 100}%` }}
            />
          </>
        ) : (
          /* Full waveform mode: bars for audio */
          <>
            {/* Waveform bars */}
            <div className="absolute inset-0 flex items-end justify-between gap-px">
              {waveformData.map((height, i) => {
                const barProgress = i / waveformData.length;
                const isPlayed = barProgress < progress;

                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-sm transition-colors duration-100 ${
                      isPlayed
                        ? 'bg-gradient-to-t from-purple-500 via-cyan-400 to-emerald-400'
                        : 'bg-blue-400/70'
                    }`}
                    style={{ height: `${height * 100}%` }}
                  />
                );
              })}
            </div>

            {/* Progress indicator line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none z-10 shadow-lg shadow-white/50"
              style={{ left: `${progress * 100}%` }}
            />
          </>
        )}

        {/* Comment markers */}
        {comments.map((comment) => {
          const commentPos = duration > 0 ? (comment.timestamp / duration) * 100 : 0;

          return (
            <div
              key={comment._id}
              className="absolute bottom-0 transform -translate-x-1/2 z-20"
              style={{ left: `${commentPos}%` }}
              onMouseEnter={() => setHoveredComment(comment)}
              onMouseLeave={() => setHoveredComment(null)}
            >
              {/* Comment dot with pulse animation */}
              <div className="w-3 h-3 rounded-full bg-orange-400 cursor-pointer hover:scale-125 transition-transform shadow-lg shadow-orange-500/50 animate-pulse" />
            </div>
          );
        })}

        {/* Hovered comment tooltip */}
        {hoveredComment && (
          <div
            className="absolute bottom-8 transform -translate-x-1/2 z-30 bg-black/90 backdrop-blur-xl rounded-sm px-3 py-2 max-w-64 shadow-xl border border-white/20"
            style={{ left: `${duration > 0 ? (hoveredComment.timestamp / duration) * 100 : 0}%` }}
          >
            <div className="text-[10px] text-cyan-400 font-medium">
              {hoveredComment.user?.displayName || 'Anon'}
              <span className="text-gray-500 ml-1">{formatTime(hoveredComment.timestamp)}</span>
            </div>
            <p className="text-xs text-white leading-tight">{hoveredComment.text}</p>
          </div>
        )}

        {/* Comment input popup */}
        {showCommentInput && (
          <div
            className="absolute bottom-10 transform -translate-x-1/2 z-40 bg-black/90 backdrop-blur-xl rounded-sm p-3 shadow-2xl border border-white/20 w-72"
            style={{ left: `${commentInputPos * 100}%` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-fuchsia-400 font-mono bg-fuchsia-500/20 px-2 py-0.5 rounded">{formatTime(commentInputPos * duration)}</span>
              <button
                onClick={handleCancelComment}
                className="ml-auto text-gray-400 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                placeholder="Say something..."
                className="flex-1 bg-white/10 border border-white/20 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-fuchsia-500/50 focus:bg-white/15 transition-all"
                autoFocus
              />
              <button
                onClick={handleSubmitComment}
                disabled={!commentText.trim() || isSubmitting}
                className="bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-400 hover:to-fuchsia-400 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed rounded-sm px-3 py-2 transition-all"
              >
                <Send size={14} className="text-white" />
              </button>
            </div>
            {/* Arrow */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900/95" />
            </div>
          </div>
        )}
      </div>

      {/* Help text - hide in simple mode */}
      {user && !simple && (
        <div className="text-[10px] text-gray-500 mt-1 text-center">
          Double-click to comment
        </div>
      )}
    </div>
  );
});

WaveformPlayer.displayName = 'WaveformPlayer';

export default WaveformPlayer;
