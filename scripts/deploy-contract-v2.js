// Deploy UMOMomentsERC1155V2 with built-in revenue splits
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../setlist-proxy/.env') });

// Contract configuration
const DEPLOYMENT_CONFIG = {
  // Base Sepolia network
  network: {
    name: 'Base Sepolia',
    rpc: 'https://sepolia.base.org',
    chainId: 84532
  },
  
  // Contract parameters
  contract: {
    name: 'UMOMomentsERC1155V2',
    baseURI: 'https://devnet.irys.xyz/', // Your current metadata URI
    
    // Default wallets for splits
    defaultWallets: {
      umo: '0x2e8D1eAd7Ba51e04c2A8ec40a8A3eD49CC4E1ceF',     // UMO wallet
      platform: '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96', // Platform wallet
      // Creator wallet will be provided per NFT
    }
  }
};

async function compileContract() {
  console.log('🔨 Compiling contract...');
  
  // Read the contract source
  const contractSource = fs.readFileSync(
    path.join(__dirname, '../contracts/UMOMomentsERC1155V2.sol'),
    'utf8'
  );
  
  console.log('✅ Contract source loaded');
  console.log('📝 Contract length:', contractSource.length, 'characters');
  
  // For deployment, you'll need to compile this with Hardhat, Foundry, or Remix
  console.log('\n📋 NEXT STEPS FOR COMPILATION:');
  console.log('1. Use Remix IDE (https://remix.ethereum.org)');
  console.log('2. Upload UMOMomentsERC1155V2.sol');
  console.log('3. Install OpenZeppelin dependencies:');
  console.log('   - @openzeppelin/contracts/token/ERC1155/ERC1155.sol');
  console.log('   - @openzeppelin/contracts/access/Ownable.sol');
  console.log('   - @openzeppelin/contracts/security/ReentrancyGuard.sol');
  console.log('4. Compile with Solidity 0.8.0+');
  console.log('5. Deploy to Base Sepolia');
  
  return contractSource;
}

async function deployWithWallet() {
  console.log('\n🚀 Deploying with wallet...');
  
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY not found in environment variables');
    console.log('💡 Add your private key to setlist-proxy/.env file');
    return;
  }
  
  try {
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(DEPLOYMENT_CONFIG.network.rpc);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log('💰 Deployer address:', wallet.address);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    const balanceETH = ethers.formatEther(balance);
    console.log('💳 Balance:', balanceETH, 'ETH');
    
    if (parseFloat(balanceETH) < 0.001) {
      console.warn('⚠️ Low balance! You need ETH for deployment gas fees');
      console.log('🔗 Get Base Sepolia ETH: https://faucet.quicknode.com/base/sepolia');
    }
    
    // Note: For actual deployment, you'd need the compiled bytecode
    console.log('\n📋 MANUAL DEPLOYMENT STEPS:');
    console.log('1. Go to Remix IDE');
    console.log('2. Compile the contract');
    console.log('3. Connect MetaMask to Base Sepolia');
    console.log('4. Deploy with constructor parameter:', `"${DEPLOYMENT_CONFIG.contract.baseURI}"`);
    console.log('5. Copy the deployed contract address');
    
  } catch (error) {
    console.error('❌ Deployment error:', error.message);
  }
}

async function generateDeploymentInfo() {
  console.log('\n📄 Generating deployment information...');
  
  const deploymentInfo = {
    network: DEPLOYMENT_CONFIG.network,
    contract: DEPLOYMENT_CONFIG.contract,
    timestamp: new Date().toISOString(),
    deployer: process.env.PRIVATE_KEY ? 'Configured' : 'Not configured',
    
    instructions: {
      remix: [
        '1. Go to https://remix.ethereum.org',
        '2. Create new file: UMOMomentsERC1155V2.sol',
        '3. Paste the contract code',
        '4. Install dependencies in File Explorer:',
        '   - @openzeppelin/contracts',
        '5. Compile with Solidity 0.8.0+',
        '6. Switch to Deploy tab',
        '7. Select "Injected Web3" environment',
        '8. Connect MetaMask to Base Sepolia',
        '9. Enter constructor parameter: "https://devnet.irys.xyz/"',
        '10. Click Deploy'
      ],
      
      postDeployment: [
        '1. Copy the deployed contract address',
        '2. Update src/contracts/UMOMomentsERC1155.json',
        '3. Update setlist-proxy/server.js to use new contract',
        '4. Test with a small NFT creation',
        '5. Verify revenue splitting works'
      ]
    }
  };
  
  // Save deployment info
  const deploymentInfoPath = path.join(__dirname, 'deployment-info-v2.json');
  fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log('✅ Deployment info saved to:', deploymentInfoPath);
  return deploymentInfo;
}

async function createUpdatedContractJSON() {
  console.log('\n📝 Creating updated contract JSON template...');
  
  // This is a template - you'll need to fill in the actual ABI and address after deployment
  const contractTemplate = {
    "address": "DEPLOYED_CONTRACT_ADDRESS_HERE", // Fill this after deployment
    "abi": [
      // Basic functions - you'll get the full ABI from Remix after compilation
      {
        "type": "constructor",
        "inputs": [{"type": "string", "name": "baseURI"}]
      },
      {
        "type": "function",
        "name": "createMomentEdition",
        "inputs": [
          {"type": "string", "name": "momentId"},
          {"type": "string", "name": "metadataURI"},
          {"type": "uint256", "name": "mintPrice"},
          {"type": "uint256", "name": "mintDuration"},
          {"type": "uint256", "name": "maxSupply"},
          {"type": "address", "name": "umoWallet"},
          {"type": "address", "name": "creatorWallet"},
          {"type": "address", "name": "platformWallet"}
        ],
        "outputs": [{"type": "uint256"}]
      },
      {
        "type": "function",
        "name": "mintMoment",
        "stateMutability": "payable",
        "inputs": [
          {"type": "uint256", "name": "tokenId"},
          {"type": "uint256", "name": "quantity"}
        ]
      },
      {
        "type": "function",
        "name": "updateRevenueSplit",
        "inputs": [
          {"type": "uint256", "name": "tokenId"},
          {"type": "address", "name": "newUmoWallet"},
          {"type": "address", "name": "newCreatorWallet"},
          {"type": "address", "name": "newPlatformWallet"}
        ]
      }
      // Note: Get the complete ABI from Remix after compilation
    ]
  };
  
  const templatePath = path.join(__dirname, '../src/contracts/UMOMomentsERC1155V2.json');
  fs.writeFileSync(templatePath, JSON.stringify(contractTemplate, null, 2));
  
  console.log('✅ Contract template created at:', templatePath);
  console.log('⚠️ Remember to update with actual ABI and address after deployment!');
}

async function main() {
  console.log('🚀 UMO Moments ERC1155 V2 Deployment Script');
  console.log('='.repeat(50));
  
  try {
    // Step 1: Compile contract
    await compileContract();
    
    // Step 2: Check deployment readiness
    await deployWithWallet();
    
    // Step 3: Generate deployment info
    await generateDeploymentInfo();
    
    // Step 4: Create contract template
    await createUpdatedContractJSON();
    
    console.log('\n🎉 Deployment preparation complete!');
    console.log('\n📋 SUMMARY:');
    console.log('✅ Contract source ready');
    console.log('✅ Deployment info generated');
    console.log('✅ Contract template created');
    console.log('\n🔗 Next: Deploy via Remix IDE');
    
  } catch (error) {
    console.error('❌ Deployment preparation failed:', error);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  DEPLOYMENT_CONFIG,
  compileContract,
  deployWithWallet,
  generateDeploymentInfo
};