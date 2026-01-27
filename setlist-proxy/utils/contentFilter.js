// setlist-proxy/utils/contentFilter.js
// Content moderation utility for chat and guestbook

// Banned word patterns with common substitutions
// This covers racial slurs, hate speech, and extreme profanity
const bannedPatterns = [
  // Racial slurs (with common character substitutions)
  /\bn[i1!|][gq9][gq9][e3a@]r?s?\b/i,
  /\bn[i1!|][gq9]{2,}[a@4]s?\b/i,
  /\bf[a@4][gq9]{1,2}[o0][t7]s?\b/i,
  /\bk[i1!|]k[e3]s?\b/i,
  /\bch[i1!|]nk[s5]?\b/i,
  /\bsp[i1!|]c[s5]?\b/i,
  /\bw[e3][t7]b[a@4]ck[s5]?\b/i,
  /\bg[o0]{2}k[s5]?\b/i,
  /\bc[o0]{2}n[s5]?\b/i,
  /\btr[a@4]nn[yi1!|][e3]?s?\b/i,

  // Extreme hate speech
  /\bk[yi1!|][l1!|]{2}\s*(a[l1!|]{2}\s*)?(j[e3]ws?|n[i1!|][gq9]{2}[e3a@]r?s?|b[l1!|][a@4]cks?|wh[i1!|]t[e3]s?|musl[i1!|]ms?)\b/i,
  /\bd[e3][a@4]th\s*t[o0]\s*(j[e3]ws?|n[i1!|][gq9]{2}[e3a@]r?s?|b[l1!|][a@4]cks?|musl[i1!|]ms?)\b/i,
  /\bh[i1!|]t[l1!|][e3]r\s*d[i1!|]d\s*n[o0]th[i1!|]ng\s*wr[o0]ng\b/i,
  /\bwh[i1!|]t[e3]\s*p[o0]w[e3]r\b/i,
  /\bwh[i1!|]t[e3]\s*supr[e3]m[a@4]c[yi1!|]\b/i,
  /\bh[e3][i1!|][l1!|]\s*h[i1!|]t[l1!|][e3]r\b/i,
  /\b14\s*88\b/i,

  // Severe harassment
  /\bk[yi1!|][l1!|]{2}\s*y[o0]urs[e3][l1!|]f\b/i,
  /\bg[o0]\s*k[yi1!|][l1!|]{2}\s*y[o0]urs[e3][l1!|]f\b/i,

  // Spam patterns
  /\b(buy|free|win|click|subscribe).{0,20}(viagra|crypto|nft|airdrop|giveaway)\b/i,
  /\bhttps?:\/\/[^\s]+\.(ru|cn|xyz|tk|ml|ga|cf)\b/i,
];

// Profanity - also blocked (previously just warned)
const profanityPatterns = [
  /\bf+u+c+k+/i,
  /\bs+h+i+t+/i,
  /\ba+s+s+h+o+l+e+/i,
  /\bb+i+t+c+h+/i,
  /\bc+u+n+t+/i,
  /\bd+i+c+k+/i,
  /\bp+u+s+s+y+/i,
  /\bw+h+o+r+e+/i,
  /\bs+l+u+t+/i,
  /\bd+a+m+n+/i,
  /\bh+e+l+l+/i,
  /\bc+r+a+p+/i,
];

// Legacy export name for backwards compatibility
const warningPatterns = profanityPatterns;

/**
 * Check if content contains banned patterns
 * @param {string} text - The text to check
 * @returns {object} - { blocked: boolean, reason: string | null, severity: 'blocked' | 'warning' | 'clean' }
 */
const filterContent = (text) => {
  if (!text || typeof text !== 'string') {
    return { blocked: false, reason: null, severity: 'clean' };
  }

  // Normalize text (remove zero-width characters, normalize spaces)
  const normalizedText = text
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Check banned patterns
  for (const pattern of bannedPatterns) {
    if (pattern.test(normalizedText)) {
      return {
        blocked: true,
        reason: 'Content contains prohibited language',
        severity: 'blocked'
      };
    }
  }

  // Check profanity patterns (now blocked, not just warned)
  for (const pattern of profanityPatterns) {
    if (pattern.test(normalizedText)) {
      return {
        blocked: true,
        reason: 'Content contains profanity',
        severity: 'blocked'
      };
    }
  }

  return { blocked: false, reason: null, severity: 'clean' };
};

/**
 * Sanitize display name
 * @param {string} name - The display name to sanitize
 * @returns {object} - { valid: boolean, sanitized: string, reason: string | null }
 */
const sanitizeDisplayName = (name) => {
  if (!name || typeof name !== 'string') {
    return { valid: true, sanitized: 'Anonymous', reason: null };
  }

  const trimmed = name.trim().slice(0, 50);

  // Check for banned content in name
  const filterResult = filterContent(trimmed);
  if (filterResult.blocked) {
    return {
      valid: false,
      sanitized: null,
      reason: 'Display name contains prohibited content'
    };
  }

  // Remove special characters that could be used for spoofing
  const sanitized = trimmed
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Control characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width characters
    .replace(/[<>'"&]/g, ''); // HTML special chars

  if (sanitized.length === 0) {
    return { valid: true, sanitized: 'Anonymous', reason: null };
  }

  return { valid: true, sanitized, reason: null };
};

module.exports = {
  filterContent,
  sanitizeDisplayName,
  bannedPatterns,
  profanityPatterns,
  warningPatterns // Legacy alias
};
