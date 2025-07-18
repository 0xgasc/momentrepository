#!/usr/bin/env node

/**
 * Script to identify and optionally fix NFTs with the wrong splits address
 * 
 * This helps identify which NFTs are sending funds to the lost wallet
 * and provides options to handle them.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../setlist-proxy/.env') });

// Import the Moment model
const Moment = require('../setlist-proxy/models/Moment');

const LOST_WALLET = '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96';
const UMO_WALLET = '0x2e8D1eAd7Ba51e04c2A8ec40a8A3eD49CC4E1ceF';

async function analyzeNFTs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/umo-repo');
    console.log('✅ Connected to MongoDB');

    // Find all moments with NFTs
    const nftMoments = await Moment.find({
      nftMinted: true,
      nftSplitsContract: { $exists: true }
    }).populate('user', 'displayName email');

    console.log(`\n📊 Found ${nftMoments.length} moments with NFTs\n`);

    // Categorize by splits address
    const lostWalletNFTs = [];
    const correctNFTs = [];
    const unknownNFTs = [];

    for (const moment of nftMoments) {
      const splitsAddress = moment.nftSplitsContract?.toLowerCase();
      
      if (splitsAddress === LOST_WALLET.toLowerCase()) {
        lostWalletNFTs.push(moment);
      } else if (splitsAddress && splitsAddress !== LOST_WALLET.toLowerCase()) {
        correctNFTs.push(moment);
      } else {
        unknownNFTs.push(moment);
      }
    }

    // Report findings
    console.log('🔴 NFTs sending to LOST WALLET:');
    console.log(`   Count: ${lostWalletNFTs.length}`);
    if (lostWalletNFTs.length > 0) {
      console.log('   Details:');
      for (const nft of lostWalletNFTs) {
        console.log(`   - "${nft.songName}" by ${nft.user?.displayName || 'Unknown'}`);
        console.log(`     Token ID: ${nft.nftTokenId}`);
        console.log(`     Minted Count: ${nft.nftMintedCount || 0}`);
        console.log(`     Created: ${nft.nftMintStartTime?.toDateString() || 'Unknown'}`);
        console.log(`     Moment ID: ${nft._id}`);
        console.log('');
      }
    }

    console.log('\n🟢 NFTs with CORRECT splits addresses:');
    console.log(`   Count: ${correctNFTs.length}`);
    if (correctNFTs.length > 0) {
      const addresses = [...new Set(correctNFTs.map(n => n.nftSplitsContract))];
      console.log(`   Unique addresses: ${addresses.length}`);
      addresses.forEach(addr => {
        console.log(`   - ${addr}`);
      });
    }

    if (unknownNFTs.length > 0) {
      console.log('\n⚠️  NFTs with UNKNOWN status:');
      console.log(`   Count: ${unknownNFTs.length}`);
    }

    // Provide recommendations
    console.log('\n📋 RECOMMENDATIONS:');
    if (lostWalletNFTs.length > 0) {
      console.log('\n1. For NFTs sending to the lost wallet:');
      console.log('   - These NFTs will continue sending funds to the inaccessible wallet');
      console.log('   - Consider creating new NFT editions with correct splits addresses');
      console.log('   - You could mark the old ones as deprecated in the database');
      
      console.log('\n2. To fix a specific NFT:');
      console.log('   - Delete the old NFT edition (update database)');
      console.log('   - Have the owner create a new one with the fixed splits logic');
      
      console.log('\n3. To prevent future issues:');
      console.log('   - The code has been updated to use creator wallet as fallback');
      console.log('   - Test creating a new NFT to verify the fix works');
    } else {
      console.log('✅ No NFTs are sending to the lost wallet!');
    }

    // Optional: Fix specific NFTs
    if (process.argv[2] === '--fix' && process.argv[3]) {
      const momentId = process.argv[3];
      console.log(`\n🔧 Attempting to fix moment: ${momentId}`);
      
      const moment = await Moment.findById(momentId);
      if (!moment) {
        console.log('❌ Moment not found');
      } else if (moment.nftSplitsContract?.toLowerCase() !== LOST_WALLET.toLowerCase()) {
        console.log('✅ This moment is not using the lost wallet');
      } else {
        console.log('⚠️  To fix this NFT:');
        console.log('1. The NFT contract is immutable - the splits address cannot be changed');
        console.log('2. You need to create a new NFT edition');
        console.log('3. Consider marking this one as deprecated:');
        console.log(`\n   Run: node fix-existing-nfts.js --deprecate ${momentId}`);
      }
    }

    // Deprecate an NFT
    if (process.argv[2] === '--deprecate' && process.argv[3]) {
      const momentId = process.argv[3];
      console.log(`\n🚫 Deprecating NFT for moment: ${momentId}`);
      
      await Moment.findByIdAndUpdate(momentId, {
        $set: {
          nftDeprecated: true,
          nftDeprecatedReason: 'Incorrect splits address - funds going to inaccessible wallet'
        }
      });
      
      console.log('✅ NFT marked as deprecated');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  console.log(`
🔍 UMO Archive NFT Analysis Tool

Usage:
  node fix-existing-nfts.js              # Analyze all NFTs
  node fix-existing-nfts.js --fix <id>   # Get fix instructions for specific NFT
  node fix-existing-nfts.js --deprecate <id>  # Mark NFT as deprecated
`);
  
  analyzeNFTs().catch(console.error);
}

module.exports = { analyzeNFTs };