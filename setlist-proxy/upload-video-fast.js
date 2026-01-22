#!/usr/bin/env node
/**
 * Upload video to Irys using the faster @irys/upload package
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { uploadFileToIrysFromPath } = require('./utils/irysUploader');

const VIDEO_PATH = "/Users/gs/Desktop/Screen Recording 2026-01-22 at 08.10.22.mov";
const fs = require('fs');

async function main() {
  console.log("🚀 Starting fast Irys upload...");

  // Check file exists
  if (!fs.existsSync(VIDEO_PATH)) {
    throw new Error(`File not found: ${VIDEO_PATH}`);
  }

  const stats = fs.statSync(VIDEO_PATH);
  console.log(`📁 File: ${VIDEO_PATH}`);
  console.log(`📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  const result = await uploadFileToIrysFromPath(VIDEO_PATH, 'umo-live-recording.mov');

  console.log("\n✅ Upload complete!");
  console.log(`🔗 URL: ${result.url}`);
  console.log(`📦 Transaction ID: ${result.id}`);

  // Save URL to file
  fs.writeFileSync(
    "/Volumes/WORKHORSE GS/vibecoding/cyberdesign/irys-url.txt",
    result.url
  );

  console.log(`💾 URL saved to irys-url.txt`);
}

main().catch(e => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
