// src/utils/slugify.js
// Utility for creating URL-friendly slugs from song names

/**
 * Convert a song name to a URL-friendly slug
 * "So Good at Being in Trouble" -> "so-good-at-being-in-trouble"
 */
export const slugify = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Remove consecutive hyphens
    .replace(/^-|-$/g, '');    // Remove leading/trailing hyphens
};

/**
 * Find a song by its slug from a list of songs
 */
export const findSongBySlug = (songs, slug) => {
  if (!songs || !slug) return null;
  return songs.find(song => slugify(song.songName) === slug);
};

/**
 * Create slug from performance data for URLs
 * Uses format: venue-city-date
 */
export const performanceSlug = (performance) => {
  if (!performance) return '';
  const parts = [
    performance.venue,
    performance.city,
    performance.date
  ].filter(Boolean);
  return slugify(parts.join(' '));
};
