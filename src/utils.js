// Updated utils.js for UMO Repository

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
        
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: year === new Date().getFullYear() ? undefined : 'numeric'
        });
      }
    }
    
    // Fallback
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  } catch (err) {
    // Return original if parsing fails
  }
  
  return dateString;
};

// UMO specific constants  
export const UMO_MBID = 'e2305342-0bde-4a2c-aed0-4b88694834de'; // Correct MusicBrainz ID
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
    // Modern browsers
    return AbortSignal.timeout(timeout);
  } else {
    // Safari fallback
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
    // Enhanced error handling for Safari
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

// Missing button styles for modals
export const additionalButtonStyles = {
  success: {
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '0.875rem 1.5rem',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
    minHeight: '44px',
    touchAction: 'manipulation'
  },
  
  disabled: {
    backgroundColor: '#9ca3af',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '0.875rem 1.5rem',
    cursor: 'not-allowed',
    fontSize: '1rem',
    fontWeight: '600',
    minHeight: '44px',
    opacity: 0.6
  }
};

// UMO API helpers
export const fetchUMOSetlists = async (page = 1, apiBaseUrl) => {
  try {
    console.log(`🎸 Fetching UMO setlists page ${page}...`);
    
    const url = `${apiBaseUrl}/api/rest/1.0/artist/${UMO_MBID}/setlists?p=${page}`;
    console.log(`📡 API URL: ${url}`);
    
    const response = await fetch(url, {
      headers: { 
        Accept: 'application/json',
        'Cache-Control': 'no-cache'
      },
      signal: createTimeoutSignal(15000)
    });

    console.log(`📊 Response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`API responded with ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`📋 Data received:`, {
      total: data.total,
      setlistCount: data.setlist?.length || 0,
      page: data.page
    });

    return data;
  } catch (error) {
    console.error(`❌ Error fetching UMO setlists:`, error);
    throw error;
  }
};

// UMO song extraction helper
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