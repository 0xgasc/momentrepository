// Web3 Configuration and Setup
// File: src/config/web3Config.js

import { createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';
import UMOMomentsABI from '../contracts/UMOMoments.json';

export const NETWORKS = {
  BASE_TESTNET: {
    chainId: '0x14A34', // 84532 in hex
    chainName: 'Base Sepolia Testnet',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://sepolia.base.org'],
    blockExplorerUrls: ['https://sepolia-explorer.base.org'],
  },
};

export const CONTRACTS = {
  // Your deployed contract
  UMO_MOMENTS: {
    address: process.env.REACT_APP_UMO_MOMENTS_CONTRACT,
    abi: UMOMomentsABI.abi,
  },
  
  // 0xSplits contracts on Base testnet
  SPLITS_MAIN: {
    address: '0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE', // Base testnet
    abi: [], // Standard 0xSplits ABI
  },
};

const projectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains: [baseSepolia], // Start with testnet
  connectors: [
    injected(),
    coinbaseWallet({
      appName: 'UMO Repository', 
      appLogoUrl: 'https://your-logo-url.com/logo.png'
    }),
    walletConnect({ projectId }),
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
});

// Contract interaction helpers
export const contractHelpers = {
  // Moment metadata structure (NFT-ready)
  formatMomentMetadata: (moment) => ({
    name: `UMO Moment #${moment._id}`,
    description: moment.description || `A moment from UMO's performance`,
    image: moment.mediaUrl, // Irys/Arweave URL
    external_url: `https://umo-repository.com/moments/${moment._id}`,
    attributes: [
      {
        trait_type: 'Rarity',
        value: moment.rating,
        max_value: 7
      },
      {
        trait_type: 'Performance Date',
        value: moment.performanceDate
      },
      {
        trait_type: 'Venue',
        value: moment.venue
      },
      {
        trait_type: 'City',
        value: moment.city
      },
      {
        trait_type: 'Upload Date',
        value: moment.uploadDate
      },
      {
        trait_type: 'File Type',
        value: moment.mediaType
      },
      {
        trait_type: 'Uploader',
        value: moment.uploadedBy
      }
    ],
    properties: {
      files: [{
        uri: moment.mediaUrl,
        type: moment.mediaType
      }],
      category: 'video' // or 'audio' based on mediaType
    }
  }),

  // Format splits for 0xSplits
  formatSplits: (moment, customSplits = null) => {
    const defaultSplits = [
      {
        account: '0x...', // Platform fee (5%)
        percentAllocation: 50000 // 5% in basis points
      },
      {
        account: moment.uploadedByAddress || '0x...', // Uploader (15%)
        percentAllocation: 150000
      },
      {
        account: '0x...', // Artist/UMO (80%)
        percentAllocation: 800000
      }
    ];
    
    return customSplits || defaultSplits;
  }
};

// Error handling
export const Web3Error = {
  NETWORK_NOT_SUPPORTED: 'Please connect to Base Sepolia testnet',
  WALLET_NOT_CONNECTED: 'Please connect your wallet',
  TRANSACTION_REJECTED: 'Transaction was rejected',
  INSUFFICIENT_FUNDS: 'Insufficient funds for transaction',
};

export default wagmiConfig;