#!/usr/bin/env node

/**
 * Manual Distribution Script for Existing UMO Archive Funds
 * 
 * This script helps distribute the existing 0.0033 ETH from the fallback wallet
 * to the proper recipients according to the 65% UMO / 30% Creator / 5% Platform split.
 * 
 * Usage:
 * 1. Connect to the wallet that controls 0x742d35cc6634c0532925a3b8d76c7de9f45f6c96
 * 2. Run this script with the proper parameters
 * 3. Confirm the transactions
 */

const { ethers } = require('ethers');

// Configuration
const FALLBACK_WALLET = '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96';
const UMO_WALLET = '0x2e8D1eAd7Ba51e04c2A8ec40a8A3eD49CC4E1ceF';
const PLATFORM_WALLET = '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96'; // Same as fallback for now
const CREATOR_WALLET = '0x...'; // TO BE FILLED IN - the wallet that minted the NFT

// Split percentages
const UMO_PERCENTAGE = 65;
const CREATOR_PERCENTAGE = 30;
const PLATFORM_PERCENTAGE = 5;

// Base Sepolia RPC
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';

async function distributeFunds(creatorWallet, privateKey) {
  if (!creatorWallet || !creatorWallet.startsWith('0x')) {
    throw new Error('Please provide a valid creator wallet address');
  }
  
  if (!privateKey) {
    throw new Error('Please provide the private key for the fallback wallet');
  }

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log('🔍 Checking wallet connection...');
  console.log('Connected wallet:', await wallet.getAddress());
  
  if ((await wallet.getAddress()).toLowerCase() !== FALLBACK_WALLET.toLowerCase()) {
    throw new Error(`Wallet mismatch. Expected ${FALLBACK_WALLET}, got ${await wallet.getAddress()}`);
  }

  // Get current balance
  const balance = await provider.getBalance(FALLBACK_WALLET);
  const balanceETH = ethers.formatEther(balance);
  
  console.log(`💰 Current balance: ${balanceETH} ETH`);
  
  if (balance === 0n) {
    console.log('❌ No funds to distribute');
    return;
  }

  // Calculate distributions
  const umoAmount = (balance * BigInt(UMO_PERCENTAGE)) / 100n;
  const creatorAmount = (balance * BigInt(CREATOR_PERCENTAGE)) / 100n;
  const platformAmount = (balance * BigInt(PLATFORM_PERCENTAGE)) / 100n;
  
  // Reserve some ETH for gas fees (estimate 0.001 ETH total for 2 transactions)
  const gasReserve = ethers.parseEther('0.001');
  const availableForDistribution = balance - gasReserve;
  
  // Recalculate with gas reserve
  const adjustedUmoAmount = (availableForDistribution * BigInt(UMO_PERCENTAGE)) / 100n;
  const adjustedCreatorAmount = (availableForDistribution * BigInt(CREATOR_PERCENTAGE)) / 100n;
  
  console.log('\n📊 Distribution Plan:');
  console.log(`🎵 UMO (65%): ${ethers.formatEther(adjustedUmoAmount)} ETH → ${UMO_WALLET}`);
  console.log(`📤 Creator (30%): ${ethers.formatEther(adjustedCreatorAmount)} ETH → ${creatorWallet}`);
  console.log(`⚙️  Platform (5%): Remaining in wallet for gas and platform fees`);
  console.log(`⛽ Gas Reserve: ${ethers.formatEther(gasReserve)} ETH`);
  
  // Confirm before proceeding
  console.log('\n⚠️  WARNING: This will send real ETH transactions!');
  console.log('Press Ctrl+C to cancel, or continue to proceed...');
  
  // Wait a bit for user to read
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    // Send to UMO
    console.log('\n🚀 Sending to UMO...');
    const umoTx = await wallet.sendTransaction({
      to: UMO_WALLET,
      value: adjustedUmoAmount,
      gasLimit: 21000
    });
    
    console.log(`📝 UMO transaction: ${umoTx.hash}`);
    console.log('⏳ Waiting for confirmation...');
    await umoTx.wait();
    console.log('✅ UMO transfer confirmed!');
    
    // Send to Creator
    console.log('\n🚀 Sending to Creator...');
    const creatorTx = await wallet.sendTransaction({
      to: creatorWallet,
      value: adjustedCreatorAmount,
      gasLimit: 21000
    });
    
    console.log(`📝 Creator transaction: ${creatorTx.hash}`);
    console.log('⏳ Waiting for confirmation...');
    await creatorTx.wait();
    console.log('✅ Creator transfer confirmed!');
    
    // Check final balance
    const finalBalance = await provider.getBalance(FALLBACK_WALLET);
    console.log(`\n💰 Remaining balance: ${ethers.formatEther(finalBalance)} ETH`);
    
    console.log('\n🎉 Distribution complete!');
    console.log(`📊 Summary:`);
    console.log(`   UMO received: ${ethers.formatEther(adjustedUmoAmount)} ETH`);
    console.log(`   Creator received: ${ethers.formatEther(adjustedCreatorAmount)} ETH`);
    console.log(`   Platform kept: ${ethers.formatEther(finalBalance)} ETH`);
    
  } catch (error) {
    console.error('❌ Distribution failed:', error.message);
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
Usage: node distribute-existing-funds.js <creator-wallet> <private-key>

Example:
node distribute-existing-funds.js 0x1234...abcd 0xYOUR_PRIVATE_KEY

This will distribute the existing 0.0033 ETH as follows:
- 65% (0.002145 ETH) → UMO wallet
- 30% (0.00099 ETH) → Creator wallet  
- 5% (0.000165 ETH) → Platform wallet (minus gas fees)
`);
    process.exit(1);
  }
  
  const [creatorWallet, privateKey] = args;
  
  distributeFunds(creatorWallet, privateKey)
    .then(() => {
      console.log('✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { distributeFunds };