// 0xSplits Integration
// File: src/utils/splitsIntegration.js
/* eslint-disable no-undef */
import { encodeFunctionData, parseEther } from 'viem';

// React hook for splits integration
import { useWalletClient, usePublicClient } from 'wagmi';

// 0xSplits contract ABI (simplified for main functions we need)
export const SPLITS_ABI = [
  {
    "inputs": [
      {"internalType": "address[]", "name": "accounts", "type": "address[]"},
      {"internalType": "uint32[]", "name": "percentAllocations", "type": "uint32[]"},
      {"internalType": "uint32", "name": "distributorFee", "type": "uint32"},
      {"internalType": "address", "name": "controller", "type": "address"}
    ],
    "name": "createSplit",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "split", "type": "address"},
      {"internalType": "address[]", "name": "accounts", "type": "address[]"},
      {"internalType": "uint32[]", "name": "percentAllocations", "type": "uint32[]"},
      {"internalType": "uint32", "name": "distributorFee", "type": "uint32"},
      {"internalType": "address", "name": "controller", "type": "address"}
    ],
    "name": "updateSplit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "split", "type": "address"},
      {"internalType": "address", "name": "token", "type": "address"},
      {"internalType": "address[]", "name": "accounts", "type": "address[]"},
      {"internalType": "uint32[]", "name": "percentAllocations", "type": "uint32[]"},
      {"internalType": "uint32", "name": "distributorFee", "type": "uint32"},
      {"internalType": "address", "name": "distributorAddress", "type": "address"}
    ],
    "name": "distributeETH",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Default split configurations
// 0xSplits uses basis points: 1000000 = 100%
export const DEFAULT_SPLITS = {
  // 65% UMO, 30% Creator, 5% Platform
  STANDARD: {
    platformFee: 50000,    // 5% in basis points (5% * 10000)
    creatorFee: 300000,    // 30% in basis points (30% * 10000)
    umoFee: 650000,        // 65% in basis points (65% * 10000)
  },
  
  // Same split for all moments - consistent structure
  HIGH_RARITY: {
    platformFee: 50000,    // 5%
    creatorFee: 300000,    // 30%
    umoFee: 650000,        // 65%
  }
};

export class SplitsManager {
  constructor(walletClient, publicClient) {
    this.walletClient = walletClient;
    this.publicClient = publicClient;
    // 0xSplits SplitMain contract address for Base Sepolia 
    // TODO: Verify this address is correct for Base Sepolia
    this.splitsMainAddress = '0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE';
    console.log('🔧 Initializing SplitsManager with address:', this.splitsMainAddress);
  }

  /**
   * Create a new split contract for a moment
   */
  async createMomentSplit(moment, uploaderAddress, customSplit = null) {
    try {
      console.log('🔧 Creating 0xSplits contract...');
      const splitConfig = this.getSplitConfiguration(moment, uploaderAddress, customSplit);
      
      console.log('📊 Split configuration:', {
        accounts: splitConfig.accounts,
        percentAllocations: splitConfig.percentAllocations,
        controller: splitConfig.controller,
        splitsMainAddress: this.splitsMainAddress
      });
      
      // Validate addresses
      for (const account of splitConfig.accounts) {
        if (!account || account.length !== 42 || !account.startsWith('0x')) {
          throw new Error(`Invalid account address: ${account}`);
        }
      }
      
      // Validate percentages sum to 1000000 (100%)
      const totalPercent = splitConfig.percentAllocations.reduce((sum, p) => sum + p, 0);
      if (totalPercent !== 1000000) {
        throw new Error(`Percentages must sum to 1000000, got: ${totalPercent}`);
      }
      
      // Try different function names - 0xSplits might use different naming
      console.log('🧪 Testing contract call with parameters:');
      console.log('Address:', this.splitsMainAddress);
      console.log('Function: createSplit');
      console.log('Args:', [
        splitConfig.accounts,
        splitConfig.percentAllocations,
        0, // No distributor fee
        splitConfig.controller
      ]);
      
      const hash = await this.walletClient.writeContract({
        address: this.splitsMainAddress,
        abi: SPLITS_ABI,
        functionName: 'createSplit',
        args: [
          splitConfig.accounts,
          splitConfig.percentAllocations,
          0, // No distributor fee
          splitConfig.controller
        ],
        gas: 500000n, // Add explicit gas limit
      });

      console.log('📡 Split creation transaction sent:', hash);

      // Wait for transaction and get split address
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      console.log('📋 Transaction receipt:', receipt);
      
      const splitAddress = this.extractSplitAddress(receipt);
      
      console.log('✅ Split created successfully:', splitAddress);
      
      return {
        splitAddress,
        txHash: hash,
        configuration: splitConfig
      };
    } catch (error) {
      console.error('❌ Failed to create split:', error);
      console.error('Error details:', {
        message: error.message,
        cause: error.cause,
        data: error.data
      });
      throw new Error(`Split creation failed: ${error.message}`);
    }
  }

  /**
   * Get split configuration based on moment details
   */
  getSplitConfiguration(moment, uploaderAddress, customSplit = null) {
    // Use custom split if provided, otherwise use defaults based on rarity
    const useHighRarity = moment.rating >= 6; // Rarity 6-7 gets better uploader split
    const defaultSplit = useHighRarity ? DEFAULT_SPLITS.HIGH_RARITY : DEFAULT_SPLITS.STANDARD;
    
    const split = customSplit || defaultSplit;
    
    // Default addresses
    const PLATFORM_ADDRESS = process.env.REACT_APP_PLATFORM_ADDRESS || '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96';
    const UMO_ADDRESS = '0x2e8D1eAd7Ba51e04c2A8ec40a8A3eD49CC4E1ceF'; // UMO's official address
    
    return {
      accounts: [
        PLATFORM_ADDRESS,
        uploaderAddress,
        UMO_ADDRESS
      ],
      percentAllocations: [
        split.platformFee,
        split.creatorFee,
        split.umoFee
      ],
      controller: PLATFORM_ADDRESS, // Platform controls the split
      distributorFee: 0
    };
  }

  /**
   * Extract split address from transaction receipt
   */
  extractSplitAddress(receipt) {
    console.log('🔍 Extracting split address from receipt:', receipt);
    console.log('📋 Receipt logs count:', receipt.logs.length);
    
    // Method 1: Look for CreateSplit event
    // The actual event signature for CreateSplit(address indexed split, bytes32 indexed hash)
    const createSplitSignature = '0x8b0e0cd1a643dbcc58b6b32d4ea1e46a3e08ba9b9c3d7e4e5a1b2c3d4e5f6a7b';
    
    for (let i = 0; i < receipt.logs.length; i++) {
      const log = receipt.logs[i];
      console.log(`📄 Log ${i}:`, {
        address: log.address,
        topics: log.topics,
        data: log.data
      });
      
      try {
        // Check if this log is from the splits contract
        if (log.address.toLowerCase() === this.splitsMainAddress.toLowerCase()) {
          console.log('✅ Found log from splits contract');
          
          // For CreateSplit, the split address should be in topics[1]
          if (log.topics && log.topics.length > 1) {
            // Extract address from the second topic (first indexed parameter)
            const splitAddress = `0x${log.topics[1].slice(26)}`;
            console.log('🎯 Extracted split address from topics:', splitAddress);
            return splitAddress;
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error parsing log ${i}:`, error);
        continue;
      }
    }
    
    // Method 2: Look for any new contract deployment
    if (receipt.contractAddress) {
      console.log('📦 Using contractAddress from receipt:', receipt.contractAddress);
      return receipt.contractAddress;
    }
    
    // Method 3: If all else fails, try to decode data manually
    console.log('🔧 Attempting manual extraction from transaction logs...');
    for (const log of receipt.logs) {
      if (log.data && log.data.length > 2) {
        console.log('📊 Raw log data:', log.data);
        // Sometimes the address might be in the data field
      }
    }
    
    throw new Error('Split address not found in transaction receipt');
  }

  /**
   * Update existing split (if platform controls it)
   */
  async updateMomentSplit(splitAddress, moment, uploaderAddress, newSplit) {
    try {
      const splitConfig = this.getSplitConfiguration(moment, uploaderAddress, newSplit);
      
      const hash = await this.walletClient.writeContract({
        address: this.splitsMainAddress,
        abi: SPLITS_ABI,
        functionName: 'updateSplit',
        args: [
          splitAddress,
          splitConfig.accounts,
          splitConfig.percentAllocations,
          0,
          splitConfig.controller
        ],
      });

      return { txHash: hash, configuration: splitConfig };
    } catch (error) {
      console.error('Failed to update split:', error);
      throw new Error(`Split update failed: ${error.message}`);
    }
  }

  /**
   * Trigger distribution of accumulated ETH
   */
  async distributeSplitETH(splitAddress, moment, uploaderAddress) {
    try {
      const splitConfig = this.getSplitConfiguration(moment, uploaderAddress);
      
      const hash = await this.walletClient.writeContract({
        address: this.splitsMainAddress,
        abi: SPLITS_ABI,
        functionName: 'distributeETH',
        args: [
          splitAddress,
          '0x0000000000000000000000000000000000000000', // ETH
          splitConfig.accounts,
          splitConfig.percentAllocations,
          0,
          splitConfig.controller
        ],
      });

      return { txHash: hash };
    } catch (error) {
      console.error('Failed to distribute split:', error);
      throw new Error(`Split distribution failed: ${error.message}`);
    }
  }

  /**
   * Get split balance for preview
   */
  async getSplitBalance(splitAddress) {
    try {
      const balance = await this.publicClient.getBalance({
        address: splitAddress,
      });
      return balance;
    } catch (error) {
      console.error('Failed to get split balance:', error);
      return 0n;
    }
  }

  /**
   * Calculate individual allocations from total amount
   */
  calculateAllocations(totalAmount, moment, uploaderAddress) {
    const splitConfig = this.getSplitConfiguration(moment, uploaderAddress);
    const total = BigInt(totalAmount);
    
    return {
      platform: (total * BigInt(splitConfig.percentAllocations[0])) / 1000000n,
      creator: (total * BigInt(splitConfig.percentAllocations[1])) / 1000000n,
      umo: (total * BigInt(splitConfig.percentAllocations[2])) / 1000000n,
      configuration: splitConfig
    };
  }
}


export const useSplits = () => {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  const splitsManager = walletClient && publicClient 
    ? new SplitsManager(walletClient, publicClient)
    : null;

  const createSplit = async (moment, uploaderAddress, customSplit = null) => {
    if (!splitsManager) throw new Error('Wallet not connected');
    return await splitsManager.createMomentSplit(moment, uploaderAddress, customSplit);
  };

  const distributeSplit = async (splitAddress, moment, uploaderAddress) => {
    if (!splitsManager) throw new Error('Wallet not connected');
    return await splitsManager.distributeSplitETH(splitAddress, moment, uploaderAddress);
  };

  const getSplitBalance = async (splitAddress) => {
    if (!splitsManager) return 0n;
    return await splitsManager.getSplitBalance(splitAddress);
  };

  const calculateAllocations = (totalAmount, moment, uploaderAddress) => {
    if (!splitsManager) return null;
    return splitsManager.calculateAllocations(totalAmount, moment, uploaderAddress);
  };

  return {
    createSplit,
    distributeSplit,
    getSplitBalance,
    calculateAllocations,
    isReady: !!splitsManager
  };
};

export default SplitsManager;