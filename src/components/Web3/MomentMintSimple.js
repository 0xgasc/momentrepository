/* global BigInt */
import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Zap, Plus, CheckCircle, ExternalLink, AlertCircle, Clock } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import UMOMomentsERC1155Contract from '../../contracts/UMOMomentsERC1155.json';
import { ethers } from 'ethers';

const MomentMint = ({ moment, user, isOwner, hasNFTEdition, isExpanded = false }) => {
  // State management
  const [isCreatingNFT, setIsCreatingNFT] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState('');
  const [mintDuration, setMintDuration] = useState(7);
  const [txHash, setTxHash] = useState(null);
  const [currentStep, setCurrentStep] = useState('ready');
  const [successMessage, setSuccessMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [randomSeed, setRandomSeed] = useState(0);

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const chainId = useChainId();
  
  // Transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && txHash && currentStep !== 'success') {
      console.log('✅ Transaction confirmed:', txHash);
      setCurrentStep('success');
      
      if (isCreatingNFT) {
        setSuccessMessage('🎉 NFT Edition Created Successfully! Page will refresh...');
        setTimeout(() => window.location.reload(), 3000);
      } else if (isMinting) {
        setSuccessMessage('🎉 NFT Minted Successfully! Check your wallet.');
        setTimeout(() => window.location.reload(), 3000);
      }
    }
  }, [isConfirmed, txHash, currentStep, isCreatingNFT, isMinting]);

  // Handle transaction errors
  useEffect(() => {
    if (txError) {
      console.error('❌ Transaction failed:', txError);
      setError(txError.message || 'Transaction failed');
      setCurrentStep('ready');
      setIsCreatingNFT(false);
      setIsMinting(false);
    }
  }, [txError]);

  // Create NFT metadata
  const createNFTMetadata = (moment, cardUrl = null) => {
    console.log('🎨 Creating NFT metadata with:', {
      cardUrl: cardUrl,
      momentMediaType: moment.mediaType,
      hasCard: !!cardUrl
    });
    
    let imageUrl = cardUrl || moment.mediaUrl;
    if (!imageUrl && moment.mediaType === 'video') {
      imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(moment.songName)}&size=512&background=1e3a8a&color=ffffff&bold=true`;
    }
    
    const uploadDate = new Date(moment.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
    
    let description = moment.momentDescription || 
      `A live performance moment of "${moment.songName}" by UMO at ${moment.venueName}, ${moment.venueCity} on ${moment.performanceDate}.`;
    
    description += `\n\n📅 Originally uploaded on ${uploadDate} by ${moment.user?.displayName || 'Anonymous'}.`;
    
    return {
      name: `${moment.songName} - ${moment.venueName} (${moment.performanceDate})`,
      description: description,
      image: imageUrl,
      external_url: `${window.location.origin}/moments/${moment._id}`,
      attributes: [
        {
          trait_type: "Upload Date",
          value: uploadDate
        },
        {
          trait_type: "Song",
          value: moment.songName
        },
        {
          trait_type: "Venue",
          value: moment.venueName
        },
        {
          trait_type: "City",
          value: moment.venueCity
        }
      ]
    };
  };

  // Upload metadata to Irys
  const uploadMetadataToIrys = async (metadata) => {
    try {
      console.log('📤 Uploading metadata to Irys...');
      
      const metadataJson = JSON.stringify(metadata, null, 2);
      const metadataBlob = new Blob([metadataJson], { type: 'application/json' });
      
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', metadataBlob, `metadata-${Date.now()}.json`);
      
      const response = await fetch(`${API_BASE_URL}/upload-file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Metadata uploaded:', result.fileUri);
        return result.fileUri;
      } else {
        throw new Error('Failed to upload metadata');
      }
    } catch (error) {
      console.error('❌ Metadata upload failed:', error);
      throw error;
    }
  };

  // Generate preview
  const handleGeneratePreview = async () => {
    setIsGeneratingPreview(true);
    try {
      const newSeed = Math.floor(Math.random() * 1000) + 1;
      setRandomSeed(newSeed);
      
      const token = localStorage.getItem('token');
      const previewResponse = await fetch(`${API_BASE_URL}/moments/${moment._id}/preview-nft-card`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          randomSeed: newSeed
        })
      });

      if (!previewResponse.ok) {
        throw new Error('Failed to generate preview');
      }

      const previewResult = await previewResponse.json();
      setPreviewUrl(previewResult.previewUrl);
      setShowPreview(true);
      console.log('✅ Preview generated with seed:', newSeed);
    } catch (err) {
      console.error('❌ Preview generation failed:', err);
      setError('Failed to generate preview: ' + err.message);
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  // Create NFT Edition
  const handleCreateNFTEdition = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    setIsCreatingNFT(true);
    setError('');
    setCurrentStep('creating');

    try {
      console.log('🚀 Creating NFT edition...');

      // Generate NFT card
      let cardUrl = null;
      console.log('🎨 Generating NFT card...');
      setCurrentStep('generating-card');
      
      const token = localStorage.getItem('token');
      const endpoint = randomSeed > 0 
        ? `${API_BASE_URL}/moments/${moment._id}/generate-nft-card-with-settings`
        : `${API_BASE_URL}/moments/${moment._id}/generate-nft-card`;
      
      const cardResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          randomSeed: randomSeed > 0 ? randomSeed : undefined
        })
      });

      if (cardResponse.ok) {
        const cardResult = await cardResponse.json();
        cardUrl = cardResult.cardUrl;
        console.log('✅ NFT card generated:', cardUrl);
      } else {
        throw new Error('Failed to generate NFT card');
      }

      // Create metadata
      const metadata = createNFTMetadata(moment, cardUrl);
      const metadataURI = await uploadMetadataToIrys(metadata);
      
      console.log('📝 Creating NFT edition with metadata:', metadataURI);
      setCurrentStep('confirming');

      // Call backend proxy
      const response = await fetch(`${API_BASE_URL}/moments/${moment._id}/create-nft-edition-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nftMetadataHash: metadataURI,
          splitsContract: '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96',
          mintPrice: '1000000000000000',
          mintDuration: mintDuration
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create NFT edition');
      }

      console.log('✅ NFT edition created:', result);
      setTxHash(result.txHash);
      
    } catch (error) {
      console.error('❌ NFT creation failed:', error);
      setError(error.message || 'Failed to create NFT');
      setCurrentStep('ready');
    } finally {
      setIsCreatingNFT(false);
    }
  };

  // Simple wallet connect component
  const SimpleWalletConnect = () => (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      className="w-full bg-white/20 border border-white/40 text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-colors text-sm font-medium"
    >
      Connect Wallet
    </button>
  );

  // Owner view - Create NFT
  if (isOwner && !hasNFTEdition) {
    return (
      <div className="bg-gradient-to-r from-emerald-500 to-blue-500 text-white p-5 rounded-xl">
        <div className="mb-4">
          <h3 className="text-lg font-bold flex items-center mb-2">
            <Plus className="w-5 h-5 mr-2" />
            Create NFT Edition
          </h3>
          <p className="text-sm opacity-90">
            Turn your moment into mintable NFTs
          </p>
        </div>

        {!isConnected ? (
          <SimpleWalletConnect />
        ) : (
          <div>
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1">Minting Duration:</label>
              <select
                value={mintDuration}
                onChange={(e) => setMintDuration(parseInt(e.target.value))}
                disabled={currentStep !== 'ready'}
                className="w-full bg-white/20 border border-white/30 text-white p-2 rounded text-xs"
              >
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-100 p-3 rounded-lg mb-4 text-xs">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleGeneratePreview}
                disabled={isGeneratingPreview || isCreatingNFT}
                className={`w-full ${
                  isGeneratingPreview || isCreatingNFT ? 'bg-white/10 cursor-not-allowed' : 'bg-green-600/80 hover:bg-green-600'
                } border border-white/30 text-white p-3 rounded-lg font-semibold`}
              >
                {isGeneratingPreview ? 'Generating Preview...' : '🎨 Preview NFT Card'}
              </button>

              <button
                onClick={handleCreateNFTEdition}
                disabled={isCreatingNFT || currentStep !== 'ready'}
                className={`w-full ${
                  isCreatingNFT || currentStep !== 'ready' ? 'bg-white/10 cursor-not-allowed' : 'bg-blue-600/80 hover:bg-blue-600'
                } border border-white/30 text-white p-3 rounded-lg font-semibold`}
              >
                {currentStep === 'generating-card' ? '🎨 Generating Card...' :
                 currentStep === 'confirming' ? '⏳ Creating Edition...' :
                 currentStep === 'success' ? successMessage :
                 '🚀 Create NFT Edition'}
              </button>
            </div>
          </div>
        )}

        {/* Simple Preview Modal */}
        {showPreview && previewUrl && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-800">NFT Mint</h3>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>
                
                <img 
                  src={previewUrl} 
                  alt="NFT Card Preview" 
                  className="w-full rounded-lg shadow-lg mb-4"
                />
                
                <div className="text-center">
                  <button
                    onClick={handleGeneratePreview}
                    disabled={isGeneratingPreview}
                    className={`w-full py-3 px-4 rounded-lg font-medium ${
                      isGeneratingPreview
                        ? 'bg-gray-300 text-gray-500'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {isGeneratingPreview ? 'Generating...' : '🎲 Try Another Variation'}
                  </button>
                  
                </div>
                
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="flex-1 py-2 px-4 bg-gray-200 text-gray-800 rounded-lg"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setShowPreview(false);
                      handleCreateNFTEdition();
                    }}
                    className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-semibold"
                  >
                    Create NFT
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Return null for other states (simplified)
  return null;
};

export default MomentMint;