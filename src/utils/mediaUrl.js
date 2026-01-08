// src/utils/mediaUrl.js
// Utility to transform media URLs with fallback support

/**
 * Transform Irys devnet URLs to working gateway URLs
 * devnet.irys.xyz is frequently down, so we fallback to gateway.irys.xyz
 *
 * @param {string} url - The original media URL
 * @returns {string} - Transformed URL with working gateway
 */
export const transformMediaUrl = (url) => {
  if (!url) return url;

  // Transform devnet.irys.xyz to gateway.irys.xyz
  if (url.includes('devnet.irys.xyz')) {
    return url.replace('devnet.irys.xyz', 'gateway.irys.xyz');
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

  const urls = [url];

  // If it's a devnet URL, add gateway fallback
  if (url.includes('devnet.irys.xyz')) {
    urls.push(url.replace('devnet.irys.xyz', 'gateway.irys.xyz'));
  }

  // If it's a gateway URL, add devnet as fallback (in case gateway is down)
  if (url.includes('gateway.irys.xyz')) {
    urls.push(url.replace('gateway.irys.xyz', 'devnet.irys.xyz'));
  }

  return urls;
};

export default transformMediaUrl;
