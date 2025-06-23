const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const User = require('./models/User');
const Moment = require('./models/Moment');

const app = express();
const PORT = 5050;

app.use(cors({
  origin: function(origin, callback) {
    // Allow localhost and any local network IP (192.168.x.x, 10.x.x.x, etc.)
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '6gb' })); // Increase JSON limit to 6GB
app.use(express.urlencoded({ limit: '6gb', extended: true })); // Add URL encoded limit

// Enhanced multer configuration for large files (up to 6GB for Zora compatibility)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 6 * 1024 * 1024 * 1024, // 6GB limit to match Zora
    fieldSize: 6 * 1024 * 1024 * 1024, // 6GB field size
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
    
    // Check file size early if possible
    const maxSize = 6 * 1024 * 1024 * 1024; // 6GB
    if (file.size && file.size > maxSize) {
      console.error(`❌ File too large: ${(file.size / 1024 / 1024 / 1024).toFixed(2)}GB exceeds 6GB limit`);
      return cb(new Error('File exceeds 6GB limit'), false);
    }
    
    // Accept all file types but log them
    cb(null, true);
  }
});

// Import your uploaders
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

// Setlist.fm proxy
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

// Auth: Register
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

// Auth: Login
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

// Enhanced file upload endpoint with better debugging and large file handling
app.post('/upload-file', authenticateToken, (req, res, next) => {
  // Add timeout for large file uploads (30 minutes)
  req.setTimeout(30 * 60 * 1000); // 30 minutes
  res.setTimeout(30 * 60 * 1000); // 30 minutes
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

    // Check if file is too large for memory
    if (req.file.size > 6 * 1024 * 1024 * 1024) {
      console.error(`❌ File too large: ${fileSizeGB}GB exceeds 6GB limit`);
      return res.status(413).json({ 
        error: 'File too large', 
        details: `File size ${fileSizeGB}GB exceeds 6GB limit` 
      });
    }

    // Validate the buffer before upload
    if (!validateBuffer(req.file.buffer, req.file.originalname)) {
      console.error('❌ Buffer validation failed');
      return res.status(400).json({ error: 'Invalid file buffer' });
    }

    console.log(`🚀 Starting upload process for ${fileSizeGB}GB file...`);
    
    // Use hybrid upload strategy that handles both small and large files efficiently
    let uri;
    try {
      console.log('📤 Using hybrid upload strategy...');
      const result = await uploadFileToIrys(req.file.buffer, req.file.originalname);
      uri = result.url;
      
      console.log('✅ Hybrid upload successful:', uri);
    } catch (uploadError) {
      console.error('❌ Hybrid upload failed:', uploadError);
      
      // Fallback to Irys for smaller files only
      if (req.file.size < 500 * 1024 * 1024) { // Less than 500MB
        console.log('📤 Falling back to Irys upload for smaller file...');
        try {
          const result = await uploadFileToIrys(req.file.buffer, req.file.originalname);
          uri = result.url;
          console.log('✅ Irys fallback upload successful:', uri);
        } catch (irysError) {
          console.error('❌ Irys fallback also failed:', irysError);
          throw uploadError; // Throw original error
        }
      } else {
        throw uploadError;
      }
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
    
    // Provide more specific error messages
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

// Test endpoint to check uploaded file
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

// Upload moment (record metadata + media URI)
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
    
    // Populate user data for response
    await moment.populate('user', 'email displayName');
    
    console.log('✅ Moment saved successfully:', moment._id);
    
    res.json({ success: true, moment });
  } catch (err) {
    console.error('❌ Upload moment error:', err);
    res.status(500).json({ error: 'Moment upload failed', details: err.message });
  }
});

// ===== UPDATED MOMENTS ENDPOINTS =====

// Get user's own moments (private)
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

// Get ALL moments (public feed) - MAIN ENDPOINT FOR YOUR APP
app.get('/moments', async (req, res) => {
  try {
    const moments = await Moment.find({})
      .sort({ createdAt: -1 })
      .limit(100) // Limit to latest 100 moments
      .populate('user', 'displayName'); // Only show display name for privacy

    console.log(`🌍 Returning ${moments.length} moments in global feed`);
    res.json({ moments });
  } catch (err) {
    console.error('❌ Fetch all moments error:', err);
    res.status(500).json({ error: 'Failed to fetch moments' });
  }
});

// Get ALL moments for a specific song across all performances
app.get('/moments/song/:songName', async (req, res) => {
  try {
    const { songName } = req.params;
    
    const moments = await Moment.find({ 
      songName: { $regex: new RegExp(songName, 'i') } // Case-insensitive search
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

// Get ALL moments for a specific performance
app.get('/moments/performance/:performanceId', async (req, res) => {
  try {
    const { performanceId } = req.params;
    
    const moments = await Moment.find({ performanceId })
      .sort({ songPosition: 1, createdAt: -1 }) // Sort by song position, then by upload time
      .populate('user', 'displayName');
    
    console.log(`🎪 Found ${moments.length} moments for performance ${performanceId}`);
    res.json({ moments });
  } catch (err) {
    console.error('❌ Fetch performance moments error:', err);
    res.status(500).json({ error: 'Failed to fetch performance moments' });
  }
});

// Search moments by venue
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

// Update moment metadata (only by owner) - NEW ENDPOINT!
app.put('/moments/:momentId', authenticateToken, async (req, res) => {
  try {
    const momentId = req.params.momentId;
    const userId = req.user.id;

    console.log('🔧 Update request received:', { momentId, userId, body: req.body });

    // Find the moment and check ownership
    const moment = await Moment.findById(momentId);
    if (!moment) {
      console.error('❌ Moment not found:', momentId);
      return res.status(404).json({ error: 'Moment not found' });
    }

    // Check if user owns this moment
    if (moment.user.toString() !== userId) {
      console.error('❌ Not authorized:', { momentOwner: moment.user.toString(), requestUser: userId });
      return res.status(403).json({ error: 'Not authorized to edit this moment' });
    }

    // Update the moment with new data
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening at http://0.0.0.0:${PORT}`);
  console.log(`📱 Mobile access: http://192.168.1.170:${PORT}`);
  console.log(`💻 Local access: http://localhost:${PORT}`);
});