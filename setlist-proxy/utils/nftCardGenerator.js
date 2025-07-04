const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const crypto = require('crypto');

/**
 * Apply generative effects to thumbnail based on moment metadata
 * @param {HTMLImageElement} thumbnail - Original thumbnail image
 * @param {Object} momentData - Moment metadata for seeding effects
 * @returns {HTMLCanvasElement} - Canvas with processed thumbnail
 */
const applyGenerativeEffects = (thumbnail, momentData) => {
  console.log('🎨 Applying generative effects based on moment metadata...');
  
  // Create deterministic seeds from metadata
  let songSeed = (momentData.songName || '').length;
  let venueSeed = (momentData.venueName || '').length;
  let descSeed = (momentData.momentDescription || '').length;
  const dateSeed = (momentData.performanceDate || '').replace(/\D/g, ''); // Extract numbers from date
  const momentHash = crypto.createHash('md5').update(JSON.stringify(momentData)).digest('hex');
  let hashSeed = parseInt(momentHash.substring(0, 8), 16) % 100;
  
  // Apply randomness for preview variations if provided
  const effectIntensity = momentData.effectIntensity || 1.0;
  const glitchIntensity = momentData.glitchIntensity || 1.0;
  if (momentData.randomSeed) {
    console.log(`🎲 Applying randomness with seed: ${momentData.randomSeed}, effect: ${effectIntensity}, glitch: ${glitchIntensity}`);
    // Mix the random seed with original values for variation while maintaining some determinism
    songSeed = (songSeed + momentData.randomSeed) % 50;
    venueSeed = (venueSeed + momentData.randomSeed * 2) % 50;
    descSeed = (descSeed + momentData.randomSeed * 3) % 50;
    hashSeed = (hashSeed + momentData.randomSeed * 4) % 100;
  }
  
  console.log(`🎯 Effect seeds: song=${songSeed}, venue=${venueSeed}, desc=${descSeed}, hash=${hashSeed}`);
  
  // Create working canvas
  const effectCanvas = createCanvas(thumbnail.width, thumbnail.height);
  const ctx = effectCanvas.getContext('2d');
  
  // Draw original thumbnail
  ctx.drawImage(thumbnail, 0, 0);
  
  // Effect 1: Pixelation (based on song name length)
  const pixelIntensity = Math.max(2, Math.min(12, (songSeed % 10 + 2) * effectIntensity));
  if (songSeed > 5) {
    console.log(`🔲 Applying pixelation: intensity=${pixelIntensity}`);
    applyPixelation(ctx, thumbnail.width, thumbnail.height, pixelIntensity);
  }
  
  // Effect 2: Color shift (based on venue name length)
  const hueShift = ((venueSeed * 15) % 360) * effectIntensity;
  if (venueSeed > 3) {
    console.log(`🌈 Applying color shift: hue=${hueShift}°`);
    applyColorShift(ctx, thumbnail.width, thumbnail.height, hueShift);
  }
  
  // Effect 3: Noise overlay (based on description length)
  const noiseIntensity = Math.min(0.3, (descSeed * 0.02) * effectIntensity);
  if (descSeed > 10) {
    console.log(`📊 Applying noise: intensity=${noiseIntensity}`);
    applyNoise(ctx, thumbnail.width, thumbnail.height, noiseIntensity, hashSeed);
  }
  
  // Effect 4: Glitch lines (based on hash and glitch intensity)
  const glitchLines = Math.floor((hashSeed % 5) * glitchIntensity);
  const glitchThreshold = 50 / glitchIntensity; // Lower threshold with higher intensity
  if (hashSeed > glitchThreshold && glitchLines > 0) {
    console.log(`⚡ Applying glitch lines: count=${glitchLines}, intensity=${glitchIntensity}`);
    applyGlitchLines(ctx, thumbnail.width, thumbnail.height, glitchLines, hashSeed);
  }
  
  // Effect 5: Chromatic aberration (based on date)
  const aberrationOffset = parseInt(dateSeed) % 3 + 1;
  if (parseInt(dateSeed) % 4 === 0) {
    console.log(`🔴🔵 Applying chromatic aberration: offset=${aberrationOffset}px`);
    applyChromaticAberration(ctx, thumbnail.width, thumbnail.height, aberrationOffset);
  }
  
  // Effect 6: Rarity-based color explosions
  const rarityIntensity = getRarityIntensity(momentData.rarityTier);
  if (rarityIntensity > 0.3) {
    console.log(`💥 Applying rarity color explosion: intensity=${rarityIntensity}`);
    applyColorExplosion(ctx, thumbnail.width, thumbnail.height, rarityIntensity, hashSeed, momentData.rarityTier);
  }
  
  // Effect 7: Vertical/horizontal line stretches (based on venue)
  const stretchDirection = venueSeed % 2 === 0 ? 'horizontal' : 'vertical';
  const stretchCount = Math.min(5, Math.floor(venueSeed / 3));
  if (stretchCount > 0) {
    console.log(`📏 Applying line stretches: ${stretchDirection}, count=${stretchCount}`);
    applyLineStretches(ctx, thumbnail.width, thumbnail.height, stretchDirection, stretchCount, hashSeed);
  }
  
  // Effect 8: Data-moshing blocks (rare effect with glitch intensity)
  const datamoshThreshold = 80 / glitchIntensity;
  if (hashSeed > datamoshThreshold && descSeed > 20) {
    console.log(`🎮 Applying datamosh blocks with glitch intensity: ${glitchIntensity}`);
    applyDatamoshBlocks(ctx, thumbnail.width, thumbnail.height, hashSeed, glitchIntensity);
  }
  
  // Effect 9: Rainbow gradient overlays (legendary tier)
  if (momentData.rarityTier === 'legendary' || momentData.rarityTier === 'mythic') {
    console.log(`🌈 Applying legendary rainbow overlay`);
    applyRainbowOverlay(ctx, thumbnail.width, thumbnail.height, momentData.rarityTier);
  }
  
  console.log('✅ All generative effects applied');
  return effectCanvas;
};

/**
 * Apply pixelation effect
 */
const applyPixelation = (ctx, width, height, intensity) => {
  // Create smaller canvas for downscaling
  const smallWidth = Math.floor(width / intensity);
  const smallHeight = Math.floor(height / intensity);
  const pixelatedCanvas = createCanvas(smallWidth, smallHeight);
  const pixelCtx = pixelatedCanvas.getContext('2d');
  
  // Disable smoothing for pixelated effect
  pixelCtx.imageSmoothingEnabled = false;
  
  // Draw current content scaled down
  pixelCtx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, smallWidth, smallHeight);
  
  // Scale back up to original size
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(pixelatedCanvas, 0, 0, width, height);
};

/**
 * Apply color shift effect
 */
const applyColorShift = (ctx, width, height, hueShift) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    // Convert RGB to HSL, shift hue, convert back
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const newH = (h + hueShift / 360) % 1;
    const [r, g, b] = hslToRgb(newH, s, l);
    
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  
  ctx.putImageData(imageData, 0, 0);
};

/**
 * Apply noise overlay
 */
const applyNoise = (ctx, width, height, intensity, seed) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Simple PRNG seeded with moment data
  let rng = seed;
  const random = () => {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  };
  
  for (let i = 0; i < data.length; i += 4) {
    const noise = (random() - 0.5) * intensity * 255;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  
  ctx.putImageData(imageData, 0, 0);
};

/**
 * Apply glitch lines effect
 */
const applyGlitchLines = (ctx, width, height, lineCount, seed) => {
  let rng = seed;
  const random = () => {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  };
  
  for (let i = 0; i < lineCount; i++) {
    const y = Math.floor(random() * height);
    const lineHeight = Math.floor(random() * 5) + 1;
    const offset = (random() - 0.5) * 20;
    
    // Get line data
    const lineData = ctx.getImageData(0, y, width, lineHeight);
    
    // Draw shifted line
    ctx.putImageData(lineData, offset, y);
  }
};

/**
 * Apply chromatic aberration effect
 */
const applyChromaticAberration = (ctx, width, height, offset) => {
  // Create separate canvases for each channel
  const originalCanvas = createCanvas(width, height);
  const originalCtx = originalCanvas.getContext('2d');
  originalCtx.drawImage(ctx.canvas, 0, 0);
  
  // Clear main canvas
  ctx.clearRect(0, 0, width, height);
  
  // Draw red channel shifted left
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(originalCanvas, -offset, 0);
  
  // Draw green channel normal
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(originalCanvas, 0, 0);
  
  // Draw blue channel shifted right
  ctx.globalCompositeOperation = 'screen';  
  ctx.drawImage(originalCanvas, offset, 0);
  
  // Reset composite operation
  ctx.globalCompositeOperation = 'source-over';
};

/**
 * RGB to HSL conversion
 */
const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  
  return [h, s, l];
};

/**
 * HSL to RGB conversion
 */
const hslToRgb = (h, s, l) => {
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

/**
 * Get rarity intensity multiplier
 */
const getRarityIntensity = (rarityTier) => {
  const rarityMap = {
    'legendary': 1.0,
    'mythic': 0.9,
    'epic': 0.7,
    'rare': 0.5,
    'uncommon': 0.3,
    'common': 0.1,
    'basic': 0.05
  };
  return rarityMap[rarityTier] || 0.1;
};

/**
 * Apply color explosion effect based on rarity
 */
const applyColorExplosion = (ctx, width, height, intensity, seed, rarityTier) => {
  let rng = seed;
  const random = () => {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  };
  
  // Rarity-specific color palettes
  const rarityColors = {
    'legendary': ['#FFD700', '#FFA500', '#FF6347', '#FF1493'],
    'mythic': ['#FF00FF', '#8A2BE2', '#9400D3', '#4B0082'],
    'epic': ['#9B59B6', '#8E44AD', '#3498DB', '#2980B9'],
    'rare': ['#3498DB', '#2980B9', '#1ABC9C', '#16A085'],
    'uncommon': ['#2ECC71', '#27AE60', '#F39C12', '#E67E22'],
    'common': ['#95A5A6', '#7F8C8D', '#BDC3C7', '#ECF0F1'],
    'basic': ['#7F8C8D', '#95A5A6', '#BDC3C7', '#D5DBDB']
  };
  
  const colors = rarityColors[rarityTier] || rarityColors['basic'];
  const explosionCount = Math.floor(intensity * 8);
  
  ctx.globalCompositeOperation = 'overlay';
  
  for (let i = 0; i < explosionCount; i++) {
    const x = random() * width;
    const y = random() * height;
    const radius = random() * 100 + 20;
    const color = colors[Math.floor(random() * colors.length)];
    
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color + '80'); // Semi-transparent
    gradient.addColorStop(1, color + '00'); // Fully transparent
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.globalCompositeOperation = 'source-over';
};

/**
 * Apply line stretches effect
 */
const applyLineStretches = (ctx, width, height, direction, count, seed) => {
  let rng = seed;
  const random = () => {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  };
  
  for (let i = 0; i < count; i++) {
    if (direction === 'horizontal') {
      const y = Math.floor(random() * height);
      const lineHeight = Math.floor(random() * 10) + 2;
      const stretchFactor = random() * 0.5 + 0.5; // 0.5 to 1.0
      
      const lineData = ctx.getImageData(0, y, width, lineHeight);
      const stretchedWidth = Math.floor(width * stretchFactor);
      
      // Create temporary canvas for stretching
      const tempCanvas = createCanvas(stretchedWidth, lineHeight);
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(lineData, 0, 0);
      
      // Draw stretched line back
      ctx.drawImage(tempCanvas, 0, y, stretchedWidth, lineHeight, 0, y, width, lineHeight);
    } else {
      // Vertical stretches
      const x = Math.floor(random() * width);
      const lineWidth = Math.floor(random() * 10) + 2;
      const stretchFactor = random() * 0.5 + 0.5;
      
      const lineData = ctx.getImageData(x, 0, lineWidth, height);
      const stretchedHeight = Math.floor(height * stretchFactor);
      
      const tempCanvas = createCanvas(lineWidth, stretchedHeight);
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(lineData, 0, 0);
      
      ctx.drawImage(tempCanvas, 0, 0, lineWidth, stretchedHeight, x, 0, lineWidth, height);
    }
  }
};

/**
 * Apply datamosh blocks effect
 */
const applyDatamoshBlocks = (ctx, width, height, seed, glitchIntensity = 1.0) => {
  let rng = seed;
  const random = () => {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  };
  
  const blockCount = Math.floor((3 + Math.floor(random() * 5)) * glitchIntensity);
  
  for (let i = 0; i < blockCount; i++) {
    const blockWidth = 20 + Math.floor(random() * 80);
    const blockHeight = 20 + Math.floor(random() * 80);
    const sourceX = Math.floor(random() * (width - blockWidth));
    const sourceY = Math.floor(random() * (height - blockHeight));
    const destX = Math.floor(random() * (width - blockWidth));
    const destY = Math.floor(random() * (height - blockHeight));
    
    // Copy block from one location to another
    const blockData = ctx.getImageData(sourceX, sourceY, blockWidth, blockHeight);
    
    // Apply some corruption to the block
    const data = blockData.data;
    for (let j = 0; j < data.length; j += 4) {
      if (random() < 0.1) { // 10% chance to corrupt each pixel
        data[j] = Math.floor(random() * 256);     // R
        data[j + 1] = Math.floor(random() * 256); // G
        data[j + 2] = Math.floor(random() * 256); // B
      }
    }
    
    ctx.putImageData(blockData, destX, destY);
  }
};

/**
 * Apply rainbow overlay for legendary tiers
 */
const applyRainbowOverlay = (ctx, width, height, rarityTier) => {
  const intensity = rarityTier === 'legendary' ? 0.3 : 0.2;
  
  // Create rainbow gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `rgba(255, 0, 0, ${intensity})`);     // Red
  gradient.addColorStop(0.16, `rgba(255, 165, 0, ${intensity})`); // Orange
  gradient.addColorStop(0.32, `rgba(255, 255, 0, ${intensity})`); // Yellow
  gradient.addColorStop(0.48, `rgba(0, 255, 0, ${intensity})`);   // Green
  gradient.addColorStop(0.64, `rgba(0, 0, 255, ${intensity})`);   // Blue
  gradient.addColorStop(0.80, `rgba(75, 0, 130, ${intensity})`);  // Indigo
  gradient.addColorStop(1, `rgba(238, 130, 238, ${intensity})`);  // Violet
  
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
};

/**
 * Generate NFT display card with moment info overlay
 * @param {Buffer} thumbnailBuffer - Video thumbnail buffer
 * @param {Object} momentData - Moment information
 * @returns {Promise<Buffer>} - Card image buffer
 */
const generateNFTCard = async (thumbnailBuffer, momentData) => {
  console.log('🎨 Generating NFT card for:', momentData.songName);

  // Create 1200x1200 canvas (good for social media and NFT displays)
  const canvas = createCanvas(1200, 1200);
  const ctx = canvas.getContext('2d');

  try {
    // 1. Draw thumbnail as background (if available)
    if (thumbnailBuffer) {
      const thumbnail = await loadImage(thumbnailBuffer);
      console.log(`🖼️ Thumbnail dimensions: ${thumbnail.width}x${thumbnail.height}`);
      
      // Apply generative effects to thumbnail
      const processedThumbnail = applyGenerativeEffects(thumbnail, momentData);
      
      // Cover entire canvas maintaining aspect ratio
      const scale = Math.max(canvas.width / processedThumbnail.width, canvas.height / processedThumbnail.height);
      const scaledWidth = processedThumbnail.width * scale;
      const scaledHeight = processedThumbnail.height * scale;
      const x = (canvas.width - scaledWidth) / 2;
      const y = (canvas.height - scaledHeight) / 2;
      
      console.log(`🖼️ Drawing processed thumbnail: scale=${scale.toFixed(2)}, pos=(${x.toFixed(0)},${y.toFixed(0)}), size=${scaledWidth.toFixed(0)}x${scaledHeight.toFixed(0)}`);
      ctx.drawImage(processedThumbnail, x, y, scaledWidth, scaledHeight);
    } else {
      // Fallback gradient background with UMO theme
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#1e3a8a'); // Blue
      gradient.addColorStop(0.5, '#7c3aed'); // Purple
      gradient.addColorStop(1, '#dc2626'); // Red
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add some visual interest with patterns
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.arc(
          Math.random() * canvas.width,
          Math.random() * canvas.height,
          Math.random() * 100 + 20,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    // 2. Apply dark gradient overlay for text readability
    const overlay = ctx.createLinearGradient(0, 0, 0, canvas.height);
    overlay.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
    overlay.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)');
    overlay.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Draw info box at bottom
    const boxHeight = 320;
    const boxY = canvas.height - boxHeight;
    
    // Semi-transparent background for info box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, boxY, canvas.width, boxHeight);

    // 4. Song/Content Name (large) - simplified without content type
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#FFFFFF';
    const songY = boxY + 60;
    ctx.fillText(momentData.songName || 'Unknown Song', 60, songY);

    // 6. Venue and Date
    ctx.font = '32px Arial';
    ctx.fillStyle = '#CCCCCC';
    const venueText = `${momentData.venueName || 'Unknown Venue'}`;
    ctx.fillText(venueText, 60, songY + 50);
    
    // Date on separate line
    ctx.font = '28px Arial';
    let dateText = 'Date Unknown';
    if (momentData.performanceDate) {
      try {
        console.log('🗓️ Original date value:', momentData.performanceDate, typeof momentData.performanceDate);
        
        let date;
        if (typeof momentData.performanceDate === 'string') {
          // Handle YYYY-MM-DD format explicitly (most reliable)
          const isoMatch = momentData.performanceDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (isoMatch) {
            const [, year, month, day] = isoMatch;
            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            console.log('🗓️ ISO format parsed:', { year, month, day }, '→', date);
          }
          // Handle DD-MM-YYYY format (European dash format)
          else if (momentData.performanceDate.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
            const [day, month, year] = momentData.performanceDate.split('-');
            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            console.log('🗓️ DD-MM-YYYY format parsed:', { day, month, year }, '→', date);
          }
          // Handle MM/DD/YYYY format (US format)
          else if (momentData.performanceDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            const [month, day, year] = momentData.performanceDate.split('/');
            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            console.log('🗓️ MM/DD/YYYY format parsed:', { month, day, year }, '→', date);
          }
          // Handle DD/MM/YYYY format (European format)
          else if (momentData.performanceDate.includes('/') && momentData.performanceDate.split('/')[2]) {
            // Try to detect based on values - if first number > 12, assume DD/MM/YYYY
            const parts = momentData.performanceDate.split('/');
            if (parts.length === 3) {
              const [first, second, year] = parts;
              if (parseInt(first) > 12) {
                // Definitely DD/MM/YYYY
                date = new Date(parseInt(year), parseInt(second) - 1, parseInt(first));
                console.log('🗓️ DD/MM/YYYY format parsed:', { day: first, month: second, year }, '→', date);
              } else {
                // Could be either, default to DD/MM/YYYY for European preference
                date = new Date(parseInt(year), parseInt(second) - 1, parseInt(first));
                console.log('🗓️ DD/MM/YYYY format (European default) parsed:', { day: first, month: second, year }, '→', date);
              }
            }
          }
          // Fallback to direct parsing
          else {
            date = new Date(momentData.performanceDate);
            console.log('🗓️ Direct parsing fallback:', date);
          }
        } else {
          date = new Date(momentData.performanceDate);
          console.log('🗓️ Non-string date parsed:', date);
        }
        
        console.log('🗓️ Final parsed date:', date, 'Valid:', !isNaN(date.getTime()));
        
        if (!isNaN(date.getTime())) {
          dateText = date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
          console.log('🗓️ Formatted date text:', dateText);
        }
      } catch (error) {
        console.error('❌ Date parsing error:', error);
        dateText = 'Date Unknown';
      }
    }
    ctx.fillText(dateText, 60, songY + 90);

    // 7. City, Country
    ctx.font = '28px Arial';
    ctx.fillStyle = '#999999';
    const locationText = `${momentData.venueCity || 'Unknown City'}${momentData.venueCountry ? ', ' + momentData.venueCountry : ''}`;
    ctx.fillText(locationText, 60, songY + 130);


    // 9. UMO Archive branding (bottom right)
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'right';
    ctx.fillText('UMO ARCHIVE', canvas.width - 60, canvas.height - 30);
    ctx.textAlign = 'left';


    // Convert canvas to buffer
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
    console.log('✅ NFT card generated:', buffer.length, 'bytes');
    
    return buffer;

  } catch (error) {
    console.error('❌ Card generation failed:', error);
    throw error;
  }
};

module.exports = { generateNFTCard };