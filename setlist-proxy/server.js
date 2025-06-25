const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const User = require('./models/User');
const Moment = require('./models/Moment');
const { UMOCache } = require('./utils/umoCache');

const app = express();
const PORT = 5050;

// Initialize UMO cache
const umoCache = new UMOCache();

// Enhanced CORS setup for file uploads
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization',
    'Accept',
    'Cache-Control',
    'Pragma'
  ]
}));

app.use(express.json({ limit: '6gb' }));
app.use(express.urlencoded({ limit: '6gb', extended: true }));

// Enhanced multer configuration for large files
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

// JWT token helpers
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

// =============================================================================
// CACHE ENDPOINTS
// =============================================================================

// Cache management endpoints
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
    
    // Start refresh in background
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

// Cached data endpoints
app.get('/cached/performances', async (req, res) => {
  try {
    const { page = 1, limit = 20, city } = req.query;
    
    let performances;
    
    if (city) {
      performances = await umoCache.searchPerformancesByCity(city);
      console.log(`🔍 City search "${city}": ${performances.length} results`);
    } else {
      performances = await umoCache.getPerformances();
    }
    
    // Handle pagination
    const startIndex = (page - 1) * limit;
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
    
    // Apply sorting
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

app.get('/cached/song/:songName', async (req, res) => {
  try {
    const { songName } = req.params;
    const songDatabase = await umoCache.getSongDatabase();
    
    const song = songDatabase[songName];
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    res.json({
      song,
      fromCache: true,
      lastUpdated: umoCache.cache?.lastUpdated
    });
    
  } catch (err) {
    console.error('❌ Error fetching cached song:', err);
    res.status(500).json({ error: 'Failed to fetch song' });
  }
});

app.get('/cached/performance/:performanceId', async (req, res) => {
  try {
    const { performanceId } = req.params;
    const performances = await umoCache.getPerformances();
    
    const performance = performances.find(p => p.id === performanceId);
    if (!performance) {
      return res.status(404).json({ error: 'Performance not found' });
    }
    
    res.json({
      performance,
      fromCache: true,
      lastUpdated: umoCache.cache?.lastUpdated
    });
    
  } catch (err) {
    console.error('❌ Error fetching cached performance:', err);
    res.status(500).json({ error: 'Failed to fetch performance' });
  }
});

app.get('/cached/search-indexes', async (req, res) => {
  try {
    const indexes = await umoCache.getSearchIndexes();
    const stats = await umoCache.getStats();
    
    res.json({
      indexes,
      stats,
      fromCache: true,
      lastUpdated: umoCache.cache?.lastUpdated
    });
    
  } catch (err) {
    console.error('❌ Error fetching search indexes:', err);
    res.status(500).json({ error: 'Failed to fetch search indexes' });
  }
});

// =============================================================================
// ORIGINAL SETLIST.FM PROXY (still available as fallback)
// =============================================================================

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
    logLevel: 'debug',
  })
);

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

app.get('/test-file/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const url = `https://gateway.irys.xyz/${fileId}`;
    
    console.log(`🔍 Testing file: ${url}`);
    
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    console.log(`📊 File info:`, {
      contentType,
      contentLength,
      status: response.status
    });
    
    res.json({
      success: true,
      fileId,
      url,
      contentType,
      contentLength,
      headers: Object.fromEntries(response.headers.entries())
    });
    
  } catch (err) {
    console.error('❌ Test file error:', err);
    res.status(500).json({ error: 'Failed to test file' });
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
    fileSize
  } = req.body;
  
  const userId = req.user.id;

  console.log('💾 Received moment upload request:', {
    performanceId,
    performanceDate,
    venueName,
    venueCity,
    songName,
    mediaUrl: fileUri || mediaUrl,
    userId
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
      fileSize
    });

    await moment.save();
    await moment.populate('user', 'email displayName');
    
    console.log('✅ Moment saved successfully:', moment._id);
    
    res.json({ success: true, moment });
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

app.get('/moments/song/:songName', async (req, res) => {
  try {
    const { songName } = req.params;
    
    const moments = await Moment.find({ 
      songName: { $regex: new RegExp(songName, 'i') }
    })
      .sort({ createdAt: -1 })
      .populate('user', 'displayName');
    
    console.log(`🎵 Found ${moments.length} moments for song "${songName}"`);
    res.json({ moments });
  } catch (err) {
    console.error('❌ Fetch song moments error:', err);
    res.status(500).json({ error: 'Failed to fetch song moments' });
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

app.get('/moments/venue/:venueName', async (req, res) => {
  try {
    const { venueName } = req.params;
    
    const moments = await Moment.find({ 
      venueName: { $regex: new RegExp(venueName, 'i') } 
    })
      .sort({ createdAt: -1 })
      .populate('user', 'displayName');
    
    console.log(`🏟️ Found ${moments.length} moments for venue "${venueName}"`);
    res.json({ moments });
  } catch (err) {
    console.error('❌ Fetch venue moments error:', err);
    res.status(500).json({ error: 'Failed to fetch venue moments' });
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
// ERROR HANDLING & STARTUP
// =============================================================================

// Error handling middleware
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

// Catch-all route for undefined endpoints
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening at http://0.0.0.0:${PORT}`);
  console.log(`📱 Mobile access: http://192.168.1.170:${PORT}`);
  console.log(`💻 Local access: http://localhost:${PORT}`);
  
  // Initialize cache after server starts
  initializeCache();
  scheduleDailyRefresh();
});