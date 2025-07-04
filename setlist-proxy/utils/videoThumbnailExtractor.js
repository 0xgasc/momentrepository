const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;

// Configure FFmpeg path explicitly
ffmpeg.setFfmpegPath('/opt/homebrew/bin/ffmpeg');
ffmpeg.setFfprobePath('/opt/homebrew/bin/ffprobe');

/**
 * Extract thumbnail from video buffer with multiple fallback attempts
 * @param {Buffer} videoBuffer - Video file buffer
 * @param {string} filename - Original filename
 * @param {Object} options - Extraction options
 * @returns {Promise<Buffer|null>} - Thumbnail buffer or null
 */
const extractVideoThumbnail = async (videoBuffer, filename, options = {}) => {
  const { frameTimingMode = 'auto', customSeed = null, zoomLevel = 1.0 } = options;
  console.log('🎬 Starting video thumbnail extraction for:', filename);
  console.log('🎬 Video buffer size:', videoBuffer.length, 'bytes');
  
  // Check if it's a video file
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v', '.3gp'];
  const ext = path.extname(filename).toLowerCase();
  if (!videoExtensions.includes(ext)) {
    console.log('⚠️ Not a video file:', filename, 'Extension:', ext);
    return null;
  }
  
  console.log('✅ Valid video file detected with extension:', ext);

  // Create temp directory
  const tempDir = path.join(__dirname, '../temp');
  await fs.mkdir(tempDir, { recursive: true });

  const timestamp = Date.now();
  const baseFilename = path.basename(filename, ext);
  const tempVideoPath = path.join(tempDir, `${timestamp}_${baseFilename}${ext}`);

  try {
    // Write video to temp file first
    console.log('📁 Writing video buffer to temp file...');
    await fs.writeFile(tempVideoPath, videoBuffer);
    console.log('✅ Video written to temp file:', tempVideoPath);
    
    // Verify file was written correctly
    const stats = await fs.stat(tempVideoPath);
    console.log('📊 Temp file stats:', { size: stats.size, matches: stats.size === videoBuffer.length });

    // Validate video file with ffprobe
    console.log('🔍 Probing video file...');
    let videoMetadata;
    try {
      videoMetadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(tempVideoPath, (err, metadata) => {
          if (err) {
            console.error('❌ Video probe failed:', err.message);
            reject(err);
          } else {
            console.log('✅ Video probe successful');
            const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
            console.log('📊 Video metadata:', {
              duration: metadata.format?.duration,
              format: metadata.format?.format_name,
              streams: metadata.streams?.length,
              resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : 'unknown',
              orientation: videoStream ? (videoStream.width > videoStream.height ? 'landscape' : 'portrait') : 'unknown'
            });
            resolve(metadata);
          }
        });
      });
    } catch (probeError) {
      console.error('❌ Cannot probe video file:', probeError.message);
      return null;
    }

    // Calculate smart extraction times based on video duration
    const videoDuration = videoMetadata.format?.duration || 30;
    console.log(`📏 Video duration: ${videoDuration} seconds`);
    
    // Create deterministic randomization based on filename and custom seed
    const baseSeed = filename.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const seed = customSeed ? (baseSeed + customSeed) % 10000 : baseSeed;
    let rng = seed;
    const random = () => {
      rng = (rng * 9301 + 49297) % 233280;
      return rng / 233280;
    };
    
    console.log(`🎲 Using ${frameTimingMode} timing mode with seed: ${seed}, zoom: ${zoomLevel}x`);
    
    const maxTime = Math.max(1, videoDuration - 1); // Leave 1 second buffer
    
    // Generate extraction times based on timing mode
    let extractionTimes = [];
    
    switch (frameTimingMode) {
      case 'early':
        extractionTimes = [
          random() * Math.min(5, videoDuration * 0.2),
          random() * Math.min(3, videoDuration * 0.15),
          random() * Math.min(8, videoDuration * 0.25)
        ];
        break;
        
      case 'middle':
        const midStart = videoDuration * 0.3;
        const midEnd = videoDuration * 0.7;
        extractionTimes = [
          midStart + random() * (midEnd - midStart),
          midStart + random() * (midEnd - midStart),
          midStart + random() * (midEnd - midStart)
        ];
        break;
        
      case 'late':
        const lateStart = videoDuration * 0.7;
        extractionTimes = [
          lateStart + random() * (maxTime - lateStart),
          lateStart + random() * (maxTime - lateStart),
          lateStart + random() * (maxTime - lateStart)
        ];
        break;
        
      case 'random':
        extractionTimes = [
          random() * maxTime,
          random() * maxTime,
          random() * maxTime,
          random() * maxTime,
          random() * maxTime
        ];
        break;
        
      case 'auto':
      default:
        // Original smart extraction logic
        if (videoDuration < 5) {
          extractionTimes = [
            random() * 1.5,
            random() * 2.5,
            random() * 1
          ];
        } else if (videoDuration < 15) {
          extractionTimes = [
            random() * (videoDuration * 0.3),
            random() * (videoDuration * 0.6),
            random() * (videoDuration * 0.9)
          ];
        } else {
          extractionTimes = [
            random() * (videoDuration * 0.2),      // Early
            random() * (videoDuration * 0.4) + (videoDuration * 0.1), // Early-mid
            random() * (videoDuration * 0.4) + (videoDuration * 0.3), // Mid  
            random() * (videoDuration * 0.3) + (videoDuration * 0.5), // Late-mid
            random() * (videoDuration * 0.2) + (videoDuration * 0.7)  // Late
          ];
        }
        break;
    }
    
    // Filter out times beyond video duration and ensure we have at least one
    extractionTimes = extractionTimes.filter(time => time < maxTime);
    if (extractionTimes.length === 0) {
      extractionTimes = [random() * maxTime];
    }
    
    // Round to 1 decimal place for cleaner logs
    extractionTimes = extractionTimes.map(time => Math.round(time * 10) / 10);
    
    console.log(`🎲 Randomized extraction times for ${videoDuration}s video (seed: ${seed}):`, extractionTimes);
    
    for (const timeSeconds of extractionTimes) {
      console.log(`🎯 Trying extraction at ${timeSeconds} seconds...`);
      
      const tempThumbnailPath = path.join(tempDir, `${timestamp}_${baseFilename}_thumb_${timeSeconds}.jpg`);
      
      try {
        console.log(`🎬 Starting FFmpeg extraction at ${timeSeconds}s...`);
        
        await new Promise((resolve, reject) => {
          // Calculate dynamic timeout based on video size and zoom
          const videoStream = videoMetadata.streams?.find(s => s.codec_type === 'video');
          const resolution = videoStream ? videoStream.width * videoStream.height : 1920 * 1080;
          const is4K = resolution >= 3840 * 2160;
          const isLargeFile = videoBuffer.length > 100 * 1024 * 1024; // 100MB
          const isZooming = zoomLevel !== 1.0;
          
          let timeoutMs = 30000; // Default 30s
          if (is4K) timeoutMs = 120000; // 4K gets 2 minutes
          if (isLargeFile) timeoutMs = Math.max(timeoutMs, 90000); // Large files get 1.5 minutes
          if (isZooming) timeoutMs = timeoutMs * 1.5; // Zoom adds 50% more time
          
          console.log(`⏰ Setting timeout: ${timeoutMs/1000}s (4K: ${is4K}, Large: ${isLargeFile}, Zoom: ${isZooming})`);
          
          const timeout = setTimeout(() => {
            console.error(`⏰ Extraction timeout at ${timeSeconds}s after ${timeoutMs/1000}s`);
            reject(new Error(`Extraction timeout at ${timeSeconds}s`));
          }, timeoutMs);

          // Build FFmpeg command with optional zoom
          let ffmpegCommand = ffmpeg(tempVideoPath);
          
          if (zoomLevel !== 1.0) {
            // When zooming, use optimized filter chain for better performance
            // For 4K videos, downscale first then zoom for better performance
            const videoStream = videoMetadata.streams?.find(s => s.codec_type === 'video');
            const is4K = videoStream && videoStream.width >= 3840;
            
            let zoomFilter;
            if (is4K) {
              // For 4K: downscale to 2K first, then zoom, then crop, then final scale
              zoomFilter = `scale=1920:-1,scale=iw*${zoomLevel}:ih*${zoomLevel},crop=iw/${zoomLevel}:ih/${zoomLevel}:iw/2-iw/${zoomLevel}/2:ih/2-ih/${zoomLevel}/2,scale=1024:-1`;
            } else {
              // For HD and below: direct zoom and crop
              zoomFilter = `scale=iw*${zoomLevel}:ih*${zoomLevel},crop=iw/${zoomLevel}:ih/${zoomLevel}:iw/2-iw/${zoomLevel}/2:ih/2-ih/${zoomLevel}/2,scale=1024:-1`;
            }
            
            console.log(`🔍 Applying ${is4K ? '4K-optimized' : 'standard'} zoom filter: ${zoomFilter}`);
            
            ffmpegCommand
              .seekInput(timeSeconds)
              .videoFilter(zoomFilter)
              .frames(1)
              .output(tempThumbnailPath)
          } else {
            // Normal screenshots without zoom
            ffmpegCommand
              .screenshots({
                timestamps: [timeSeconds],
                filename: path.basename(tempThumbnailPath),
                folder: path.dirname(tempThumbnailPath),
                size: '1024x?'  // Maintain aspect ratio, max width 1024
              })
          }
          
          ffmpegCommand
            .on('start', (commandLine) => {
              console.log(`🔧 FFmpeg command: ${commandLine}`);
            })
            .on('progress', (progress) => {
              console.log(`📊 FFmpeg progress: ${JSON.stringify(progress)}`);
            })
            .on('end', () => {
              console.log(`✅ FFmpeg extraction completed at ${timeSeconds}s`);
              clearTimeout(timeout);
              resolve();
            })
            .on('error', (err) => {
              console.error(`❌ FFmpeg error at ${timeSeconds}s:`, err.message);
              clearTimeout(timeout);
              reject(err);
            });
        });
        
        console.log(`✅ FFmpeg promise resolved for ${timeSeconds}s`);

        // Check if file was created and has content
        try {
          console.log(`📖 Attempting to read thumbnail file: ${tempThumbnailPath}`);
          const thumbnailBuffer = await fs.readFile(tempThumbnailPath);
          console.log(`📊 Thumbnail buffer size: ${thumbnailBuffer.length} bytes`);
          
          // More thorough validation
          if (thumbnailBuffer.length > 1000) {
            // Check if it's actually a valid JPEG by looking at magic bytes
            const isValidJPEG = thumbnailBuffer[0] === 0xFF && thumbnailBuffer[1] === 0xD8;
            console.log(`🔍 JPEG validation: ${isValidJPEG ? 'VALID' : 'INVALID'}`);
            
            if (isValidJPEG) {
              console.log(`✅ Valid thumbnail extracted at ${timeSeconds}s:`, thumbnailBuffer.length, 'bytes');
              
              // Cleanup temp files
              await fs.unlink(tempVideoPath).catch(() => {});
              await fs.unlink(tempThumbnailPath).catch(() => {});
              
              return thumbnailBuffer;
            } else {
              console.log(`⚠️ Invalid JPEG file at ${timeSeconds}s, trying next time...`);
            }
          } else {
            console.log(`⚠️ Thumbnail too small at ${timeSeconds}s (${thumbnailBuffer.length} bytes), trying next time...`);
          }
          
          await fs.unlink(tempThumbnailPath).catch(() => {});
        } catch (readError) {
          console.log(`⚠️ Could not read thumbnail at ${timeSeconds}s:`, readError.message);
          await fs.unlink(tempThumbnailPath).catch(() => {});
        }

      } catch (extractError) {
        console.log(`⚠️ Extraction failed at ${timeSeconds}s:`, extractError.message);
        await fs.unlink(tempThumbnailPath).catch(() => {});
      }
    }

    console.log('❌ All extraction attempts failed');
    return null;

  } catch (error) {
    console.error('❌ Video processing error:', error.message);
    return null;
  } finally {
    // Cleanup video file
    await fs.unlink(tempVideoPath).catch(() => {});
  }
};

module.exports = { extractVideoThumbnail };