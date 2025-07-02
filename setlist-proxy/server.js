const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
require('dotenv').config();
const { createProxyMiddleware } = require('http-proxy-middleware');
const User = require('./models/User');
const Moment = require('./models/Moment');
const { UMOCache } = require('./utils/umoCache');
const { ethers } = require('ethers');

const app = express();
const PORT = 5050;

// Initialize UMO cache
const umoCache = new UMOCache();

// Global metadata storage (in production, use database)
global.metadataStorage = global.metadataStorage || {};

// CORS setup
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*']
}));

app.use(express.json({ limit: '6gb' }));
app.use(express.urlencoded({ limit: '6gb', extended: true }));

// Multer configuration for large files
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 6 * 1024 * 1024 * 1024, // 6GB limit
    fieldSize: 6 * 1024 * 1024 * 1024,
    fields: 10,
    files: 1,
    parts: 1000
  },
  fileFilter: (req, file, cb) => {
    console.log(`📁 Multer received file:`, {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size || 'size not available yet'
    });
    
    const maxSize = 6 * 1024 * 1024 * 1024; // 6GB
    if (file.size && file.size > maxSize) {
      console.error(`❌ File too large: ${(file.size / 1024 / 1024 / 1024).toFixed(2)}GB exceeds 6GB limit`);
      return cb(new Error('File exceeds 6GB limit'), false);
    }
    
    cb(null, true);
  }
});

// Import file uploaders
const { uploadFileToIrys, validateBuffer } = require('./utils/irysUploader');

// JWT helpers
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

const generateToken = (user) => {
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('🔐 Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
    }
    req.user = user;
    next();
  });
};

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Token ID Counter Schema for ERC1155
const tokenIdCounterSchema = new mongoose.Schema({
  _id: { type: String, default: 'tokenIdCounter' },
  currentId: { type: Number, default: 0 }
});

const TokenIdCounter = mongoose.model('TokenIdCounter', tokenIdCounterSchema);

// =============================================================================
// 🎯 ENHANCED RARITY CALCULATION SYSTEM
// =============================================================================

// Helper function for ordinal numbers
const getOrdinalSuffix = (num) => {
  const j = num % 10;
  const k = num % 100;
  if (j == 1 && k != 11) return "st";
  if (j == 2 && k != 12) return "nd";
  if (j == 3 && k != 13) return "rd";
  return "th";
};

// Detect non-song content from name (fallback only)
const detectNonSongContent = (songName) => {
  if (!songName || typeof songName !== 'string') {
    return { isNonSong: true, type: 'other', confidence: 1.0 };
  }
  
  const lowercased = songName.toLowerCase().trim();
  
  const patterns = [
    { pattern: /^intro$/i, type: 'intro', confidence: 1.0 },
    { pattern: /^outro$/i, type: 'outro', confidence: 1.0 },
    { pattern: /soundcheck/i, type: 'other', confidence: 0.9 },
    { pattern: /tuning/i, type: 'other', confidence: 0.9 },
    { pattern: /^jam$/i, type: 'jam', confidence: 0.8 },
    { pattern: /banter/i, type: 'other', confidence: 0.9 },
    { pattern: /crowd/i, type: 'crowd', confidence: 0.8 },
    { pattern: /applause/i, type: 'crowd', confidence: 0.9 },
    { pattern: /^\d+$/i, type: 'other', confidence: 0.95 }
  ];
  
  for (const { pattern, type, confidence } of patterns) {
    if (pattern.test(songName)) {
      return { isNonSong: true, type, confidence };
    }
  }
  
  return { isNonSong: false, type: 'song', confidence: 0.0 };
};

// Enhanced non-song rarity calculation
const calculateNonSongRarity = async (moment, contentType) => {
  console.log(`🎭 Calculating enhanced non-song rarity for "${moment.songName}" (${contentType})`);
  
  let totalScore = 0;
  let scoreBreakdown = {
    nonSongContent: {
      type: contentType,
      components: {}
    }
  };
  
  // 1. CONTENT TYPE BASE SCORE (0.8-1.5 points) - Higher base scores
  let baseScore = 0;
  let maxPossible = 6.0; // All content types can reach 6/7 max
  let tierCap = 'epic'; // Most can reach epic tier
  
  switch (contentType) {
    case 'intro':
    case 'outro':
      baseScore = 1.0;
      tierCap = 'rare'; // Can reach rare
      break;
    case 'jam':
      baseScore = 1.5; // Highest base - jams are special
      tierCap = 'epic'; // Jams can reach epic tier
      break;
    case 'crowd':
      baseScore = 1.2;
      tierCap = 'rare'; // Can reach rare
      break;
    case 'other':
      baseScore = 0.8;
      tierCap = 'uncommon'; // More limited but still decent
      maxPossible = 4.0; // Slightly lower cap for generic "other"
      break;
    default:
      baseScore = 1.0;
      tierCap = 'rare';
  }
  
  totalScore += baseScore;
  scoreBreakdown.nonSongContent.components.baseScore = {
    score: baseScore,
    description: `Base score for ${contentType} content`
  };
  
  // 2. GLOBAL FIRST BONUS (0-1.5 points) - NEW: First of this type EVER
  const isGlobalFirstOfType = await Moment.find({
    contentType: contentType,
    _id: { $ne: moment._id }
  }).sort({ createdAt: 1 }).limit(1);
  
  let globalFirstBonus = 0;
  if (isGlobalFirstOfType.length === 0) {
    // This is the very first upload of this content type!
    globalFirstBonus = contentType === 'jam' ? 1.5 : 1.2; // Jams get highest bonus
    console.log(`🌟 GLOBAL FIRST: First ${contentType} content ever uploaded!`);
  }
  
  totalScore += globalFirstBonus;
  scoreBreakdown.nonSongContent.components.globalFirst = {
    score: globalFirstBonus,
    isGlobalFirst: globalFirstBonus > 0,
    description: globalFirstBonus > 0 ? 
      `🌟 FIRST ${contentType.toUpperCase()} CONTENT EVER UPLOADED!` : 
      `Not the first ${contentType} content`
  };
  
  // 3. METADATA QUALITY BONUS (0-0.8 points) - Increased from 0.4
  const metadataFields = [
    moment.momentDescription,
    moment.emotionalTags,
    moment.crowdReaction,
    moment.uniqueElements,
    moment.personalNote
  ];
  
  const filledFields = metadataFields.filter(field => field && field.trim().length > 0).length;
  const metadataMultiplier = contentType === 'jam' ? 0.8 : 0.6; // Higher bonuses
  const metadataScore = (filledFields / metadataFields.length) * metadataMultiplier;
  
  totalScore += metadataScore;
  scoreBreakdown.nonSongContent.components.metadata = {
    score: metadataScore,
    filledFields,
    totalFields: metadataFields.length,
    description: `${filledFields}/${metadataFields.length} metadata fields`
  };
  
  // 4. PERFORMANCE PRECEDENCE (0-0.8 points) - Increased bonus
  const existingContentAtPerformance = await Moment.find({
    performanceId: moment.performanceId,
    contentType: contentType,
    _id: { $ne: moment._id }
  }).sort({ createdAt: 1 });
  
  const isFirstOfTypeAtPerformance = existingContentAtPerformance.length === 0;
  let precedenceScore = 0;
  
  if (isFirstOfTypeAtPerformance) {
    precedenceScore = contentType === 'jam' ? 0.8 : 0.6; // Higher precedence bonuses
  } else if (existingContentAtPerformance.length === 1) {
    precedenceScore = contentType === 'jam' ? 0.4 : 0.3; // Second upload gets partial bonus
  }
  
  totalScore += precedenceScore;
  scoreBreakdown.nonSongContent.components.precedence = {
    score: precedenceScore,
    isFirst: isFirstOfTypeAtPerformance,
    existingCount: existingContentAtPerformance.length,
    description: isFirstOfTypeAtPerformance 
      ? `First ${contentType} content for this performance`
      : `${existingContentAtPerformance.length + 1}${getOrdinalSuffix(existingContentAtPerformance.length + 1)} ${contentType} content for this performance`
  };
  
  // 5. CONTENT-SPECIFIC BONUSES (0-0.8 points) - Increased bonuses
  let specificBonus = 0;
  
  if (contentType === 'jam') {
    // Jam-specific bonuses - higher rewards
    const instruments = moment.instruments ? moment.instruments.split(',').map(i => i.trim()).filter(i => i) : [];
    if (instruments.length >= 3) {
      specificBonus += 0.5; // 3+ instruments = major bonus
    } else if (instruments.length >= 2) {
      specificBonus += 0.3; // 2 instruments = good bonus
    }
    if (moment.guestAppearances && moment.guestAppearances.trim().length > 0) {
      specificBonus += 0.3; // Guest appearance bonus
    }
    
    scoreBreakdown.nonSongContent.components.jamBonus = {
      score: specificBonus,
      instruments: instruments.length,
      hasGuests: !!(moment.guestAppearances && moment.guestAppearances.trim().length > 0),
      description: `Jam complexity bonus (${instruments.length} instruments, ${moment.guestAppearances ? 'guest' : 'no guest'})`
    };
  } else if (contentType === 'crowd') {
    // Crowd reaction intensity bonus - higher rewards
    const intenseCrowdReactions = ['Explosive energy', 'Wild dancing', 'Standing ovation', 'Massive sing-along', 'Everyone jumping'];
    if (intenseCrowdReactions.includes(moment.crowdReaction)) {
      specificBonus += 0.6; // Major bonus for intense reactions
    } else if (moment.crowdReaction && moment.crowdReaction !== '') {
      specificBonus += 0.2; // Minor bonus for any reaction
    }
    
    scoreBreakdown.nonSongContent.components.crowdBonus = {
      score: specificBonus,
      reaction: moment.crowdReaction || 'None specified',
      isIntense: intenseCrowdReactions.includes(moment.crowdReaction),
      description: `Crowd intensity bonus`
    };
  } else if (contentType === 'other') {
    // Special circumstance bonus for "other" content
    const specialTerms = ['technical', 'issue', 'rare', 'unexpected', 'unique', 'mistake', 'accident', 'soundcheck'];
    const description = (moment.momentDescription || '').toLowerCase();
    const hasSpecialCircumstance = specialTerms.some(term => description.includes(term));
    
    if (hasSpecialCircumstance) {
      specificBonus += 0.4; // Higher bonus for special circumstances
    }
    
    scoreBreakdown.nonSongContent.components.specialBonus = {
      score: specificBonus,
      hasSpecialCircumstance,
      description: hasSpecialCircumstance ? 'Special circumstance bonus' : 'No special circumstances detected'
    };
  } else if (contentType === 'intro' || contentType === 'outro') {
    // Intro/outro specific bonuses
    if (moment.specialOccasion && moment.specialOccasion.trim().length > 0) {
      specificBonus += 0.3; // Special occasion bonus
    }
    if (moment.uniqueElements && moment.uniqueElements.trim().length > 0) {
      specificBonus += 0.2; // Unique elements bonus
    }
    
    scoreBreakdown.nonSongContent.components.introBonus = {
      score: specificBonus,
      hasSpecialOccasion: !!(moment.specialOccasion && moment.specialOccasion.trim().length > 0),
      hasUniqueElements: !!(moment.uniqueElements && moment.uniqueElements.trim().length > 0),
      description: `${contentType} content bonus`
    };
  }
  
  totalScore += specificBonus;
  
  // 6. MEDIA QUALITY BONUS (0-0.4 points) - Increased bonus
  let qualityBonus = 0;
  if (moment.videoQuality === 'excellent' && moment.audioQuality === 'excellent') {
    qualityBonus = 0.4; // Doubled bonus for excellent quality
  } else if (moment.videoQuality === 'excellent' || moment.audioQuality === 'excellent') {
    qualityBonus = 0.2;
  } else if (moment.videoQuality === 'good' && moment.audioQuality === 'good') {
    qualityBonus = 0.1;
  }
  
  totalScore += qualityBonus;
  scoreBreakdown.nonSongContent.components.quality = {
    score: qualityBonus,
    videoQuality: moment.videoQuality || 'good',
    audioQuality: moment.audioQuality || 'good',
    description: `Media quality bonus`
  };
  
  // CAP THE SCORE
  totalScore = Math.min(maxPossible, totalScore);
  
  // DETERMINE TIER (with enhanced caps)
  let rarityTier = 'common';
  if (tierCap === 'epic' && totalScore >= 5.0) {
    rarityTier = 'epic';
  } else if (tierCap === 'rare' && totalScore >= 3.5) {
    rarityTier = 'rare';
  } else if ((tierCap === 'uncommon' || tierCap === 'rare' || tierCap === 'epic') && totalScore >= 2.0) {
    rarityTier = 'uncommon';
  } else if (totalScore >= 1.0) {
    rarityTier = 'common';
  } else {
    rarityTier = 'common';
  }
  
  // Apply tier caps
  if (tierCap === 'common') rarityTier = 'common';
  if (tierCap === 'uncommon' && ['rare', 'epic', 'legendary'].includes(rarityTier)) rarityTier = 'uncommon';
  if (tierCap === 'rare' && ['epic', 'legendary'].includes(rarityTier)) rarityTier = 'rare';
  if (tierCap === 'epic' && rarityTier === 'legendary') rarityTier = 'epic';
  
  const finalScore = Math.round(totalScore * 100) / 100;
  
  console.log(`✅ NON-SONG "${moment.songName}" (${contentType}): ${finalScore}/${maxPossible} (${rarityTier})`);
  if (globalFirstBonus > 0) {
    console.log(`   🌟 GLOBAL FIRST BONUS: +${globalFirstBonus} points!`);
  }
  console.log(`   Components: Base ${baseScore}, Global ${globalFirstBonus}, Metadata ${metadataScore.toFixed(2)}, Precedence ${precedenceScore}, Specific ${specificBonus}, Quality ${qualityBonus}`);
  
  return {
    rarityScore: finalScore,
    rarityTier,
    isFirstMomentForSong: false, // Never true for non-songs
    songTotalPerformances: 0, // N/A for non-songs
    scoreBreakdown
  };
};

// Enhanced song rarity calculation with performance-specific venue scoring
const calculateSongRarity = async (moment, umoCache) => {
  try {
    console.log(`🎵 Calculating enhanced song rarity for "${moment.songName}" at ${moment.venueName}...`);
    
    const songDatabase = await umoCache.getSongDatabase();
    const songData = songDatabase[moment.songName];
    
    let songTotalPerformances = 0;
    if (songData) {
      songTotalPerformances = songData.totalPerformances;
    } else {
      console.log(`⚠️ Song "${moment.songName}" not found in cache - treating as rare song`);
      songTotalPerformances = 25; // Treat as moderately rare
    }
    
    // ENHANCED: Check for first moment for this song at this SPECIFIC PERFORMANCE
    const allMomentsForSongAtPerformance = await Moment.find({ 
      songName: moment.songName,
      performanceId: moment.performanceId, // Same performance, not just venue
      contentType: 'song',
      _id: { $ne: moment._id }
    }).sort({ createdAt: 1 });
    
    const allSongMomentsAtPerformanceIncludingCurrent = await Moment.find({ 
      songName: moment.songName,
      performanceId: moment.performanceId, // Same performance
      contentType: 'song'
    }).sort({ createdAt: 1, _id: 1 });
    
    const isFirstMomentForSongAtPerformance = allSongMomentsAtPerformanceIncludingCurrent.length > 0 && 
                                            allSongMomentsAtPerformanceIncludingCurrent[0]._id.toString() === moment._id.toString();
    
    console.log(`   First song moment at this performance: ${allMomentsForSongAtPerformance.length} other song moments found`);
    console.log(`   isFirstAtPerformance: ${isFirstMomentForSongAtPerformance}`);
    
    let totalScore = 0;
    let scoreBreakdown = {};
    
    // 1. PERFORMANCE FREQUENCY SCORE (0-4 points)
    let performanceScore = 0;
    if (songTotalPerformances === 0) {
      performanceScore = 3.5;
    } else if (songTotalPerformances >= 1 && songTotalPerformances <= 10) {
      performanceScore = 4;
    } else if (songTotalPerformances >= 11 && songTotalPerformances <= 50) {
      performanceScore = 3;
    } else if (songTotalPerformances >= 51 && songTotalPerformances <= 100) {
      performanceScore = 2.5;
    } else if (songTotalPerformances >= 101 && songTotalPerformances <= 150) {
      performanceScore = 2;
    } else if (songTotalPerformances >= 151 && songTotalPerformances <= 200) {
      performanceScore = 1.5;
    } else {
      performanceScore = 1;
    }
    
    totalScore += performanceScore;
    scoreBreakdown.performanceFrequency = {
      score: performanceScore,
      totalPerformances: songTotalPerformances,
      inCache: !!songData,
      description: `${songTotalPerformances} live performances${!songData ? ' (estimated)' : ''}`
    };
    
    // 2. METADATA COMPLETENESS SCORE (0-1 point)
    const metadataFields = [
      moment.momentDescription,
      moment.emotionalTags,
      moment.specialOccasion,
      moment.instruments,
      moment.guestAppearances,
      moment.crowdReaction,
      moment.uniqueElements,
      moment.personalNote
    ];
    
    const filledFields = metadataFields.filter(field => field && field.trim().length > 0).length;
    const totalFields = metadataFields.length;
    const metadataScore = (filledFields / totalFields);
    
    totalScore += metadataScore;
    scoreBreakdown.metadataCompleteness = {
      score: metadataScore,
      filledFields,
      totalFields,
      percentage: Math.round((filledFields / totalFields) * 100),
      description: `${filledFields}/${totalFields} metadata fields (${Math.round((filledFields / totalFields) * 100)}%)`
    };
    
    // 3. VIDEO LENGTH OPTIMIZATION SCORE (0-1 point)
    let lengthScore = 0;
    let videoDuration = null;
    
    if (moment.mediaType === 'video' && moment.fileSize) {
      const estimatedDuration = (moment.fileSize / (1024 * 1024)) * 10; // seconds
      videoDuration = estimatedDuration;
      
      const targetDuration = 150; // 2.5 minutes in seconds
      const difference = Math.abs(estimatedDuration - targetDuration);
      
      if (difference <= 15) {
        lengthScore = 1;
      } else if (difference <= 30) {
        lengthScore = 0.8;
      } else if (difference <= 60) {
        lengthScore = 0.6;
      } else if (difference <= 120) {
        lengthScore = 0.4;
      } else if (difference <= 180) {
        lengthScore = 0.2;
      } else {
        lengthScore = 0.1;
      }
    } else if (moment.mediaType === 'audio') {
      lengthScore = 0.5;
    } else if (moment.mediaType === 'image') {
      lengthScore = 0.3;
    }
    
    totalScore += lengthScore;
    scoreBreakdown.videoLength = {
      score: lengthScore,
      estimatedDuration: videoDuration ? Math.round(videoDuration) : null,
      targetDuration: 150,
      description: videoDuration ? 
        `~${Math.round(videoDuration)}s (target: 150s)` : 
        `${moment.mediaType || 'unknown'} file`
    };
    
    // 4. PERFORMANCE-SPECIFIC PRECEDENCE SCORE (0-1 point) - ENHANCED
    const uploadPosition = allMomentsForSongAtPerformance.length + 1;
    let precedenceScore = 0;
    
    if (uploadPosition === 1) {
      precedenceScore = 1.0; // First moment for this song at this specific performance
    } else if (uploadPosition === 2) {
      precedenceScore = 0.5; // Second moment for this song at this performance
    } else if (uploadPosition === 3) {
      precedenceScore = 0.25; // Third moment
    } else if (uploadPosition <= 5) {
      precedenceScore = 0.1; // 4th-5th moments
    } else {
      precedenceScore = 0;
    }
    
    precedenceScore = Math.min(1.0, precedenceScore);
    
    totalScore += precedenceScore;
    scoreBreakdown.performancePrecedence = {
      score: precedenceScore,
      uploadPosition,
      existingAtPerformance: allMomentsForSongAtPerformance.length,
      description: uploadPosition === 1 ? 
        'First moment for this song at this performance' : 
        `${uploadPosition}${getOrdinalSuffix(uploadPosition)} moment for this song at this performance`
    };
    
    // Safety check: Ensure total score never exceeds 7.0
    totalScore = Math.min(7.0, totalScore);
    
    // Determine rarity tier
    let rarityTier = 'common';
    if (totalScore >= 6) {
      rarityTier = 'legendary';
    } else if (totalScore >= 5) {
      rarityTier = 'epic';
    } else if (totalScore >= 3.5) {
      rarityTier = 'rare';
    } else if (totalScore >= 2) {
      rarityTier = 'uncommon';
    } else {
      rarityTier = 'common';
    }
    
    const finalScore = Math.round(totalScore * 100) / 100;
    
    console.log(`✅ SONG "${moment.songName}" at ${moment.venueName} (${moment.performanceDate}): ${finalScore}/7 (${rarityTier})`);
    console.log(`   Performance: ${performanceScore}, Metadata: ${metadataScore.toFixed(2)}, Length: ${lengthScore}, Precedence: ${precedenceScore}`);
    
    return {
      rarityScore: finalScore,
      rarityTier,
      isFirstMomentForSong: isFirstMomentForSongAtPerformance, // ENHANCED: First at this performance
      songTotalPerformances,
      scoreBreakdown
    };
    
  } catch (error) {
    console.error('❌ Error calculating song rarity score:', error);
    return {
      rarityScore: 0,
      rarityTier: 'common',
      isFirstMomentForSong: false,
      songTotalPerformances: 0,
      scoreBreakdown: {}
    };
  }
};

// Main calculation function
const calculateRarityScore = async (moment, umoCache) => {
  try {
    console.log(`🎯 Calculating rarity for "${moment.songName}" at ${moment.venueName}...`);
    
    // Check content type from form data
    const contentType = moment.contentType || 'song';
    
    // Handle non-song content with enhanced calculation
    if (contentType !== 'song') {
      console.log(`🎭 Processing non-song content: "${moment.songName}" (type: ${contentType})`);
      return calculateNonSongRarity(moment, contentType);
    }
    
    // Fallback: Detect non-song content from name if type wasn't set
    const nonSongDetection = detectNonSongContent(moment.songName);
    if (nonSongDetection.isNonSong && nonSongDetection.confidence > 0.8) {
      console.log(`🚫 Auto-detected non-song content: "${moment.songName}" (${nonSongDetection.type})`);
      return calculateNonSongRarity(moment, nonSongDetection.type);
    }
    
    // Process as song with enhanced calculation
    return calculateSongRarity(moment, umoCache);
    
  } catch (error) {
    console.error('❌ Error calculating rarity score:', error);
    return {
      rarityScore: 0,
      rarityTier: 'common',
      isFirstMomentForSong: false,
      songTotalPerformances: 0,
      scoreBreakdown: {}
    };
  }
};

// =============================================================================
// NFT TOKEN ID MANAGEMENT
// =============================================================================

app.get('/get-next-token-id', async (req, res) => {
  try {
    console.log('🔢 Getting next token ID for ERC1155...');
    
    const counter = await TokenIdCounter.findByIdAndUpdate(
      'tokenIdCounter',
      { $inc: { currentId: 1 } },
      { 
        upsert: true,
        new: true,
        runValidators: true
      }
    );
    
    const nextTokenId = counter.currentId;
    console.log(`✅ Next token ID: ${nextTokenId}`);
    
    res.json({ 
      tokenId: nextTokenId,
      success: true 
    });
    
  } catch (error) {
    console.error('❌ Error generating token ID:', error);
    res.status(500).json({ 
      error: 'Failed to generate token ID',
      details: error.message 
    });
  }
});

// =============================================================================
// NFT METADATA ENDPOINTS
// =============================================================================

app.post('/upload-metadata', authenticateToken, async (req, res) => {
  try {
    const metadata = req.body;
    console.log('📄 Uploading NFT metadata to server...');
    
    if (!metadata.name || !metadata.image) {
      return res.status(400).json({ error: 'Invalid metadata: name and image required' });
    }

    const metadataId = `metadata-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const metadataUri = `${req.protocol}://${req.get('host')}/metadata/${metadataId}`;
    
    global.metadataStorage[metadataId] = {
      ...metadata,
      storedAt: new Date().toISOString()
    };
    
    console.log('✅ Metadata stored with URI:', metadataUri);
    
    res.json({
      success: true,
      metadataUri: metadataUri,
      metadataId: metadataId
    });
    
  } catch (error) {
    console.error('❌ Metadata upload error:', error);
    res.status(500).json({
      error: 'Failed to upload metadata',
      details: error.message
    });
  }
});

app.get('/metadata/:metadataId', (req, res) => {
  try {
    const { metadataId } = req.params;
    
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'public, max-age=86400'
    });
    
    const metadata = global.metadataStorage?.[metadataId];
    
    if (!metadata) {
      console.error(`❌ Metadata not found: ${metadataId}`);
      return res.status(404).json({ 
        error: 'Metadata not found',
        metadataId: metadataId
      });
    }
    
    console.log(`📋 Serving metadata for ${metadataId}`);
    
    const { storedAt, ...publicMetadata } = metadata;
    res.json(publicMetadata);
    
  } catch (error) {
    console.error('❌ Metadata serve error:', error);
    res.status(500).json({ 
      error: 'Failed to serve metadata',
      details: error.message 
    });
  }
});

// =============================================================================
// NFT EDITION ENDPOINTS
// =============================================================================

app.post('/moments/:momentId/create-nft-edition-proxy', authenticateToken, async (req, res) => {
  try {
    const { momentId } = req.params;
    const userId = req.user.id;
    const {
      nftMetadataHash,
      splitsContract,
      mintPrice,
      mintDuration
    } = req.body;

    console.log(`🎯 Backend Proxy: Creating ERC1155 NFT edition for moment ${momentId} by user ${userId}`);

    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }

    if (moment.user.toString() !== userId) {
      console.error(`❌ User ${userId} doesn't own moment ${momentId} (owned by ${moment.user})`);
      return res.status(403).json({ error: 'Not authorized to create NFT for this moment' });
    }

    if (moment.nftMinted || moment.nftContractAddress) {
      return res.status(400).json({ error: 'NFT edition already exists for this moment' });
    }

    console.log('🔧 Using dev wallet to create NFT edition on behalf of user...');
    
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
    const devWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    const UMOMomentsERC1155Contract = require('../src/contracts/UMOMomentsERC1155.json');
    const contract = new ethers.Contract(
      UMOMomentsERC1155Contract.address,
      UMOMomentsERC1155Contract.abi,
      devWallet
    );

    const mintPriceWei = ethers.parseEther('0.001');
    const mintDurationSeconds = mintDuration * 24 * 60 * 60;
    const rarityScore = Math.floor(Math.min(7, Math.max(1, moment.rarityScore || 1)));
    const mockSplitsAddress = splitsContract || '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96';

    console.log('📝 Proxy transaction parameters:', {
      momentId: moment._id.toString().slice(0, 12) + '...',
      mintPrice: ethers.formatEther(mintPriceWei) + ' ETH',
      duration: `${mintDuration} days`,
      rarity: rarityScore,
      metadataURI: nftMetadataHash.slice(0, 50) + '...',
      devWallet: devWallet.address
    });

    const transaction = await contract.createMomentEdition(
      moment._id.toString(),
      nftMetadataHash,
      mintPriceWei,
      mintDurationSeconds,
      0,
      mockSplitsAddress,
      rarityScore
    );

    console.log('✅ Proxy transaction submitted:', transaction.hash);

    const receipt = await transaction.wait();
    console.log('✅ Proxy transaction confirmed in block:', receipt.blockNumber);

    const eventFilter = contract.filters.MomentEditionCreated();
    const events = await contract.queryFilter(eventFilter, receipt.blockNumber, receipt.blockNumber);
    const tokenId = events.length > 0 ? events[0].args.tokenId : null;

    console.log('✅ New token ID created via proxy:', tokenId?.toString());

    const updatedMoment = await Moment.findByIdAndUpdate(
      momentId,
      {
        $set: {
          nftMinted: true,
          nftTokenId: parseInt(tokenId?.toString() || 0),
          nftContractAddress: UMOMomentsERC1155Contract.address,
          nftMetadataHash: nftMetadataHash,
          nftSplitsContract: mockSplitsAddress,
          nftMintPrice: mintPrice,
          nftMintDuration: mintDuration,
          nftMintStartTime: new Date(),
          nftMintEndTime: new Date(Date.now() + (mintDuration * 24 * 60 * 60 * 1000)),
          nftCreationTxHash: transaction.hash,
          nftMintedCount: 0
        }
      },
      { new: true }
    ).populate('user', 'displayName email');

    console.log(`✅ Backend Proxy: ERC1155 NFT edition created for moment "${updatedMoment.songName}" with token ID ${tokenId}`);

    res.json({
      success: true,
      moment: updatedMoment,
      tokenId: parseInt(tokenId?.toString() || 0),
      txHash: transaction.hash,
      message: 'ERC1155 NFT edition created successfully via backend proxy',
      createdBy: 'backend-proxy',
      devWallet: devWallet.address
    });

  } catch (err) {
    console.error('❌ Backend Proxy NFT creation failed:', err);
    
    let errorMessage = err.message || 'Unknown error';
    
    if (errorMessage.includes('insufficient funds')) {
      errorMessage = 'Dev wallet has insufficient ETH for gas fees';
    } else if (errorMessage.includes('Edition already exists')) {
      errorMessage = 'NFT edition already exists for this moment';
    } else if (errorMessage.includes('NETWORK_ERROR')) {
      errorMessage = 'Network connection failed - please try again';
    }
    
    res.status(500).json({ 
      error: 'Failed to create NFT edition via proxy', 
      details: errorMessage,
      isProxyError: true
    });
  }
});

app.get('/moments/:momentId/nft-status', async (req, res) => {
  try {
    const { momentId } = req.params;
    
    const moment = await Moment.findById(momentId)
      .select('nftMinted nftTokenId nftContractAddress nftMintedCount nftMintStartTime nftMintEndTime nftMintPrice')
      .populate('user', 'displayName');

    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }

    const hasNFTEdition = !!(moment.nftMinted && moment.nftContractAddress && moment.nftTokenId !== undefined);
    const isMintingActive = hasNFTEdition && 
                           moment.nftMintEndTime && 
                           new Date() < new Date(moment.nftMintEndTime);

    console.log(`🔍 NFT Status for ${momentId}:`, {
      nftMinted: moment.nftMinted,
      hasContract: !!moment.nftContractAddress,
      hasTokenId: moment.nftTokenId !== undefined,
      tokenId: moment.nftTokenId,
      hasNFTEdition,
      isMintingActive
    });

    res.json({
      hasNFTEdition,
      isMintingActive,
      nftData: hasNFTEdition ? {
        contractAddress: moment.nftContractAddress,
        tokenId: moment.nftTokenId,
        mintedCount: moment.nftMintedCount || 0,
        mintPrice: moment.nftMintPrice,
        mintStartTime: moment.nftMintStartTime,
        mintEndTime: moment.nftMintEndTime,
        uploader: moment.user.displayName
      } : null
    });

  } catch (err) {
    console.error('❌ Get NFT status error:', err);
    res.status(500).json({ 
      error: 'Failed to get NFT status', 
      details: err.message 
    });
  }
});

app.post('/moments/:momentId/record-mint', authenticateToken, async (req, res) => {
  try {
    const { momentId } = req.params;
    const { quantity = 1, minterAddress, txHash } = req.body;

    console.log(`🎯 Recording ${quantity} NFT mint(s) for moment ${momentId}`);

    if (!txHash) {
      return res.status(400).json({ error: 'Transaction hash is required' });
    }

    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }

    if (!moment.nftMinted || !moment.nftContractAddress) {
      return res.status(400).json({ error: 'No NFT edition exists for this moment' });
    }

    const existingMint = moment.nftMintHistory?.find(mint => mint.txHash === txHash);
    if (existingMint) {
      console.log(`⚠️ Transaction ${txHash} already recorded, skipping duplicate`);
      return res.json({
        success: true,
        totalMinted: moment.nftMintedCount,
        message: 'Mint already recorded (duplicate transaction prevented)',
        isDuplicate: true
      });
    }

    const updatedMoment = await Moment.findOneAndUpdate(
      { 
        _id: momentId,
        'nftMintHistory.txHash': { $ne: txHash }
      },
      {
        $inc: { nftMintedCount: quantity },
        $push: {
          nftMintHistory: {
            minter: req.user.id,
            minterAddress: minterAddress,
            quantity: quantity,
            txHash: txHash,
            mintedAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!updatedMoment) {
      console.log(`⚠️ Transaction ${txHash} was already recorded by another request`);
      const currentMoment = await Moment.findById(momentId);
      return res.json({
        success: true,
        totalMinted: currentMoment.nftMintedCount,
        message: 'Mint already recorded (race condition prevented)',
        isDuplicate: true
      });
    }

    console.log(`✅ Recorded ${quantity} mint(s). Total now: ${updatedMoment.nftMintedCount}`);

    res.json({
      success: true,
      totalMinted: updatedMoment.nftMintedCount,
      message: `Recorded ${quantity} mint(s)`,
      isDuplicate: false,
      newMintEntry: {
        quantity,
        txHash,
        mintedAt: new Date()
      }
    });

  } catch (err) {
    console.error('❌ Record mint error:', err);
    res.status(500).json({ 
      error: 'Failed to record mint', 
      details: err.message 
    });
  }
});

// =============================================================================
// CACHE ENDPOINTS
// =============================================================================

app.get('/cache/status', async (req, res) => {
  try {
    await umoCache.loadCache();
    const stats = await umoCache.getStats();
    const needsRefresh = await umoCache.needsRefresh();
    
    res.json({
      hasCache: !!umoCache.cache,
      needsRefresh,
      stats,
      lastUpdated: umoCache.cache?.lastUpdated
    });
  } catch (err) {
    console.error('❌ Cache status error:', err);
    res.status(500).json({ error: 'Failed to check cache status' });
  }
});

app.post('/cache/refresh', async (req, res) => {
  try {
    console.log('🔄 Manual cache refresh requested...');
    
    const currentStats = await umoCache.getStats();
    const estimatedCalls = currentStats.apiCallsUsed || 200;
    
    res.json({ 
      message: 'Cache refresh started in background',
      estimatedApiCalls: estimatedCalls,
      status: 'started'
    });
    
    const API_BASE_URL = `http://localhost:${PORT}`;
    umoCache.buildFreshCache(API_BASE_URL, (progress) => {
      console.log(`📊 Cache refresh progress:`, progress);
    }).catch(err => {
      console.error('❌ Background cache refresh failed:', err);
    });
    
  } catch (err) {
    console.error('❌ Cache refresh error:', err);
    res.status(500).json({ error: 'Failed to start cache refresh' });
  }
});

app.get('/cached/performances', async (req, res) => {
  try {
    const { page = 1, limit = 20, city } = req.query;
    
    let result;
    
    if (city) {
      result = await umoCache.searchPerformancesByCity(city, parseInt(page), parseInt(limit));
      console.log(`🔍 Search "${city}" page ${page}: ${result.results.length}/${result.totalResults} results`);
      
      res.json({
        performances: result.results,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.totalResults,
          hasMore: result.hasMore
        },
        fromCache: true,
        lastUpdated: umoCache.cache?.lastUpdated,
        searchQuery: city
      });
    } else {
      const performances = await umoCache.getPerformances();
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedPerformances = performances.slice(startIndex, endIndex);
      
      res.json({
        performances: paginatedPerformances,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: performances.length,
          hasMore: endIndex < performances.length
        },
        fromCache: true,
        lastUpdated: umoCache.cache?.lastUpdated
      });
    }
    
  } catch (err) {
    console.error('❌ Error fetching cached performances:', err);
    res.status(500).json({ error: 'Failed to fetch performances' });
  }
});

app.get('/cached/songs', async (req, res) => {
  try {
    const { sortBy = 'alphabetical', limit } = req.query;
    
    const songDatabase = await umoCache.getSongDatabase();
    let songs = Object.values(songDatabase);
    
    switch (sortBy) {
      case 'mostPerformed':
        songs.sort((a, b) => b.totalPerformances - a.totalPerformances);
        break;
      case 'lastPerformed':
        songs.sort((a, b) => new Date(b.lastPerformed) - new Date(a.lastPerformed));
        break;
      case 'firstPerformed':
        songs.sort((a, b) => new Date(a.firstPerformed) - new Date(b.firstPerformed));
        break;
      case 'alphabetical':
      default:
        songs.sort((a, b) => a.songName.localeCompare(b.songName));
        break;
    }
    
    if (limit) {
      songs = songs.slice(0, parseInt(limit));
    }
    
    res.json({
      songs,
      totalSongs: Object.keys(songDatabase).length,
      fromCache: true,
      lastUpdated: umoCache.cache?.lastUpdated
    });
    
  } catch (err) {
    console.error('❌ Error fetching cached songs:', err);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
});

// =============================================================================
// AUTH ENDPOINTS
// =============================================================================

app.post('/register', async (req, res) => {
  const { email, password, displayName } = req.body;
  try {
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, displayName });
      await user.setPassword(password);
      await user.save();
    }

    const token = generateToken(user);
    res.json({ token, user: { id: user._id, email: user.email, displayName: user.displayName } });
  } catch (err) {
    console.error('❌ Registration Error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await user.validatePassword(password);
    if (!isValid) return res.status(401).json({ error: 'Invalid password' });

    const token = generateToken(user);
    res.json({ token, user: { id: user._id, email: user.email, displayName: user.displayName } });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// =============================================================================
// FILE UPLOAD ENDPOINTS
// =============================================================================

app.post('/upload-file', authenticateToken, (req, res, next) => {
  req.setTimeout(30 * 60 * 1000); // 30 minutes
  res.setTimeout(30 * 60 * 1000);
  next();
}, upload.single('file'), async (req, res) => {
  try {
    console.log(`🔍 Upload request received:`, {
      hasFile: !!req.file,
      headers: req.headers,
      bodyKeys: Object.keys(req.body)
    });

    if (!req.file) {
      console.error('❌ No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileSizeGB = (req.file.size / 1024 / 1024 / 1024).toFixed(2);
    console.log(`📁 File details:`, {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      sizeGB: `${fileSizeGB}GB`,
      bufferLength: req.file.buffer?.length,
      bufferType: typeof req.file.buffer,
      isBuffer: Buffer.isBuffer(req.file.buffer)
    });

    if (req.file.size > 6 * 1024 * 1024 * 1024) {
      console.error(`❌ File too large: ${fileSizeGB}GB exceeds 6GB limit`);
      return res.status(413).json({ 
        error: 'File too large', 
        details: `File size ${fileSizeGB}GB exceeds 6GB limit` 
      });
    }

    if (!validateBuffer(req.file.buffer, req.file.originalname)) {
      console.error('❌ Buffer validation failed');
      return res.status(400).json({ error: 'Invalid file buffer' });
    }

    console.log(`🚀 Starting upload process for ${fileSizeGB}GB file...`);
    
    let uri;
    try {
      console.log('📤 Using Irys upload...');
      const result = await uploadFileToIrys(req.file.buffer, req.file.originalname);
      uri = result.url;
      console.log('✅ Irys upload successful:', uri);
    } catch (uploadError) {
      console.error('❌ Upload failed:', uploadError);
      throw uploadError;
    }

    console.log(`✅ Upload completed successfully: ${uri}`);
    res.json({ 
      success: true, 
      fileUri: uri,
      metadata: {
        originalName: req.file.originalname,
        size: req.file.size,
        sizeGB: fileSizeGB,
        mimetype: req.file.mimetype
      }
    });

  } catch (err) {
    console.error('❌ Upload error:', err);
    console.error('Error stack:', err.stack);
    
    let errorMessage = 'File upload failed';
    let statusCode = 500;
    
    if (err.message.includes('File too large') || err.code === 'LIMIT_FILE_SIZE') {
      errorMessage = 'File exceeds size limit';
      statusCode = 413;
    } else if (err.message.includes('timeout')) {
      errorMessage = 'Upload timed out - file may be too large';
      statusCode = 408;
    } else if (err.message.includes('ENOTFOUND') || err.message.includes('network')) {
      errorMessage = 'Network error - check internet connection';
      statusCode = 503;
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: err.message 
    });
  }
});

// =============================================================================
// MOMENT ENDPOINTS
// =============================================================================

app.post('/upload-moment', authenticateToken, async (req, res) => {
  const { 
    performanceId, 
    performanceDate,
    venueName,
    venueCity,
    venueCountry,
    songName, 
    setName,
    songPosition,
    mediaUrl, 
    fileUri,
    mediaType,
    fileName,
    fileSize,
    personalNote,
    momentDescription,
    emotionalTags,
    specialOccasion,
    audioQuality,
    videoQuality,
    momentType,
    instruments,
    guestAppearances,
    crowdReaction,
    uniqueElements,
    contentType
  } = req.body;
  
  const userId = req.user.id;

  console.log('💾 Received moment upload request:', {
    performanceId,
    songName,
    venueName,
    venueCity,
    userId,
    contentType
  });

  if (!performanceId || !songName || (!mediaUrl && !fileUri)) {
    return res.status(400).json({ error: 'Missing required fields: performanceId, songName, and media URL' });
  }

  try {
    const moment = new Moment({
      user: userId,
      performanceId,
      performanceDate,
      venueName,
      venueCity,
      venueCountry,
      songName,
      setName,
      songPosition,
      mediaUrl: fileUri || mediaUrl,
      mediaType,
      fileName,
      fileSize,
      personalNote,
      momentDescription,
      emotionalTags,
      specialOccasion,
      audioQuality: audioQuality || 'good',
      videoQuality: videoQuality || 'good',
      momentType: momentType || 'performance',
      instruments,
      guestAppearances,
      crowdReaction,
      uniqueElements,
      contentType: contentType || 'song'
    });

    // Calculate rarity using the enhanced function
    await umoCache.loadCache();
    const rarityData = await calculateRarityScore(moment, umoCache);
    
    // Set rarity data
    moment.rarityScore = rarityData.rarityScore;
    moment.rarityTier = rarityData.rarityTier;
    moment.isFirstMomentForSong = rarityData.isFirstMomentForSong;
    moment.songTotalPerformances = rarityData.songTotalPerformances;

    await moment.save();
    await moment.populate('user', 'email displayName');
    
    console.log(`✅ Moment saved: "${songName}" - ${rarityData.rarityScore}/7 (${rarityData.rarityTier})`);
    
    if (rarityData.scoreBreakdown?.nonSongContent) {
      console.log(`🎭 Non-song content processed:`, rarityData.scoreBreakdown.nonSongContent);
    }
    
    res.json({ 
      success: true, 
      moment,
      rarityData,
      nonSongDetected: rarityData.scoreBreakdown?.nonSongContent ? true : false
    });
  } catch (err) {
    console.error('❌ Upload moment error:', err);
    res.status(500).json({ error: 'Moment upload failed', details: err.message });
  }
});

app.get('/moments/my', authenticateToken, async (req, res) => {
  try {
    const moments = await Moment.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate('user', 'email displayName');

    console.log(`👤 Found ${moments.length} moments for user ${req.user.id}`);
    res.json({ moments });
  } catch (err) {
    console.error('❌ Fetch user moments error:', err);
    res.status(500).json({ error: 'Failed to fetch user moments' });
  }
});

app.get('/moments', async (req, res) => {
  try {
    const moments = await Moment.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('user', 'displayName');

    console.log(`🌍 Returning ${moments.length} moments in global feed`);
    res.json({ moments });
  } catch (err) {
    console.error('❌ Fetch all moments error:', err);
    res.status(500).json({ error: 'Failed to fetch moments' });
  }
});

app.get('/moments/:momentId', async (req, res) => {
  try {
    const { momentId } = req.params;
    const moment = await Moment.findById(momentId).populate('user', 'displayName');
    
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }
    
    res.json(moment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/moments/performance/:performanceId', async (req, res) => {
  try {
    const { performanceId } = req.params;
    
    const moments = await Moment.find({ performanceId })
      .sort({ songPosition: 1, createdAt: -1 })
      .populate('user', 'displayName');
    
    console.log(`🎪 Found ${moments.length} moments for performance ${performanceId}`);
    res.json({ moments });
  } catch (err) {
    console.error('❌ Fetch performance moments error:', err);
    res.status(500).json({ error: 'Failed to fetch performance moments' });
  }
});

app.put('/moments/:momentId', authenticateToken, async (req, res) => {
  try {
    const momentId = req.params.momentId;
    const userId = req.user.id;

    console.log('🔧 Update request received:', { momentId, userId, body: req.body });

    const moment = await Moment.findById(momentId);
    if (!moment) {
      console.error('❌ Moment not found:', momentId);
      return res.status(404).json({ error: 'Moment not found' });
    }

    if (moment.user.toString() !== userId) {
      console.error('❌ Not authorized:', { momentOwner: moment.user.toString(), requestUser: userId });
      return res.status(403).json({ error: 'Not authorized to edit this moment' });
    }

    const updatedMoment = await Moment.findByIdAndUpdate(
      momentId,
      {
        $set: {
          setName: req.body.setName,
          momentDescription: req.body.momentDescription,
          emotionalTags: req.body.emotionalTags,
          momentType: req.body.momentType,
          specialOccasion: req.body.specialOccasion,
          instruments: req.body.instruments,
          audioQuality: req.body.audioQuality,
          videoQuality: req.body.videoQuality,
          crowdReaction: req.body.crowdReaction,
          guestAppearances: req.body.guestAppearances,
          personalNote: req.body.personalNote
        }
      },
      { new: true }
    ).populate('user', 'displayName');

    console.log('✅ Moment updated successfully:', momentId);
    res.json({ success: true, moment: updatedMoment });

  } catch (err) {
    console.error('❌ Update moment error:', err);
    res.status(500).json({ error: 'Failed to update moment', details: err.message });
  }
});

// =============================================================================
// RARITY RECALCULATION ENDPOINT
// =============================================================================

app.post('/admin/recalculate-rarity', async (req, res) => {
  try {
    console.log('🎯 Starting ENHANCED rarity recalculation for all moments...');
    
    await umoCache.loadCache();
    
    const allMoments = await Moment.find({});
    console.log(`📊 Found ${allMoments.length} moments to recalculate`);
    
    let updated = 0;
    let errors = 0;
    let nonSongCount = 0;
    let songNotInCacheCount = 0;
    
    const tierCounts = {
      legendary: 0,
      epic: 0,
      rare: 0,
      uncommon: 0,
      common: 0
    };
    
    for (const moment of allMoments) {
      try {
        const rarityData = await calculateRarityScore(moment, umoCache);
        
        if (rarityData.scoreBreakdown?.nonSongContent) {
          nonSongCount++;
        }
        
        if (rarityData.scoreBreakdown?.performanceFrequency && !rarityData.scoreBreakdown.performanceFrequency.inCache) {
          songNotInCacheCount++;
        }
        
        tierCounts[rarityData.rarityTier]++;
        
        await Moment.updateOne(
          { _id: moment._id },
          {
            $set: {
              rarityScore: rarityData.rarityScore,
              rarityTier: rarityData.rarityTier,
              isFirstMomentForSong: rarityData.isFirstMomentForSong,
              songTotalPerformances: rarityData.songTotalPerformances
            }
          }
        );
        
        updated++;
        
        if (rarityData.scoreBreakdown?.nonSongContent) {
          console.log(`🎭 Non-song "${moment.songName}" - Score: ${rarityData.rarityScore} (${rarityData.rarityTier})`);
        } else {
          console.log(`✅ Updated "${moment.songName}" - Score: ${rarityData.rarityScore} (${rarityData.rarityTier})`);
        }
        
      } catch (err) {
        console.error(`❌ Error updating moment ${moment._id}:`, err);
        errors++;
      }
    }
    
    console.log(`🎯 ENHANCED rarity recalculation complete:`);
    console.log(`   📊 Total processed: ${allMoments.length}`);
    console.log(`   ✅ Successfully updated: ${updated}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   🎭 Non-song content detected: ${nonSongCount}`);
    console.log(`   🔍 Songs not in cache: ${songNotInCacheCount}`);
    console.log(`   🏆 Tier distribution:`, tierCounts);
    
    res.json({
      success: true,
      message: `Enhanced recalculation complete: ${updated} moments updated`,
      statistics: {
        totalProcessed: allMoments.length,
        successfulUpdates: updated,
        errors: errors,
        nonSongContentDetected: nonSongCount,
        songsNotInCache: songNotInCacheCount,
        tierDistribution: tierCounts
      },
      details: {
        updated,
        errors,
        total: allMoments.length
      }
    });
    
  } catch (error) {
    console.error('❌ Enhanced rarity recalculation failed:', error);
    res.status(500).json({
      error: 'Failed to recalculate rarity',
      details: error.message
    });
  }
});

// =============================================================================
// ERROR HANDLING & STARTUP
// =============================================================================

app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        error: 'File too large', 
        details: 'File exceeds 6GB limit',
        maxSize: '6GB'
      });
    } else if (error.code === 'LIMIT_FIELD_SIZE') {
      return res.status(413).json({ 
        error: 'Field too large', 
        details: 'Upload field exceeds size limit' 
      });
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        error: 'Unexpected file field', 
        details: 'Only single file uploads are supported' 
      });
    }
    
    return res.status(400).json({ 
      error: 'Upload error', 
      details: error.message 
    });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

app.use('*', (req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// Cache initialization and scheduling
const initializeCache = async () => {
  try {
    console.log('🏗️ Initializing UMO cache...');
    
    await umoCache.loadCache();
    const needsRefresh = await umoCache.needsRefresh();
    
    if (needsRefresh || !umoCache.cache) {
      console.log('🔄 Cache needs refresh, building...');
      
      if (umoCache.cache) {
        const API_BASE_URL = `http://localhost:${PORT}`;
        const hasNewShows = await umoCache.checkForNewShows(API_BASE_URL, umoCache.cache.stats.totalPerformances);
        if (!hasNewShows) {
          console.log('✅ No new shows detected, using existing cache');
          return;
        }
      }
      
      const API_BASE_URL = `http://localhost:${PORT}`;
      await umoCache.buildFreshCache(API_BASE_URL);
    } else {
      console.log('✅ Using existing cache');
    }
    
  } catch (err) {
    console.error('❌ Failed to initialize cache:', err);
    console.log('⚠️ Server will continue with limited functionality');
  }
};

const scheduleDailyRefresh = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(3, 0, 0, 0); // 3 AM
  
  const msUntilRefresh = tomorrow.getTime() - now.getTime();
  
  setTimeout(async () => {
    console.log('🕐 Daily cache refresh triggered');
    try {
      const API_BASE_URL = `http://localhost:${PORT}`;
      const hasNewShows = await umoCache.checkForNewShows(API_BASE_URL, umoCache.cache?.stats?.totalPerformances || 0);
      if (hasNewShows) {
        console.log('📅 New shows detected, refreshing cache...');
        await umoCache.buildFreshCache(API_BASE_URL);
      } else {
        console.log('✅ No new shows, skipping refresh');
      }
    } catch (err) {
      console.error('❌ Daily refresh failed:', err);
    }
    
    scheduleDailyRefresh();
  }, msUntilRefresh);
  
  console.log(`⏰ Next cache refresh scheduled for ${tomorrow.toLocaleString()}`);
};

// API proxy for cache rebuild
app.use(
  '/api',
  createProxyMiddleware({
    target: 'https://api.setlist.fm',
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    headers: {
      Accept: 'application/json',
      'x-api-key': process.env.SETLIST_FM_API_KEY,
      'User-Agent': 'SetlistProxy/1.0',
    },
    logLevel: 'warn',
  })
);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening at http://0.0.0.0:${PORT}`);
  console.log(`📱 Mobile access: http://192.168.1.170:${PORT}`);
  console.log(`💻 Local access: http://localhost:${PORT}`);
  
  // Initialize cache after server starts
  initializeCache();
  scheduleDailyRefresh();
});