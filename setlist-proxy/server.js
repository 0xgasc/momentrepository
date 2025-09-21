const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
require('dotenv').config();
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const { body, validationResult } = require('express-validator');
const User = require('./models/User');
const Moment = require('./models/Moment');
const PlatformSettings = require('./models/PlatformSettings');
const emailService = require('./services/emailService');
const { UMOCache } = require('./utils/umoCache');
const { ethers } = require('ethers');
const { extractVideoThumbnail } = require('./utils/videoThumbnailExtractor');
const { generateNFTCard } = require('./utils/nftCardGenerator');

const app = express();
const PORT = process.env.PORT || 5050;

// Initialize UMO cache
const umoCache = new UMOCache();

// Cache refresh status tracking
let cacheRefreshStatus = {
  inProgress: false,
  startTime: null,
  progress: null,
  error: null,
  lastCompleted: null
};

// Global metadata storage (in production, use database)
global.metadataStorage = global.metadataStorage || {};

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:"],
      frameSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(mongoSanitize());

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many authentication attempts' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 uploads per hour
  message: { error: 'Upload limit exceeded, try again later' },
});

app.use('/api/', generalLimiter);

// CORS setup
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'https://umoarchive.vercel.app', 'https://www.umoarchive.com', 'https://momentrepository-production.up.railway.app'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: '*', // Allow all headers
  exposedHeaders: ['Content-Length', 'Content-Type']
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
  fileFilter: async (req, file, cb) => {
    console.log(`📁 Multer received file:`, {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size || 'size not available yet'
    });

    // Check file size
    const maxSize = 6 * 1024 * 1024 * 1024; // 6GB
    if (file.size && file.size > maxSize) {
      console.error(`❌ File too large: ${(file.size / 1024 / 1024 / 1024).toFixed(2)}GB exceeds 6GB limit`);
      return cb(new Error('File exceeds 6GB limit'), false);
    }

    // Check allowed file types
    const allowedMimes = [
      'video/mp4', 'video/quicktime', 'video/avi', 'video/webm',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'audio/mpeg', 'audio/wav', 'audio/ogg'
    ];

    if (!allowedMimes.includes(file.mimetype)) {
      console.error(`❌ Invalid file type: ${file.mimetype}`);
      return cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }

    // Check server memory usage
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > 4 * 1024 * 1024 * 1024) { // 4GB heap limit
      console.error(`❌ Server memory usage too high: ${(memUsage.heapUsed / 1024 / 1024 / 1024).toFixed(2)}GB`);
      return cb(new Error('Server busy, please try again later'), false);
    }

    cb(null, true);
  }
});

// Import file uploaders
const { uploadFileToIrys, validateBuffer } = require('./utils/irysUploader');

// JWT helpers
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

const generateToken = (user) => {
  return jwt.sign({
    id: user._id,
    email: user.email,
    role: user.role || 'user'
  }, JWT_SECRET, { expiresIn: '7d' });
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

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// MongoDB ObjectId validation
const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: `Invalid ${paramName}` });
    }
    next();
  };
};

// ✅ NEW: Role-based access control middleware
const requireRole = (requiredRole) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Update last active timestamp
      user.lastActive = new Date();
      await user.save();
      
      // Check role permissions (include hardcoded admin emails)
      const isHardcodedAdmin = user.email === 'solo@solo.solo' || user.email === 'solo2@solo.solo';
      console.log(`🔒 Role check: ${user.email}, role: ${user.role}, required: ${requiredRole}, isHardcodedAdmin: ${isHardcodedAdmin}`);
      
      if (requiredRole === 'admin' && !user.isAdmin() && !isHardcodedAdmin) {
        console.log(`❌ Admin access denied for ${user.email}`);
        return res.status(403).json({ error: 'Admin access required' });
      }
      if (requiredRole === 'mod' && !user.isModOrAdmin() && !isHardcodedAdmin) {
        console.log(`❌ Mod access denied for ${user.email}`);
        return res.status(403).json({ error: 'Moderator access required' });
      }
      
      req.authenticatedUser = user; // Attach full user object
      next();
    } catch (error) {
      console.error('❌ Role check error:', error);
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
};

const requireAdmin = requireRole('admin');
const requireMod = requireRole('mod');

// Connect to MongoDB
console.log('🔍 Environment check:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- MONGO_URI exists:', !!process.env.MONGO_URI);
console.log('- MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('- Available env vars:', Object.keys(process.env).filter(key => key.includes('MONGO')));

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
console.log('📍 Using MongoDB URI:', mongoUri ? '✅ Found' : '❌ Missing');

if (mongoUri) {
  mongoose.connect(mongoUri)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));
} else {
  console.error('❌ No MongoDB URI found in environment variables');
  console.log('🔧 Server will continue without database (some features may not work)');
}

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

// ✅ SUPER SIMPLE: 3-factor rarity calculation
const calculateRarityScore = async (moment, umoCache) => {
  try {
    console.log(`🎯 Calculating super simple rarity for "${moment.songName}" at ${moment.venueName}...`);
    
    let totalScore = 0;
    let scoreBreakdown = {
      simplified: true,
      factors: {},
      contentType: moment.contentType || 'song',
      isNonSong: (moment.contentType && moment.contentType !== 'song')
    };
    
    // =============================================================================
    // FACTOR 1: FILE SIZE QUALITY (0-2 points)
    // Larger files = higher quality = more points
    // =============================================================================
    let fileSizeScore = 0;
    const fileSizeGB = (moment.fileSize || 0) / (1024 * 1024 * 1024);
    const fileSizeMB = (moment.fileSize || 0) / (1024 * 1024);
    
    if (fileSizeMB >= 500) {
      fileSizeScore = 2.0; // 500MB+ = excellent quality
    } else if (fileSizeMB >= 100) {
      fileSizeScore = 1.5; // 100-500MB = great quality
    } else if (fileSizeMB >= 50) {
      fileSizeScore = 1.0; // 50-100MB = good quality
    } else if (fileSizeMB >= 10) {
      fileSizeScore = 0.5; // 10-50MB = decent quality
    } else {
      fileSizeScore = 0.2; // <10MB = basic quality
    }
    
    totalScore += fileSizeScore;
    scoreBreakdown.factors.fileSize = {
      score: fileSizeScore,
      fileSizeMB: Math.round(fileSizeMB * 10) / 10,
      fileSizeGB: Math.round(fileSizeGB * 100) / 100,
      description: `${Math.round(fileSizeMB)}MB file size`
    };
    
    // =============================================================================
    // FACTOR 2: SONG/CONTENT RARITY SCORE (0-2 points)
    // Based on how rare the song/content type is
    // =============================================================================
    let rarityScore = 0;
    let songTotalPerformances = 0;
    
    if (scoreBreakdown.isNonSong) {
      // For non-song content, base rarity on content type
      const contentTypeRarity = {
        'jam': 1.8,      // Jams are quite rare and special
        'intro': 1.2,    // Intros are moderately rare
        'outro': 1.2,    // Same as intros  
        'crowd': 1.0,    // Crowd moments are fairly common
        'other': 0.8     // Other content is most common
      };
      
      rarityScore = contentTypeRarity[moment.contentType] || 1.0;
      scoreBreakdown.factors.contentRarity = {
        score: rarityScore,
        contentType: moment.contentType,
        description: `${moment.contentType} content type rarity`
      };
    } else {
      // For songs, use the existing performance frequency logic
      const songDatabase = await umoCache.getSongDatabase();
      const songData = songDatabase[moment.songName];
      
      if (songData) {
        songTotalPerformances = songData.totalPerformances;
      } else {
        console.log(`⚠️ Song "${moment.songName}" not found in cache - treating as moderately rare`);
        songTotalPerformances = 25; // Default assumption for unknown songs
      }
      
      // Simplified performance rarity scoring
      if (songTotalPerformances >= 1 && songTotalPerformances <= 10) {
        rarityScore = 2.0; // Ultra rare songs
      } else if (songTotalPerformances >= 11 && songTotalPerformances <= 50) {
        rarityScore = 1.5; // Rare songs
      } else if (songTotalPerformances >= 51 && songTotalPerformances <= 100) {
        rarityScore = 1.0; // Uncommon songs
      } else if (songTotalPerformances >= 101 && songTotalPerformances <= 200) {
        rarityScore = 0.7; // Common songs
      } else {
        rarityScore = 0.4; // Very common songs (200+ performances)
      }
      
      scoreBreakdown.factors.songRarity = {
        score: rarityScore,
        totalPerformances: songTotalPerformances,
        inCache: !!songData,
        description: `${songTotalPerformances} live performances${!songData ? ' (estimated)' : ''}`
      };
    }
    
    totalScore += rarityScore;
    
    // =============================================================================
    // FACTOR 3: METADATA COMPLETENESS SCORE (0-2 points)
    // 6 metadata fields - percentage filled × 2 = score
    // =============================================================================
    const metadataFields = [
      moment.momentDescription,
      moment.emotionalTags,
      moment.specialOccasion,
      moment.instruments,
      moment.crowdReaction,
      moment.uniqueElements
    ];
    
    const filledFields = metadataFields.filter(field => field && field.trim().length > 0).length;
    const totalFields = metadataFields.length;
    const completenessPercentage = (filledFields / totalFields) * 100;
    const metadataScore = (filledFields / totalFields) * 2.0; // Scale to 2 points max
    
    totalScore += metadataScore;
    scoreBreakdown.factors.metadata = {
      score: metadataScore,
      filledFields,
      totalFields,
      percentage: Math.round(completenessPercentage),
      description: `${filledFields}/${totalFields} metadata fields (${Math.round(completenessPercentage)}%)`
    };
    
    // =============================================================================
    // DETERMINE 7-TIER RARITY (0-6 points scale)
    // =============================================================================
    let rarityTier = 'basic';
    
    if (totalScore >= 5.5) {
      rarityTier = 'legendary';
    } else if (totalScore >= 4.8) {
      rarityTier = 'mythic';
    } else if (totalScore >= 4.0) {
      rarityTier = 'epic';
    } else if (totalScore >= 3.2) {
      rarityTier = 'rare';
    } else if (totalScore >= 2.4) {
      rarityTier = 'uncommon';
    } else if (totalScore >= 1.6) {
      rarityTier = 'common';
    } else {
      rarityTier = 'basic';
    }
    
    const finalScore = Math.round(totalScore * 100) / 100;
    
    console.log(`✅ SUPER SIMPLE "${moment.songName}" ${scoreBreakdown.isNonSong ? `(${moment.contentType})` : ''}: ${finalScore}/6.0 (${rarityTier})`);
    console.log(`   File: ${fileSizeScore}, Rarity: ${rarityScore}, Metadata: ${metadataScore.toFixed(2)}`);
    
    return {
      rarityScore: finalScore,
      rarityTier,
      isFirstMomentForSong: false, // Removed this bonus entirely
      songTotalPerformances: scoreBreakdown.isNonSong ? 0 : songTotalPerformances,
      scoreBreakdown
    };
    
  } catch (error) {
    console.error('❌ Error calculating super simple rarity score:', error);
    return {
      rarityScore: 0,
      rarityTier: 'basic',
      isFirstMomentForSong: false,
      songTotalPerformances: 0,
      scoreBreakdown: {
        simplified: true,
        error: error.message
      }
    };
  }
};

// Export for use in server
module.exports = {
  calculateRarityScore
};

// =============================================================================
// HEALTH CHECK ROUTES
// =============================================================================

// Health check for Railway and other deployment platforms
app.get('/', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'UMO Archive Backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'UMO Archive Backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

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
// NFT CARD GENERATION ENDPOINT
// =============================================================================

app.post('/moments/:momentId/preview-nft-card', authenticateToken, async (req, res) => {
  try {
    const { momentId } = req.params;
    const { randomSeed, effectIntensity = 1.0, frameTimingMode = 'auto', glitchIntensity = 1.0, zoomLevel = 1.0 } = req.body;
    const userId = req.user.id;
    
    console.log(`🎨 Generating NFT card preview for moment ${momentId}`);
    
    const moment = await Moment.findById(momentId).populate('user', 'displayName');
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }
    
    if (moment.user._id.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to preview card for this moment' });
    }
    
    // Extract thumbnail from video if it's a video
    let thumbnailBuffer = null;
    console.log('🔍 Moment media info for thumbnail extraction:', {
      mediaType: moment.mediaType,
      hasMediaUrl: !!moment.mediaUrl,
      fileName: moment.fileName,
      isVideo: moment.mediaType && (moment.mediaType.startsWith('video/') || moment.mediaType === 'video')
    });
    
    // Check for video by mediaType or file extension
    const isVideo = (moment.mediaType && (moment.mediaType.startsWith('video/') || moment.mediaType === 'video')) ||
                   (moment.fileName && /\.(mp4|mov|avi|webm|mkv|m4v|3gp)$/i.test(moment.fileName));
    
    if (isVideo && moment.mediaUrl) {
      try {
        console.log('📹 Moment has video, attempting to extract thumbnail...');
        
        // Fetch video from Irys
        const videoResponse = await fetch(moment.mediaUrl);
        if (!videoResponse.ok) {
          throw new Error(`Failed to fetch video: ${videoResponse.status}`);
        }
        
        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        thumbnailBuffer = await extractVideoThumbnail(videoBuffer, moment.fileName || 'video.mp4', {
          frameTimingMode,
          customSeed: randomSeed,
          zoomLevel
        });
        
        if (thumbnailBuffer) {
          console.log('✅ Thumbnail extracted successfully');
        }
      } catch (error) {
        console.error('⚠️ Thumbnail extraction failed:', error.message);
        // Continue without thumbnail - will use fallback design
      }
    }
    
    // Generate NFT card with optional randomness
    const cardBuffer = await generateNFTCard(thumbnailBuffer, {
      songName: moment.songName,
      contentType: moment.contentType,
      venueName: moment.venueName,
      venueCity: moment.venueCity,
      venueCountry: moment.venueCountry,
      performanceDate: moment.performanceDate,
      rarityTier: moment.rarityTier,
      rarityScore: moment.rarityScore,
      momentDescription: moment.momentDescription,
      // Add randomness parameters for preview variations
      randomSeed: randomSeed || undefined,
      effectIntensity: effectIntensity,
      glitchIntensity: glitchIntensity
    });
    
    // Return card as base64 data URL for immediate preview
    const base64Card = cardBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Card}`;
    
    console.log('✅ NFT card preview generated');
    
    res.json({
      success: true,
      previewUrl: dataUrl,
      message: 'NFT card preview generated successfully'
    });
    
  } catch (error) {
    console.error('❌ NFT card preview generation error:', error);
    res.status(500).json({
      error: 'Failed to generate NFT card preview',
      details: error.message
    });
  }
});

app.post('/moments/:momentId/generate-nft-card', authenticateToken, async (req, res) => {
  try {
    const { momentId } = req.params;
    const userId = req.user.id;
    
    console.log(`🎨 Generating NFT card for moment ${momentId}`);
    
    const moment = await Moment.findById(momentId).populate('user', 'displayName');
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }
    
    if (moment.user._id.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to generate card for this moment' });
    }
    
    // Extract thumbnail from video if it's a video
    let thumbnailBuffer = null;
    console.log('🔍 Moment media info for thumbnail extraction:', {
      mediaType: moment.mediaType,
      hasMediaUrl: !!moment.mediaUrl,
      fileName: moment.fileName,
      isVideo: moment.mediaType && (moment.mediaType.startsWith('video/') || moment.mediaType === 'video')
    });
    
    // Check for video by mediaType or file extension
    const isVideo = (moment.mediaType && (moment.mediaType.startsWith('video/') || moment.mediaType === 'video')) ||
                   (moment.fileName && /\.(mp4|mov|avi|webm|mkv|m4v|3gp)$/i.test(moment.fileName));
    
    if (isVideo && moment.mediaUrl) {
      try {
        console.log('📹 Moment has video, attempting to extract thumbnail...');
        
        // Fetch video from Irys
        const videoResponse = await fetch(moment.mediaUrl);
        if (!videoResponse.ok) {
          throw new Error(`Failed to fetch video: ${videoResponse.status}`);
        }
        
        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        thumbnailBuffer = await extractVideoThumbnail(videoBuffer, moment.fileName || 'video.mp4', {
          frameTimingMode,
          customSeed: randomSeed,
          zoomLevel
        });
        
        if (thumbnailBuffer) {
          console.log('✅ Thumbnail extracted successfully');
        }
      } catch (error) {
        console.error('⚠️ Thumbnail extraction failed:', error.message);
        // Continue without thumbnail - will use fallback design
      }
    }
    
    // Generate NFT card
    const cardBuffer = await generateNFTCard(thumbnailBuffer, {
      songName: moment.songName,
      contentType: moment.contentType,
      venueName: moment.venueName,
      venueCity: moment.venueCity,
      venueCountry: moment.venueCountry,
      performanceDate: moment.performanceDate,
      rarityTier: moment.rarityTier,
      rarityScore: moment.rarityScore,
      momentDescription: moment.momentDescription // Add description for generative effects
    });
    
    // Upload card to Irys
    const { uploadFileToIrys } = require('./utils/irysUploader');
    const cardFilename = `nft_card_${moment._id}.jpg`;
    const cardUploadResult = await uploadFileToIrys(cardBuffer, cardFilename);
    
    console.log('✅ NFT card uploaded to Irys:', cardUploadResult.url);
    
    // Save card URL to moment
    await Moment.findByIdAndUpdate(momentId, {
      $set: { nftCardUrl: cardUploadResult.url }
    });
    
    res.json({
      success: true,
      cardUrl: cardUploadResult.url,
      message: 'NFT card generated successfully'
    });
    
  } catch (error) {
    console.error('❌ NFT card generation failed:', error);
    res.status(500).json({
      error: 'Failed to generate NFT card',
      details: error.message
    });
  }
});

// Generate NFT card with custom settings (for final minting)
app.post('/moments/:momentId/generate-nft-card-with-settings', authenticateToken, async (req, res) => {
  try {
    const { momentId } = req.params;
    const { randomSeed, effectIntensity = 1.0, frameTimingMode = 'auto', glitchIntensity = 1.0, zoomLevel = 1.0 } = req.body;
    const userId = req.user.id;
    
    console.log(`🎨 Generating NFT card with custom settings for moment ${momentId}`);
    
    const moment = await Moment.findById(momentId).populate('user', 'displayName');
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }
    
    if (moment.user._id.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to generate card for this moment' });
    }
    
    // Extract thumbnail from video if it's a video
    let thumbnailBuffer = null;
    console.log('🔍 Moment media info for thumbnail extraction:', {
      mediaType: moment.mediaType,
      hasMediaUrl: !!moment.mediaUrl,
      fileName: moment.fileName,
      isVideo: moment.mediaType && (moment.mediaType.startsWith('video/') || moment.mediaType === 'video')
    });
    
    // Check for video by mediaType or file extension
    const isVideo = (moment.mediaType && (moment.mediaType.startsWith('video/') || moment.mediaType === 'video')) ||
                   (moment.fileName && /\.(mp4|mov|avi|webm|mkv|m4v|3gp)$/i.test(moment.fileName));
    
    if (isVideo && moment.mediaUrl) {
      try {
        console.log('📹 Moment has video, attempting to extract thumbnail with custom settings...');
        
        // Fetch video from Irys
        const videoResponse = await fetch(moment.mediaUrl);
        if (!videoResponse.ok) {
          throw new Error(`Failed to fetch video: ${videoResponse.status}`);
        }
        
        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        thumbnailBuffer = await extractVideoThumbnail(videoBuffer, moment.fileName || 'video.mp4', {
          frameTimingMode,
          customSeed: randomSeed,
          zoomLevel
        });
        
        if (thumbnailBuffer) {
          console.log('✅ Thumbnail extracted successfully with custom settings');
        }
      } catch (error) {
        console.error('❌ Video thumbnail extraction failed:', error);
        // Continue without thumbnail - NFT card will use fallback
      }
    }
    
    // Prepare moment data with custom settings for generative effects
    const momentDataWithSettings = {
      ...moment.toObject(),
      randomSeed: randomSeed,
      effectIntensity: effectIntensity,
      glitchIntensity: glitchIntensity
    };
    
    // Generate the NFT card
    const nftCardBuffer = await generateNFTCard(thumbnailBuffer, momentDataWithSettings);
    
    // Upload to Irys and save
    const uploadResult = await uploadFileToIrys(nftCardBuffer, `nft-card-${momentId}.jpg`, 'image/jpeg');
    const arweaveUrl = uploadResult.url;
    
    // Update moment with NFT card URL
    moment.nftCardUrl = arweaveUrl;
    await moment.save();
    
    console.log('✅ NFT card with custom settings generated and uploaded:', arweaveUrl);
    
    res.json({
      success: true,
      cardUrl: arweaveUrl,
      message: 'NFT card generated with custom settings'
    });
    
  } catch (error) {
    console.error('❌ Custom NFT card generation failed:', error);
    res.status(500).json({
      error: 'Failed to generate NFT card with custom settings',
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
      uploaderAddress,
      mintPrice,
      mintDuration,
      nftCardUrl
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

    console.log('🔧 Using dev wallet to create NFT edition with V2 contract (built-in revenue splits)...');
    
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
    const devWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    const UMOMomentsERC1155V2Contract = require('../src/contracts/UMOMomentsERC1155V2.json');
    const contract = new ethers.Contract(
      UMOMomentsERC1155V2Contract.address,
      UMOMomentsERC1155V2Contract.abi,
      devWallet
    );

    const mintPriceWei = BigInt(mintPrice); // mintPrice is already in wei from frontend
    const mintDurationSeconds = mintDuration * 24 * 60 * 60;
    
    // Define wallet addresses for revenue splits
    const umoWallet = '0xd573BeCb6A6B0a0D43065d468D07787ca65dAF8a'; // UMO treasury wallet (65%)
    const creatorWallet = uploaderAddress || '0x23de198F1520ad386565fc98AEE6abb3Ae5052BE'; // Creator's wallet (30%)
    const platformWallet = '0x23de198F1520ad386565fc98AEE6abb3Ae5052BE'; // Platform fee wallet (5%)

    console.log('📝 Proxy transaction parameters (V2):', {
      momentId: moment._id.toString().slice(0, 12) + '...',
      mintPrice: ethers.formatEther(mintPriceWei) + ' ETH',
      duration: `${mintDuration} days`,
      metadataURI: nftMetadataHash.slice(0, 50) + '...',
      devWallet: devWallet.address,
      umoWallet: umoWallet,
      creatorWallet: creatorWallet,
      platformWallet: platformWallet,
      contractV2: UMOMomentsERC1155V2Contract.address
    });

    const transaction = await contract.createMomentEdition(
      moment._id.toString(),
      nftMetadataHash,
      mintPriceWei,
      mintDurationSeconds,
      0, // maxSupply (unlimited in V2)
      umoWallet,
      creatorWallet,
      platformWallet
    );

    console.log('✅ Proxy transaction submitted:', transaction.hash);

    const receipt = await transaction.wait();
    console.log('✅ Proxy transaction confirmed in block:', receipt.blockNumber);

    console.log('🔍 Parsing events from transaction receipt...');
    console.log('📋 Receipt logs:', receipt.logs.length, 'logs found');
    
    // Method 1: Try to parse logs directly from receipt
    let tokenId = null;
    
    try {
      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog(log);
          console.log('📝 Parsed log:', {
            name: parsedLog.name,
            args: parsedLog.args
          });
          
          if (parsedLog.name === 'MomentEditionCreated') {
            tokenId = parsedLog.args.tokenId;
            console.log('✅ Found tokenId in receipt logs:', tokenId?.toString());
            break;
          }
        } catch (parseError) {
          // Skip logs that can't be parsed
        }
      }
    } catch (error) {
      console.error('⚠️ Error parsing receipt logs:', error.message);
    }
    
    // Method 2: Fallback to event query if receipt parsing failed
    if (!tokenId) {
      console.log('🔄 Fallback: Querying events with filter...');
      
      const eventFilter = contract.filters.MomentEditionCreated();
      const events = await contract.queryFilter(eventFilter, receipt.blockNumber, receipt.blockNumber);
      
      console.log('📊 Event query results:', {
        eventsFound: events.length,
        blockNumber: receipt.blockNumber
      });
      
      if (events.length > 0) {
        tokenId = events[0].args.tokenId;
        console.log('✅ Found tokenId via event query:', tokenId?.toString());
      }
    }
    
    console.log('🎯 Final extracted token ID:', tokenId?.toString());

    const updatedMoment = await Moment.findByIdAndUpdate(
      momentId,
      {
        $set: {
          nftMinted: true,
          nftTokenId: parseInt(tokenId?.toString() || 0),
          nftContractAddress: UMOMomentsERC1155V2Contract.address,
          nftMetadataHash: nftMetadataHash,
          nftUmoWallet: umoWallet,
          nftCreatorWallet: creatorWallet,
          nftPlatformWallet: platformWallet,
          nftMintPrice: mintPriceWei.toString(), // Custom price in wei
          nftMintDuration: mintDuration,
          nftMintStartTime: new Date(),
          nftMintEndTime: new Date(Date.now() + (mintDuration * 24 * 60 * 60 * 1000)),
          nftCreationTxHash: transaction.hash,
          nftMintedCount: 0,
          nftCardUrl: nftCardUrl // Save the NFT card URL
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

// Manual fix endpoint to repair mint counts
app.post('/moments/:momentId/fix-mint-count', authenticateToken, async (req, res) => {
  try {
    const { momentId } = req.params;
    const { forceAdd = false } = req.body; // Option to force add a mint record
    const moment = await Moment.findById(momentId);
    
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }
    
    const oldCount = moment.nftMintedCount || 0;
    let newCount = 0;
    
    // If user requests force add, add a manual entry
    if (forceAdd) {
      console.log(`🔧 Force adding mint record for user ${req.user.id}`);
      
      if (!moment.nftMintHistory) {
        moment.nftMintHistory = [];
      }
      
      moment.nftMintHistory.push({
        minter: req.user.id,
        minterAddress: '0x0000000000000000000000000000000000000000', // Placeholder since we don't have the original address
        quantity: 1,
        txHash: `manual-fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique identifier
        mintedAt: new Date()
      });
      
      // Recalculate total
      newCount = moment.nftMintHistory.reduce((total, mint) => total + (mint.quantity || 1), 0);
    } else if (moment.nftMintHistory && moment.nftMintHistory.length > 0) {
      // Just recalculate from existing history
      newCount = moment.nftMintHistory.reduce((total, mint) => total + (mint.quantity || 1), 0);
    }
    
    moment.nftMintedCount = newCount;
    await moment.save();
    
    console.log(`🔧 Fixed mint count for ${momentId}: ${oldCount} -> ${newCount}`);
    
    res.json({
      success: true,
      oldCount,
      newCount,
      historyLength: moment.nftMintHistory?.length || 0,
      forceAdded: forceAdd && oldCount === 0
    });
  } catch (err) {
    console.error('❌ Fix mint count error:', err);
    res.status(500).json({ error: 'Failed to fix mint count' });
  }
});

app.get('/moments/:momentId/nft-status', async (req, res) => {
  try {
    const { momentId } = req.params;
    
    const moment = await Moment.findById(momentId)
      .select('nftMinted nftTokenId nftContractAddress nftMintedCount nftMintStartTime nftMintEndTime nftMintPrice nftMintHistory')
      .populate('user', 'displayName');

    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }
    
    // Recalculate mint count from history if it seems incorrect
    if (moment.nftMintHistory && moment.nftMintHistory.length > 0) {
      const calculatedCount = moment.nftMintHistory.reduce((total, mint) => total + (mint.quantity || 1), 0);
      if (calculatedCount !== moment.nftMintedCount) {
        console.log(`🔧 Fixing mint count in nft-status for ${momentId}: ${moment.nftMintedCount} -> ${calculatedCount}`);
        moment.nftMintedCount = calculatedCount;
        await moment.save();
      }
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
    console.log('📝 Mint details:', { quantity, minterAddress, txHash });

    if (!txHash) {
      return res.status(400).json({ error: 'Transaction hash is required' });
    }

    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }

    console.log('📝 Moment before update:', {
      nftTokenId: moment.nftTokenId,
      nftContractAddress: moment.nftContractAddress,
      currentMintCount: moment.nftMintedCount
    });

    if (!moment.nftTokenId || !moment.nftContractAddress) {
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
        _id: mongoose.Types.ObjectId(momentId),
        'nftMintHistory.txHash': { $ne: String(txHash) }
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
    console.log('📝 Updated moment details:', {
      id: updatedMoment._id,
      nftMintedCount: updatedMoment.nftMintedCount,
      historyLength: updatedMoment.nftMintHistory?.length
    });

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

// Mint NFT proxy endpoint for collectors/creators
app.post('/moments/:momentId/mint-nft-proxy', authenticateToken, async (req, res) => {
  try {
    const { momentId } = req.params;
    const { quantity = 1 } = req.body;
    const userId = req.user.id;

    console.log(`🎯 Backend Proxy: Minting ${quantity} NFT(s) for moment ${momentId} by user ${userId}`);

    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }

    if (!moment.nftContractAddress || moment.nftTokenId === undefined || moment.nftTokenId === null) {
      return res.status(400).json({ 
        error: 'No NFT edition exists for this moment',
        debug: {
          hasContract: !!moment.nftContractAddress,
          tokenId: moment.nftTokenId,
          tokenIdType: typeof moment.nftTokenId
        }
      });
    }

    // Check if minting is still active
    if (moment.nftMintEndTime && new Date() > new Date(moment.nftMintEndTime)) {
      return res.status(400).json({ error: 'Minting period has ended' });
    }

    // Set up blockchain connection
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
    const devWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Determine which contract to use based on the NFT's contract address
    const UMOMomentsERC1155V2Contract = require('../src/contracts/UMOMomentsERC1155V2.json');
    const UMOMomentsERC1155Contract = require('../src/contracts/UMOMomentsERC1155.json');
    
    const isV2Contract = moment.nftContractAddress === UMOMomentsERC1155V2Contract.address;
    
    const contractABI = isV2Contract ? UMOMomentsERC1155V2Contract.abi : UMOMomentsERC1155Contract.abi;
    const contract = new ethers.Contract(
      moment.nftContractAddress,
      contractABI,
      devWallet
    );
    
    console.log(`🔧 Using ${isV2Contract ? 'V2' : 'V1'} contract for minting:`, moment.nftContractAddress);

    const mintPriceWei = BigInt(moment.nftMintPrice || '50000000000000'); // Use stored price or fallback to 0.00005 ETH
    const totalCost = mintPriceWei * BigInt(quantity);

    console.log(`🎯 Proxy mint parameters (${isV2Contract ? 'V2' : 'V1'}):`, {
      momentId: moment._id.toString().slice(0, 12) + '...',
      tokenId: moment.nftTokenId,
      tokenIdType: typeof moment.nftTokenId,
      quantity: quantity,
      mintPrice: ethers.formatEther(mintPriceWei) + ' ETH each',
      totalCost: ethers.formatEther(totalCost) + ' ETH',
      devWallet: devWallet.address,
      contractVersion: isV2Contract ? 'V2 (with built-in splits)' : 'V1 (legacy)',
      momentData: {
        nftMinted: moment.nftMinted,
        nftContractAddress: moment.nftContractAddress,
        nftMintEndTime: moment.nftMintEndTime
      }
    });

    // Execute mint transaction
    const transaction = await contract.mintMoment(
      moment.nftTokenId,
      quantity,
      { value: totalCost }
    );

    console.log(`✅ Mint transaction submitted: ${transaction.hash}`);

    res.json({
      success: true,
      txHash: transaction.hash,
      quantity: quantity,
      totalCost: ethers.formatEther(totalCost),
      message: `Minting ${quantity} NFT(s) initiated`
    });

  } catch (error) {
    console.error('❌ Mint proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to mint NFT', 
      details: error.message 
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
    if (cacheRefreshStatus.inProgress) {
      return res.json({ 
        message: 'Cache refresh already in progress',
        status: 'in_progress',
        startTime: cacheRefreshStatus.startTime,
        progress: cacheRefreshStatus.progress
      });
    }

    console.log('🔄 Manual cache refresh requested...');
    
    const currentStats = await umoCache.getStats();
    const estimatedCalls = currentStats.apiCallsUsed || 200;
    
    // Update status
    cacheRefreshStatus = {
      inProgress: true,
      startTime: new Date(),
      progress: { stage: 'starting', completed: 0, total: estimatedCalls },
      error: null,
      lastCompleted: null
    };
    
    res.json({ 
      message: 'Cache refresh started in background',
      estimatedApiCalls: estimatedCalls,
      status: 'started',
      startTime: cacheRefreshStatus.startTime
    });
    
    const API_BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : `http://localhost:${PORT}`;
      
    umoCache.buildFreshCache(API_BASE_URL, (progress) => {
      console.log(`📊 Cache refresh progress:`, progress);
      cacheRefreshStatus.progress = progress;
    })
    .then(() => {
      console.log('✅ Cache refresh completed successfully');
      cacheRefreshStatus = {
        inProgress: false,
        startTime: null,
        progress: null,
        error: null,
        lastCompleted: new Date()
      };
    })
    .catch(err => {
      console.error('❌ Background cache refresh failed:', err);
      cacheRefreshStatus = {
        inProgress: false,
        startTime: null,
        progress: null,
        error: err.message,
        lastCompleted: null
      };
    });
    
  } catch (err) {
    console.error('❌ Cache refresh error:', err);
    cacheRefreshStatus.error = err.message;
    cacheRefreshStatus.inProgress = false;
    res.status(500).json({ error: 'Failed to start cache refresh' });
  }
});

// Get cache refresh status
app.get('/cache/refresh/status', async (req, res) => {
  try {
    const currentStats = await umoCache.getStats();
    res.json({
      refreshStatus: cacheRefreshStatus,
      cacheStats: currentStats
    });
  } catch (err) {
    console.error('❌ Error getting cache status:', err);
    res.status(500).json({ error: 'Failed to get cache status' });
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

app.get('/cached/performance/:performanceId', async (req, res) => {
  try {
    const { performanceId } = req.params;
    
    console.log(`🎸 Looking for performance: ${performanceId}`);
    
    // Get all performances from cache
    const performances = await umoCache.getPerformances();
    
    // Find the specific performance by ID
    const performance = performances.find(p => p.id === performanceId);
    
    if (!performance) {
      console.log(`❌ Performance ${performanceId} not found`);
      return res.status(404).json({ 
        error: 'Performance not found',
        performanceId 
      });
    }
    
    console.log(`✅ Found performance: ${performance.venue?.name} - ${performance.eventDate}`);
    
    res.json({
      performance,
      fromCache: true,
      lastUpdated: umoCache.cache?.lastUpdated
    });
    
  } catch (err) {
    console.error('❌ Error fetching single performance:', err);
    res.status(500).json({ 
      error: 'Failed to fetch performance',
      details: err.message 
    });
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

app.post('/register', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('displayName').isLength({ min: 2, max: 50 }).trim().withMessage('Display name must be 2-50 characters'),
  handleValidationErrors
], async (req, res) => {
  const { email, password, displayName } = req.body;
  try {
    let user = await User.findOne({ email });
    let isNewUser = false;
    if (!user) {
      user = new User({ email, displayName });
      await user.setPassword(password);
      await user.save();
      isNewUser = true;
    }

    // 📧 Send notification to admins about new user registration
    if (isNewUser) {
      try {
        const adminEmails = await emailService.getAdminEmails();
        await emailService.sendNewUserRegistered(user, adminEmails);
      } catch (emailError) {
        console.error('📧 Email notification error:', emailError);
      }
    }

    const token = generateToken(user);
    res.json({ token, user: { id: user._id, email: user.email, displayName: user.displayName } });
  } catch (err) {
    console.error('❌ Registration Error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
  handleValidationErrors
], async (req, res) => {
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
// ROLE MANAGEMENT & ADMIN ENDPOINTS
// =============================================================================

// Bootstrap admin (run once to set up solo@solo.solo as admin)
app.post('/bootstrap-admin', async (req, res) => {
  try {
    const { adminSecret } = req.body;
    
    // Simple protection - require a secret
    if (adminSecret !== 'UMO-ADMIN-SETUP-2024') {
      return res.status(403).json({ error: 'Invalid admin secret' });
    }
    
    // Set solo@solo.solo as admin
    const adminEmail = 'solo@solo.solo';
    const adminUser = await User.findOne({ email: adminEmail });
    
    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found. Please register first.' });
    }
    
    // Always ensure admin role is set
    if (adminUser.role !== 'admin') {
      adminUser.role = 'admin';
      adminUser.roleAssignedAt = new Date();
      await adminUser.save();
    }
    
    // Always run these updates to fix any missing data
    // Set all existing users to 'user' role if they don't have one
    const usersUpdated = await User.updateMany(
      { role: { $exists: false } },
      { $set: { role: 'user', lastActive: new Date() } }
    );
    
    // Grandfather all existing moments as approved
    const momentsUpdated = await Moment.updateMany(
      { $or: [
        { approvalStatus: { $exists: false } },
        { approvalStatus: null }
      ]},
      { 
        $set: { 
          approvalStatus: 'approved',
          reviewedBy: adminUser._id,
          reviewedAt: new Date()
        }
      }
    );
    
    console.log('🎉 Admin bootstrap complete!');
    console.log(`📊 Updated ${usersUpdated.modifiedCount} users and ${momentsUpdated.modifiedCount} moments`);
    
    res.json({ 
      success: true, 
      message: momentsUpdated.modifiedCount > 0 ? 'Bootstrap updates applied' : 'System already up to date',
      admin: adminUser.email,
      usersUpdated: usersUpdated.modifiedCount,
      momentsUpdated: momentsUpdated.modifiedCount,
      note: 'All existing content approved, new uploads require moderation'
    });
    
  } catch (error) {
    console.error('❌ Admin bootstrap error:', error);
    res.status(500).json({ error: 'Bootstrap failed' });
  }
});

// Get current user's profile with role info
app.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update last active
    user.lastActive = new Date();
    await user.save();
    
    res.json({
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        createdAt: user.createdAt,
        lastActive: user.lastActive,
        roleAssignedAt: user.roleAssignedAt
      }
    });
  } catch (error) {
    console.error('❌ Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Admin: Get all users with roles
app.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .select('-passwordHash')
      .populate('assignedBy', 'email displayName')
      .sort({ createdAt: -1 });
      
    res.json({ users });
  } catch (error) {
    console.error('❌ Admin users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin: Assign role to user
app.put('/admin/users/:userId/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!['user', 'mod', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const oldRole = user.role;
    user.role = role;
    user.assignedBy = req.user.id;
    user.roleAssignedAt = new Date();
    await user.save();
    
    console.log(`👑 Admin ${req.user.email} changed ${user.email} from ${oldRole} to ${role}`);
    
    // 📧 Send role assignment notification to user
    try {
      const assignedByUser = await User.findById(req.user.id);
      await emailService.sendRoleAssigned(user, role, assignedByUser);
    } catch (emailError) {
      console.error('📧 Email notification error:', emailError);
    }
    
    res.json({ 
      success: true, 
      message: `User role updated from ${oldRole} to ${role}`,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        roleAssignedAt: user.roleAssignedAt
      }
    });
  } catch (error) {
    console.error('❌ Role assignment error:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

// Admin/Mod: Get platform settings (mods can access for cache refresh)
app.get('/admin/settings', authenticateToken, requireMod, async (req, res) => {
  try {
    const settings = await PlatformSettings.getCurrentSettings();
    res.json({ 
      success: true, 
      settings: settings.toObject({ virtuals: true }) 
    });
  } catch (error) {
    console.error('❌ Platform settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch platform settings' });
  }
});

// Admin: Update platform settings
app.put('/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    const allowedSettings = [
      'web3Enabled', 'maintenanceMode', 'uploadsEnabled', 
      'autoApprovalEnabled', 'maxFileSize', 'platformName', 
      'platformDescription', 'adminEmail'
    ];
    
    const settings = await PlatformSettings.getCurrentSettings();
    let updatedFields = [];
    
    // Update only allowed fields
    Object.keys(updates).forEach(key => {
      if (allowedSettings.includes(key) && updates[key] !== undefined) {
        const oldValue = settings[key];
        settings[key] = updates[key];
        settings.updatedBy = req.user.id;
        updatedFields.push({ field: key, oldValue, newValue: updates[key] });
      }
    });
    
    await settings.save();
    
    console.log(`⚙️ Admin ${req.user.email} updated platform settings:`, 
      updatedFields.map(f => `${f.field}: ${f.oldValue} → ${f.newValue}`).join(', ')
    );
    
    res.json({ 
      success: true, 
      message: `Updated ${updatedFields.length} platform settings`,
      settings: settings.toObject({ virtuals: true }),
      updatedFields
    });
  } catch (error) {
    console.error('❌ Platform settings update error:', error);
    res.status(500).json({ error: 'Failed to update platform settings' });
  }
});

// Public: Get platform settings (limited fields for frontend)
app.get('/platform/settings', async (req, res) => {
  try {
    const settings = await PlatformSettings.getCurrentSettings();
    
    // Only expose public settings
    const publicSettings = {
      web3Enabled: settings.web3Enabled,
      maintenanceMode: settings.maintenanceMode,
      uploadsEnabled: settings.uploadsEnabled,
      platformName: settings.platformName,
      platformDescription: settings.platformDescription,
      maxFileSize: settings.maxFileSize
    };
    
    res.json({ success: true, settings: publicSettings });
  } catch (error) {
    console.error('❌ Public platform settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch platform settings' });
  }
});

// DEBUG: Check user auth status
app.get('/debug/user', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      userId: req.user.id,
      userExists: !!user,
      userEmail: user?.email,
      userRole: user?.role,
      isHardcodedAdmin: user?.email === 'solo@solo.solo' || user?.email === 'solo2@solo.solo',
      isAdmin: user?.isAdmin?.(),
      isModOrAdmin: user?.isModOrAdmin?.()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// CONTENT MODERATION ENDPOINTS
// =============================================================================

// Mod/Admin: Get pending moments for review
app.get('/moderation/pending', authenticateToken, requireMod, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    const pendingMoments = await Moment.find({ approvalStatus: 'pending' })
      .populate('user', 'email displayName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    const totalPending = await Moment.countDocuments({ approvalStatus: 'pending' });
    
    res.json({
      moments: pendingMoments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalPending,
        hasMore: skip + pendingMoments.length < totalPending
      }
    });
  } catch (error) {
    console.error('❌ Pending moments fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch pending moments' });
  }
});

// Mod/Admin: Approve moment
app.put('/moderation/moments/:momentId/approve', authenticateToken, requireMod, async (req, res) => {
  try {
    const { momentId } = req.params;
    const moment = await Moment.findById(momentId);
    
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }
    
    moment.approvalStatus = 'approved';
    moment.reviewedBy = req.user.id;
    moment.reviewedAt = new Date();
    await moment.save();
    
    console.log(`✅ Mod ${req.authenticatedUser.email} approved moment ${momentId}`);
    
    // 📧 Send approval email to user
    try {
      const momentWithUser = await Moment.findById(momentId).populate('user');
      await emailService.sendMomentApproved(momentWithUser, momentWithUser.user);
    } catch (emailError) {
      console.error('📧 Email notification error:', emailError);
    }
    
    res.json({ 
      success: true, 
      message: 'Moment approved',
      moment: {
        id: moment._id,
        approvalStatus: moment.approvalStatus,
        reviewedAt: moment.reviewedAt
      }
    });
  } catch (error) {
    console.error('❌ Moment approval error:', error);
    res.status(500).json({ error: 'Failed to approve moment' });
  }
});

// Mod/Admin: Reject and delete moment
app.delete('/moderation/moments/:momentId/reject', authenticateToken, requireMod, async (req, res) => {
  try {
    const { momentId } = req.params;
    const { reason } = req.body;
    
    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }
    
    // 📧 Send rejection email to user before deletion
    try {
      const momentWithUser = await Moment.findById(momentId).populate('user');
      await emailService.sendMomentRejected(momentWithUser, momentWithUser.user, reason);
    } catch (emailError) {
      console.error('📧 Email notification error:', emailError);
    }
    
    // Delete the moment entirely (as per requirements)
    await Moment.findByIdAndDelete(momentId);
    
    console.log(`❌ Mod ${req.authenticatedUser.email} rejected and deleted moment ${momentId}: ${reason}`);
    
    res.json({ 
      success: true, 
      message: 'Moment rejected and deleted',
      reason: reason || 'No reason provided'
    });
  } catch (error) {
    console.error('❌ Moment rejection error:', error);
    res.status(500).json({ error: 'Failed to reject moment' });
  }
});

// Mod/Admin: Send moment back for review with suggested changes
app.put('/moderation/moments/:momentId/send-back', authenticateToken, requireMod, async (req, res) => {
  try {
    const { momentId } = req.params;
    const { moderatorNote, ...suggestedMetadata } = req.body;
    
    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }
    
    // Apply moderator's changes directly to the moment and mark as needs revision
    const updateFields = {
      approvalStatus: 'needs_revision',
      rejectionReason: moderatorNote || 'Your moment has been updated by a moderator. Please review the changes and resubmit if you agree.',
      reviewedBy: req.authenticatedUser._id,
      reviewedAt: new Date(),
      userApprovedChanges: false
    };
    
    // Apply all metadata changes directly to the moment
    Object.keys(suggestedMetadata).forEach(key => {
      if (suggestedMetadata[key] !== undefined) {
        updateFields[key] = suggestedMetadata[key];
      }
    });
    
    const updatedMoment = await Moment.findByIdAndUpdate(
      momentId,
      updateFields,
      { new: true }
    );
    
    console.log(`📤 Mod ${req.authenticatedUser.email} applied changes and sent moment ${momentId} back for review`);
    
    // 📧 Send needs revision email to user
    try {
      const momentWithUser = await Moment.findById(momentId).populate('user');
      await emailService.sendMomentNeedsRevision(momentWithUser, momentWithUser.user, moderatorNote, suggestedMetadata);
    } catch (emailError) {
      console.error('📧 Email notification error:', emailError);
    }
    
    res.json({ 
      success: true, 
      message: 'Changes applied and moment sent back for review',
      moment: {
        id: updatedMoment._id,
        status: updatedMoment.approvalStatus,
        moderatorNote: moderatorNote,
        appliedChanges: suggestedMetadata
      }
    });
  } catch (error) {
    console.error('❌ Send back for review error:', error);
    res.status(500).json({ error: 'Failed to send back for review' });
  }
});

// User: Get my moments with approval status
app.get('/moments/my-status', authenticateToken, async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    
    let query = { user: req.user.id };
    if (status !== 'all') {
      query.approvalStatus = status;
    }
    
    const moments = await Moment.find(query)
      .sort({ createdAt: -1 })
      .populate('reviewedBy', 'email displayName');
      
    res.json({ moments });
  } catch (error) {
    console.error('❌ User moments status fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch moment status' });
  }
});

// =============================================================================
// FILE UPLOAD ENDPOINTS
// =============================================================================

app.post('/upload-file', uploadLimiter, authenticateToken, (req, res, next) => {
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

// Update moment description (for pending moments only)
app.put('/moments/:momentId/description', authenticateToken, async (req, res) => {
  try {
    const { momentId } = req.params;
    const { momentDescription } = req.body;
    const userId = req.user.id;
    
    // Find the moment and verify ownership
    const moment = await Moment.findOne({ _id: momentId, user: userId });
    
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found or not owned by user' });
    }
    
    // Only allow editing pending or needs_revision moments
    if (moment.approvalStatus !== 'pending' && moment.approvalStatus !== 'needs_revision') {
      return res.status(403).json({ error: 'Can only edit pending or needs revision moments' });
    }
    
    // Update the description
    moment.momentDescription = momentDescription;
    await moment.save();
    
    console.log(`✏️ User ${userId} updated description for moment ${momentId}`);
    res.json({ success: true, message: 'Description updated' });
    
  } catch (error) {
    console.error('❌ Update moment description error:', error);
    res.status(500).json({ error: 'Failed to update description' });
  }
});

// Update moment metadata (for pending moments only)
app.put('/moments/:momentId/metadata', authenticateToken, async (req, res) => {
  try {
    const { momentId } = req.params;
    const metadata = req.body;
    const userId = req.user.id;
    
    // Find the moment and verify ownership
    const moment = await Moment.findOne({ _id: momentId, user: userId });
    
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found or not owned by user' });
    }
    
    // Only allow editing pending or needs_revision moments
    if (moment.approvalStatus !== 'pending' && moment.approvalStatus !== 'needs_revision') {
      return res.status(403).json({ error: 'Can only edit pending or needs revision moments' });
    }
    
    // Update allowed metadata fields
    const allowedFields = [
      'momentDescription', 'personalNote', 'emotionalTags', 'specialOccasion',
      'audioQuality', 'videoQuality', 'instruments', 'guestAppearances',
      'crowdReaction', 'uniqueElements'
    ];
    
    allowedFields.forEach(field => {
      if (metadata[field] !== undefined) {
        // Convert arrays back to comma-separated strings for array-like fields
        if (['emotionalTags', 'instruments', 'guestAppearances', 'uniqueElements'].includes(field) && Array.isArray(metadata[field])) {
          moment[field] = metadata[field].join(', ');
        } else {
          moment[field] = metadata[field];
        }
      }
    });
    
    // If moment was needs_revision, change it back to pending for re-review
    const wasNeedsRevision = moment.approvalStatus === 'needs_revision';
    const previousFeedback = moment.rejectionReason;
    
    if (wasNeedsRevision) {
      moment.approvalStatus = 'pending';
      moment.rejectionReason = null; // Clear the moderator feedback
      moment.reviewedBy = null;
      moment.reviewedAt = null;
      moment.userApprovedChanges = false;
    }
    
    await moment.save();
    
    // 📧 Send email notifications for resubmission
    if (wasNeedsRevision) {
      try {
        const momentWithUser = await Moment.findById(momentId).populate('user');
        
        // Notify user of resubmission
        await emailService.sendMomentResubmitted(momentWithUser, momentWithUser.user);
        
        // Notify moderators of resubmission
        const moderatorEmails = await emailService.getModeratorEmails();
        await emailService.sendMomentResubmittedForMod(momentWithUser, momentWithUser.user, moderatorEmails, previousFeedback);
      } catch (emailError) {
        console.error('📧 Email notification error:', emailError);
      }
    }
    
    console.log(`✏️ User ${userId} updated metadata for moment ${momentId}`);
    res.json({ success: true, message: 'Metadata updated' });
    
  } catch (error) {
    console.error('❌ Update moment metadata error:', error);
    res.status(500).json({ error: 'Failed to update metadata' });
  }
});

// Delete moment (withdraw submission)
app.delete('/moments/:momentId', authenticateToken, async (req, res) => {
  try {
    const { momentId } = req.params;
    const userId = req.user.id;
    
    // Find the moment and verify ownership
    const moment = await Moment.findOne({ _id: momentId, user: userId });
    
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found or not owned by user' });
    }
    
    // Only allow deleting pending or rejected moments
    if (moment.approvalStatus === 'approved') {
      return res.status(403).json({ error: 'Cannot delete approved moments' });
    }
    
    // Delete the moment
    await Moment.findByIdAndDelete(momentId);
    
    console.log(`🗑️ User ${userId} withdrew moment ${momentId} (${moment.approvalStatus})`);
    res.json({ success: true, message: 'Moment deleted successfully' });
    
  } catch (error) {
    console.error('❌ Delete moment error:', error);
    res.status(500).json({ error: 'Failed to delete moment' });
  }
});

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
    
    // 📧 Send notification to moderators about new moment for review
    try {
      const moderatorEmails = await emailService.getModeratorEmails();
      await emailService.sendNewMomentForReview(moment, moment.user, moderatorEmails);
    } catch (emailError) {
      console.error('📧 Email notification error:', emailError);
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
    // Only show approved moments to the public
    const moments = await Moment.find({ approvalStatus: 'approved' })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('user', 'displayName');

    // Transform moments to include virtual fields
    const momentsWithVirtuals = moments.map(moment => {
      const momentObj = moment.toObject({ virtuals: true });
      return momentObj;
    });

    console.log(`🌍 Returning ${moments.length} moments in global feed`);
    res.json({ moments: momentsWithVirtuals });
  } catch (err) {

    console.error('❌ Fetch all moments error:', err);
    res.status(500).json({ error: 'Failed to fetch moments' });
  }
});

// Notifications API - Get notification counts for badges
app.get('/notifications/counts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const userEmail = req.user.email;
    const isModOrAdmin = userRole === 'admin' || userRole === 'mod' || userEmail === 'solo@solo.solo' || userEmail === 'solo2@solo.solo';
    
    let notifications = {
      pendingApproval: 0,  // Blue dot for users
      needsRevision: 0,    // Red dot for users  
      pendingReview: 0     // Red dot for admins/mods
    };

    if (isModOrAdmin) {
      // For admins/mods: count all moments pending review from any user
      const pendingCount = await Moment.countDocuments({ 
        approvalStatus: 'pending' 
      });
      notifications.pendingReview = pendingCount;
    } else {
      // For regular users: count their own moments by status
      const userPendingCount = await Moment.countDocuments({ 
        user: userId, 
        approvalStatus: 'pending' 
      });
      
      const userRevisionCount = await Moment.countDocuments({ 
        user: userId, 
        approvalStatus: 'needs_revision' 
      });
      
      notifications.pendingApproval = userPendingCount;
      notifications.needsRevision = userRevisionCount;
      
      console.log('📊 User notifications:', {
        userId,
        userEmail: req.user.email,
        pendingApproval: userPendingCount,
        needsRevision: userRevisionCount
      });
    }

    res.json(notifications);
  } catch (err) {
    console.error('❌ Get notifications error:', err);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

app.get('/moments/:momentId', async (req, res) => {
  try {
    const { momentId } = req.params;
    const moment = await Moment.findById(momentId).populate('user', 'displayName');
    
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }
    
    // Recalculate mint count from history if it seems incorrect
    if (moment.nftMintHistory && moment.nftMintHistory.length > 0) {
      const calculatedCount = moment.nftMintHistory.reduce((total, mint) => total + (mint.quantity || 1), 0);
      if (calculatedCount !== moment.nftMintedCount) {
        console.log(`🔧 Fixing mint count for ${momentId}: ${moment.nftMintedCount} -> ${calculatedCount}`);
        moment.nftMintedCount = calculatedCount;
        await moment.save();
      }
    }
    
    res.json(moment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/moments/performance/:performanceId', async (req, res) => {
  try {
    const { performanceId } = req.params;
    
    const moments = await Moment.find({ 
      performanceId,
      approvalStatus: 'approved'
    })
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
// Add this endpoint to your server.js file, around line 800 where your other moment endpoints are:

app.get('/moments/song/:songName', async (req, res) => {
  try {
    const { songName } = req.params;
    const decodedSongName = decodeURIComponent(songName);
    
    console.log(`🎵 Fetching moments for song: "${decodedSongName}"`);
    
    const moments = await Moment.find({ 
      songName: decodedSongName,
      approvalStatus: 'approved'
    })
    .sort({ createdAt: -1 })
    .populate('user', 'displayName');
    
    console.log(`✅ Found ${moments.length} moments for "${decodedSongName}"`);
    
    res.json({ 
      moments,
      songName: decodedSongName,
      count: moments.length
    });
    
  } catch (err) {
    console.error(`❌ Error fetching moments for song:`, err);
    res.status(500).json({ 
      error: 'Failed to fetch song moments',
      details: err.message 
    });
  }
});
// =============================================================================
// RARITY RECALCULATION ENDPOINT
// =============================================================================
app.post('/admin/recalculate-rarity', async (req, res) => {
  try {
    console.log('🎯 Starting SIMPLIFIED rarity recalculation for all moments...');
    
    await umoCache.loadCache();
    
    const allMoments = await Moment.find({});
    console.log(`📊 Found ${allMoments.length} moments to recalculate`);
    
    let updated = 0;
    let errors = 0;
    let nonSongCount = 0;
    
    const tierCounts = {
      legendary: 0,
      mythic: 0,
      epic: 0,
      rare: 0,
      uncommon: 0,
      common: 0,
      basic: 0
    };
    
    for (const moment of allMoments) {
      try {
        const rarityData = await calculateRarityScore(moment, umoCache);


        
        if (rarityData.scoreBreakdown?.isNonSong) {
          nonSongCount++;
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
        
        if (updated % 10 === 0) {
          console.log(`   📊 Progress: ${updated}/${allMoments.length} completed`);
        }
        
      } catch (err) {
        console.error(`❌ Error updating moment ${moment._id}:`, err);
        errors++;
      }
    }
    
    console.log(`🎯 SIMPLIFIED rarity recalculation complete:`);
    console.log(`   📊 Total processed: ${allMoments.length}`);
    console.log(`   ✅ Successfully updated: ${updated}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   🎭 Non-song content: ${nonSongCount}`);
    console.log(`   🏆 7-Tier distribution:`, tierCounts);
    
    res.json({
      success: true,
      message: `Simplified 4-factor recalculation complete: ${updated} moments updated`,
      system: 'simplified-4-factor',
      statistics: {
        totalProcessed: allMoments.length,
        successfulUpdates: updated,
        errors: errors,
        nonSongContent: nonSongCount,
        tierDistribution: tierCounts
      }
    });
    
  } catch (error) {
    console.error('❌ Simplified rarity recalculation failed:', error);
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
        const API_BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : `http://localhost:${PORT}`;
        const hasNewShows = await umoCache.checkForNewShows(API_BASE_URL, umoCache.cache.stats.totalPerformances);
        if (!hasNewShows) {
          console.log('✅ No new shows detected, using existing cache');
          return;
        }
      }
      
      const API_BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : `http://localhost:${PORT}`;
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
      const API_BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : `http://localhost:${PORT}`;
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