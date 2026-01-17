// setlist-proxy/utils/irysRefreshService.js - Irys devnet link refresh service
require('dotenv').config();
const { uploadFileToIrys, checkBalance } = require('./irysUploader');
const Moment = require('../models/Moment');

/**
 * Convert HTTPS devnet.irys.xyz URLs to HTTP (workaround for SSL issues)
 * @param {string} url - The original URL
 * @returns {string} - URL with HTTP if it's a devnet.irys.xyz URL
 */
function getWorkingUrl(url) {
  if (url && url.includes('devnet.irys.xyz')) {
    return url.replace('https://', 'http://');
  }
  return url;
}

/**
 * Check if a URL is still accessible
 * @param {string} url - The URL to check
 * @returns {Promise<boolean>} - True if URL is valid, false otherwise
 */
async function checkUrlValidity(url) {
  try {
    const fetch = (await import('node-fetch')).default;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Use HTTP for devnet.irys.xyz (their HTTPS is broken)
    const workingUrl = getWorkingUrl(url);

    const response = await fetch(workingUrl, {
      method: 'HEAD',
      signal: controller.signal
    });

    clearTimeout(timeout);
    return response.ok;
  } catch (error) {
    console.log(`URL check failed for ${url}:`, error.message);
    return false;
  }
}

/**
 * Get all moments with Irys devnet URLs
 * @returns {Promise<Array>} - Array of moments with Irys URLs
 */
async function getMomentsWithIrysUrls() {
  return Moment.find({
    $or: [
      { mediaUrl: { $regex: /irys\.xyz|irysnetwork\.com/i } },
      { thumbnailUrl: { $regex: /irys\.xyz|irysnetwork\.com/i } }
    ]
  }).lean();
}

/**
 * Download content from URL to buffer
 * @param {string} url - The URL to download from
 * @returns {Promise<Buffer>} - The downloaded content as a Buffer
 */
async function downloadToBuffer(url) {
  const fetch = (await import('node-fetch')).default;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for large files

  // Use HTTP for devnet.irys.xyz (their HTTPS is broken)
  const workingUrl = getWorkingUrl(url);
  console.log(`  Downloading from: ${workingUrl}`);

  try {
    const response = await fetch(workingUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Extract filename from URL or moment data
 * @param {string} url - The URL
 * @param {Object} moment - The moment object
 * @param {string} field - 'mediaUrl' or 'thumbnailUrl'
 * @returns {string} - The filename
 */
function getFilename(url, moment, field) {
  if (field === 'thumbnailUrl') {
    return `thumb_${moment._id}.jpg`;
  }
  if (moment.fileName) {
    return moment.fileName;
  }
  // Extract from URL
  const urlParts = url.split('/');
  const lastPart = urlParts[urlParts.length - 1];
  if (lastPart && lastPart.includes('.')) {
    return lastPart;
  }
  // Default based on media type
  const ext = moment.mediaType === 'audio' ? 'mp3' : 'mp4';
  return `media_${moment._id}.${ext}`;
}

/**
 * Refresh a single moment's media URLs
 * @param {Object} moment - The moment document
 * @param {Object} options - Options for refresh
 * @returns {Promise<Object>} - Results with new URLs and any errors
 */
async function refreshMomentUrls(moment, options = {}) {
  const results = {
    mediaUrl: null,
    thumbnailUrl: null,
    errors: []
  };

  // Refresh mediaUrl if it's an Irys URL
  if (moment.mediaUrl && /irys\.xyz|irysnetwork\.com/i.test(moment.mediaUrl)) {
    try {
      console.log(`  Downloading media for moment ${moment._id}...`);
      const buffer = await downloadToBuffer(moment.mediaUrl);
      const filename = getFilename(moment.mediaUrl, moment, 'mediaUrl');

      console.log(`  Re-uploading ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)...`);
      const upload = await uploadFileToIrys(buffer, filename);
      results.mediaUrl = upload.url;
      console.log(`  New mediaUrl: ${upload.url}`);
    } catch (err) {
      console.error(`  Failed to refresh mediaUrl for ${moment._id}:`, err.message);
      results.errors.push({ field: 'mediaUrl', error: err.message });
    }
  }

  // Refresh thumbnailUrl if it's an Irys URL
  if (moment.thumbnailUrl && /irys\.xyz|irysnetwork\.com/i.test(moment.thumbnailUrl)) {
    try {
      console.log(`  Downloading thumbnail for moment ${moment._id}...`);
      const buffer = await downloadToBuffer(moment.thumbnailUrl);
      const filename = getFilename(moment.thumbnailUrl, moment, 'thumbnailUrl');

      console.log(`  Re-uploading ${filename}...`);
      const upload = await uploadFileToIrys(buffer, filename);
      results.thumbnailUrl = upload.url;
      console.log(`  New thumbnailUrl: ${upload.url}`);
    } catch (err) {
      console.error(`  Failed to refresh thumbnailUrl for ${moment._id}:`, err.message);
      results.errors.push({ field: 'thumbnailUrl', error: err.message });
    }
  }

  return results;
}

/**
 * Bulk refresh all Irys URLs
 * @param {Object} options - Options for bulk refresh
 * @param {boolean} options.dryRun - If true, don't actually upload or update DB
 * @param {boolean} options.validateFirst - If true, skip URLs that are still valid
 * @param {number} options.batchSize - Number of moments to process at a time (default 10)
 * @param {number} options.delayBetweenBatches - Delay in ms between batches (default 2000)
 * @returns {Promise<Object>} - Results summary
 */
async function bulkRefreshIrysUrls(options = {}) {
  const {
    dryRun = false,
    validateFirst = true,
    batchSize = 10,
    delayBetweenBatches = 2000
  } = options;

  console.log('\n========================================');
  console.log('  Irys Devnet URL Refresh Service');
  console.log('========================================');
  console.log(`  Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Validate first: ${validateFirst}`);
  console.log(`  Batch size: ${batchSize}`);
  console.log('----------------------------------------\n');

  const moments = await getMomentsWithIrysUrls();
  const results = {
    total: moments.length,
    processed: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    details: []
  };

  console.log(`Found ${moments.length} moments with Irys URLs\n`);

  if (moments.length === 0) {
    console.log('No moments to refresh.');
    return results;
  }

  // Process in batches
  for (let i = 0; i < moments.length; i += batchSize) {
    const batch = moments.slice(i, i + batchSize);
    console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(moments.length / batchSize)}...`);

    for (const moment of batch) {
      console.log(`\nProcessing moment ${moment._id} (${moment.songName || 'Untitled'})...`);

      // Validate URL if requested
      if (validateFirst && moment.mediaUrl) {
        const isValid = await checkUrlValidity(moment.mediaUrl);
        if (isValid) {
          console.log('  URL still valid, skipping.');
          results.skipped++;
          results.details.push({
            id: moment._id,
            status: 'skipped',
            reason: 'URL still valid'
          });
          continue;
        }
        console.log('  URL expired or invalid, will refresh.');
      }

      if (dryRun) {
        console.log('  [DRY RUN] Would refresh URLs for this moment.');
        results.processed++;
        results.details.push({
          id: moment._id,
          status: 'would_refresh',
          mediaUrl: moment.mediaUrl,
          thumbnailUrl: moment.thumbnailUrl
        });
        continue;
      }

      try {
        const refreshed = await refreshMomentUrls(moment);

        const updates = {};
        if (refreshed.mediaUrl) updates.mediaUrl = refreshed.mediaUrl;
        if (refreshed.thumbnailUrl) updates.thumbnailUrl = refreshed.thumbnailUrl;

        if (Object.keys(updates).length > 0) {
          // Update the database with $set to ensure updatedAt is written
          const now = new Date();
          await Moment.findByIdAndUpdate(
            moment._id,
            { $set: { ...updates, updatedAt: now } },
            { new: true }
          );
          results.updated++;
          console.log(`  Database updated with new URLs. updatedAt: ${now.toISOString()}`);
        }

        if (refreshed.errors.length > 0) {
          results.failed++;
          results.details.push({
            id: moment._id,
            status: 'partial_failure',
            errors: refreshed.errors,
            newUrls: updates
          });
        } else {
          results.processed++;
          results.details.push({
            id: moment._id,
            status: 'success',
            newUrls: updates
          });
        }
      } catch (err) {
        console.error(`  Error refreshing moment ${moment._id}:`, err.message);
        results.failed++;
        results.details.push({
          id: moment._id,
          status: 'failed',
          error: err.message
        });
      }
    }

    // Delay between batches to avoid rate limiting
    if (i + batchSize < moments.length) {
      console.log(`\nWaiting ${delayBetweenBatches}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  console.log('\n========================================');
  console.log('  Refresh Complete');
  console.log('========================================');
  console.log(`  Total: ${results.total}`);
  console.log(`  Updated: ${results.updated}`);
  console.log(`  Skipped: ${results.skipped}`);
  console.log(`  Failed: ${results.failed}`);
  console.log('========================================\n');

  return results;
}

/**
 * Get status summary of Irys URLs
 * @param {number} sampleSize - Number of URLs to sample check
 * @returns {Promise<Object>} - Status summary
 */
async function getIrysUrlStatus(sampleSize = 10) {
  const moments = await getMomentsWithIrysUrls();
  const sample = moments.slice(0, sampleSize);

  let validCount = 0;
  let expiredCount = 0;

  for (const moment of sample) {
    if (moment.mediaUrl) {
      const isValid = await checkUrlValidity(moment.mediaUrl);
      if (isValid) {
        validCount++;
      } else {
        expiredCount++;
      }
    }
  }

  return {
    totalWithIrysUrls: moments.length,
    sampleSize: sample.length,
    sampleValid: validCount,
    sampleExpired: expiredCount,
    estimatedExpiredPercent: sample.length > 0 ? Math.round((expiredCount / sample.length) * 100) : 0
  };
}

module.exports = {
  checkUrlValidity,
  getMomentsWithIrysUrls,
  downloadToBuffer,
  refreshMomentUrls,
  bulkRefreshIrysUrls,
  getIrysUrlStatus
};
