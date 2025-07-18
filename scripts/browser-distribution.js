/**
 * Browser-based Manual Distribution for UMO Archive Funds
 * 
 * Copy and paste this into your browser console while connected to MetaMask
 * on Base Sepolia with the wallet that controls the fallback address.
 */

// Configuration
const FALLBACK_WALLET = '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96';
const UMO_WALLET = '0x2e8D1eAd7Ba51e04c2A8ec40a8A3eD49CC4E1ceF';
const CREATOR_WALLET = '0x...'; // REPLACE WITH ACTUAL CREATOR WALLET

// Distribution percentages
const UMO_PERCENTAGE = 65;
const CREATOR_PERCENTAGE = 30;
const PLATFORM_PERCENTAGE = 5;

async function distributeExistingFunds() {
  try {
    // Check if we have Web3
    if (!window.ethereum) {
      throw new Error('MetaMask not found. Please install MetaMask.');
    }

    // Connect to wallet
    console.log('🔗 Connecting to wallet...');
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    const currentAccount = accounts[0];
    
    console.log('🔍 Connected account:', currentAccount);
    
    if (currentAccount.toLowerCase() !== FALLBACK_WALLET.toLowerCase()) {
      throw new Error(`Wrong wallet connected. Please connect to ${FALLBACK_WALLET}`);
    }

    // Check current balance
    const balanceHex = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [FALLBACK_WALLET, 'latest']
    });
    
    const balance = BigInt(balanceHex);
    const balanceETH = Number(balance) / 1e18;
    
    console.log(`💰 Current balance: ${balanceETH} ETH`);
    
    if (balance === 0n) {
      console.log('❌ No funds to distribute');
      return;
    }

    // Calculate amounts (reserve 0.001 ETH for gas)
    const gasReserve = BigInt(1e15); // 0.001 ETH
    const availableForDistribution = balance - gasReserve;
    
    const umoAmount = (availableForDistribution * BigInt(UMO_PERCENTAGE)) / 100n;
    const creatorAmount = (availableForDistribution * BigInt(CREATOR_PERCENTAGE)) / 100n;
    
    console.log('\n📊 Distribution Plan:');
    console.log(`🎵 UMO (65%): ${Number(umoAmount) / 1e18} ETH → ${UMO_WALLET}`);
    console.log(`📤 Creator (30%): ${Number(creatorAmount) / 1e18} ETH → ${CREATOR_WALLET}`);
    console.log(`⚙️  Platform (5%): Remaining for gas and fees`);
    
    // Confirm with user
    const confirmed = confirm(`
🚨 CONFIRM DISTRIBUTION 🚨

This will send:
• ${Number(umoAmount) / 1e18} ETH to UMO wallet
• ${Number(creatorAmount) / 1e18} ETH to Creator wallet

Are you sure you want to proceed?
    `);
    
    if (!confirmed) {
      console.log('❌ Distribution cancelled by user');
      return;
    }

    // Send to UMO
    console.log('\n🚀 Sending to UMO...');
    const umoTxHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: currentAccount,
        to: UMO_WALLET,
        value: '0x' + umoAmount.toString(16),
        gas: '0x5208' // 21000 gas
      }]
    });
    
    console.log(`📝 UMO transaction: https://sepolia.basescan.org/tx/${umoTxHash}`);
    
    // Send to Creator
    console.log('\n🚀 Sending to Creator...');
    const creatorTxHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: currentAccount,
        to: CREATOR_WALLET,
        value: '0x' + creatorAmount.toString(16),
        gas: '0x5208' // 21000 gas
      }]
    });
    
    console.log(`📝 Creator transaction: https://sepolia.basescan.org/tx/${creatorTxHash}`);
    
    console.log('\n🎉 Distribution transactions sent!');
    console.log(`🔗 UMO TX: https://sepolia.basescan.org/tx/${umoTxHash}`);
    console.log(`🔗 Creator TX: https://sepolia.basescan.org/tx/${creatorTxHash}`);
    
    // Wait a bit and check final balance
    setTimeout(async () => {
      const finalBalanceHex = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [FALLBACK_WALLET, 'latest']
      });
      const finalBalance = BigInt(finalBalanceHex);
      console.log(`\n💰 Final balance: ${Number(finalBalance) / 1e18} ETH`);
    }, 5000);
    
  } catch (error) {
    console.error('❌ Distribution failed:', error.message);
    alert(`Distribution failed: ${error.message}`);
  }
}

// Instructions
console.log(`
🎯 UMO Archive Fund Distribution Tool

To use this tool:

1. Make sure you're connected to Base Sepolia network
2. Connect MetaMask to wallet: ${FALLBACK_WALLET}
3. Update CREATOR_WALLET variable above with the actual creator address
4. Run: distributeExistingFunds()

Current balance will be distributed as:
• 65% to UMO wallet (${UMO_WALLET})
• 30% to Creator wallet (update CREATOR_WALLET first!)
• 5% remains for platform fees and gas
`);

// Expose function globally
window.distributeExistingFunds = distributeExistingFunds;