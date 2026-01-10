// src/utils/mediaUrl.js
// Utility to transform media URLs with fallback support

/**
 * Transform Irys URLs to working gateway
 * Normalize between irys.xyz and irysnetwork.com (both are legitimate)
 * irys.xyz is primary, irysnetwork.com is the mirror
 *
 * @param {string} url - The original media URL
 * @returns {string} - Transformed URL with working gateway
 */
export const transformMediaUrl = (url) => {
  if (!url) return url;

  // Normalize irysnetwork.com to irys.xyz (primary domain is back online)
  // Both are identical, but irys.xyz is the primary
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
