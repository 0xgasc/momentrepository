// src/utils/mediaUrl.js
// Utility to transform media URLs with fallback support

// API base URL for proxy
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://momentrepository-production.up.railway.app';

/**
 * Transform Irys URLs to working gateway
 * Routes devnet.irys.xyz through our proxy to bypass SSL issues
 *
 * @param {string} url - The original media URL
 * @returns {string} - Transformed URL with working gateway
 */
export const transformMediaUrl = (url) => {
  if (!url) return url;

  // Route devnet.irys.xyz through our proxy (SSL is broken on their end)
  if (url.includes('devnet.irys.xyz')) {
    // Extract the transaction ID from the URL
    const match = url.match(/devnet\.irys\.xyz\/([A-Za-z0-9_-]+)/);
    if (match && match[1]) {
      const txId = match[1];
      return `${API_BASE_URL}/proxy/irys/${txId}`;
    }
  }

  // Normalize irysnetwork.com to irys.xyz (primary domain)
  if (url.includes('irysnetwork.com')) {
    return url.replace('irysnetwork.com', 'irys.xyz');
  }

  return url;
};

/**
 * Get an array of fallback URLs to try in order
 * @param {string} url - The original media URL
 * @returns {string[]} - Array of URLs to try
 */
export const getMediaUrlsWithFallback = (url) => {
  if (!url) return [];

  const urls = [];

  // If it's a devnet URL, use our proxy first
  if (url.includes('devnet.irys.xyz')) {
    const match = url.match(/devnet\.irys\.xyz\/([A-Za-z0-9_-]+)/);
    if (match && match[1]) {
      const txId = match[1];
      urls.push(`${API_BASE_URL}/proxy/irys/${txId}`);
    }
    // Add original as fallback in case Irys fixes their SSL
    urls.push(url);
  } else {
    urls.push(url);
  }

  return urls;
};

export default transformMediaUrl;
