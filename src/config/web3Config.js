// src/config/web3Config.js - Web3 Configuration for UMO Repository

import UMOMomentsContract from '../contracts/UMOMoments.json';

// Contract addresses - UPDATE THESE WITH YOUR DEPLOYED CONTRACTS
export const CONTRACTS = {
  UMO_MOMENTS: {
    address: process.env.REACT_APP_UMO_MOMENTS_CONTRACT || UMOMomentsContract.address,
    abi: UMOMomentsContract.abi
  },
  
  // 0xSplits contract on Base Sepolia
  SPLITS_MAIN: {
    address: '0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE', // Base Sepolia
    abi: [
      // Simplified Splits ABI for the functions we need
      {
        "inputs": [
          {"type": "address[]", "name": "accounts"},
          {"type": "uint32[]", "name": "percentAllocations"},
          {"type": "uint32", "name": "distributorFee"},
          {"type": "address", "name": "controller"}
        ],
        "name": "createSplit",
        "outputs": [{"type": "address"}],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ]
  }
};

// Network configurations
export const NETWORKS = {
  BASE_SEPOLIA: {
    id: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: {
      name: 'BaseScan',
      url: 'https://sepolia.basescan.org'
    },
    currency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18
    }
  },
  
  BASE_MAINNET: {
    id: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: {
      name: 'BaseScan',
      url: 'https://basescan.org'
    },
    currency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18
    }
  }
};

// Default network for the app
export const DEFAULT_NETWORK = NETWORKS.BASE_SEPOLIA;

// Revenue split configurations
export const REVENUE_SPLITS = {
  STANDARD: {
    umo: 55,      // 55% to UMO (artist)
    uploader: 35, // 35% to moment uploader
    platform: 10 // 10% to platform
  },
  
  HIGH_RARITY: {
    umo: 50,      // 50% to UMO
    uploader: 40, // 40% to uploader (bonus for rare moments)
    platform: 10 // 10% to platform
  }
};

// NFT pricing (in ETH)
export const NFT_PRICING = {
  BASE_PRICE: '0.001', // ~$1 USD equivalent
  HIGH_RARITY_PRICE: '0.002' // ~$2 USD for rare moments
};

// Helper functions
export const contractHelpers = {
  /**
   * Get the appropriate revenue split based on moment rarity
   */
  getRevenueSplit: (rarityScore) => {
    return rarityScore >= 6 ? REVENUE_SPLITS.HIGH_RARITY : REVENUE_SPLITS.STANDARD;
  },

  /**
   * Get NFT price based on rarity
   */
  getNFTPrice: (rarityScore) => {
    return rarityScore >= 6 ? NFT_PRICING.HIGH_RARITY_PRICE : NFT_PRICING.BASE_PRICE;
  },

  /**
   * Format moment metadata for NFT
   */
  formatMomentMetadata: (moment) => {
    return {
      name: `UMO Moment: ${moment.songName}`,
      description: `${moment.momentDescription || `A moment from UMO's performance of "${moment.songName}"`} - Captured at ${moment.venueName}, ${moment.venueCity} on ${moment.performanceDate}.`,
      image: moment.mediaUrl,
      external_url: `${window.location.origin}/moments/${moment._id}`,
      attributes: [
        { trait_type: 'Song', value: moment.songName },
        { trait_type: 'Venue', value: moment.venueName },
        { trait_type: 'City', value: moment.venueCity },
        { trait_type: 'Date', value: moment.performanceDate },
        { trait_type: 'Rarity Tier', value: moment.rarityTier || 'common' },
        { trait_type: 'Rarity Score', value: moment.rarityScore || 0, display_type: 'number', max_value: 7 },
        { trait_type: 'Media Type', value: moment.mediaType || 'video' },
        { trait_type: 'Uploader', value: moment.user?.displayName || 'Unknown' },
        { trait_type: 'File Size (MB)', value: Math.round((moment.fileSize || 0) / 1024 / 1024), display_type: 'number' },
        { trait_type: 'Audio Quality', value: moment.audioQuality || 'good' },
        { trait_type: 'Video Quality', value: moment.videoQuality || 'good' },
        { trait_type: 'Moment Type', value: moment.momentType || 'performance' }
      ].concat(
        // Add set info if available
        moment.setName ? [{ trait_type: 'Set', value: moment.setName }] : []
      ).concat(
        // Add position if available
        moment.songPosition ? [{ trait_type: 'Song Position', value: moment.songPosition, display_type: 'number' }] : []
      ).concat(
        // Add emotional tags as separate traits
        moment.emotionalTags ? moment.emotionalTags.split(',').map(tag => ({
          trait_type: 'Emotion',
          value: tag.trim()
        })) : []
      ).concat(
        // Add instruments as separate traits
        moment.instruments ? moment.instruments.split(',').map(instrument => ({
          trait_type: 'Instrument',
          value: instrument.trim()
        })) : []
      ).filter(attr => attr.value !== undefined && attr.value !== null && attr.value !== ''),
      
      properties: {
        category: 'music',
        creator: moment.user?.displayName || 'Unknown',
        performance_id: moment.performanceId,
        moment_id: moment._id,
        created_at: moment.createdAt,
        rarity_score: moment.rarityScore,
        is_first_moment: moment.isFirstMomentForSong || false
      }
    };
  },

  /**
   * Get OpenSea URL for a token
   */
  getOpenSeaUrl: (contractAddress, tokenId, isMainnet = false) => {
    const baseUrl = isMainnet 
      ? 'https://opensea.io/assets/ethereum'
      : 'https://testnets.opensea.io/assets/base-sepolia';
    
    return `${baseUrl}/${contractAddress}/${tokenId}`;
  },

  /**
   * Get block explorer URL for a transaction
   */
  getBlockExplorerUrl: (txHash, isMainnet = false) => {
    const baseUrl = isMainnet 
      ? NETWORKS.BASE_MAINNET.blockExplorer.url
      : NETWORKS.BASE_SEPOLIA.blockExplorer.url;
    
    return `${baseUrl}/tx/${txHash}`;
  },

  /**
   * Format Wei to ETH with proper decimals
   */
  formatEthAmount: (weiAmount, decimals = 4) => {
    const eth = parseFloat(weiAmount) / 1e18;
    return eth.toFixed(decimals);
  },

  /**
   * Calculate USD value from ETH amount
   */
  calculateUsdValue: (ethAmount, ethPriceUsd = 3500) => {
    return (parseFloat(ethAmount) * ethPriceUsd).toFixed(2);
  }
};

// Validation helpers
export const validation = {
  /**
   * Check if address is valid Ethereum address
   */
  isValidAddress: (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  },

  /**
   * Check if we're on the correct network
   */
  isCorrectNetwork: (chainId) => {
    return chainId === DEFAULT_NETWORK.id;
  },

  /**
   * Validate moment data before NFT creation
   */
  validateMomentForNFT: (moment) => {
    const errors = [];
    
    if (!moment.songName?.trim()) {
      errors.push('Song name is required');
    }
    
    if (!moment.venueName?.trim()) {
      errors.push('Venue name is required');
    }
    
    if (!moment.mediaUrl?.trim()) {
      errors.push('Media URL is required');
    }
    
    if (!moment.performanceDate?.trim()) {
      errors.push('Performance date is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// Export everything as default as well for convenience
export default {
  CONTRACTS,
  NETWORKS,
  DEFAULT_NETWORK,
  REVENUE_SPLITS,
  NFT_PRICING,
  contractHelpers,
  validation
};