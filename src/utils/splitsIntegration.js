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
export const DEFAULT_SPLITS = {
  // 65% UMO, 30% Creator, 5% Platform
  STANDARD: {
    platformFee: 50000,    // 5% in basis points (5 * 1000)
    creatorFee: 300000,    // 30%
    umoFee: 650000,        // 65%
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
    this.splitsMainAddress = '0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE'; // Base Sepolia
  }

  /**
   * Create a new split contract for a moment
   */
  async createMomentSplit(moment, uploaderAddress, customSplit = null) {
    try {
      const splitConfig = this.getSplitConfiguration(moment, uploaderAddress, customSplit);
      
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
      });

      // Wait for transaction and get split address
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      const splitAddress = this.extractSplitAddress(receipt);
      
      return {
        splitAddress,
        txHash: hash,
        configuration: splitConfig
      };
    } catch (error) {
      console.error('Failed to create split:', error);
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
    // Find the SplitCreated event in logs
    for (const log of receipt.logs) {
      try {
        // This is a simplified version - in practice you'd decode the event properly
        if (log.topics[0] === '0x...') { // SplitCreated event signature
          return `0x${log.topics[1].slice(26)}`; // Extract address from topics
        }
      } catch (error) {
        continue;
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