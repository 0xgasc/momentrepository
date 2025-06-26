// Moment Minting Component (Updated for Uploader-Initiated Flow)
// File: src/components/MomentMint.js
/* eslint-disable no-undef */
import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Clock, Users, Zap, AlertCircle, CheckCircle, ExternalLink, Plus } from 'lucide-react';
import { CONTRACTS } from '../../config/web3Config';
import UploaderNFTCreator from './UploaderNFTCreator';
import { Wallet } from 'lucide-react';
import WalletConnect from './WalletConnect';

const MomentMint = ({ moment, user, isExpanded = false }) => {
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [showNFTCreator, setShowNFTCreator] = useState(false);
  
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  
  // Check if current user is the uploader
  const isUploader = user && moment.uploadedBy === user.username;
  
  // Read contract data for this moment
  const { data: editionData, refetch: refetchEdition } = useReadContract({
    address: CONTRACTS.UMO_MOMENTS.address,
    abi: CONTRACTS.UMO_MOMENTS.abi,
    functionName: 'getEdition',
    args: [moment._id],
  });
  
  const { data: isMintingActive } = useReadContract({
    address: CONTRACTS.UMO_MOMENTS.address,
    abi: CONTRACTS.UMO_MOMENTS.abi,
    functionName: 'isMintingActive',
    args: [moment._id],
  });
  
  const { data: userMintCount } = useReadContract({
    address: CONTRACTS.UMO_MOMENTS.address,
    abi: CONTRACTS.UMO_MOMENTS.abi,
    functionName: 'getUserMintCount',
    args: [moment._id, address],
    enabled: !!address,
  });
  
  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  
  useEffect(() => {
    if (isConfirmed) {
      setIsLoading(false);
      setTxHash(null);
      refetchEdition();
      // Show success message
    }
  }, [isConfirmed, refetchEdition]);
  
  const handleMint = async () => {
    if (!isConnected || !editionData) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const totalCost = BigInt(editionData.mintPrice) * BigInt(quantity);
      
      const hash = await writeContract({
        address: CONTRACTS.UMO_MOMENTS.address,
        abi: CONTRACTS.UMO_MOMENTS.abi,
        functionName: 'mintMoment',
        args: [moment._id, quantity],
        value: totalCost,
      });
      
      setTxHash(hash);
    } catch (err) {
      setError(err.message || 'Minting failed');
      setIsLoading(false);
    }
  };
  
  const formatTimeLeft = (endTime) => {
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = Number(endTime) - now;
    
    if (timeLeft <= 0) return 'Ended';
    
    const days = Math.floor(timeLeft / 86400);
    const hours = Math.floor((timeLeft % 86400) / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };
  
  const getMintPrice = () => {
    if (!editionData) return '0';
    return formatEther(editionData.mintPrice);
  };
  
  const getTotalCost = () => {
    if (!editionData) return '0';
    const total = BigInt(editionData.mintPrice) * BigInt(quantity);
    return formatEther(total);
  };
  
  // If moment doesn't have an edition yet, show creation option for uploader
  if (!editionData || !editionData.momentId) {
    if (isUploader && isConnected) {
      return (
        <div className="space-y-4">
          {!showNFTCreator ? (
            <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-lg p-4 text-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Plus className="w-5 h-5" />
                  <span className="font-semibold">Create NFT Edition</span>
                </div>
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                  You uploaded this
                </span>
              </div>
              
              <p className="text-sm mb-3 opacity-90">
                Turn your moment into mintable NFTs and earn 15% of revenue
              </p>
              
              <button
                onClick={() => setShowNFTCreator(true)}
                className="w-full bg-white/20 hover:bg-white/30 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Start NFT Creation
              </button>
            </div>
          ) : (
            <UploaderNFTCreator
              moment={moment}
              user={user}
              onSuccess={() => {
                setShowNFTCreator(false);
                // Refresh the page or refetch data
                window.location.reload();
              }}
              onCancel={() => setShowNFTCreator(false)}
            />
          )}
        </div>
      );
    }
    
    // For non-uploaders or not connected users
    return (
      <div className="bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-300">
        <div className="text-center">
          <Zap className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 font-medium">NFT Not Available</p>
          <p className="text-xs text-gray-500 mt-1">
            {isUploader 
              ? "Connect your wallet to create an NFT edition" 
              : "Only the uploader can create NFT editions"}
          </p>
        </div>
      </div>
    );
  }
  
  const isActive = isMintingActive;
  const timeLeft = formatTimeLeft(editionData.mintEndTime);
  const supplyText = editionData.maxSupply > 0 
    ? `${editionData.currentSupply}/${editionData.maxSupply}` 
    : `${editionData.currentSupply} minted`;
  
  // Compact version for moment cards
  if (!isExpanded) {
    return (
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-3 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-semibold">NFT Edition</span>
          </div>
          <div className="text-xs bg-white/20 px-2 py-1 rounded-full">
            Rarity {editionData.rarity}/7
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span>{getMintPrice()} ETH</span>
          <div className="flex items-center space-x-2">
            <Clock className="w-3 h-3" />
            <span>{timeLeft}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-xs mt-2 opacity-90">
          <span>{supplyText}</span>
          {isActive ? (
            <span className="bg-green-400 text-green-900 px-2 py-0.5 rounded-full font-medium">
              Live
            </span>
          ) : (
            <span className="bg-gray-400 text-gray-900 px-2 py-0.5 rounded-full font-medium">
              Ended
            </span>
          )}
        </div>
      </div>
    );
  }
  
  // Full minting interface
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Zap className="w-6 h-6" />
            <div>
              <h3 className="text-lg font-bold">Mint as NFT</h3>
              <p className="text-purple-100 text-sm">Limited time open edition</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs bg-white/20 px-3 py-1 rounded-full">
              Rarity {editionData.rarity}/7
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{getMintPrice()}</div>
            <div className="text-xs text-purple-100">ETH per mint</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{editionData.currentSupply}</div>
            <div className="text-xs text-purple-100">Total minted</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{timeLeft}</div>
            <div className="text-xs text-purple-100">Time left</div>
          </div>
        </div>
      </div>
      
      {/* Minting Interface */}
      <div className="p-6">
        {!isConnected ? (
          <div className="text-center py-8">
            <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Connect your wallet to mint this moment</p>
            <WalletConnect />
          </div>
        ) : !isActive ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Minting window has ended</p>
            <p className="text-sm text-gray-500 mt-2">
              This moment is no longer available for minting
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Quantity Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity (max 10 per transaction)
              </label>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                  disabled={quantity <= 1}
                >
                  -
                </button>
                <span className="text-xl font-semibold w-12 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(10, quantity + 1))}
                  className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                  disabled={quantity >= 10}
                >
                  +
                </button>
              </div>
            </div>
            
            {/* Cost Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Price per NFT:</span>
                <span className="font-medium">{getMintPrice()} ETH</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Quantity:</span>
                <span className="font-medium">{quantity}</span>
              </div>
              <div className="border-t border-gray-200 pt-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total:</span>
                  <span className="font-bold text-lg">{getTotalCost()} ETH</span>
                </div>
              </div>
            </div>
            
            {/* User's Previous Mints */}
            {userMintCount > 0 && (
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 text-blue-800">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    You've already minted {userMintCount} of this moment
                  </span>
                </div>
              </div>
            )}
            
            {/* Error Display */}
            {error && (
              <div className="bg-red-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 text-red-800">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Error: {error}</span>
                </div>
              </div>
            )}
            
            {/* Transaction Status */}
            {txHash && (
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 text-yellow-800 mb-2">
                  <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">
                    {isConfirming ? 'Confirming transaction...' : 'Transaction pending...'}
                  </span>
                </div>
                <a
                  href={`https://sepolia-explorer.base.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-yellow-700 hover:underline flex items-center space-x-1"
                >
                  <span>View on Explorer</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            
            {/* Mint Button */}
            <button
              onClick={handleMint}
              disabled={isLoading || isConfirming || !isActive}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading || isConfirming ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Minting...</span>
                </div>
              ) : (
                `Mint ${quantity} NFT${quantity > 1 ? 's' : ''} for ${getTotalCost()} ETH`
              )}
            </button>
            
            {/* Revenue Split Info */}
            <div className="text-xs text-gray-500 text-center space-y-1">
              <p>🎵 80% to UMO • 📤 15% to uploader • ⚙️ 5% platform fee</p>
              <p>Revenue automatically distributed via 0xSplits</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MomentMint;