#!/usr/bin/env node
// setlist-proxy/scripts/refresh-irys-uploads.js
// Bulk re-upload script for Irys testnet (devnet) uploads before expiration
//
// Usage:
//   node scripts/refresh-irys-uploads.js           # Full run
//   node scripts/refresh-irys-uploads.js --dry-run # Preview only, no changes
//   node scripts/refresh-irys-uploads.js --limit=5 # Process only first 5 moments
//   node scripts/refresh-irys-uploads.js --skip=10 # Skip first 10 moments

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Import our existing Irys uploader
const { uploadFileToIrys, checkBalance } = require('../utils/irysUploader');

// Command line args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = args.find(a => a.startsWith('--limit='))?.split('=')[1];
const SKIP = args.find(a => a.startsWith('--skip='))?.split('=')[1] || 0;

// Results tracking
const results = {
  total: 0,
  success: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

// Helper to download file from URL
async function downloadFile(url) {
  const fetch = (await import('node-fetch')).default;

  console.log(`   Downloading from: ${url}`);
  const response = await fetch(url, {
    timeout: 120000 // 2 minute timeout for large files
  });

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.buffer();
  console.log(`   Downloaded: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

  return buffer;
}

// Helper to extract filename from URL or moment
function getFilename(moment) {
  if (moment.fileName) return moment.fileName;

  // Try to extract from URL
  const url = moment.mediaUrl;
  const ext = moment.mediaType === 'video' ? 'mp4' :
              moment.mediaType === 'audio' ? 'mp3' : 'bin';

  return `moment_${moment._id}.${ext}`;
}

// Main refresh function
async function refreshIrysUploads() {
  console.log('\n========================================');
  console.log('  IRYS TESTNET RE-UPLOAD SCRIPT');
  console.log('========================================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE RUN'}`);
  console.log(`Limit: ${LIMIT || 'No limit'}`);
  console.log(`Skip: ${SKIP}`);
  console.log('========================================\n');

  // Verify environment variables
  if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI environment variable not set');
    process.exit(1);
  }

  if (!DRY_RUN && !process.env.PRIVATE_KEY) {
    console.error('ERROR: PRIVATE_KEY environment variable not set (required for uploads)');
    process.exit(1);
  }

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Load the Moment model
    const Moment = require('../models/Moment');

    // Find all Irys moments (both old gateway.irys.xyz and new devnet.irys.xyz)
    const query = {
      $or: [
        { mediaUrl: { $regex: /gateway\.irys\.xyz/i } },
        { mediaUrl: { $regex: /devnet\.irys\.xyz/i } }
      ]
    };

    // Build query options
    let findQuery = Moment.find(query).sort({ createdAt: -1 });
    if (SKIP) findQuery = findQuery.skip(parseInt(SKIP));
    if (LIMIT) findQuery = findQuery.limit(parseInt(LIMIT));

    const moments = await findQuery.lean();
    results.total = moments.length;

    console.log(`Found ${results.total} Irys moments to process\n`);

    if (results.total === 0) {
      console.log('No Irys moments found. Nothing to do.');
      process.exit(0);
    }

    // Check balance before starting (if not dry run)
    if (!DRY_RUN) {
      console.log('Checking Irys account balance...');
      try {
        // Estimate needed balance (rough estimate: 100KB average per moment)
        const estimatedSize = results.total * 100 * 1024;
        const balanceCheck = await checkBalance(estimatedSize);
        console.log(`Account balance: ${balanceCheck.balance} wei`);
        console.log(`Estimated cost for all: ~${balanceCheck.price} wei\n`);
      } catch (err) {
        console.warn('Warning: Could not check balance:', err.message);
        console.log('Continuing anyway...\n');
      }
    }

    // Process each moment
    for (let i = 0; i < moments.length; i++) {
      const moment = moments[i];
      const progress = `[${i + 1}/${moments.length}]`;

      console.log(`\n${progress} Processing: ${moment.songName}`);
      console.log(`   Venue: ${moment.venueName}`);
      console.log(`   Date: ${moment.performanceDate}`);
      console.log(`   Current URL: ${moment.mediaUrl}`);
      console.log(`   Size: ${moment.fileSize ? (moment.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}`);

      if (DRY_RUN) {
        console.log(`   [DRY RUN] Would re-upload this moment`);
        results.success++;
        continue;
      }

      try {
        // Step 1: Download the current file
        const buffer = await downloadFile(moment.mediaUrl);

        // Step 2: Calculate hash for verification
        const originalHash = crypto.createHash('md5').update(buffer).digest('hex');
        console.log(`   Original MD5: ${originalHash}`);

        // Step 3: Get filename
        const filename = getFilename(moment);
        console.log(`   Filename: ${filename}`);

        // Step 4: Upload to Irys devnet
        console.log(`   Uploading to Irys devnet...`);
        const receipt = await uploadFileToIrys(buffer, filename);

        console.log(`   New URL: ${receipt.url}`);
        console.log(`   Transaction ID: ${receipt.id}`);

        // Step 5: Update MongoDB
        await Moment.updateOne(
          { _id: moment._id },
          {
            $set: {
              mediaUrl: receipt.url,
              irysRefreshedAt: new Date(),
              irysOldUrl: moment.mediaUrl, // Keep old URL for reference
              irysOldHash: originalHash
            }
          }
        );

        console.log(`   Database updated`);
        results.success++;

        // Small delay between uploads to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err) {
        console.error(`   ERROR: ${err.message}`);
        results.failed++;
        results.errors.push({
          momentId: moment._id.toString(),
          songName: moment.songName,
          error: err.message
        });

        // Continue with next moment instead of stopping
        continue;
      }
    }

  } catch (err) {
    console.error('\nFATAL ERROR:', err);
    process.exit(1);
  } finally {
    // Print summary
    console.log('\n========================================');
    console.log('  SUMMARY');
    console.log('========================================');
    console.log(`Total moments: ${results.total}`);
    console.log(`Successful: ${results.success}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Skipped: ${results.skipped}`);

    if (results.errors.length > 0) {
      console.log('\nFailed moments:');
      results.errors.forEach(e => {
        console.log(`  - ${e.songName} (${e.momentId}): ${e.error}`);
      });
    }

    console.log('========================================\n');

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
  }
}

// Run the script
refreshIrysUploads().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
