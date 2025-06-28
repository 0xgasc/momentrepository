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
    uniqueElements
  } = req.body;
  
  const userId = req.user.id;

  console.log('💾 Received moment upload request:', {
    performanceId,
    songName,
    venueName,
    venueCity,
    userId
  });

  if (!performanceId || !songName || (!mediaUrl && !fileUri)) {
    return res.status(400).json({ error: 'Missing required fields: performanceId, songName, and media URL' });
  }

  try {
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
      uniqueElements
    });

    // Calculate rarity before saving
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
    
    res.json({ 
      success: true, 
      moment,
      rarityData
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

const calculateRarityScore = async (moment, umoCache) => {
  try {
    console.log(`🎯 Calculating rarity for "${moment.songName}" at ${moment.venueName}...`);
    
    // Get song database to find performance count
    const songDatabase = await umoCache.getSongDatabase();
    const songData = songDatabase[moment.songName];
    
    let songTotalPerformances = 0;
    if (songData) {
      songTotalPerformances = songData.totalPerformances;
    }
    
    // Check if this is the GLOBAL first moment for this song (anywhere, any venue)
    const allMomentsForSong = await Moment.find({ 
      songName: moment.songName,
      _id: { $ne: moment._id }
    }).sort({ createdAt: 1 });
    
    // Get the very first moment for this song (including the current one)
    const allMomentsIncludingCurrent = await Moment.find({ 
      songName: moment.songName
    }).sort({ createdAt: 1, _id: 1 }); // Use _id as tiebreaker for same timestamps
    
    const isFirstMomentForSong = allMomentsIncludingCurrent.length > 0 && 
                                allMomentsIncludingCurrent[0]._id.toString() === moment._id.toString();
    
    console.log(`   Global first moment check: ${allMomentsForSong.length} other moments found`);
    console.log(`   Current moment ID: ${moment._id}`);
    console.log(`   First moment ID: ${allMomentsIncludingCurrent[0]?._id}`);
    console.log(`   Current timestamp: ${moment.createdAt}`);
    console.log(`   First timestamp: ${allMomentsIncludingCurrent[0]?.createdAt}`);
    console.log(`   isFirst: ${isFirstMomentForSong}`);
    
    
    let totalScore = 0;
    let scoreBreakdown = {};
    
    // =============================================================================
    // 1. PERFORMANCE FREQUENCY SCORE (0-4 points)
    // More performances = lower score, rare songs = higher score
    // =============================================================================
    let performanceScore = 0;
    if (songTotalPerformances === 0) {
      performanceScore = 4; // Unplayed song (shouldn't happen but max score)
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
      description: `${songTotalPerformances} live performances`
    };
    
    // =============================================================================
    // 2. METADATA COMPLETENESS SCORE (0-1 point)
    // Rich metadata = higher score
    // =============================================================================
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
    const completenessPercentage = (filledFields / totalFields) * 100;
    const metadataScore = (filledFields / totalFields); // 0-1 based on completion percentage
    
    totalScore += metadataScore;
    scoreBreakdown.metadataCompleteness = {
      score: metadataScore,
      filledFields,
      totalFields,
      percentage: Math.round(completenessPercentage),
      description: `${filledFields}/${totalFields} metadata fields (${Math.round(completenessPercentage)}%)`
    };
    
    // =============================================================================
    // 3. VIDEO LENGTH OPTIMIZATION SCORE (0-1 point)
    // Closer to 2.5 minutes (150 seconds) = higher score
    // =============================================================================
    let lengthScore = 0;
    let videoDuration = null;
    
    // For now, we'll estimate based on file size for video files
    // In the future, you could extract actual duration from video metadata
    if (moment.mediaType === 'video' && moment.fileSize) {
      // Rough estimation: assume ~1MB per 10 seconds for decent quality video
      const estimatedDuration = (moment.fileSize / (1024 * 1024)) * 10; // seconds
      videoDuration = estimatedDuration;
      
      const targetDuration = 150; // 2.5 minutes in seconds
      const difference = Math.abs(estimatedDuration - targetDuration);
      
      // Score decreases as we get further from ideal length
      if (difference <= 15) { // Within 15 seconds of 2.5 min
        lengthScore = 1;
      } else if (difference <= 30) { // Within 30 seconds
        lengthScore = 0.8;
      } else if (difference <= 60) { // Within 1 minute
        lengthScore = 0.6;
      } else if (difference <= 120) { // Within 2 minutes
        lengthScore = 0.4;
      } else if (difference <= 180) { // Within 3 minutes
        lengthScore = 0.2;
      } else {
        lengthScore = 0.1; // Very far from ideal
      }
    } else if (moment.mediaType === 'audio') {
      // Give moderate score for audio files
      lengthScore = 0.5;
    } else if (moment.mediaType === 'image') {
      // Images get a small base score
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
    
    // =============================================================================
    // 4. VENUE UPLOAD PRECEDENCE SCORE (0-1 point)
    // First upload at this venue = 1pt, second = 0.5pt, third = 0.25pt, etc.
    // =============================================================================
    // Check for first moment at this specific venue for this song
    const existingMomentsAtVenue = await Moment.find({ 
      songName: moment.songName,
      venueName: moment.venueName,
      _id: { $ne: moment._id }
    }).sort({ createdAt: 1 });
    
    const uploadPosition = existingMomentsAtVenue.length + 1; // 1st, 2nd, 3rd, etc.
    let venueScore = 0;
    
    if (uploadPosition === 1) {
      venueScore = 1; // First upload at this venue
    } else if (uploadPosition === 2) {
      venueScore = 0.5; // Second upload
    } else if (uploadPosition === 3) {
      venueScore = 0.25; // Third upload
    } else if (uploadPosition === 4) {
      venueScore = 0.125; // Fourth upload
    } else if (uploadPosition <= 10) {
      venueScore = 0.1; // 5th-10th upload
    } else {
      venueScore = 0; // 11+ uploads
    }
    
    totalScore += venueScore;
    scoreBreakdown.venuePrecedence = {
      score: venueScore,
      uploadPosition,
      description: uploadPosition === 1 ? 
        'First moment for this song at this venue' : 
        `${uploadPosition}${getOrdinalSuffix(uploadPosition)} moment at this venue`
    };
    
    // =============================================================================
    // DETERMINE RARITY TIER BASED ON TOTAL SCORE (0-7)
    // =============================================================================
    let rarityTier = 'common';
    if (totalScore >= 6) {
      rarityTier = 'legendary'; // 6-7 points
    } else if (totalScore >= 5) {
      rarityTier = 'epic'; // 5-6 points
    } else if (totalScore >= 3.5) {
      rarityTier = 'rare'; // 3.5-5 points
    } else if (totalScore >= 2) {
      rarityTier = 'uncommon'; // 2-3.5 points
    } else {
      rarityTier = 'common'; // 0-2 points
    }
    
    // Round total score to 2 decimal places
    const finalScore = Math.round(totalScore * 100) / 100;
    
    console.log(`✅ "${moment.songName}" at ${moment.venueName}: ${finalScore}/7 (${rarityTier})`);
    console.log(`   Performance: ${performanceScore}, Metadata: ${metadataScore.toFixed(2)}, Length: ${lengthScore}, Venue: ${venueScore}`);
    
    return {
      rarityScore: finalScore,
      rarityTier,
      isFirstMomentForSong, // This is now the GLOBAL first moment for the song
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

// Helper function for ordinal numbers (1st, 2nd, 3rd, etc.)
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
    console.log('🎯 Starting rarity recalculation for all moments...');
    
    // Load the UMO cache
    await umoCache.loadCache();
    
    // Get all moments
    const allMoments = await Moment.find({});
    console.log(`📊 Found ${allMoments.length} moments to recalculate`);
    
    let updated = 0;
    let errors = 0;
    
    for (const moment of allMoments) {
      try {
        // Calculate new rarity data
        const rarityData = await calculateRarityScore(moment, umoCache);
        
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
        console.log(`✅ Updated "${moment.songName}" - Score: ${rarityData.rarityScore} (${rarityData.rarityTier})`);
        
      } catch (err) {
        console.error(`❌ Error updating moment ${moment._id}:`, err);
        errors++;
      }
    }
    
    console.log(`🎯 Rarity recalculation complete: ${updated} updated, ${errors} errors`);
    
    res.json({
      success: true,
      message: `Recalculated rarity for ${updated} moments`,
      updated,
      errors,
      total: allMoments.length
    });
    
  } catch (error) {
    console.error('❌ Rarity recalculation failed:', error);
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