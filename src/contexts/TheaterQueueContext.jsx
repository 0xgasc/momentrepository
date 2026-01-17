// src/contexts/TheaterQueueContext.jsx - Theater queue playlist system
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const TheaterQueueContext = createContext();

export const useTheaterQueue = () => {
  const context = useContext(TheaterQueueContext);
  if (!context) {
    throw new Error('useTheaterQueue must be used within TheaterQueueProvider');
  }
  return context;
};

export const TheaterQueueProvider = ({ children }) => {
  // Theater queue state
  const [theaterQueue, setTheaterQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);
  const [isPlayingFromQueue, setIsPlayingFromQueue] = useState(false);
  const [currentMoment, setCurrentMoment] = useState(null);

  // Player state - shared between VideoHero and MediaControlCenter
  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    isFullscreen: false,
    effectMode: null, // 'ascii' | 'trippy' | null
    effectIntensity: 50,
    isPiPMode: false
  });

  // Player controls ref - VideoHero registers its controls here
  const playerControlsRef = useRef(null);

  // Register player controls from VideoHero
  const registerPlayerControls = useCallback((controls) => {
    playerControlsRef.current = controls;
  }, []);

  // Update player state (called by VideoHero)
  const updatePlayerState = useCallback((updates) => {
    setPlayerState(prev => ({ ...prev, ...updates }));
  }, []);

  // Player control functions that MediaControlCenter can call
  const togglePlayPause = useCallback(() => {
    if (playerControlsRef.current?.togglePlayPause) {
      playerControlsRef.current.togglePlayPause();
    }
  }, []);

  const seekTo = useCallback((time) => {
    if (playerControlsRef.current?.seekTo) {
      playerControlsRef.current.seekTo(time);
    }
  }, []);

  const setVolume = useCallback((vol) => {
    if (playerControlsRef.current?.setVolume) {
      playerControlsRef.current.setVolume(vol);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (playerControlsRef.current?.toggleMute) {
      playerControlsRef.current.toggleMute();
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (playerControlsRef.current?.toggleFullscreen) {
      playerControlsRef.current.toggleFullscreen();
    }
  }, []);

  const toggleEffect = useCallback((effectType) => {
    if (playerControlsRef.current?.toggleEffect) {
      playerControlsRef.current.toggleEffect(effectType);
    }
  }, []);

  const setEffectIntensity = useCallback((intensity) => {
    if (playerControlsRef.current?.setEffectIntensity) {
      playerControlsRef.current.setEffectIntensity(intensity);
    }
    setPlayerState(prev => ({ ...prev, effectIntensity: intensity }));
  }, []);

  const togglePiPMode = useCallback(() => {
    if (playerControlsRef.current?.togglePiP) {
      playerControlsRef.current.togglePiP();
    }
  }, []);

  const openComments = useCallback(() => {
    if (playerControlsRef.current?.openComments) {
      playerControlsRef.current.openComments();
    }
  }, []);

  const openInfo = useCallback(() => {
    if (playerControlsRef.current?.openInfo) {
      playerControlsRef.current.openInfo();
    }
  }, []);

  const playNext = useCallback(() => {
    if (playerControlsRef.current?.playNext) {
      playerControlsRef.current.playNext();
    }
  }, []);

  const playRandom = useCallback(() => {
    if (playerControlsRef.current?.playRandom) {
      playerControlsRef.current.playRandom();
    }
  }, []);

  // Add moment to theater queue
  const addToQueue = useCallback((moment) => {
    setTheaterQueue(prev => {
      // Don't add if already exists
      if (prev.find(m => m._id === moment._id)) return prev;
      return [...prev, moment];
    });
  }, []);

  // Remove moment from queue
  const removeFromQueue = useCallback((momentId) => {
    setTheaterQueue(prev => {
      const idx = prev.findIndex(m => m._id === momentId);
      const updated = prev.filter(m => m._id !== momentId);

      // Adjust current index if needed
      if (idx !== -1 && idx <= currentQueueIndex) {
        setCurrentQueueIndex(i => Math.max(-1, i - 1));
      }

      return updated;
    });
  }, [currentQueueIndex]);

  // Clear queue
  const clearQueue = useCallback(() => {
    setTheaterQueue([]);
    setCurrentQueueIndex(-1);
    setIsPlayingFromQueue(false);
    setCurrentMoment(null);
  }, []);

  // Play queue from start or specific index
  const playQueue = useCallback((startIndex = 0) => {
    if (theaterQueue.length === 0) return null;
    const idx = Math.min(startIndex, theaterQueue.length - 1);
    setCurrentQueueIndex(idx);
    setIsPlayingFromQueue(true);
    setCurrentMoment(theaterQueue[idx]);
    return theaterQueue[idx];
  }, [theaterQueue]);

  // Play next in queue
  const playNextInQueue = useCallback(() => {
    if (theaterQueue.length === 0) return null;
    const nextIdx = currentQueueIndex + 1;
    if (nextIdx >= theaterQueue.length) {
      // Queue finished
      setIsPlayingFromQueue(false);
      setCurrentQueueIndex(-1);
      setCurrentMoment(null);
      return null;
    }
    setCurrentQueueIndex(nextIdx);
    setCurrentMoment(theaterQueue[nextIdx]);
    return theaterQueue[nextIdx];
  }, [theaterQueue, currentQueueIndex]);

  // Play previous in queue
  const playPrevInQueue = useCallback(() => {
    if (theaterQueue.length === 0 || currentQueueIndex <= 0) return null;
    const prevIdx = currentQueueIndex - 1;
    setCurrentQueueIndex(prevIdx);
    setCurrentMoment(theaterQueue[prevIdx]);
    return theaterQueue[prevIdx];
  }, [theaterQueue, currentQueueIndex]);

  // Get current queue moment
  const getCurrentQueueMoment = useCallback(() => {
    if (currentQueueIndex < 0 || currentQueueIndex >= theaterQueue.length) return null;
    return theaterQueue[currentQueueIndex];
  }, [theaterQueue, currentQueueIndex]);

  // Reorder queue (for drag and drop)
  const reorderQueue = useCallback((fromIndex, toIndex) => {
    setTheaterQueue(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);

      // Update current index if it was affected
      if (currentQueueIndex === fromIndex) {
        setCurrentQueueIndex(toIndex);
      } else if (fromIndex < currentQueueIndex && toIndex >= currentQueueIndex) {
        setCurrentQueueIndex(i => i - 1);
      } else if (fromIndex > currentQueueIndex && toIndex <= currentQueueIndex) {
        setCurrentQueueIndex(i => i + 1);
      }

      return updated;
    });
  }, [currentQueueIndex]);

  // Shuffle queue (Fisher-Yates)
  const shuffleQueue = useCallback(() => {
    setTheaterQueue(prev => {
      if (prev.length <= 1) return prev;
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      // Reset to start of shuffled queue
      setCurrentQueueIndex(0);
      if (shuffled.length > 0) {
        setCurrentMoment(shuffled[0]);
      }
      return shuffled;
    });
  }, []);

  // Add multiple moments to queue at once
  const addManyToQueue = useCallback((moments) => {
    if (!moments || moments.length === 0) return;
    setTheaterQueue(prev => {
      const existingIds = new Set(prev.map(m => m._id));
      const newMoments = moments.filter(m => !existingIds.has(m._id));
      return [...prev, ...newMoments];
    });
  }, []);

  // Check if moment is in queue
  const isInQueue = useCallback((momentId) => {
    return theaterQueue.some(m => m._id === momentId);
  }, [theaterQueue]);

  // Stop playing from queue (but keep queue)
  const stopQueue = useCallback(() => {
    setIsPlayingFromQueue(false);
    setCurrentMoment(null);
  }, []);

  // Set current moment for direct playback (not from queue)
  // Used by VideoHero when playing moments directly
  const setPlayingMoment = useCallback((moment) => {
    setCurrentMoment(moment);
    // Not from queue, so don't set isPlayingFromQueue
  }, []);

  const value = {
    // Queue state
    theaterQueue,
    currentQueueIndex,
    isPlayingFromQueue,
    currentMoment,

    // Queue actions
    addToQueue,
    addManyToQueue,
    removeFromQueue,
    clearQueue,
    playQueue,
    playNextInQueue,
    playPrevInQueue,
    getCurrentQueueMoment,
    reorderQueue,
    shuffleQueue,
    isInQueue,
    stopQueue,
    setPlayingMoment,

    // Player state (shared)
    playerState,
    updatePlayerState,
    registerPlayerControls,

    // Player controls (for MediaControlCenter)
    togglePlayPause,
    seekTo,
    setVolume,
    toggleMute,
    toggleFullscreen,
    toggleEffect,
    setEffectIntensity,
    togglePiPMode,
    openComments,
    openInfo,
    playNext,
    playRandom
  };

  return (
    <TheaterQueueContext.Provider value={value}>
      {children}
    </TheaterQueueContext.Provider>
  );
};

export default TheaterQueueContext;
