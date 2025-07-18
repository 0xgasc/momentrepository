// Quick test to check if the 0xSplits address exists on Base Sepolia
const { ethers } = require('ethers');

const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
const SPLITS_ADDRESS = '0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE';

async function testSplitsAddress() {
  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
  
  try {
    console.log('🔍 Testing 0xSplits address on Base Sepolia...');
    console.log('Address:', SPLITS_ADDRESS);
    
    // Check if address has code
    const code = await provider.getCode(SPLITS_ADDRESS);
    console.log('Contract code length:', code.length);
    
    if (code === '0x' || code.length <= 2) {
      console.log('❌ No contract deployed at this address');
      console.log('This explains why splits creation is failing!');
      
      console.log('\n💡 Possible solutions:');
      console.log('1. Find the correct 0xSplits address for Base Sepolia');
      console.log('2. Deploy your own splits contract');
      console.log('3. Use a different revenue sharing method');
      console.log('4. Continue using creator wallet fallback (current behavior)');
    } else {
      console.log('✅ Contract exists at this address');
      console.log('Code preview:', code.slice(0, 100) + '...');
      
      // Try to get basic info
      console.log('\nTesting basic interaction...');
      // This would require the actual ABI to test properly
    }
    
  } catch (error) {
    console.error('❌ Error testing address:', error.message);
  }
}

testSplitsAddress();