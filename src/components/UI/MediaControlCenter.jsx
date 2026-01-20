// src/components/UI/MediaControlCenter.jsx - Enhanced media control center with all controls
import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Maximize2, Minimize2, GripHorizontal, X, Shuffle, Droplet,
  ListPlus, MessageSquare, Info, Heart, PictureInPicture, Disc3,
  ChevronDown, ChevronUp
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
    setVolume,
    toggleEffect,
    togglePiPMode,
    playRandom,
    addToQueue,
    isInQueue,
    openComments,
    openInfo
  } = useTheaterQueue();

  // Dragging state
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // UI state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

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
      const newX = Math.max(0, Math.min(window.innerWidth - 320, clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 200, clientY - dragOffset.current.y));
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

  // Check media type - match VideoHero detection logic
  const isYouTube = currentMoment?.mediaSource === 'youtube' ||
    currentMoment?.mediaUrl?.includes('youtube.com') ||
    currentMoment?.mediaUrl?.includes('youtu.be') ||
    (currentMoment?.externalVideoId && !currentMoment?.externalVideoId?.match(/^umo\d{4}/i));

  const isArchive = currentMoment?.mediaSource === 'archive' ||
    currentMoment?.mediaUrl?.includes('archive.org') ||
    currentMoment?.externalVideoId?.match(/^umo\d{4}/i);

  const mediaUrl = (currentMoment?.mediaUrl || '').toLowerCase();
  const isAudio = currentMoment?.mediaType === 'audio' ||
    isArchive ||
    mediaUrl.includes('.mp3') ||
    mediaUrl.includes('.flac') ||
    mediaUrl.includes('.wav') ||
    mediaUrl.includes('.ogg');

  // Uploaded video = not YouTube, not archive, not audio
  const isUploadedVideo = !isYouTube && !isArchive && !isAudio && currentMoment?.mediaUrl;

  const hasQueue = theaterQueue.length > 0;
  const isAtQueueEnd = currentQueueIndex >= theaterQueue.length - 1;

  // Handle next/random
  const handleNext = () => {
    if (hasQueue && !isAtQueueEnd) {
      playNextInQueue();
    } else {
      playRandom?.();
    }
  };

  // Handle add to queue
  const handleAddToQueue = () => {
    if (currentMoment && !isInQueue?.(currentMoment._id)) {
      addToQueue?.(currentMoment);
    }
  };

  // Empty state - nothing playing
  if (!currentMoment && !isPlayingFromQueue) {
    return (
      <div className={isDocked ? 'media-control-center-docked p-3' : ''}>
        {isDocked ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-800/50 flex items-center justify-center">
              <Disc3 size={24} className="text-gray-600" />
            </div>
            <p className="text-gray-500 text-sm mb-3">Nothing playing</p>
            <button
              onClick={() => playRandom?.()}
              className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-sm rounded-full transition-colors flex items-center gap-2 mx-auto"
            >
              <Shuffle size={14} />
              Play Random
            </button>
          </div>
        ) : (
          <div
            ref={dragRef}
            className="fixed z-50 w-64 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden"
            style={{ left: position.x, top: position.y }}
          >
            <div
              className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5 cursor-grab"
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
            >
              <div className="flex items-center gap-2">
                <GripHorizontal size={14} className="text-gray-500" />
                <span className="text-xs text-gray-400">Media Controls</span>
              </div>
              <button onClick={onClose} className="p-1 text-gray-500 hover:text-red-400">
                <X size={12} />
              </button>
            </div>
            <div className="p-4 text-center">
              <Disc3 size={32} className="text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm mb-3">Nothing playing</p>
              <button
                onClick={() => playRandom?.()}
                className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-sm rounded-full transition-colors flex items-center gap-2 mx-auto"
              >
                <Shuffle size={14} />
                Play Random
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Docked version (for sidebar)
  if (isDocked) {
    return (
      <div className="media-control-center-docked p-2 bg-black/30 backdrop-blur-xl rounded-lg border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
          >
            Now Playing
            {isCollapsed ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => togglePiPMode?.()}
              className={`p-1 transition-colors ${playerState.isPiPMode ? 'text-yellow-400' : 'text-gray-500 hover:text-white'}`}
              title="Picture in Picture"
            >
              <PictureInPicture size={12} />
            </button>
            <button
              onClick={() => onDockChange?.(false)}
              className="p-1 text-gray-500 hover:text-white transition-colors"
              title="Pop out"
            >
              <Maximize2 size={12} />
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-2">
            {/* Song Info */}
            <div className="mb-2">
              <div className="text-xs font-medium text-white truncate">{currentMoment?.songName || 'Unknown'}</div>
              <div className="text-[10px] text-gray-400 truncate">{currentMoment?.venueName || ''}</div>
            </div>

            {/* Progress Bar */}
            <div
              className="h-1 bg-white/20 rounded cursor-pointer mb-2 group"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-yellow-400 rounded relative"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Time Display */}
            <div className="flex justify-between text-[9px] text-gray-500 mb-2">
              <span>{formatTime(playerState.currentTime)}</span>
              <span>{formatTime(playerState.duration)}</span>
            </div>

            {/* Main Controls */}
            <div className="flex items-center justify-center gap-1 mb-2">
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
                onClick={handleNext}
                className="p-1.5 rounded-full text-gray-300 hover:text-white hover:bg-gray-700/50 transition-all"
                title={hasQueue && !isAtQueueEnd ? 'Next' : 'Random'}
              >
                {hasQueue && !isAtQueueEnd ? (
                  <SkipForward size={14} />
                ) : (
                  <Shuffle size={14} />
                )}
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-1 mb-2">
              <button
                onClick={toggleMute}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                {playerState.isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
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
                           [&::-webkit-slider-thumb]:w-2
                           [&::-webkit-slider-thumb]:h-2
                           [&::-webkit-slider-thumb]:rounded-full
                           [&::-webkit-slider-thumb]:bg-white
                           [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            {/* Secondary Controls */}
            <div className="flex items-center justify-center gap-1 pt-1 border-t border-gray-700/50">
              {/* Add to queue */}
              <button
                onClick={handleAddToQueue}
                className={`p-1.5 rounded-full transition-colors ${
                  currentMoment && isInQueue?.(currentMoment._id)
                    ? 'text-yellow-400 bg-yellow-900/40'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
                title={currentMoment && isInQueue?.(currentMoment._id) ? 'In queue' : 'Add to queue'}
              >
                <ListPlus size={12} />
              </button>

              {/* Favorite - simple heart */}
              <button
                onClick={() => setIsFavorited(!isFavorited)}
                className={`p-1.5 rounded-full transition-colors ${
                  isFavorited ? 'text-red-500' : 'text-gray-400 hover:text-red-400 hover:bg-red-900/40'
                }`}
                title={isFavorited ? 'Unfavorite' : 'Favorite'}
              >
                <Heart size={12} fill={isFavorited ? 'currentColor' : 'none'} />
              </button>

              {/* Comments */}
              <button
                onClick={() => openComments?.()}
                className="p-1.5 rounded-full text-gray-400 hover:text-blue-400 hover:bg-blue-900/40 transition-colors"
                title="Comments"
              >
                <MessageSquare size={12} />
              </button>

              {/* Info */}
              <button
                onClick={() => openInfo?.()}
                className="p-1.5 rounded-full text-gray-400 hover:text-blue-400 hover:bg-blue-900/40 transition-colors"
                title="Details"
              >
                <Info size={12} />
              </button>

              {/* Effect toggle (video only) */}
              {(isYouTube || isUploadedVideo) && (
                <button
                  onClick={() => toggleEffect?.(isYouTube ? 'trippy' : 'ascii')}
                  className={`p-1.5 rounded-full transition-colors ${
                    playerState.effectMode ? 'text-purple-400 bg-purple-900/40' : 'text-gray-400 hover:text-purple-400 hover:bg-purple-900/40'
                  }`}
                  title={isYouTube ? 'Trippy FX' : 'ASCII mode'}
                >
                  <Droplet size={12} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Floating/popped out version
  return (
    <div
      ref={dragRef}
      className="fixed z-50 w-80 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* Drag Handle */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-yellow-500/10 to-transparent border-b border-white/5 cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal size={14} className="text-gray-500" />
          <span className="text-xs text-gray-400">Media Controls</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => togglePiPMode?.()}
            className={`p-1 transition-colors ${playerState.isPiPMode ? 'text-yellow-400' : 'text-gray-500 hover:text-white'}`}
            title="Picture in Picture"
          >
            <PictureInPicture size={12} />
          </button>
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
        <div className="mb-3">
          <div className="text-sm font-medium text-white truncate">{currentMoment?.songName || 'Unknown'}</div>
          <div className="text-xs text-gray-400 truncate">
            {currentMoment?.venueName || ''}
            {currentMoment?.venueCity && ` - ${currentMoment.venueCity}`}
          </div>
        </div>

        {/* Progress Bar */}
        <div
          className="h-1.5 bg-white/20 rounded cursor-pointer mb-2 group"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-yellow-400 rounded relative transition-all"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded opacity-0 group-hover:opacity-100 transition-opacity shadow" />
          </div>
        </div>

        {/* Time Display */}
        <div className="flex justify-between text-[10px] text-gray-500 mb-3">
          <span>{formatTime(playerState.currentTime)}</span>
          <span>{formatTime(playerState.duration)}</span>
        </div>

        {/* Main Controls */}
        <div className="flex items-center justify-center gap-2 mb-3">
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
            onClick={handleNext}
            className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-gray-700/50 transition-all"
            title={hasQueue && !isAtQueueEnd ? 'Next' : 'Random'}
          >
            {hasQueue && !isAtQueueEnd ? (
              <SkipForward size={18} />
            ) : (
              <Shuffle size={18} />
            )}
          </button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2 mb-3">
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

        {/* Secondary Controls Grid */}
        <div className="grid grid-cols-5 gap-1 pt-2 border-t border-gray-700/50">
          {/* Add to queue */}
          <button
            onClick={handleAddToQueue}
            className={`p-2 rounded-lg transition-colors flex flex-col items-center ${
              currentMoment && isInQueue?.(currentMoment._id)
                ? 'text-yellow-400 bg-yellow-900/40'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
            title={currentMoment && isInQueue?.(currentMoment._id) ? 'In queue' : 'Add to queue'}
          >
            <ListPlus size={14} />
            <span className="text-[8px] mt-0.5">Queue</span>
          </button>

          {/* Favorite - simple heart */}
          <button
            onClick={() => setIsFavorited(!isFavorited)}
            className={`p-2 rounded-lg transition-colors flex flex-col items-center ${
              isFavorited ? 'text-red-500' : 'text-gray-400 hover:text-red-400 hover:bg-red-900/40'
            }`}
            title={isFavorited ? 'Unfavorite' : 'Favorite'}
          >
            <Heart size={14} fill={isFavorited ? 'currentColor' : 'none'} />
            <span className="text-[8px] mt-0.5">Fav</span>
          </button>

          {/* Comments */}
          <button
            onClick={() => openComments?.()}
            className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-900/40 transition-colors flex flex-col items-center"
            title="Comments"
          >
            <MessageSquare size={14} />
            <span className="text-[8px] mt-0.5">Chat</span>
          </button>

          {/* Info */}
          <button
            onClick={() => openInfo?.()}
            className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-900/40 transition-colors flex flex-col items-center"
            title="Details"
          >
            <Info size={14} />
            <span className="text-[8px] mt-0.5">Info</span>
          </button>

          {/* Effect toggle (video only) */}
          {(isYouTube || isUploadedVideo) ? (
            <button
              onClick={() => toggleEffect?.(isYouTube ? 'trippy' : 'ascii')}
              className={`p-2 rounded-lg transition-colors flex flex-col items-center ${
                playerState.effectMode ? 'text-purple-400 bg-purple-900/40' : 'text-gray-400 hover:text-purple-400 hover:bg-purple-900/40'
              }`}
              title={isYouTube ? 'Trippy FX' : 'ASCII mode'}
            >
              <Droplet size={14} />
              <span className="text-[8px] mt-0.5">FX</span>
            </button>
          ) : (
            <div className="p-2" />
          )}
        </div>
      </div>
    </div>
  );
});

MediaControlCenter.displayName = 'MediaControlCenter';

export default MediaControlCenter;
