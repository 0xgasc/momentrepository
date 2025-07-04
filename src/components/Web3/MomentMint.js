/* global BigInt */
import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useWaitForTransactionReceipt, useWriteContract, useReadContract } from 'wagmi';
import { Plus, Zap } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import UMOMomentsERC1155Contract from '../../contracts/UMOMomentsERC1155.json';
import { parseEther } from 'viem';

const MomentMint = ({ moment, user, isOwner, hasNFTEdition, isExpanded = false, onRefresh }) => {
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
  const [lastMintQuantity, setLastMintQuantity] = useState(0);

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { writeContract } = useWriteContract();
  
  // Transaction confirmation
  const { isSuccess: isConfirmed, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Read user's NFT balance for this token
  const { data: userBalance, refetch: refetchBalance } = useReadContract({
    address: UMOMomentsERC1155Contract.address,
    abi: UMOMomentsERC1155Contract.abi,
    functionName: 'balanceOf',
    args: [address, moment.nftTokenId],
    enabled: !!(isConnected && address && hasNFTEdition && moment.nftTokenId)
  });

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && txHash && currentStep !== 'success') {
      console.log('✅ Transaction confirmed:', txHash);
      setCurrentStep('success');
      
      if (isCreatingNFT) {
        setSuccessMessage('🎉 NFT Edition Created Successfully! Refreshing...');
        if (onRefresh) {
          console.log('🔄 Calling onRefresh for NFT creation');
          onRefresh();
        }
        setTimeout(() => window.location.reload(), 3000);
      } else if (isMinting) {
        setSuccessMessage('🎉 NFT Minted Successfully! Updating records...');
        // Record the mint in the database
        recordMintInDatabase();
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
    
    // Always use the NFT card as the image for OpenSea display
    let imageUrl = cardUrl;
    
    // Fallback only if no NFT card was generated
    if (!imageUrl) {
      if (moment.mediaType === 'video') {
        imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(moment.songName)}&size=512&background=1e3a8a&color=ffffff&bold=true`;
      } else {
        imageUrl = moment.mediaUrl;
      }
    }
    
    const uploadDate = new Date(moment.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
    
    const uploadTime = new Date(moment.createdAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC'
    });
    
    let description = moment.momentDescription || 
      `A live performance moment of "${moment.songName}" by UMO at ${moment.venueName}, ${moment.venueCity} on ${moment.performanceDate}.`;
    
    description += `\n\n📅 Originally uploaded on ${uploadDate} at ${uploadTime} UTC by ${moment.user?.displayName || 'Anonymous'}.`;
    description += `\n\n🎬 Download original ${moment.mediaType || 'media'}: ${moment.mediaUrl}`;
    
    // Build comprehensive attributes array
    const attributes = [
      // Upload provenance (most important)
      {
        trait_type: "Upload Date",
        value: uploadDate
      },
      {
        trait_type: "Upload Time (UTC)",
        value: uploadTime
      },
      {
        trait_type: "Uploader",
        value: moment.user?.displayName || "Anonymous"
      },
      
      // Performance details
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
      },
      {
        trait_type: "Performance Date",
        value: moment.performanceDate
      },
      
      // Content details
      {
        trait_type: "Content Type",
        value: moment.contentType || 'song'
      },
      {
        trait_type: "Media Type",
        value: moment.mediaType
      },
      {
        trait_type: "File Size (MB)",
        value: Math.round((moment.fileSize || 0) / 1024 / 1024),
        display_type: "number"
      },
      
      // Quality attributes
      {
        trait_type: "Audio Quality",
        value: moment.audioQuality || 'good'
      },
      {
        trait_type: "Video Quality",
        value: moment.videoQuality || 'good'
      },
      
      // Rarity attributes
      {
        trait_type: "Rarity Tier",
        value: moment.rarityTier || 'basic'
      },
      {
        trait_type: "Rarity Score",
        value: moment.rarityScore || 0,
        display_type: "number",
        max_value: 6
      }
    ];
    
    // Add conditional attributes if they exist
    if (moment.venueCountry) {
      attributes.push({
        trait_type: "Country",
        value: moment.venueCountry
      });
    }
    
    if (moment.setName) {
      attributes.push({
        trait_type: "Set",
        value: moment.setName
      });
    }
    
    if (moment.songPosition) {
      attributes.push({
        trait_type: "Song Position",
        value: moment.songPosition,
        display_type: "number"
      });
    }
    
    if (moment.specialOccasion) {
      attributes.push({
        trait_type: "Special Occasion",
        value: moment.specialOccasion
      });
    }
    
    if (moment.instruments) {
      // Split instruments and add each as separate attribute
      moment.instruments.split(',').forEach(instrument => {
        attributes.push({
          trait_type: "Instrument",
          value: instrument.trim()
        });
      });
    }
    
    if (moment.emotionalTags) {
      // Split emotional tags and add each as separate attribute
      moment.emotionalTags.split(',').forEach(tag => {
        attributes.push({
          trait_type: "Emotion",
          value: tag.trim()
        });
      });
    }
    
    if (moment.crowdReaction) {
      attributes.push({
        trait_type: "Crowd Reaction",
        value: moment.crowdReaction
      });
    }
    
    if (moment.uniqueElements) {
      attributes.push({
        trait_type: "Unique Elements",
        value: moment.uniqueElements
      });
    }
    
    if (moment.guestAppearances) {
      attributes.push({
        trait_type: "Guest Appearances",
        value: moment.guestAppearances
      });
    }
    
    const metadata = {
      name: `${moment.songName} - ${moment.venueName} (${moment.performanceDate})`,
      description: description,
      image: imageUrl,
      external_url: `${window.location.origin}/moments/${moment._id}`,
      attributes: attributes.filter(attr => attr.value !== undefined && attr.value !== null && attr.value !== '')
    };

    console.log('🎨 Generated NFT metadata:', {
      name: metadata.name,
      imageUrl: metadata.image,
      attributeCount: metadata.attributes.length,
      hasImage: !!metadata.image
    });

    return metadata;
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
    setShowPreview(false); // Close preview modal when creating NFT

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
          mintDuration: mintDuration,
          nftCardUrl: cardUrl // Pass the generated card URL
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

  // Record mint in database for tracking
  const recordMintInDatabase = async () => {
    try {
      console.log('📝 Recording mint in database...', {
        momentId: moment._id,
        quantity: lastMintQuantity,
        minterAddress: address,
        txHash: txHash
      });

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/moments/${moment._id}/record-mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          quantity: lastMintQuantity,
          minterAddress: address,
          txHash: txHash
        })
      });

      const result = await response.json();
      console.log('📝 Record mint response:', response.status, result);

      if (response.ok) {
        console.log('✅ Mint recorded in database:', result);
        // Refetch balance and refresh data
        refetchBalance();
        if (onRefresh) {
          console.log('🔄 Calling onRefresh callback');
          onRefresh();
        }
        setTimeout(() => window.location.reload(), 2000);
      } else {
        console.error('❌ Failed to record mint in database:', result);
        // Still refresh to show updated balance
        refetchBalance();
        if (onRefresh) onRefresh();
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (error) {
      console.error('❌ Error recording mint:', error);
      // Still refresh to show updated balance
      refetchBalance();
      if (onRefresh) onRefresh();
      setTimeout(() => window.location.reload(), 2000);
    }
  };

  // Handle NFT minting for collectors
  const handleMintNFT = async (quantity) => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    setIsMinting(true);
    setError('');
    setCurrentStep('minting');
    setLastMintQuantity(quantity); // Store quantity for database recording

    try {
      console.log('🎯 Minting NFT with user wallet...', { 
        quantity, 
        tokenId: moment.nftTokenId,
        contractAddress: UMOMomentsERC1155Contract.address 
      });
      
      const mintPrice = parseEther('0.001');
      const totalValue = mintPrice * BigInt(quantity);

      // Call contract directly with user's wallet
      const hash = await writeContract({
        address: UMOMomentsERC1155Contract.address,
        abi: UMOMomentsERC1155Contract.abi,
        functionName: 'mintMoment',
        args: [moment.nftTokenId, quantity],
        value: totalValue
      });

      console.log('✅ NFT mint transaction submitted:', hash);
      setTxHash(hash);
      
    } catch (error) {
      console.error('❌ NFT mint failed:', error);
      setError(`Failed to mint NFT: ${error.message}`);
      setCurrentStep('ready');
    } finally {
      setIsMinting(false);
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
              {currentStep !== 'success' && (
                <button
                  onClick={handleGeneratePreview}
                  disabled={isGeneratingPreview || isCreatingNFT}
                  className={`w-full ${
                    isGeneratingPreview || isCreatingNFT ? 'bg-white/10 cursor-not-allowed' : 'bg-green-600/80 hover:bg-green-600'
                  } border border-white/30 text-white p-3 rounded-lg font-semibold`}
                >
                  {isGeneratingPreview ? 'Generating Preview...' : '🎨 Preview NFT Card'}
                </button>
              )}

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
                  <h3 className="text-lg font-bold text-gray-800">NFT Preview</h3>
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
                    disabled={isGeneratingPreview || isCreatingNFT}
                    className={`w-full py-3 px-4 rounded-lg font-medium ${
                      isGeneratingPreview || isCreatingNFT
                        ? 'bg-gray-300 text-gray-500'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {isGeneratingPreview ? 'Generating...' : '🎲 Try Another Variation'}
                  </button>
                  
                  {randomSeed > 0 && (
                    <div className="text-xs text-gray-500 mt-2">
                      Variation #{randomSeed}
                    </div>
                  )}
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
                    disabled={isCreatingNFT}
                    className={`flex-1 py-2 px-4 rounded-lg font-semibold ${
                      isCreatingNFT 
                        ? 'bg-blue-400 text-blue-100 cursor-not-allowed' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isCreatingNFT ? 'Creating...' : 'Create NFT'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Collector/Owner view - Mint NFT (when NFT edition already exists)
  if (hasNFTEdition) {
    return (
      <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white p-5 rounded-xl">
        <div className="mb-4">
          <h3 className="text-lg font-bold flex items-center mb-2">
            <Zap className="w-5 h-5 mr-2" />
            Mint NFT
            <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded-full">
              {isOwner ? 'Creator' : 'Collector'}
            </span>
          </h3>
          <p className="text-sm opacity-90">
            {isOwner ? 'Mint copies of your own NFT edition' : 'Support the artist and uploader by minting this moment'}
          </p>
        </div>

        {!isConnected ? (
          <div className="text-center">
            <p className="mb-4 text-sm">
              Connect your wallet to mint NFTs
            </p>
            <SimpleWalletConnect />
          </div>
        ) : (
          <div>
            {/* NFT Card Preview */}
            {moment.nftCardUrl && (
              <div className="mb-4">
                <div className="text-xs mb-2 opacity-90 text-center">
                  🎨 NFT Card Preview
                </div>
                <img 
                  src={moment.nftCardUrl} 
                  alt="NFT Card Preview" 
                  className="w-full rounded-lg shadow-lg"
                  style={{ maxHeight: '200px', objectFit: 'contain' }}
                />
              </div>
            )}

            <div className="bg-white/10 p-4 rounded-lg mb-4 text-center">
              <div className="text-xs mb-2 opacity-90">
                💎 Available for Minting
              </div>
              <div className="text-2xl font-bold mb-1">
                ~$1 USD
              </div>
              <div className="text-xs opacity-80">
                {moment.nftMintedCount || 0} already minted
              </div>
              {userBalance && Number(userBalance) > 0 && (
                <div className="text-xs mt-2 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-lg text-green-200">
                  ✅ You own {Number(userBalance)} NFT{Number(userBalance) !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-100 p-3 rounded-lg mb-4 text-xs">
                {error}
              </div>
            )}

            <div className="flex gap-3 mb-4">
              <button 
                onClick={() => handleMintNFT(1)}
                disabled={isMinting || currentStep !== 'ready'}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm ${
                  isMinting || currentStep !== 'ready' 
                    ? 'bg-purple-800 cursor-not-allowed opacity-70' 
                    : 'bg-purple-700 hover:bg-purple-600'
                }`}
              >
                {isMinting ? 'Minting...' : 'Mint 1 NFT'}
              </button>
              <button 
                onClick={() => handleMintNFT(5)}
                disabled={isMinting || currentStep !== 'ready'}
                className={`px-4 py-3 rounded-lg text-sm border border-white/30 ${
                  isMinting || currentStep !== 'ready'
                    ? 'bg-white/10 cursor-not-allowed opacity-70'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                Mint 5
              </button>
            </div>

            <div className="bg-white/10 p-3 rounded-lg text-xs leading-relaxed">
              <strong>Revenue goes to:</strong><br/>
              🎵 UMO: 55% • 📤 Uploader: 35% • ⚙️ Platform: 10%
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