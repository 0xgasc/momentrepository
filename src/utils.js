// Complete src/utils.js with cache support

// Utility functions for UMO Repository

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDate = (dateString) => {
  if (!dateString) return 'Unknown date';
  
  // Handle DD-MM-YYYY format (common in setlist.fm)
  if (dateString.includes('-')) {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
      const year = parseInt(parts[2]);
      
      if (year >= 2020 && year <= 2025 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const date = new Date(year, month, day);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    }
  }
  
  // Fallback: try parsing as regular date
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  } catch (err) {
    // Return original if parsing fails
  }
  
  return dateString;
};

// Updated formatShortDate function for src/utils.js
// Replace the existing formatShortDate function with this:

export const formatShortDate = (dateString) => {
  if (!dateString) return 'Unknown date';
  
  try {
    // Handle DD-MM-YYYY format
    if (dateString.includes('-')) {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        const date = new Date(year, month, day);
        
        // Always show year for concert archive clarity
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'  // Always show year
        });
      }
    }
    
    // Fallback
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'  // Always show year
      });
    }
  } catch (err) {
    // Return original if parsing fails
  }
  
  return dateString;
};

// UMO specific constants  
export const UMO_MBID = 'e2305342-0bde-4a2c-aed0-4b88694834de';
export const UMO_ARTIST = { name: 'Unknown Mortal Orchestra', mbid: UMO_MBID };

// Mobile Safari detection utility
export const isMobileSafari = () => {
  const userAgent = navigator.userAgent;
  return /Safari/.test(userAgent) && 
         /Mobile/.test(userAgent) && 
         !/Chrome/.test(userAgent) && 
         !/CriOS/.test(userAgent) && 
         !/FxiOS/.test(userAgent);
};

// Enhanced timeout signal for Safari compatibility
export const createTimeoutSignal = (timeout) => {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeout);
  } else {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);
    return controller.signal;
  }
};

// Safari-compatible fetch wrapper
export const safeFetch = async (url, options = {}) => {
  const defaultOptions = {
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...options.headers
    },
    signal: options.signal || createTimeoutSignal(10000),
    ...options
  };

  try {
    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    } else if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw error;
    }
  }
};

// Debounce utility for mobile performance
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Touch-friendly button styles for mobile
export const mobileButtonStyles = {
  minHeight: '44px',
  minWidth: '44px',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent'
};

// =============================================================================
// CACHE-AWARE API HELPERS
// =============================================================================

// Main function to get UMO performances from cache
export const fetchUMOSetlists = async (page = 1, apiBaseUrl) => {
  try {
    console.log(`🎸 Fetching UMO performances from cache (page ${page})...`);
    
    const url = `${apiBaseUrl}/cached/performances?page=${page}&limit=20`;
    console.log(`📡 Cache URL: ${url}`);
    
    const response = await safeFetch(url);
    const data = await response.json();
    
    console.log(`📋 Cache data received:`, {
      total: data.pagination.total,
      performanceCount: data.performances.length,
      page: data.pagination.page,
      fromCache: data.fromCache,
      lastUpdated: data.lastUpdated
    });

    // Transform to match original setlist.fm API format
    return {
      setlist: data.performances,
      total: data.pagination.total,
      page: data.pagination.page,
      fromCache: data.fromCache,
      hasMore: data.pagination.hasMore
    };
    
  } catch (error) {
    console.error(`❌ Error fetching cached UMO setlists:`, error);
    throw error;
  }
};

// Search function for city/venue using cache
export const searchUMOPerformances = async (cityQuery, apiBaseUrl) => {
  try {
    console.log(`🔍 Searching UMO performances for "${cityQuery}"...`);
    
    const url = `${apiBaseUrl}/cached/performances?city=${encodeURIComponent(cityQuery)}`;
    
    const response = await safeFetch(url);
    const data = await response.json();
    
    console.log(`📍 Search results: ${data.performances.length} performances found`);
    
    return {
      setlist: data.performances,
      total: data.performances.length,
      fromCache: data.fromCache,
      searchQuery: cityQuery
    };
    
  } catch (error) {
    console.error(`❌ Error searching UMO performances:`, error);
    throw error;
  }
};

// Function to get comprehensive song database from cache
export const fetchUMOSongDatabase = async (apiBaseUrl, sortBy = 'alphabetical') => {
  try {
    console.log(`🎵 Fetching UMO song database from cache...`);
    
    const url = `${apiBaseUrl}/cached/songs?sortBy=${sortBy}`;
    
    const response = await safeFetch(url);
    const data = await response.json();
    
    console.log(`📊 Song database loaded: ${data.songs.length} songs`);
    
    return data.songs;
    
  } catch (error) {
    console.error(`❌ Error fetching song database:`, error);
    throw error;
  }
};

// Function to get specific song data with all performances
export const fetchUMOSongDetail = async (songName, apiBaseUrl) => {
  try {
    console.log(`🎵 Fetching song detail for "${songName}"...`);
    
    const url = `${apiBaseUrl}/cached/song/${encodeURIComponent(songName)}`;
    
    const response = await safeFetch(url);
    const data = await response.json();
    
    console.log(`📊 Song detail loaded: ${data.song.totalPerformances} performances`);
    
    return data.song;
    
  } catch (error) {
    console.error(`❌ Error fetching song detail:`, error);
    throw error;
  }
};

// Function to get cache status and stats
export const getCacheStatus = async (apiBaseUrl) => {
  try {
    const response = await safeFetch(`${apiBaseUrl}/cache/status`);
    const data = await response.json();
    
    return {
      hasCache: data.hasCache,
      needsRefresh: data.needsRefresh,
      stats: data.stats,
      lastUpdated: data.lastUpdated
    };
    
  } catch (error) {
    console.error(`❌ Error fetching cache status:`, error);
    return { hasCache: false, needsRefresh: true };
  }
};

// Function to trigger cache refresh (admin use)
export const refreshCache = async (apiBaseUrl) => {
  try {
    const response = await fetch(`${apiBaseUrl}/cache/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error(`❌ Error refreshing cache:`, error);
    throw error;
  }
};

// Helper to check if we should show cache status to user
export const shouldShowCacheStatus = async (apiBaseUrl) => {
  try {
    const status = await getCacheStatus(apiBaseUrl);
    return !status.hasCache || status.needsRefresh;
  } catch (error) {
    return true;
  }
};

// Backward compatibility function
export const extractUMOSongs = (setlists) => {
  const allSongs = new Set();
  
  setlists.forEach(setlist => {
    if (setlist.sets && setlist.sets.set) {
      setlist.sets.set.forEach(set => {
        if (set.song) {
          set.song.forEach(song => {
            if (song.name) {
              allSongs.add(song.name);
            }
          });
        }
      });
    }
  });
  
  return Array.from(allSongs).sort();
};