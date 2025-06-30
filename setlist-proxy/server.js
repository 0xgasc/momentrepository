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

// ✅ GLOBAL METADATA STORAGE (in production, use database)
global.metadataStorage = global.metadataStorage || {};

// Enhanced CORS setup for file uploads
app.use(cors({
  origin: '*', // Allow all origins for testing
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*']
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
// ✅ NEW: Token ID Counter Schema (add to your models or include inline)
const tokenIdCounterSchema = new mongoose.Schema({
  _id: { type: String, default: 'tokenIdCounter' },
  currentId: { type: Number, default: 0 }
});

const TokenIdCounter = mongoose.model('TokenIdCounter', tokenIdCounterSchema);
// ===================================================================
// ✅ NEW: Non-song content detection (add near top of file)
// ===================================================================

const NON_SONG_PATTERNS = [
  /^intro$/i,
  /^outro$/i, 
  /^soundcheck$/i,
  /^tuning$/i,
  /^banter$/i,
  /^crowd$/i,
  /^applause$/i,
  /^announcement$/i,
  /^speech$/i,
  /^talk$/i,
  /.*\s+intro$/i,  // "Show Intro", "Set Intro"
  /.*\s+outro$/i,  // "Show Outro", "Set Outro"
  /^warm.?up$/i,   // "Warmup", "Warm-up"
  /^encore\s+intro$/i,
  /^mic\s+check$/i,
  /^between\s+songs$/i
];

const isNonSongContent = (songName, momentType = null) => {
  if (!songName || typeof songName !== 'string') return false;
  
  // Check song name patterns
  const nameIsNonSong = NON_SONG_PATTERNS.some(pattern => pattern.test(songName.trim()));
  
  // Check moment type
  const typeIsNonSong = momentType && ['intro', 'outro', 'banter', 'soundcheck', 'crowd', 'announcement'].includes(momentType);
  
  return nameIsNonSong || typeIsNonSong;
};

// ✅ NEW: Get next available token ID for ERC1155
app.get('/get-next-token-id', async (req, res) => {
  try {
    console.log('🔢 Getting next token ID for ERC1155...');
    
    // Get and increment the counter atomically
    const counter = await TokenIdCounter.findByIdAndUpdate(
      'tokenIdCounter',
      { $inc: { currentId: 1 } },
      { 
        upsert: true, // Create if doesn't exist
        new: true,    // Return updated document
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

// ✅ NEW: Get current token ID without incrementing (for checking)
app.get('/current-token-id', async (req, res) => {
  try {
    const counter = await TokenIdCounter.findById('tokenIdCounter');
    const currentId = counter ? counter.currentId : 0;
    
    res.json({ 
      currentTokenId: currentId,
      nextTokenId: currentId + 1,
      success: true 
    });
    
  } catch (error) {
    console.error('❌ Error getting current token ID:', error);
    res.status(500).json({ 
      error: 'Failed to get current token ID',
      details: error.message 
    });
  }
});

// =============================================================================
// ✅ ENHANCED NFT EDITION ENDPOINTS WITH METADATA & CLEANUP
// =============================================================================

// ✅ NEW: Upload metadata to server (better than data URIs for OpenSea)
app.post('/upload-metadata', authenticateToken, async (req, res) => {
  try {
    const metadata = req.body;
    console.log('📄 Uploading NFT metadata to server...');
    
    // Validate metadata
    if (!metadata.name || !metadata.image) {
      return res.status(400).json({ error: 'Invalid metadata: name and image required' });
    }

    // Generate unique metadata ID
    const metadataId = `metadata-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const metadataUri = `${req.protocol}://${req.get('host')}/metadata/${metadataId}`;
    
    // Store metadata (in production, save to database)
    global.metadataStorage[metadataId] = {
      ...metadata,
      storedAt: new Date().toISOString()
    };
    
    console.log('✅ Metadata stored with URI:', metadataUri);
    console.log('📋 Metadata preview:', {
      name: metadata.name,
      attributeCount: metadata.attributes?.length || 0,
      hasImage: !!metadata.image,
      hasAnimation: !!metadata.animation_url
    });
    
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

// ✅ NEW: Serve metadata with proper headers for OpenSea
app.get('/metadata/:metadataId', (req, res) => {
  try {
    const { metadataId } = req.params;
    
    // Set proper headers for OpenSea compatibility
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
    });
    
    const metadata = global.metadataStorage?.[metadataId];
    
    if (!metadata) {
      console.error(`❌ Metadata not found: ${metadataId}`);
      return res.status(404).json({ 
        error: 'Metadata not found',
        metadataId: metadataId
      });
    }
    
    console.log(`📋 Serving metadata for ${metadataId}:`, {
      name: metadata.name,
      hasImage: !!metadata.image,
      hasAnimation: !!metadata.animation_url,
      attributeCount: metadata.attributes?.length || 0
    });
    
    // Remove internal fields before sending
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

// ✅ UPDATED: Create NFT Edition endpoint for ERC1155
app.post('/moments/:momentId/create-nft-edition', authenticateToken, async (req, res) => {
  try {
    const { momentId } = req.params;
    const userId = req.user.id;
    const {
      nftContractAddress,
      nftTokenId,        // ✅ Now expects numeric value
      nftMetadataHash,
      splitsContract,
      mintPrice,
      mintDuration,
      txHash
    } = req.body;

    console.log(`🎯 Creating ERC1155 NFT edition for moment ${momentId} by user ${userId}`);

    // Find the moment and verify ownership
    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }

    // Verify the user owns this moment
    if (moment.user.toString() !== userId) {
      console.error(`❌ User ${userId} doesn't own moment ${momentId} (owned by ${moment.user})`);
      return res.status(403).json({ error: 'Not authorized to create NFT for this moment' });
    }

    // Check if NFT edition already exists
    if (moment.nftMinted || moment.nftContractAddress) {
      return res.status(400).json({ error: 'NFT edition already exists for this moment' });
    }

    // ✅ UPDATED: Store numeric token ID for ERC1155
    const updatedMoment = await Moment.findByIdAndUpdate(
      momentId,
      {
        $set: {
          nftMinted: true,
          nftTokenId: parseInt(nftTokenId), // ✅ Store as number
          nftContractAddress: nftContractAddress,
          nftMetadataHash: nftMetadataHash,
          nftSplitsContract: splitsContract,
          nftMintPrice: mintPrice,
          nftMintDuration: mintDuration,
          nftMintStartTime: new Date(),
          nftMintEndTime: new Date(Date.now() + (mintDuration * 1000)),
          nftCreationTxHash: txHash,
          nftMintedCount: 0 // Start with 0 mints
        }
      },
      { new: true }
    ).populate('user', 'displayName email');

    console.log(`✅ ERC1155 NFT edition created for moment "${updatedMoment.songName}" with token ID ${nftTokenId}`);

    res.json({
      success: true,
      moment: updatedMoment,
      tokenId: parseInt(nftTokenId),
      message: 'ERC1155 NFT edition created successfully'
    });

  } catch (err) {
    console.error('❌ Create ERC1155 NFT edition error:', err);
    res.status(500).json({ 
      error: 'Failed to create NFT edition', 
      details: err.message 
    });
  }
});
// ✅ BACKEND PROXY: Create NFT Edition using dev wallet on behalf of users
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

    // Find the moment and verify ownership
    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }

    // Verify the user owns this moment
    if (moment.user.toString() !== userId) {
      console.error(`❌ User ${userId} doesn't own moment ${momentId} (owned by ${moment.user})`);
      return res.status(403).json({ error: 'Not authorized to create NFT for this moment' });
    }

    // Check if NFT edition already exists
    if (moment.nftMinted || moment.nftContractAddress) {
      return res.status(400).json({ error: 'NFT edition already exists for this moment' });
    }

    // ✅ USE DEV WALLET to create edition on behalf of user
    console.log('🔧 Using dev wallet to create NFT edition on behalf of user...');
    
    // Setup ethers with dev wallet
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
    const devWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Import contract ABI (you already have this)
    const UMOMomentsERC1155Contract = require('../src/contracts/UMOMomentsERC1155.json');
    const contract = new ethers.Contract(
      UMOMomentsERC1155Contract.address,
      UMOMomentsERC1155Contract.abi,
      devWallet
    );

    // Prepare transaction parameters
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

    // ✅ CREATE EDITION using dev wallet
    const transaction = await contract.createMomentEdition(
      moment._id.toString(),        // momentId (database ID)      
      nftMetadataHash,              // metadataURI
      mintPriceWei,                 // mintPrice
      mintDurationSeconds,          // mintDuration
      0,                            // maxSupply (unlimited)
      mockSplitsAddress,            // splitsContract
      rarityScore                   // rarity
    );

    console.log('✅ Proxy transaction submitted:', transaction.hash);
console.log('🔍 Debug ENV vars:', {
  hasPrivateKey: !!process.env.PRIVATE_KEY,
  hasRPC: !!process.env.SEPOLIA_RPC,
  privateKeyLength: process.env.PRIVATE_KEY?.length
});
    // Wait for confirmation
    const receipt = await transaction.wait();
    console.log('✅ Proxy transaction confirmed in block:', receipt.blockNumber);

    // ✅ Get the token ID from the event logs
    const eventFilter = contract.filters.MomentEditionCreated();
    const events = await contract.queryFilter(eventFilter, receipt.blockNumber, receipt.blockNumber);
    const tokenId = events.length > 0 ? events[0].args.tokenId : null;

    console.log('✅ New token ID created via proxy:', tokenId?.toString());

    // ✅ UPDATE DATABASE with new NFT data
    const updatedMoment = await Moment.findByIdAndUpdate(
      momentId,
      {
        $set: {
          nftMinted: true,
          nftTokenId: parseInt(tokenId?.toString() || 0), // Store as number
          nftContractAddress: UMOMomentsERC1155Contract.address,
          nftMetadataHash: nftMetadataHash,
          nftSplitsContract: mockSplitsAddress,
          nftMintPrice: mintPrice,
          nftMintDuration: mintDuration,
          nftMintStartTime: new Date(),
          nftMintEndTime: new Date(Date.now() + (mintDuration * 24 * 60 * 60 * 1000)),
          nftCreationTxHash: transaction.hash,
          nftMintedCount: 0 // Start with 0 mints
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

console.log('🎯 Backend Proxy endpoint for NFT creation added to server');

// Debug endpoint to check first moments for a song
app.get('/debug/first-moments/:songName', async (req, res) => {
  try {
    const { songName } = req.params;
    
    console.log(`🔍 Checking first moments for "${songName}"`);
    
    // Get all moments for this song, sorted by creation date
    const allMomentsForSong = await Moment.find({ 
      songName: { $regex: new RegExp(`^${songName}$`, 'i') } // Case insensitive exact match
    }).sort({ createdAt: 1, _id: 1 }); // Use _id as tiebreaker
    
    const results = allMomentsForSong.map((moment, index) => ({
      id: moment._id,
      songName: moment.songName,
      venueName: moment.venueName,
      createdAt: moment.createdAt,
      timestamp: moment.createdAt.getTime(),
      isFirstMomentForSong: moment.isFirstMomentForSong,
      shouldBeFirst: index === 0,
      position: index + 1,
      uploader: moment.user
    }));
    
    res.json({
      songName,
      totalMoments: allMomentsForSong.length,
      actualFirst: results[0],
      allMoments: results,
      issuesFound: results.filter(m => m.isFirstMomentForSong !== m.shouldBeFirst)
    });
    
  } catch (error) {
    console.error('❌ Debug first moments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ 2. FIX ALL FIRST MOMENT FLAGS FOR A SPECIFIC SONG
app.post('/debug/fix-first-moments/:songName', async (req, res) => {
  try {
    const { songName } = req.params;
    
    console.log(`🔧 Fixing first moment flags for "${songName}"`);
    
    // Get all moments for this song, sorted by creation date
    const allMomentsForSong = await Moment.find({ 
      songName: { $regex: new RegExp(`^${songName}$`, 'i') }
    }).sort({ createdAt: 1, _id: 1 });
    
    if (allMomentsForSong.length === 0) {
      return res.json({ error: 'No moments found for this song' });
    }
    
    const firstMomentId = allMomentsForSong[0]._id;
    let updated = 0;
    
    // Update all moments for this song
    for (const moment of allMomentsForSong) {
      const isFirst = moment._id.toString() === firstMomentId.toString();
      
      if (moment.isFirstMomentForSong !== isFirst) {
        await Moment.updateOne(
          { _id: moment._id },
          { $set: { isFirstMomentForSong: isFirst } }
        );
        updated++;
        console.log(`✅ Updated ${moment._id}: isFirst = ${isFirst}`);
      }
    }
    
    res.json({
      success: true,
      songName,
      totalMoments: allMomentsForSong.length,
      momentsUpdated: updated,
      firstMomentId: firstMomentId,
      firstMomentDetails: {
        venueName: allMomentsForSong[0].venueName,
        createdAt: allMomentsForSong[0].createdAt,
        uploader: allMomentsForSong[0].user
      }
    });
    
  } catch (error) {
    console.error('❌ Fix first moments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ 3. FIX ALL SONGS AT ONCE
app.post('/debug/fix-all-first-moments', async (req, res) => {
  try {
    console.log('🔧 Fixing ALL first moment flags...');
    
    // Get all unique song names
    const uniqueSongs = await Moment.distinct('songName');
    console.log(`Found ${uniqueSongs.length} unique songs`);
    
    let totalUpdated = 0;
    const results = [];
    
    for (const songName of uniqueSongs) {
      // Get all moments for this song
      const allMomentsForSong = await Moment.find({ 
        songName: songName
      }).sort({ createdAt: 1, _id: 1 });
      
      if (allMomentsForSong.length === 0) continue;
      
      const firstMomentId = allMomentsForSong[0]._id;
      let songUpdated = 0;
      
      // Update all moments for this song
      for (const moment of allMomentsForSong) {
        const isFirst = moment._id.toString() === firstMomentId.toString();
        
        if (moment.isFirstMomentForSong !== isFirst) {
          await Moment.updateOne(
            { _id: moment._id },
            { $set: { isFirstMomentForSong: isFirst } }
          );
          songUpdated++;
          totalUpdated++;
        }
      }
      
      if (songUpdated > 0) {
        results.push({
          songName,
          momentsUpdated: songUpdated,
          totalMoments: allMomentsForSong.length,
          firstMomentVenue: allMomentsForSong[0].venueName,
          firstMomentDate: allMomentsForSong[0].createdAt
        });
        console.log(`✅ Fixed "${songName}": ${songUpdated} updates`);
      }
    }
    
    res.json({
      success: true,
      totalSongsProcessed: uniqueSongs.length,
      songsWithUpdates: results.length,
      totalMomentsUpdated: totalUpdated,
      results
    });
    
  } catch (error) {
    console.error('❌ Fix all first moments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ NEW: Migration script endpoint (run once to migrate existing moments)
app.post('/admin/migrate-to-erc1155', async (req, res) => {
  try {
    console.log('🔄 Starting migration from ERC721 to ERC1155...');
    
    // Find all moments that have NFTs but no numeric token ID
    const momentsToMigrate = await Moment.find({ 
      nftMinted: true,
      $or: [
        { nftTokenId: { $type: "string" } }, // Old string token IDs
        { nftTokenId: { $exists: false } }   // Missing token IDs
      ]
    });

    console.log(`📊 Found ${momentsToMigrate.length} moments to migrate`);

    let migrated = 0;
    const results = [];

    for (let i = 0; i < momentsToMigrate.length; i++) {
      const moment = momentsToMigrate[i];
      
      try {
        // Assign sequential token IDs starting from 0
        const newTokenId = i;
        
        await Moment.updateOne(
          { _id: moment._id },
          { 
            $set: { 
              nftTokenId: newTokenId,
              nftContractAddress: process.env.REACT_APP_UMO_MOMENTS_CONTRACT || moment.nftContractAddress
            } 
          }
        );

        results.push({
          momentId: moment._id,
          songName: moment.songName,
          oldTokenId: moment.nftTokenId,
          newTokenId: newTokenId
        });

        migrated++;
        console.log(`✅ Migrated "${moment.songName}": ${moment.nftTokenId} → ${newTokenId}`);
        
      } catch (err) {
        console.error(`❌ Failed to migrate moment ${moment._id}:`, err);
        results.push({
          momentId: moment._id,
          songName: moment.songName,
          error: err.message
        });
      }
    }

    // Set the token counter to continue from where we left off
    if (momentsToMigrate.length > 0) {
      await TokenIdCounter.findByIdAndUpdate(
        'tokenIdCounter',
        { currentId: momentsToMigrate.length },
        { upsert: true }
      );
    }

    console.log(`🎉 Migration complete: ${migrated}/${momentsToMigrate.length} moments migrated`);

    res.json({
      success: true,
      message: `Migration complete: ${migrated} moments migrated to ERC1155`,
      totalFound: momentsToMigrate.length,
      migrated: migrated,
      nextTokenId: momentsToMigrate.length,
      results: results
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      error: 'Migration failed',
      details: error.message
    });
  }
});

// ✅ NEW: Get ERC1155 stats
app.get('/admin/erc1155-stats', async (req, res) => {
  try {
    const totalMoments = await Moment.countDocuments({ nftMinted: true });
    const momentsWithNumericTokenId = await Moment.countDocuments({ 
      nftMinted: true,
      nftTokenId: { $type: "number" }
    });
    const momentsWithStringTokenId = await Moment.countDocuments({ 
      nftMinted: true,
      nftTokenId: { $type: "string" }
    });
    
    const counter = await TokenIdCounter.findById('tokenIdCounter');
    const currentTokenId = counter ? counter.currentId : 0;

    const topMintedMoments = await Moment.find({ nftMinted: true })
      .sort({ nftMintedCount: -1 })
      .limit(10)
      .select('songName venueName nftMintedCount nftTokenId');

    res.json({
      totalNFTMoments: totalMoments,
      migratedToERC1155: momentsWithNumericTokenId,
      stillERC721Format: momentsWithStringTokenId,
      migrationProgress: totalMoments > 0 ? Math.round((momentsWithNumericTokenId / totalMoments) * 100) : 0,
      currentTokenIdCounter: currentTokenId,
      topMintedMoments: topMintedMoments
    });

  } catch (error) {
    console.error('❌ Error getting ERC1155 stats:', error);
    res.status(500).json({
      error: 'Failed to get stats',
      details: error.message
    });
  }
});

console.log('🎯 ERC1155 backend endpoints added to server');

// Get NFT edition status for a moment

app.get('/moments/:momentId/nft-status', async (req, res) => {
  try {
    const { momentId } = req.params;
    
    const moment = await Moment.findById(momentId)
      .select('nftMinted nftTokenId nftContractAddress nftMintedCount nftMintStartTime nftMintEndTime nftMintPrice')
      .populate('user', 'displayName');

    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }

    // ✅ FIXED: Check for ERC1155 NFT edition
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
        tokenId: moment.nftTokenId, // ✅ This will be 0 for your Intro moment
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
// ADD THIS to your server.js
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
// ✅ FIXED: Record an NFT mint (called when someone mints)
app.post('/moments/:momentId/record-mint', authenticateToken, async (req, res) => {
  try {
    const { momentId } = req.params;
    const { quantity = 1, minterAddress, txHash } = req.body;

    console.log(`🎯 Recording ${quantity} NFT mint(s) for moment ${momentId}`);

    // Validate required fields
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

    // ✅ FIXED: Check if this transaction hash was already recorded
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

    // ✅ FIXED: Use findOneAndUpdate with atomic operations to prevent race conditions
    const updatedMoment = await Moment.findOneAndUpdate(
      { 
        _id: momentId,
        // Double-check that this txHash doesn't exist (race condition protection)
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

    // If no document was updated, it means the txHash already exists
    if (!updatedMoment) {
      console.log(`⚠️ Transaction ${txHash} was already recorded by another request`);
      
      // Get the current moment to return accurate count
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

// ✅ NEW: Clean up duplicate mint entries for a specific moment
app.post('/admin/cleanup-duplicate-mints/:momentId', async (req, res) => {
  try {
    const { momentId } = req.params;
    
    console.log(`🧹 Cleaning up duplicate mints for moment ${momentId}`);
    
    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }

    if (!moment.nftMintHistory || moment.nftMintHistory.length === 0) {
      return res.json({
        success: true,
        message: 'No mint history to clean up',
        cleanedCount: 0
      });
    }

    // Find duplicates by transaction hash
    const txHashCounts = {};
    const duplicates = [];
    const uniqueMints = [];

    moment.nftMintHistory.forEach((mint, index) => {
      if (!mint.txHash) {
        uniqueMints.push(mint);
        return;
      }

      if (txHashCounts[mint.txHash]) {
        // This is a duplicate
        duplicates.push({
          index,
          txHash: mint.txHash,
          quantity: mint.quantity,
          mintedAt: mint.mintedAt
        });
      } else {
        // First occurrence
        txHashCounts[mint.txHash] = true;
        uniqueMints.push(mint);
      }
    });

    if (duplicates.length === 0) {
      return res.json({
        success: true,
        message: 'No duplicates found',
        cleanedCount: 0
      });
    }

    // Calculate correct mint count
    const correctMintCount = uniqueMints.reduce((sum, mint) => sum + (mint.quantity || 1), 0);
    
    // Update moment with cleaned data
    const updatedMoment = await Moment.findByIdAndUpdate(
      momentId,
      {
        $set: {
          nftMintHistory: uniqueMints,
          nftMintedCount: correctMintCount,
          lastCleanupAt: new Date()
        }
      },
      { new: true }
    );

    console.log(`✅ Cleaned up ${duplicates.length} duplicate entries`);
    console.log(`📊 Corrected mint count: ${moment.nftMintedCount} → ${correctMintCount}`);

    res.json({
      success: true,
      message: `Cleaned up ${duplicates.length} duplicate mint entries`,
      cleanedCount: duplicates.length,
      oldMintCount: moment.nftMintedCount,
      newMintCount: correctMintCount,
      duplicatesRemoved: duplicates,
      remainingMints: uniqueMints.length
    });

  } catch (err) {
    console.error('❌ Cleanup duplicates error:', err);
    res.status(500).json({ 
      error: 'Failed to clean up duplicates', 
      details: err.message 
    });
  }
});

// ✅ NEW: Clean up ALL moments with duplicates
app.post('/admin/cleanup-all-duplicates', async (req, res) => {
  try {
    console.log('🧹 Starting cleanup of all duplicate mints...');
    
    const momentsWithMints = await Moment.find({ 
      nftMinted: true,
      'nftMintHistory.0': { $exists: true }
    });

    let totalCleaned = 0;
    let momentsFixed = 0;
    const results = [];

    for (const moment of momentsWithMints) {
      if (!moment.nftMintHistory || moment.nftMintHistory.length === 0) continue;

      // Find duplicates by transaction hash
      const txHashCounts = {};
      const duplicates = [];
      const uniqueMints = [];

      moment.nftMintHistory.forEach((mint) => {
        if (!mint.txHash) {
          uniqueMints.push(mint);
          return;
        }

        if (txHashCounts[mint.txHash]) {
          duplicates.push(mint);
        } else {
          txHashCounts[mint.txHash] = true;
          uniqueMints.push(mint);
        }
      });

      if (duplicates.length > 0) {
        const correctMintCount = uniqueMints.reduce((sum, mint) => sum + (mint.quantity || 1), 0);
        
        await Moment.updateOne(
          { _id: moment._id },
          {
            $set: {
              nftMintHistory: uniqueMints,
              nftMintedCount: correctMintCount,
              lastCleanupAt: new Date()
            }
          }
        );

        totalCleaned += duplicates.length;
        momentsFixed++;

        results.push({
          momentId: moment._id,
          songName: moment.songName,
          duplicatesRemoved: duplicates.length,
          oldCount: moment.nftMintedCount,
          newCount: correctMintCount
        });

        console.log(`✅ Fixed "${moment.songName}": ${moment.nftMintedCount} → ${correctMintCount} (removed ${duplicates.length} duplicates)`);
      }
    }

    console.log(`🎉 Cleanup complete: ${totalCleaned} duplicates removed from ${momentsFixed} moments`);

    res.json({
      success: true,
      message: `Cleanup complete: ${totalCleaned} duplicates removed from ${momentsFixed} moments`,
      totalDuplicatesRemoved: totalCleaned,
      momentsFixed: momentsFixed,
      totalMomentsChecked: momentsWithMints.length,
      results: results
    });

  } catch (err) {
    console.error('❌ Cleanup all duplicates error:', err);
    res.status(500).json({ 
      error: 'Failed to clean up all duplicates', 
      details: err.message 
    });
  }
});

// ✅ NEW: Get mint analytics for debugging
app.get('/moments/:momentId/mint-analytics', async (req, res) => {
  try {
    const { momentId } = req.params;
    
    const moment = await Moment.findById(momentId)
      .populate('nftMintHistory.minter', 'displayName email');

    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }

    // Analyze mint history for duplicates and issues
    const mintHistory = moment.nftMintHistory || [];
    const txHashes = mintHistory.map(mint => mint.txHash).filter(Boolean);
    const duplicateTxs = txHashes.filter((tx, index) => txHashes.indexOf(tx) !== index);
    
    const totalFromHistory = mintHistory.reduce((sum, mint) => sum + (mint.quantity || 1), 0);
    const uniqueTxs = [...new Set(txHashes)];

    // Calculate duplicate count correctly
    const duplicateCount = mintHistory.filter(mint => {
      return mint.txHash && txHashes.filter(tx => tx === mint.txHash).length > 1;
    }).length;

    res.json({
      moment: {
        id: moment._id,
        songName: moment.songName,
        venueName: moment.venueName
      },
      mintData: {
        databaseCount: moment.nftMintedCount,
        historyTotal: totalFromHistory,
        uniqueTransactions: uniqueTxs.length,
        totalTransactions: mintHistory.length,
        duplicateEntries: duplicateCount,
        duplicateTransactions: [...new Set(duplicateTxs)]
      },
      analysis: {
        isConsistent: moment.nftMintedCount === totalFromHistory,
        possibleDoubleCount: moment.nftMintedCount > totalFromHistory,
        missingMints: totalFromHistory > moment.nftMintedCount,
        hasDuplicates: duplicateTxs.length > 0
      },
      recentMints: mintHistory.slice(-5).map(mint => ({
        quantity: mint.quantity,
        txHash: mint.txHash ? `${mint.txHash.slice(0, 10)}...` : 'No hash',
        mintedAt: mint.mintedAt,
        minter: mint.minter?.displayName || 'Unknown'
      }))
    });

  } catch (err) {
    console.error('❌ Mint analytics error:', err);
    res.status(500).json({ 
      error: 'Failed to get mint analytics', 
      details: err.message 
    });
  }
});

// Create 0xSplits contract (mock for now - replace with real implementation)
app.post('/create-splits', authenticateToken, async (req, res) => {
  try {
    const { recipients } = req.body;
    console.log('💰 Creating splits contract for recipients:', recipients);
    
    // TODO: Replace with real 0xSplits integration
    // For now, return a mock address
    const mockSplitsAddress = `0x${Math.random().toString(16).substr(2, 40)}`;
    
    // In production, you would:
    // 1. Call 0xSplits createSplit function
    // 2. Wait for transaction confirmation
    // 3. Return the real splits contract address
    
    console.log('✅ Mock splits contract created:', mockSplitsAddress);
    
    res.json({
      success: true,
      splitsAddress: mockSplitsAddress,
      recipients: recipients
    });
    
  } catch (error) {
    console.error('❌ Splits creation error:', error);
    res.status(500).json({
      error: 'Failed to create splits contract',
      details: error.message
    });
  }
});
// 🔍 Debug a specific moment's rarity calculation
app.get('/debug/moment-rarity/:momentId', async (req, res) => {
  try {
    const { momentId } = req.params;
    
    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }

    console.log(`🔍 ENHANCED debugging rarity for "${moment.songName}" at ${moment.venueName}`);
    
    // Load cache for song data
    await umoCache.loadCache();
    const songDatabase = await umoCache.getSongDatabase();
    const songData = songDatabase[moment.songName];
    
    // ✅ NEW: Check for non-song content
    const nonSongAnalysis = detectNonSongContent(moment.songName);
    
    // Check song performance count
    let songTotalPerformances = 0;
    if (songData) {
      songTotalPerformances = songData.totalPerformances;
    }
    
    // Check venue priority calculation
    const existingMomentsAtVenue = await Moment.find({ 
      songName: moment.songName,
      venueName: moment.venueName,
      _id: { $ne: moment._id }
    }).sort({ createdAt: 1 });
    
    const uploadPosition = existingMomentsAtVenue.length + 1;
    
    let venueScore = 0;
    if (uploadPosition === 1) {
      venueScore = 1.0;
    } else if (uploadPosition === 2) {
      venueScore = 0.5;
    } else if (uploadPosition === 3) {
      venueScore = 0.25;
    } else if (uploadPosition === 4) {
      venueScore = 0.125;
    } else if (uploadPosition <= 10) {
      venueScore = 0.1;
    } else {
      venueScore = 0;
    }
    
    // Metadata analysis
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
    const metadataScore = filledFields / metadataFields.length;
    
    res.json({
      moment: {
        id: moment._id,
        songName: moment.songName,
        venueName: moment.venueName,
        currentRarityScore: moment.rarityScore,
        currentRarityTier: moment.rarityTier
      },
      nonSongAnalysis: {
        isNonSong: nonSongAnalysis.isNonSong,
        type: nonSongAnalysis.type,
        confidence: nonSongAnalysis.confidence,
        detectedPattern: nonSongAnalysis.detectedPattern
      },
      songAnalysis: {
        songInCache: !!songData,
        songTotalPerformances: songTotalPerformances,
        cacheEntry: songData ? {
          totalPerformances: songData.totalPerformances,
          venues: songData.venues?.length || 0,
          firstPerformed: songData.firstPerformed,
          lastPerformed: songData.lastPerformed
        } : null
      },
      venueAnalysis: {
        uploadPositionAtVenue: uploadPosition,
        existingMomentsAtVenue: existingMomentsAtVenue.length,
        calculatedVenueScore: venueScore
      },
      metadataAnalysis: {
        filledFields: filledFields,
        totalFields: metadataFields.length,
        completenessPercentage: Math.round((filledFields / metadataFields.length) * 100),
        calculatedMetadataScore: metadataScore,
        fieldDetails: metadataFields.map((field, index) => ({
          field: ['description', 'emotionalTags', 'specialOccasion', 'instruments', 'guestAppearances', 'crowdReaction', 'uniqueElements', 'personalNote'][index],
          filled: !!(field && field.trim().length > 0),
          value: field ? field.slice(0, 50) + (field.length > 50 ? '...' : '') : null
        }))
      },
      recommendations: generateRecommendations(moment, nonSongAnalysis, songData)
    });
    
  } catch (error) {
    console.error('❌ Debug rarity error:', error);
    res.status(500).json({ error: error.message });
  }
});
// ✅ NEW: Generate recommendations for improving rarity
const generateRecommendations = (moment, nonSongAnalysis, songData) => {
  const recommendations = [];
  
  if (nonSongAnalysis.isNonSong) {
    recommendations.push({
      category: 'Content Type',
      priority: 'high',
      message: `This appears to be ${nonSongAnalysis.type} content, which receives lower rarity scores`,
      action: 'Consider recategorizing or being more specific with the song name'
    });
  }
  
  if (!songData) {
    recommendations.push({
      category: 'Song Recognition',
      priority: 'medium',
      message: 'Song not found in performance database',
      action: 'Verify song name spelling or check if this is a rare/new song'
    });
  }
  
  const metadataFields = [
    moment.momentDescription,
    moment.emotionalTags,
    moment.specialOccasion,
    moment.instruments,
    moment.crowdReaction,
    moment.uniqueElements,
    moment.personalNote
  ];
  
  const filledFields = metadataFields.filter(field => field && field.trim().length > 0).length;
  const completeness = (filledFields / metadataFields.length) * 100;
  
  if (completeness < 50) {
    recommendations.push({
      category: 'Metadata',
      priority: 'medium',
      message: `Only ${Math.round(completeness)}% of metadata fields are filled`,
      action: 'Add more details like description, emotions, instruments, etc. to increase rarity score'
    });
  }
  
  return recommendations;
};
// Add to your server.js
app.get('/debug/full-rarity/:momentId', async (req, res) => {
  try {
    const { momentId } = req.params;
    const moment = await Moment.findById(momentId);
    
    // Load cache
    await umoCache.loadCache();
    
    // Run the ACTUAL rarity calculation function
    const rarityData = await calculateRarityScore(moment, umoCache);
    
    res.json({
      moment: {
        songName: moment.songName,
        venueName: moment.venueName,
        storedScore: moment.rarityScore,
        storedTier: moment.rarityTier
      },
      freshCalculation: rarityData,
      comparison: {
        scoreMatch: Math.abs(moment.rarityScore - rarityData.rarityScore) < 0.01,
        tierMatch: moment.rarityTier === rarityData.rarityTier
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Enhanced NFT status endpoint with contract validation
app.get('/moments/:momentId/nft-status-enhanced', async (req, res) => {
  try {
    const { momentId } = req.params;
    
    const moment = await Moment.findById(momentId)
      .populate('user', 'displayName email');

    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }

    const hasNFTEdition = !!(moment.nftContractAddress && moment.nftTokenId);
    const isMintingActive = hasNFTEdition && 
                           moment.nftMintEndTime && 
                           new Date() < new Date(moment.nftMintEndTime);

    // Calculate time remaining
    let timeRemaining = null;
    if (hasNFTEdition && moment.nftMintEndTime) {
      const now = new Date();
      const endTime = new Date(moment.nftMintEndTime);
      const msRemaining = Math.max(0, endTime - now);
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
      
      timeRemaining = {
        milliseconds: msRemaining,
        days: daysRemaining,
        isActive: msRemaining > 0
      };
    }

    // Calculate revenue info
    let revenueInfo = null;
    if (hasNFTEdition) {
      const totalMints = moment.nftMintedCount || 0;
      const mintPriceEth = 0.001; // Should read from contract
      const totalRevenue = totalMints * mintPriceEth;
      const uploaderRevenue = totalRevenue * 0.35; // 35% share
      
      revenueInfo = {
        totalMints,
        totalRevenueEth: totalRevenue,
        uploaderRevenueEth: uploaderRevenue,
        totalRevenueUsd: totalRevenue * 3500, // Mock ETH price
        uploaderRevenueUsd: uploaderRevenue * 3500
      };
    }

    res.json({
      hasNFTEdition,
      isMintingActive,
      timeRemaining,
      revenueInfo,
      nftData: hasNFTEdition ? {
        contractAddress: moment.nftContractAddress,
        tokenId: moment.nftTokenId,
        mintedCount: moment.nftMintedCount || 0,
        mintPrice: moment.nftMintPrice,
        mintStartTime: moment.nftMintStartTime,
        mintEndTime: moment.nftMintEndTime,
        uploader: {
          displayName: moment.user.displayName,
          email: moment.user.email
        },
        metadata: {
          song: moment.songName,
          venue: `${moment.venueName}, ${moment.venueCity}`,
          date: moment.performanceDate,
          rarity: moment.rarityTier,
          score: moment.rarityScore
        }
      } : null
    });

  } catch (err) {
    console.error('❌ Enhanced NFT status error:', err);
    res.status(500).json({ 
      error: 'Failed to get NFT status', 
      details: err.message 
    });
  }
});

// Get NFT edition analytics for owners
app.get('/moments/:momentId/nft-analytics', authenticateToken, async (req, res) => {
  try {
    const { momentId } = req.params;
    const userId = req.user.id;

    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }

    // Verify ownership
    if (moment.user.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to view analytics' });
    }

    if (!moment.nftMinted) {
      return res.status(400).json({ error: 'No NFT edition exists' });
    }

    // Calculate revenue (35% of total mints)
    const totalMints = moment.nftMintedCount || 0;
    const mintPrice = moment.nftMintPrice || 0;
    const totalRevenue = totalMints * mintPrice;
    const uploaderRevenue = totalRevenue * 0.35; // 35% share

    // Time remaining
    const now = new Date();
    const endTime = new Date(moment.nftMintEndTime);
    const timeRemaining = endTime > now ? endTime - now : 0;
    const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));

    res.json({
      totalMints,
      totalRevenue: totalRevenue.toString(),
      uploaderRevenue: uploaderRevenue.toString(),
      mintPrice: mintPrice.toString(),
      timeRemaining: {
        milliseconds: timeRemaining,
        days: daysRemaining,
        isActive: timeRemaining > 0
      },
      mintHistory: moment.nftMintHistory || [],
      contractAddress: moment.nftContractAddress,
      tokenId: moment.nftTokenId
    });

  } catch (err) {
    console.error('❌ Get NFT analytics error:', err);
    res.status(500).json({ 
      error: 'Failed to get NFT analytics', 
      details: err.message 
    });
  }
});

// Get OpenSea collection info
app.get('/moments/:momentId/opensea-info', async (req, res) => {
  try {
    const { momentId } = req.params;
    
    const moment = await Moment.findById(momentId);
    if (!moment || !moment.nftContractAddress) {
      return res.status(404).json({ error: 'NFT not found' });
    }

    // Determine correct OpenSea URL based on network
    const isMainnet = moment.nftContractAddress.startsWith('0x'); // Simple check
    const baseUrl = isMainnet 
      ? 'https://opensea.io/assets/ethereum'
      : 'https://testnets.opensea.io/assets/base-sepolia';
    
    const openSeaUrl = `${baseUrl}/${moment.nftContractAddress}/${moment.nftTokenId || moment._id}`;
    
    res.json({
      openSeaUrl,
      contractAddress: moment.nftContractAddress,
      tokenId: moment.nftTokenId || moment._id,
      network: isMainnet ? 'mainnet' : 'testnet',
      collectionSlug: 'umo-moments' // You'd set this when creating the collection
    });

  } catch (error) {
    console.error('❌ OpenSea info error:', error);
    res.status(500).json({
      error: 'Failed to get OpenSea info',
      details: error.message
    });
  }
});

console.log('🎯 Enhanced NFT endpoints with metadata and cleanup added to server');

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

app.post('/cache/force-rebuild', async (req, res) => {
  try {
    console.log('🔄 Force rebuild cache requested with medley processing...');
    
    res.json({ 
      message: 'Cache rebuild started in background with medley processing',
      status: 'started'
    });
    
    // Start rebuild in background
    const API_BASE_URL = `http://localhost:${PORT}`;
    umoCache.buildFreshCache(API_BASE_URL, (progress) => {
      console.log(`📊 Cache rebuild progress:`, progress);
    }).catch(err => {
      console.error('❌ Background cache rebuild failed:', err);
    });
    
  } catch (err) {
    console.error('❌ Cache force rebuild error:', err);
    res.status(500).json({ error: 'Failed to start cache rebuild' });
  }
});

app.get('/cached/performances', async (req, res) => {
  try {
    const { page = 1, limit = 20, city } = req.query;
    
    let result;
    
    if (city) {
      // FIXED: Search with proper pagination support
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
      // Regular pagination (no search)
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
    // Enhanced metadata
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
    contentType  // ✅ NEW: Content type from form
  } = req.body;
  
  const userId = req.user.id;

  console.log('💾 Received moment upload request:', {
    performanceId,
    songName,
    venueName,
    venueCity,
    userId,
    contentType  // ✅ NEW: Log content type
  });

  if (!performanceId || !songName || (!mediaUrl && !fileUri)) {
    return res.status(400).json({ error: 'Missing required fields: performanceId, songName, and media URL' });
  }

  try {
    // ✅ NEW: Pre-validate song name for non-song content
    const nonSongCheck = detectNonSongContent(songName);
    if (nonSongCheck.isNonSong && nonSongCheck.confidence > 0.8) {
      console.log(`⚠️ Detected high-confidence non-song content: "${songName}" (${nonSongCheck.type})`);
    }

    // Create the moment first
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
      // Enhanced metadata
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
      // ✅ NEW: Store content type for future reference
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
    
    // ✅ NEW: Log detailed breakdown for non-song content
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

// ✅ CLEANED UP: Rarity calculation with proper non-song handling
const calculateRarityScore = async (moment, umoCache) => {
  try {
    console.log(`🎯 Calculating rarity for "${moment.songName}" at ${moment.venueName}...`);
    
    // ✅ FIRST: Check content type from form data
    const contentType = moment.contentType || 'song';
    
    // ✅ FIXED: Handle non-song content immediately
    if (contentType !== 'song') {
      console.log(`🎭 Processing non-song content: "${moment.songName}" (type: ${contentType})`);
      return calculateNonSongRarity(moment, contentType);
    }
    
    // ✅ FALLBACK: Detect non-song content from name if type wasn't set
    const nonSongDetection = detectNonSongContent(moment.songName);
    if (nonSongDetection.isNonSong && nonSongDetection.confidence > 0.8) {
      console.log(`🚫 Auto-detected non-song content: "${moment.songName}" (${nonSongDetection.type})`);
      return calculateNonSongRarity(moment, nonSongDetection.type);
    }
    
    // ✅ PROCEED WITH SONG RARITY CALCULATION
    const songDatabase = await umoCache.getSongDatabase();
    const songData = songDatabase[moment.songName];
    
    let songTotalPerformances = 0;
    if (songData) {
      songTotalPerformances = songData.totalPerformances;
    } else {
      // Songs not in cache get moderate rarity (not maximum)
      console.log(`⚠️ Song "${moment.songName}" not found in cache - treating as rare song`);
      songTotalPerformances = 25; // Treat as moderately rare (3 points instead of 4)
    }
    
    // ✅ FIXED: Only check for first moment if it's actually a song
    const allMomentsForSong = await Moment.find({ 
      songName: moment.songName,
      contentType: 'song', // ✅ ONLY count actual songs for first moment logic
      _id: { $ne: moment._id }
    }).sort({ createdAt: 1 });
    
    const allSongMomentsIncludingCurrent = await Moment.find({ 
      songName: moment.songName,
      contentType: 'song' // ✅ ONLY count actual songs
    }).sort({ createdAt: 1, _id: 1 });
    
    const isFirstMomentForSong = allSongMomentsIncludingCurrent.length > 0 && 
                                allSongMomentsIncludingCurrent[0]._id.toString() === moment._id.toString();
    
    console.log(`   First song moment check: ${allMomentsForSong.length} other song moments found`);
    console.log(`   isFirstSong: ${isFirstMomentForSong}`);
    
    let totalScore = 0;
    let scoreBreakdown = {};
    
    // 1. PERFORMANCE FREQUENCY SCORE (0-4 points)
    let performanceScore = 0;
    if (songTotalPerformances === 0) {
      performanceScore = 3.5; // Reduced from 4 to prevent inflation
    } else if (songTotalPerformances >= 1 && songTotalPerformances <= 10) {
      performanceScore = 4; // 1-10 performances - maximum rarity
    } else if (songTotalPerformances >= 11 && songTotalPerformances <= 50) {
      performanceScore = 3; // 11-50 performances - rare
    } else if (songTotalPerformances >= 51 && songTotalPerformances <= 100) {
      performanceScore = 2.5; // 51-100 performances - uncommon
    } else if (songTotalPerformances >= 101 && songTotalPerformances <= 150) {
      performanceScore = 2; // 101-150 performances - somewhat common
    } else if (songTotalPerformances >= 151 && songTotalPerformances <= 200) {
      performanceScore = 1.5; // 151-200 performances - common
    } else {
      performanceScore = 1; // 200+ performances - most common songs
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
    
    // 4. VENUE UPLOAD PRECEDENCE SCORE (0-1 point) - Only for songs
    const existingMomentsAtVenue = await Moment.find({ 
      songName: moment.songName,
      venueName: moment.venueName,
      contentType: 'song', // ✅ ONLY count actual songs for venue precedence
      _id: { $ne: moment._id }
    }).sort({ createdAt: 1 });
    
    const uploadPosition = existingMomentsAtVenue.length + 1;
    let venueScore = 0;
    
    if (uploadPosition === 1) {
      venueScore = 1.0;
    } else if (uploadPosition === 2) {
      venueScore = 0.5;
    } else if (uploadPosition === 3) {
      venueScore = 0.25;
    } else if (uploadPosition === 4) {
      venueScore = 0.125;
    } else if (uploadPosition <= 10) {
      venueScore = 0.1;
    } else {
      venueScore = 0;
    }
    
    venueScore = Math.min(1.0, venueScore); // Safety cap
    
    totalScore += venueScore;
    scoreBreakdown.venuePrecedence = {
      score: venueScore,
      uploadPosition,
      existingAtVenue: existingMomentsAtVenue.length,
      description: uploadPosition === 1 ? 
        'First song moment at this venue' : 
        `${uploadPosition}${getOrdinalSuffix(uploadPosition)} song moment at this venue`
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
    
    console.log(`✅ SONG "${moment.songName}" at ${moment.venueName}: ${finalScore}/7 (${rarityTier})`);
    console.log(`   Performance: ${performanceScore}, Metadata: ${metadataScore.toFixed(2)}, Length: ${lengthScore}, Venue: ${venueScore}`);
    
    return {
      rarityScore: finalScore,
      rarityTier,
      isFirstMomentForSong, // ✅ Only true for actual songs
      songTotalPerformances,
      scoreBreakdown
    };
    
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

// ✅ SIMPLIFIED: Non-song content gets low, fixed scores
const calculateNonSongRarity = async (moment, contentType) => {
  console.log(`🎭 Calculating non-song rarity for "${moment.songName}" (${contentType})`);
  
  let baseScore = 0;
  let description = '';
  
  // Assign base scores based on content type
  switch (contentType) {
    case 'intro':
    case 'outro':
      baseScore = 1.0;
      description = 'Performance intro/outro content';
      break;
    case 'jam':
      baseScore = 1.5;
      description = 'Jam/improvisation content';
      break;
    case 'crowd':
      baseScore = 1.2;
      description = 'Crowd reaction content';
      break;
    case 'other':
      baseScore = 0.8;
      description = 'Other performance content';
      break;
    default:
      baseScore = 1.0;
      description = 'Non-song content';
  }
  
  // Small metadata bonus (max +0.5)
  const metadataFields = [
    moment.momentDescription,
    moment.emotionalTags,
    moment.specialOccasion,
    moment.crowdReaction,
    moment.uniqueElements,
    moment.personalNote
  ];
  
  const filledFields = metadataFields.filter(field => field && field.trim().length > 0).length;
  const metadataBonus = (filledFields / metadataFields.length) * 0.5;
  
  const finalScore = Math.min(2.5, baseScore + metadataBonus); // Cap at 2.5 for non-songs
  
  // Non-song content is always common or uncommon at most
  const rarityTier = finalScore >= 2.0 ? 'uncommon' : 'common';
  
  console.log(`✅ NON-SONG "${moment.songName}": ${finalScore.toFixed(2)}/7 (${rarityTier}, ${contentType})`);
  
  return {
    rarityScore: Math.round(finalScore * 100) / 100,
    rarityTier,
    isFirstMomentForSong: false, // ✅ NEVER true for non-songs
    songTotalPerformances: 0, // ✅ N/A for non-songs
    scoreBreakdown: {
      nonSongContent: {
        type: contentType,
        baseScore: baseScore,
        metadataBonus: metadataBonus,
        description: description
      }
    }
  };
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

// Helper function for ordinal numbers
const getOrdinalSuffix = (num) => {
  const j = num % 10;
  const k = num % 100;
  if (j == 1 && k != 11) return "st";
  if (j == 2 && k != 12) return "nd";
  if (j == 3 && k != 13) return "rd";
  return "th";
};
// =============================================================================
// RARITY CALCULATION ENDPOINTS
// =============================================================================

// Endpoint to recalculate rarity for all moments
app.post('/admin/recalculate-rarity', async (req, res) => {
  try {
    console.log('🎯 Starting ENHANCED rarity recalculation for all moments...');
    
    // Load the UMO cache
    await umoCache.loadCache();
    
    // Get all moments
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
        // Calculate new rarity data using enhanced function
        const rarityData = await calculateRarityScore(moment, umoCache);
        
        // Track statistics
        if (rarityData.scoreBreakdown?.nonSongContent) {
          nonSongCount++;
        }
        
        if (rarityData.scoreBreakdown?.performanceFrequency && !rarityData.scoreBreakdown.performanceFrequency.inCache) {
          songNotInCacheCount++;
        }
        
        tierCounts[rarityData.rarityTier]++;
        
        // Update the moment
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


// Get rarity statistics
app.get('/admin/rarity-stats', async (req, res) => {
  try {
    const stats = await Moment.aggregate([
      {
        $group: {
          _id: '$rarityTier',
          count: { $sum: 1 },
          averageScore: { $avg: '$rarityScore' },
          maxScore: { $max: '$rarityScore' },
          minScore: { $min: '$rarityScore' }
        }
      },
      {
        $sort: { maxScore: -1 }
      }
    ]);
    
    const firstMoments = await Moment.countDocuments({ isFirstMomentForSong: true });
    const totalMoments = await Moment.countDocuments();
    
    res.json({
      tierDistribution: stats,
      firstMoments,
      totalMoments,
      firstMomentPercentage: totalMoments > 0 ? Math.round((firstMoments / totalMoments) * 100) : 0
    });
    
  } catch (error) {
    console.error('❌ Error getting rarity stats:', error);
    res.status(500).json({ error: 'Failed to get rarity statistics' });
  }
});
app.post('/admin/fix-intro-moments', async (req, res) => {
  try {
    console.log('🔧 Finding and fixing "Intro" and other non-song moments...');
    
    // Find moments that are likely non-song content
    const nonSongPatterns = [
      /^intro$/i, /^outro$/i, /soundcheck/i, /tuning/i, /^jam$/i, 
      /banter/i, /crowd/i, /applause/i, /^\d+$/
    ];
    
    const problematicMoments = await Moment.find({
      $or: nonSongPatterns.map(pattern => ({ songName: { $regex: pattern } }))
    });
    
    console.log(`📊 Found ${problematicMoments.length} potentially problematic moments`);
    
    let fixed = 0;
    const results = [];
    
    // Load cache
    await umoCache.loadCache();
    
    for (const moment of problematicMoments) {
      try {
        const oldScore = moment.rarityScore;
        const oldTier = moment.rarityTier;
        
        // Recalculate with enhanced logic
        const rarityData = await calculateRarityScore(moment, umoCache);
        
        // Update moment
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
        
        results.push({
          id: moment._id,
          songName: moment.songName,
          venueName: moment.venueName,
          oldScore: oldScore,
          newScore: rarityData.rarityScore,
          oldTier: oldTier,
          newTier: rarityData.rarityTier,
          isNonSong: !!rarityData.scoreBreakdown?.nonSongContent,
          nonSongType: rarityData.scoreBreakdown?.nonSongContent?.type
        });
        
        fixed++;
        console.log(`🔧 Fixed "${moment.songName}": ${oldScore} → ${rarityData.rarityScore} (${oldTier} → ${rarityData.rarityTier})`);
        
      } catch (err) {
        console.error(`❌ Error fixing moment ${moment._id}:`, err);
      }
    }
    
    console.log(`✅ Fixed ${fixed} problematic moments`);
    
    res.json({
      success: true,
      message: `Fixed ${fixed} problematic moments`,
      totalFound: problematicMoments.length,
      totalFixed: fixed,
      results: results
    });
    
  } catch (error) {
    console.error('❌ Fix intro moments failed:', error);
    res.status(500).json({
      error: 'Failed to fix intro moments',
      details: error.message
    });
  }
});

app.get('/admin/rarity-analytics', async (req, res) => {
  try {
    console.log('📊 Generating rarity analytics...');
    
    // Get overall statistics
    const totalMoments = await Moment.countDocuments();
    
    // Tier distribution
    const tierStats = await Moment.aggregate([
      {
        $group: {
          _id: '$rarityTier',
          count: { $sum: 1 },
          averageScore: { $avg: '$rarityScore' },
          maxScore: { $max: '$rarityScore' },
          minScore: { $min: '$rarityScore' }
        }
      },
      { $sort: { maxScore: -1 } }
    ]);
    
    // Score distribution (binned)
    const scoreDistribution = await Moment.aggregate([
      {
        $bucket: {
          groupBy: '$rarityScore',
          boundaries: [0, 1, 2, 3, 4, 5, 6, 7, 8],
          default: 'other',
          output: {
            count: { $sum: 1 },
            moments: { 
              $push: { 
                songName: '$songName', 
                venueName: '$venueName',
                score: '$rarityScore',
                tier: '$rarityTier'
              } 
            }
          }
        }
      }
    ]);
    
    // Top and bottom moments
    const topMoments = await Moment.find({})
      .sort({ rarityScore: -1 })
      .limit(10)
      .select('songName venueName rarityScore rarityTier user createdAt')
      .populate('user', 'displayName');
    
    const bottomMoments = await Moment.find({})
      .sort({ rarityScore: 1 })
      .limit(10)
      .select('songName venueName rarityScore rarityTier user createdAt')
      .populate('user', 'displayName');
    
    // Non-song content analysis
    const nonSongPatterns = [
      /^intro$/i, /^outro$/i, /soundcheck/i, /tuning/i, /^jam$/i, 
      /banter/i, /crowd/i, /applause/i, /^\d+$/
    ];
    
    const potentialNonSongs = await Moment.find({
      $or: nonSongPatterns.map(pattern => ({ songName: { $regex: pattern } }))
    }).select('songName venueName rarityScore rarityTier');
    
    // First moment statistics
    const firstMoments = await Moment.countDocuments({ isFirstMomentForSong: true });
    
    res.json({
      overview: {
        totalMoments,
        firstMoments,
        firstMomentPercentage: Math.round((firstMoments / totalMoments) * 100)
      },
      tierDistribution: tierStats,
      scoreDistribution,
      extremes: {
        topMoments,
        bottomMoments
      },
      qualityIssues: {
        potentialNonSongs: potentialNonSongs.length,
        examples: potentialNonSongs.slice(0, 10)
      },
      recommendations: [
        potentialNonSongs.length > 0 ? `${potentialNonSongs.length} moments may be non-song content` : null,
        firstMoments < totalMoments * 0.05 ? 'Very few first moments detected - check calculation logic' : null,
        tierStats.find(t => t._id === 'legendary')?.count > totalMoments * 0.1 ? 'Too many legendary moments - scoring may be inflated' : null
      ].filter(Boolean)
    });
    
  } catch (error) {
    console.error('❌ Rarity analytics error:', error);
    res.status(500).json({
      error: 'Failed to generate analytics',
      details: error.message
    });
  }
});

console.log('🎯 Enhanced rarity calculation and debugging endpoints added to server');
console.log('🎯 Rarity calculation endpoints added to server');

app.post('/debug/fix-first-moment/:momentId', async (req, res) => {
  try {
    const { momentId } = req.params;
    
    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({ error: 'Moment not found' });
    }
    
    // Find all moments for this song, sorted by creation date
    const allMomentsForSong = await Moment.find({ 
      songName: moment.songName
    }).sort({ createdAt: 1, _id: 1 }); // Use _id as tiebreaker
    
    // Check if this moment is the first one created
    const isFirstMomentForSong = allMomentsForSong[0]._id.toString() === momentId;
    
    // Update the moment
    const updatedMoment = await Moment.findByIdAndUpdate(
      momentId,
      { 
        $set: { 
          isFirstMomentForSong: isFirstMomentForSong 
        }
      },
      { new: true }
    ).populate('user', 'displayName');
    
    res.json({
      success: true,
      moment: updatedMoment,
      wasFirstMoment: isFirstMomentForSong,
      totalMomentsForSong: allMomentsForSong.length,
      position: allMomentsForSong.findIndex(m => m._id.toString() === momentId) + 1,
      allTimestamps: allMomentsForSong.map(m => ({
        id: m._id,
        createdAt: m.createdAt,
        timestamp: m.createdAt.getTime()
      }))
    });
    
  } catch (error) {
    console.error('❌ Fix first moment error:', error);
    res.status(500).json({ error: error.message });
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

// =============================================================================
// TEMPORARY API PROXY FOR CACHE REBUILD
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