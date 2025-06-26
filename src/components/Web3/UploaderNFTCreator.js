// Uploader NFT Creation Component
// File: src/components/UploaderNFTCreator.js

import React, { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { Zap, Clock, DollarSign, Users, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { useSplits } from '../../utils/splitsIntegration';
import { contractHelpers } from '../../config/web3Config';

const UploaderNFTCreator = ({ moment, user, onSuccess, onCancel }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState('connect'); // connect, create-split, create-edition, success
  const [txHash, setTxHash] = useState(null);
  const [splitAddress, setSplitAddress] = useState(null);
  const [error, setError] = useState(null);
  
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  const { createSplit } = useSplits();
  
  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  
  // Check if current user is the uploader
  const isUploader = user && moment.uploadedBy === user.username;
  
  // Mock addresses for testing
  const MOCK_UMO_ADDRESS = process.env.REACT_APP_MOCK_UMO_ADDRESS || '0x742d35Cc6634C0532925a3b8D76C7DE9F45F6c96';
  const MOCK_PLATFORM_ADDRESS = process.env.REACT_APP_MOCK_PLATFORM_ADDRESS || '0x8ba1f109551bD432803012645Hac136c5e33f4C';
  
  // Current ETH price for $1 USD equivalent (you'd fetch this from an API in production)
  const ETH_PRICE_USD = 3500; // Mock current ETH price
  const MINT_PRICE_ETH = 1 / ETH_PRICE_USD; // $1 USD equivalent
  
  const handleCreateNFTEdition = async () => {
    if (!isConnected || !isUploader) {
      setError('Please connect your wallet as the moment uploader');
      return;
    }
    
    setIsCreating(true);
    setError(null);
    
    try {
      // Step 1: Create 0xSplits contract
      setStep('create-split');
      console.log('Creating split contract...');
      
      const splitResult = await createSplit(moment, address);
      setSplitAddress(splitResult.splitAddress);
      
      // Step 2: Create NFT edition on smart contract
      setStep('create-edition');
      console.log('Creating NFT edition...');
      
      const metadata = contractHelpers.formatMomentMetadata(moment);
      const metadataURI = await uploadMetadataToIrys(metadata);
      
      const mintDuration = 7 * 24 * 60 * 60; // 1 week in seconds
      const mintPriceWei = parseEther(MINT_PRICE_ETH.toString());
      
      const hash = await writeContract({
        address: process.env.REACT_APP_UMO_MOMENTS_CONTRACT,
        abi: [], // Contract ABI would be imported
        functionName: 'createMomentEdition',
        args: [
          moment._id,
          metadataURI,
          mintPriceWei,
          mintDuration,
          0, // Unlimited supply
          splitResult.splitAddress,
          moment.rating
        ],
      });
      
      setTxHash(hash);
      
      // Step 3: Update backend
      await updateMomentInDatabase(moment._id, {
        splitAddress: splitResult.splitAddress,
        metadataURI,
        mintPrice: mintPriceWei.toString(),
        mintDuration,
        uploaderAddress: address
      });
      
      setStep('success');
      onSuccess && onSuccess({
        momentId: moment._id,
        splitAddress: splitResult.splitAddress,
        txHash: hash
      });
      
    } catch (err) {
      console.error('NFT creation failed:', err);
      setError(err.message || 'Failed to create NFT edition');
      setIsCreating(false);
    }
  };
  
  const uploadMetadataToIrys = async (metadata) => {
    // Upload to Irys/Arweave (integrate with your existing uploader)
    try {
      const response = await fetch('/api/upload-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
      });
      const result = await response.json();
      return result.uri;
    } catch (error) {
      throw new Error('Failed to upload metadata');
    }
  };
  
  const updateMomentInDatabase = async (momentId, nftData) => {
    try {
      const response = await fetch(`/api/moments/${momentId}/nft-edition`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(nftData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update moment in database');
      }
    } catch (error) {
      console.error('Database update failed:', error);
      // Don't fail the whole process for database errors
    }
  };
  
  if (!isUploader) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <div>
            <p className="text-sm font-medium text-yellow-800">
              Only the uploader can create NFT editions
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              This moment was uploaded by {moment.uploadedBy}
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  if (step === 'success') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-green-800 mb-2">
          NFT Edition Created Successfully!
        </h3>
        <p className="text-sm text-green-700 mb-4">
          Your moment is now available for minting for the next 7 days
        </p>
        
        <div className="space-y-2 text-xs text-green-600 mb-4">
          <div className="flex justify-between">
            <span>Split Contract:</span>
            <span className="font-mono">{splitAddress?.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between">
            <span>Mint Price:</span>
            <span>${1} USD (~{MINT_PRICE_ETH.toFixed(6)} ETH)</span>
          </div>
          <div className="flex justify-between">
            <span>Your Share:</span>
            <span>15% of all mint revenue</span>
          </div>
        </div>
        
        {txHash && (
          <a
            href={`https://sepolia-explorer.base.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 text-xs text-green-700 hover:underline"
          >
            <span>View Transaction</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Zap className="w-6 h-6" />
          <div>
            <h3 className="text-lg font-bold">Create NFT Edition</h3>
            <p className="text-purple-100 text-sm">Turn your moment into mintable NFTs</p>
          </div>
        </div>
        
        {/* Progress Steps */}
        <div className="flex items-center space-x-2 text-sm">
          <div className={`px-2 py-1 rounded-full ${step === 'connect' ? 'bg-white text-purple-600' : 'bg-purple-500'}`}>
            1. Connect
          </div>
          <div className="w-8 h-0.5 bg-purple-400" />
          <div className={`px-2 py-1 rounded-full ${step === 'create-split' ? 'bg-white text-purple-600' : 'bg-purple-500'}`}>
            2. Setup Splits
          </div>
          <div className="w-8 h-0.5 bg-purple-400" />
          <div className={`px-2 py-1 rounded-full ${step === 'create-edition' ? 'bg-white text-purple-600' : 'bg-purple-500'}`}>
            3. Create Edition
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-6">
        {!isConnected ? (
          <div className="text-center py-4">
            <AlertCircle className="w-8 h-8 text-orange-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">
              Connect your wallet to create an NFT edition
            </p>
            <p className="text-sm text-gray-500 mb-4">
              As the uploader, you'll receive 15% of all mint revenue
            </p>
            {/* Include compact wallet connect here */}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Edition Details Preview */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-3">Edition Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <div>
                    <div className="font-medium">Mint Price</div>
                    <div className="text-gray-500">$1 USD (~{MINT_PRICE_ETH.toFixed(6)} ETH)</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <div>
                    <div className="font-medium">Duration</div>
                    <div className="text-gray-500">7 days</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-purple-500" />
                  <div>
                    <div className="font-medium">Supply</div>
                    <div className="text-gray-500">Unlimited</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-orange-500" />
                  <div>
                    <div className="font-medium">Rarity</div>
                    <div className="text-gray-500">{moment.rating}/7</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Revenue Split Preview */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-3">Revenue Distribution</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">🎵 UMO (Artist)</span>
                  <span className="font-medium text-blue-800">80%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">📤 You (Uploader)</span>
                  <span className="font-medium text-blue-800">15%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">⚙️ Platform</span>
                  <span className="font-medium text-blue-800">5%</span>
                </div>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                Revenue automatically distributed via 0xSplits smart contracts
              </p>
            </div>
            
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
                    {step === 'create-split' && 'Creating revenue split contract...'}
                    {step === 'create-edition' && 'Creating NFT edition...'}
                    {isConfirming && 'Confirming transaction...'}
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
            
            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={onCancel}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNFTEdition}
                disabled={isCreating || isConfirming}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-4 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isCreating || isConfirming ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating...</span>
                  </div>
                ) : (
                  'Create NFT Edition'
                )}
              </button>
            </div>
            
            <p className="text-xs text-gray-500 text-center">
              By creating this edition, you agree to the revenue split terms and 
              confirm you have rights to this content.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploaderNFTCreator;