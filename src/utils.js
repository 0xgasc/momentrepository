// Updated utils.js with complete featured artists and mobile Safari fixes

// Utility functions for Concert Moments Platform

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

// Featured Artists with official setlist.fm MBIDs
// These are artists with verified high activity and tour presence
export const FEATURED_ARTISTS = [
  { name: 'Muse', mbid: '9c9f1380-2516-4fc9-a3e6-f9f61941d090' },
  { name: 'Green Day', mbid: '084308bd-1654-436f-ba03-df6697104e19' },
  { name: 'Pearl Jam', mbid: '83b9cbe7-9857-49e2-ab8e-b57b01038103' },
  { name: 'Metallica', mbid: '65f4f0c5-ef9e-490c-aee3-909e7ae6b2ab' },
  { name: 'Unknown Mortal Orchestra', mbid: '33d2ccc9-7e64-44b2-ad8c-618d9499bf42' },
  { name: 'Fontaines D.C.', mbid: '2bcac0f6-ee1b-4856-8264-a8b3262b9d3c' },
  { name: 'Daniel Me Estas Matando', mbid: '63f31a0f-2756-43e4-b58f-61e7b0e83b57' }
];

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