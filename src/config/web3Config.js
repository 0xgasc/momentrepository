// src/config/web3Config.js - UPDATED for ERC1155

import UMOMomentsERC1155Contract from '../contracts/UMOMomentsERC1155.json';

// ✅ UPDATED: Contract addresses for ERC1155
export const CONTRACTS = {
  UMO_MOMENTS: {
    address: process.env.REACT_APP_UMO_MOMENTS_CONTRACT || UMOMomentsERC1155Contract.address,
    abi: UMOMomentsERC1155Contract.abi
  },
  
  // 0xSplits contract on Base Sepolia (same as before)
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

// Network configurations (same as before)
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

// Revenue split configurations (same as before)
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

// NFT pricing (in ETH) - same as before
export const NFT_PRICING = {
  BASE_PRICE: '0.001', // ~$1 USD equivalent
  HIGH_RARITY_PRICE: '0.002' // ~$2 USD for rare moments
};

// ✅ UPDATED: Helper functions for ERC1155
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
   * ✅ UPDATED: Format moment metadata for ERC1155 NFT
   */
  formatMomentMetadata: (moment) => {
    // ✅ ERC1155: Better image/animation handling for OpenSea
    let imageUrl, animationUrl;
    
    if (moment.mediaType === 'video') {
      // For videos: Use a generated thumbnail
      imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(moment.songName)}&size=512&background=1e3a8a&color=ffffff&bold=true`;
      animationUrl = moment.mediaUrl;
    } else if (moment.mediaType === 'audio') {
      imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(moment.songName)}&size=512&background=dc2626&color=ffffff&bold=true`;
      animationUrl = undefined;
    } else {
      imageUrl = moment.mediaUrl;
      animationUrl = undefined;
    }

    return {
      name: `${moment.songName} - ${moment.venueName} (${moment.performanceDate})`,
      description: `${moment.momentDescription || `A moment from UMO's performance of "${moment.songName}"`} - Captured at ${moment.venueName}, ${moment.venueCity} on ${moment.performanceDate}.`,
      image: imageUrl,
      animation_url: animationUrl, // ✅ Important for video/audio files
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
        { trait_type: 'Moment Type', value: moment.momentType || 'performance' },
        { trait_type: 'First Moment for Song', value: moment.isFirstMomentForSong ? 'Yes' : 'No' }
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
        is_first_moment: moment.isFirstMomentForSong || false,
        // ✅ ERC1155 specific properties
        token_standard: 'erc1155',
        supply: moment.nftMintedCount || 0
      }
    };
  },

  /**
   * ✅ UPDATED: Get OpenSea URL for ERC1155 token
   */
  getOpenSeaUrl: (contractAddress, tokenId, isMainnet = false) => {
    const baseUrl = isMainnet 
      ? 'https://opensea.io/assets/ethereum'
      : 'https://testnets.opensea.io/assets/base-sepolia';
    
    // ✅ ERC1155: Same URL format, just numeric tokenId
    return `${baseUrl}/${contractAddress}/${tokenId}`;
  },

  /**
   * Get block explorer URL for a transaction (same as before)
   */
  getBlockExplorerUrl: (txHash, isMainnet = false) => {
    const baseUrl = isMainnet 
      ? NETWORKS.BASE_MAINNET.blockExplorer.url
      : NETWORKS.BASE_SEPOLIA.blockExplorer.url;
    
    return `${baseUrl}/tx/${txHash}`;
  },

  /**
   * Format Wei to ETH with proper decimals (same as before)
   */
  formatEthAmount: (weiAmount, decimals = 4) => {
    const eth = parseFloat(weiAmount) / 1e18;
    return eth.toFixed(decimals);
  },

  /**
   * Calculate USD value from ETH amount (same as before)
   */
  calculateUsdValue: (ethAmount, ethPriceUsd = 3500) => {
    return (parseFloat(ethAmount) * ethPriceUsd).toFixed(2);
  },

  /**
   * ✅ NEW: ERC1155 specific helpers
   */
  
  /**
   * Check if token ID is valid (numeric)
   */
  isValidTokenId: (tokenId) => {
    return typeof tokenId === 'number' && tokenId >= 0 && Number.isInteger(tokenId);
  },

  /**
   * Format token ID for display
   */
  formatTokenId: (tokenId) => {
    return `#${tokenId}`;
  },

  /**
   * Get supply display text for ERC1155
   */
  getSupplyDisplayText: (currentSupply, maxSupply = 0) => {
    if (maxSupply === 0) {
      return `${currentSupply} minted • Open Edition`;
    } else {
      return `${currentSupply}/${maxSupply} minted`;
    }
  },

  /**
   * Check if ERC1155 minting is active
   */
  isERC1155MintingActive: (moment) => {
    if (!moment.nftMinted || !moment.nftMintEndTime) return false;
    return new Date() < new Date(moment.nftMintEndTime);
  },

  /**
   * Get ERC1155 collection info for OpenSea
   */
  getERC1155CollectionInfo: (contractAddress) => {
    return {
      name: 'UMO Moments',
      description: 'Live performance moments from UMO concerts',
      image: 'https://ui-avatars.com/api/?name=UMO+Moments&size=512&background=1e3a8a&color=ffffff&bold=true',
      external_link: window.location.origin,
      seller_fee_basis_points: 1000, // 10% royalty
      fee_recipient: contractAddress
    };
  }
};

// ✅ UPDATED: Validation helpers for ERC1155
export const validation = {
  /**
   * Check if address is valid Ethereum address (same as before)
   */
  isValidAddress: (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  },

  /**
   * Check if we're on the correct network (same as before)
   */
  isCorrectNetwork: (chainId) => {
    return chainId === DEFAULT_NETWORK.id;
  },

  /**
   * ✅ UPDATED: Validate moment data for ERC1155 NFT creation
   */
  validateMomentForERC1155NFT: (moment) => {
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
    
    // ✅ ERC1155: Check if moment already has NFT
    if (moment.nftMinted && typeof moment.nftTokenId === 'number') {
      errors.push('ERC1155 NFT already exists for this moment');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * ✅ NEW: Validate ERC1155 mint parameters
   */
  validateERC1155MintParams: (tokenId, quantity, maxQuantity = 10) => {
    const errors = [];
    
    if (!contractHelpers.isValidTokenId(tokenId)) {
      errors.push('Invalid token ID');
    }
    
    if (!Number.isInteger(quantity) || quantity < 1) {
      errors.push('Quantity must be a positive integer');
    }
    
    if (quantity > maxQuantity) {
      errors.push(`Quantity cannot exceed ${maxQuantity}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// ✅ ERC1155 specific constants
export const ERC1155_CONSTANTS = {
  MAX_MINT_PER_TRANSACTION: 10,
  DEFAULT_MINT_DURATION_DAYS: 7,
  UNLIMITED_SUPPLY: 0,
  TOKEN_STANDARD: 'erc1155'
};

// Export everything as default as well for convenience
export default {
  CONTRACTS,
  NETWORKS,
  DEFAULT_NETWORK,
  REVENUE_SPLITS,
  NFT_PRICING,
  contractHelpers,
  validation,
  ERC1155_CONSTANTS
};