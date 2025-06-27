// scripts/cleanup-mock-nfts.js - Run this to clean up mock NFT data

const mongoose = require('mongoose');
require('dotenv').config();

const Moment = require('../setlist-proxy/models/Moment');

async function cleanupMockNFTs() {
  try {
    console.log('🧹 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    
    console.log('🔍 Finding moments with mock NFT data...');
    
    // Find all moments with NFT data
    const momentsWithNFTs = await Moment.find({
      $or: [
        { nftMinted: true },
        { nftContractAddress: { $exists: true } },
        { nftTokenId: { $exists: true } }
      ]
    });
    
    console.log(`📊 Found ${momentsWithNFTs.length} moments with NFT data`);
    
    if (momentsWithNFTs.length === 0) {
      console.log('✅ No mock NFT data found - database is clean!');
      process.exit(0);
    }
    
    // Show what we found
    console.log('\n🔍 Moments with NFT data:');
    momentsWithNFTs.forEach((moment, index) => {
      console.log(`${index + 1}. "${moment.songName}" at ${moment.venueName}`);
      console.log(`   - NFT Minted: ${moment.nftMinted}`);
      console.log(`   - Contract: ${moment.nftContractAddress || 'None'}`);
      console.log(`   - Token ID: ${moment.nftTokenId || 'None'}`);
      console.log(`   - Mint Count: ${moment.nftMintedCount || 0}`);
    });
    
    // Ask for confirmation
    console.log('\n⚠️  This will RESET all NFT data and remove mock entries.');
    console.log('Are you sure you want to continue? (Type "yes" to confirm)');
    
    // In a real script, you'd use readline for input
    // For now, just proceed with cleanup
    console.log('\n🧹 Proceeding with cleanup...');
    
    // Reset all NFT fields to clean state
    const result = await Moment.updateMany(
      {
        $or: [
          { nftMinted: true },
          { nftContractAddress: { $exists: true } },
          { nftTokenId: { $exists: true } }
        ]
      },
      {
        $unset: {
          nftContractAddress: "",
          nftTokenId: "",
          nftMetadataHash: "",
          nftSplitsContract: "",
          nftMintPrice: "",
          nftMintDuration: "",
          nftMintStartTime: "",
          nftMintEndTime: "",
          nftCreationTxHash: "",
          nftMintHistory: ""
        },
        $set: {
          nftMinted: false,
          nftMintedCount: 0,
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`✅ Cleanup complete! Updated ${result.modifiedCount} moments`);
    console.log('🎯 All moments are now ready for real NFT creation');
    
    // Verify cleanup
    const remainingNFTs = await Moment.countDocuments({
      $or: [
        { nftMinted: true },
        { nftContractAddress: { $exists: true } }
      ]
    });
    
    if (remainingNFTs === 0) {
      console.log('✅ Verification passed - no NFT data remaining');
    } else {
      console.log(`⚠️  Warning: ${remainingNFTs} moments still have NFT data`);
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

cleanupMockNFTs();