// src/components/UI/MediaControlCenter.jsx - Draggable media control center
import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Maximize2, Minimize2, GripHorizontal, X
} from 'lucide-react';
import { useTheaterQueue } from '../../contexts/TheaterQueueContext';

const MediaControlCenter = memo(({
  isDocked = true,
  onDockChange,
  onClose
}) => {
  const {
    currentMoment,
    isPlayingFromQueue,
    theaterQueue,
    currentQueueIndex,
    playNextInQueue,
    playPrevInQueue,
    playerState,
    togglePlayPause,
    toggleMute,
    seekTo,
    setVolume
  } = useTheaterQueue();

  // Dragging state
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Volume slider visibility
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Handle drag start
  const handleDragStart = useCallback((e) => {
    if (isDocked) return;
    e.preventDefault();
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    dragOffset.current = {
      x: clientX - position.x,
      y: clientY - position.y
    };
    setIsDragging(true);
  }, [isDocked, position]);

  // Handle dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e) => {
      const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
      const newX = Math.max(0, Math.min(window.innerWidth - 300, clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 150, clientY - dragOffset.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging]);

  // Format time
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Progress percentage
  const progressPercent = playerState.duration > 0
    ? (playerState.currentTime / playerState.duration) * 100
    : 0;

  // Handle progress bar click
  const handleProgressClick = (e) => {
    if (!playerState.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * playerState.duration;
    seekTo(newTime);
  };

  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
  };

  // Don't render if nothing is playing
  if (!currentMoment && !isPlayingFromQueue) {
    return null;
  }

  // Docked version (for sidebar)
  if (isDocked) {
    return (
      <div className="media-control-center-docked p-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            Now Playing
          </div>
          <button
            onClick={() => onDockChange?.(false)}
            className="p-1 text-gray-500 hover:text-white transition-colors"
            title="Pop out"
          >
            <Maximize2 size={12} />
          </button>
        </div>

        {/* Now Playing Card */}
        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg p-2">
          {/* Song Info */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-end gap-0.5 h-3 flex-shrink-0">
              <div className={`w-0.5 bg-yellow-400 rounded-full ${playerState.isPlaying ? 'animate-pulse' : ''}`} style={{ height: '8px' }} />
              <div className={`w-0.5 bg-yellow-400 rounded-full ${playerState.isPlaying ? 'animate-pulse' : ''}`} style={{ height: '12px', animationDelay: '150ms' }} />
              <div className={`w-0.5 bg-yellow-400 rounded-full ${playerState.isPlaying ? 'animate-pulse' : ''}`} style={{ height: '6px', animationDelay: '300ms' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">{currentMoment?.songName || 'Unknown'}</div>
              <div className="text-[10px] text-gray-400 truncate">{currentMoment?.venueName || ''}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div
            className="h-1 bg-gray-700 rounded-full cursor-pointer mb-2 group"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-yellow-400 rounded-full relative"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Time Display */}
          <div className="flex justify-between text-[9px] text-gray-500 mb-2">
            <span>{formatTime(playerState.currentTime)}</span>
            <span>{formatTime(playerState.duration)}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={playPrevInQueue}
              disabled={currentQueueIndex <= 0}
              className={`p-1.5 rounded-full transition-all ${
                currentQueueIndex <= 0
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <SkipBack size={14} />
            </button>

            <button
              onClick={togglePlayPause}
              className="w-8 h-8 bg-yellow-500/20 hover:bg-yellow-500/30 rounded-full flex items-center justify-center transition-colors"
            >
              {playerState.isPlaying ? (
                <Pause size={14} className="text-yellow-400" />
              ) : (
                <Play size={14} className="text-yellow-400 ml-0.5" />
              )}
            </button>

            <button
              onClick={playNextInQueue}
              disabled={currentQueueIndex >= theaterQueue.length - 1}
              className={`p-1.5 rounded-full transition-all ${
                currentQueueIndex >= theaterQueue.length - 1
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <SkipForward size={14} />
            </button>

            <button
              onClick={toggleMute}
              className="p-1.5 rounded-full text-gray-300 hover:text-white hover:bg-gray-700/50 transition-all ml-1"
            >
              {playerState.isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          </div>

          {/* Queue Progress */}
          <div className="text-[9px] text-gray-500 text-center mt-1">
            {currentQueueIndex + 1} of {theaterQueue.length}
          </div>
        </div>
      </div>
    );
  }

  // Floating/popped out version
  return (
    <div
      ref={dragRef}
      className="fixed z-50 w-72 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* Drag Handle */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-yellow-900/40 to-gray-900/80 border-b border-gray-700/50 cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal size={14} className="text-gray-500" />
          <span className="text-xs text-gray-400">Media Controls</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDockChange?.(true)}
            className="p-1 text-gray-500 hover:text-white transition-colors"
            title="Dock to sidebar"
          >
            <Minimize2 size={12} />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-red-400 transition-colors"
            title="Close"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Song Info */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-end gap-0.5 h-4 flex-shrink-0">
            <div className={`w-1 bg-yellow-400 rounded-full ${playerState.isPlaying ? 'animate-pulse' : ''}`} style={{ height: '10px' }} />
            <div className={`w-1 bg-yellow-400 rounded-full ${playerState.isPlaying ? 'animate-pulse' : ''}`} style={{ height: '16px', animationDelay: '150ms' }} />
            <div className={`w-1 bg-yellow-400 rounded-full ${playerState.isPlaying ? 'animate-pulse' : ''}`} style={{ height: '8px', animationDelay: '300ms' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{currentMoment?.songName || 'Unknown'}</div>
            <div className="text-xs text-gray-400 truncate">{currentMoment?.venueName || ''}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div
          className="h-1.5 bg-gray-700 rounded-full cursor-pointer mb-2 group"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-yellow-400 rounded-full relative transition-all"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow" />
          </div>
        </div>

        {/* Time Display */}
        <div className="flex justify-between text-[10px] text-gray-500 mb-3">
          <span>{formatTime(playerState.currentTime)}</span>
          <span>{formatTime(playerState.duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={playPrevInQueue}
            disabled={currentQueueIndex <= 0}
            className={`p-2 rounded-full transition-all ${
              currentQueueIndex <= 0
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={togglePlayPause}
            className="w-12 h-12 bg-yellow-500/20 hover:bg-yellow-500/30 rounded-full flex items-center justify-center transition-colors"
          >
            {playerState.isPlaying ? (
              <Pause size={20} className="text-yellow-400" />
            ) : (
              <Play size={20} className="text-yellow-400 ml-1" />
            )}
          </button>

          <button
            onClick={playNextInQueue}
            disabled={currentQueueIndex >= theaterQueue.length - 1}
            className={`p-2 rounded-full transition-all ${
              currentQueueIndex >= theaterQueue.length - 1
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            <SkipForward size={18} />
          </button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-700/50">
          <button
            onClick={toggleMute}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            {playerState.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={playerState.isMuted ? 0 : (playerState.volume || 1)}
            onChange={handleVolumeChange}
            className="flex-1 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none
                       [&::-webkit-slider-thumb]:w-3
                       [&::-webkit-slider-thumb]:h-3
                       [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-white
                       [&::-webkit-slider-thumb]:cursor-pointer"
          />
        </div>

        {/* Queue Info */}
        <div className="text-[10px] text-gray-500 text-center mt-2">
          {currentQueueIndex + 1} of {theaterQueue.length} in queue
        </div>
      </div>
    </div>
  );
});

MediaControlCenter.displayName = 'MediaControlCenter';

export default MediaControlCenter;
