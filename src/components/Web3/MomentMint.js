/* global BigInt */
import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Zap, Plus, CheckCircle, ExternalLink, AlertCircle, Clock } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import UMOMomentsContract from '../../contracts/UMOMoments.json';
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

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const chainId = useChainId();
  
  // Transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Read current token ID for display
  const { data: currentTokenId } = useReadContract({
    address: UMOMomentsContract.address,
    abi: UMOMomentsContract.abi,
    functionName: 'getCurrentTokenId',
    enabled: !!UMOMomentsContract.address
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

  // ✅ FIXED: Generate proper OpenSea-compatible metadata
 const createNFTMetadata = (moment) => {
  // ✅ For videos: Create proper thumbnail for OpenSea
  let imageUrl, animationUrl;
  
  if (moment.mediaType === 'video') {
    // For videos: Use a thumbnail service
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
    description: moment.momentDescription || 
      `A live performance moment of "${moment.songName}" by UMO at ${moment.venueName}, ${moment.venueCity} on ${moment.performanceDate}. ` +
      `${moment.personalNote ? `\n\nUploader's note: ${moment.personalNote}` : ''}`,
    image: imageUrl,
    animation_url: animationUrl,
    // ... keep the rest of your existing attributes and properties exactly the same
      external_url: `${window.location.origin}/moments/${moment._id}`,
      attributes: [
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
          trait_type: "Country",
          value: moment.venueCountry || "Unknown"
        },
        {
          trait_type: "Performance Date",
          value: moment.performanceDate
        },
        {
          trait_type: "Media Type",
          value: moment.mediaType || "video"
        },
        {
          trait_type: "Rarity Tier",
          value: moment.rarityTier || "common"
        },
        {
          trait_type: "Rarity Score",
          value: moment.rarityScore || 0,
          display_type: "number",
          max_value: 7
        },
        {
          trait_type: "Audio Quality",
          value: moment.audioQuality || "good"
        },
        {
          trait_type: "Video Quality", 
          value: moment.videoQuality || "good"
        },
        {
          trait_type: "Moment Type",
          value: moment.momentType || "performance"
        },
        {
          trait_type: "First Moment for Song",
          value: moment.isFirstMomentForSong ? "Yes" : "No"
        },
        {
          trait_type: "File Size (MB)",
          value: Math.round((moment.fileSize || 0) / 1024 / 1024),
          display_type: "number"
        },
        {
          trait_type: "Uploader",
          value: moment.user?.displayName || "Anonymous"
        }
      ].concat(
        // Add set info if available
        moment.setName ? [{ trait_type: "Set", value: moment.setName }] : []
      ).concat(
        // Add position if available  
        moment.songPosition ? [{ trait_type: "Song Position", value: moment.songPosition, display_type: "number" }] : []
      ).concat(
        // Add emotional tags as separate attributes
        moment.emotionalTags ? moment.emotionalTags.split(',').map(tag => ({
          trait_type: "Emotion",
          value: tag.trim()
        })) : []
      ).concat(
        // Add instruments as separate attributes
        moment.instruments ? moment.instruments.split(',').map(instrument => ({
          trait_type: "Instrument", 
          value: instrument.trim()
        })) : []
      ).filter(attr => attr.value !== undefined && attr.value !== null && attr.value !== ''),
      
      properties: {
        category: "music",
        creator: moment.user?.displayName || "Unknown",
        performance_id: moment.performanceId,
        moment_id: moment._id,
        created_at: moment.createdAt,
        rarity_score: moment.rarityScore,
        is_first_moment: moment.isFirstMomentForSong || false,
        crowd_reaction: moment.crowdReaction,
        special_occasion: moment.specialOccasion,
        guest_appearances: moment.guestAppearances
      }
    };
  };

  // ✅ FIXED: Upload metadata to Irys/Arweave (browser-compatible)
  const uploadMetadataToIrys = async (metadata) => {
    try {
      console.log('📤 Uploading metadata to Irys/Arweave...');
      
      // Convert metadata to JSON string and create Blob (browser-compatible)
      const metadataJson = JSON.stringify(metadata, null, 2);
      const metadataBlob = new Blob([metadataJson], { type: 'application/json' });
      
      // Upload to Irys using existing backend endpoint
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', metadataBlob, `metadata-${Date.now()}.json`);
      
      console.log('📄 Metadata size:', metadataBlob.size, 'bytes');
      
      const response = await fetch(`${API_BASE_URL}/upload-file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Metadata uploaded to Arweave:', result.fileUri);
        return result.fileUri;
      } else {
        const errorText = await response.text();
        console.error('❌ Upload response error:', errorText);
        throw new Error(`Failed to upload metadata to Irys: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Metadata upload to Irys failed:', error);
      throw new Error(`Metadata upload failed: ${error.message}`);
    }
  };

  // ✅ FIXED: Create NFT Edition (for owners)
  const handleCreateNFTEdition = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (chainId !== 84532) {
      setError('Please switch to Base Sepolia network (Chain ID: 84532)');
      return;
    }

    setIsCreatingNFT(true);
    setError('');
    setCurrentStep('creating');

    try {
      console.log('🚀 Creating NFT edition with ethers v6...');

      // Setup ethers provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        UMOMomentsContract.address,
        UMOMomentsContract.abi,
        signer
      );

      // Prepare transaction parameters
      const mintPriceWei = parseEther('0.001');
      const mintDurationSeconds = mintDuration * 24 * 60 * 60; // Convert to number first
      const rarityScore = Math.floor(Math.min(7, Math.max(1, moment.rarityScore || 1)));
      
      // Create proper metadata
      const metadata = createNFTMetadata(moment);
const metadataURI = await uploadMetadataToIrys(metadata);
      
      const mockSplitsAddress = '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96';

      console.log('📝 Transaction parameters:', {
        momentId: moment._id.slice(0, 12) + '...',
        mintPrice: formatEther(mintPriceWei) + ' ETH',
        duration: `${mintDuration} days`,
        rarity: rarityScore,
        metadataURI: metadataURI.slice(0, 50) + '...'
      });

      setCurrentStep('confirming');

      // Create moment edition on blockchain
      const transaction = await contract.createMomentEdition(
        String(moment._id),
        metadataURI,
        mintPriceWei,
        mintDurationSeconds,
        0, // unlimited supply
        mockSplitsAddress,
        rarityScore
      );

      console.log('✅ Transaction submitted:', transaction.hash);
      setTxHash(transaction.hash);

      // Wait for confirmation
      setCurrentStep('updating');
      const receipt = await transaction.wait();
      console.log('✅ Transaction confirmed in block:', receipt.blockNumber);

      // Update database
      await updateBackendAfterCreation(transaction.hash, metadataURI);

    } catch (error) {
      console.error('❌ Create NFT Edition failed:', error);
      
      let errorMessage = error.message || 'Unknown error';
      
      if (error.code === 'ACTION_REJECTED' || errorMessage.includes('User rejected')) {
        errorMessage = 'Transaction was rejected in MetaMask';
      } else if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Insufficient ETH for gas fees';
      } else if (errorMessage.includes('Edition already exists')) {
        errorMessage = 'NFT edition already exists for this moment';
      }
      
      setError(errorMessage);
      setCurrentStep('ready');
    } finally {
      setIsCreatingNFT(false);
    }
  };

  // ✅ FIXED: Mint NFT (for both owners and collectors)
  const handleMintNFT = async (quantity = 1) => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (chainId !== 84532) {
      setError('Please switch to Base Sepolia network');
      return;
    }

    setIsMinting(true);
    setError('');
    setCurrentStep('creating');

    try {
      console.log(`🎯 Minting ${quantity} NFT(s) for moment:`, moment._id.slice(0, 12) + '...');

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        moment.nftContractAddress,
        UMOMomentsContract.abi,
        signer
      );

      const mintPrice = parseEther('0.001');
      const totalCost = mintPrice * BigInt(quantity);

      console.log(`💰 Minting ${quantity} NFT(s) for ${formatEther(totalCost)} ETH`);

      setCurrentStep('confirming');

      const transaction = await contract.mintMoment(String(moment._id), quantity, {
        value: totalCost
      });

      console.log('✅ Mint transaction submitted:', transaction.hash);
      setTxHash(transaction.hash);

      // Wait for confirmation
      const receipt = await transaction.wait();
      console.log('✅ Mint confirmed in block:', receipt.blockNumber);

      // ✅ FIXED: Only update backend ONCE after successful mint
      await recordMintInBackend(transaction.hash, quantity);

    } catch (error) {
      console.error('❌ Error minting NFT:', error);
      
      let errorMessage = error.message || 'Failed to mint NFT';
      
      if (error.code === 'ACTION_REJECTED') {
        errorMessage = 'Transaction was rejected in MetaMask';
      } else if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Insufficient ETH for gas fees and mint cost';
      } else if (errorMessage.includes('Minting not active')) {
        errorMessage = 'Minting period has ended for this moment';
      }
      
      setError(errorMessage);
      setCurrentStep('ready');
    } finally {
      setIsMinting(false);
    }
  };

  // ✅ FIXED: Update backend after successful NFT creation
  const updateBackendAfterCreation = async (transactionHash, metadataURI) => {
    try {
      const token = localStorage.getItem('token');
      
      const nftEditionData = {
        nftContractAddress: UMOMomentsContract.address,
        nftTokenId: String(moment._id),
        nftMetadataHash: metadataURI,
        splitsContract: '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96',
        mintPrice: parseEther('0.001').toString(),
        mintDuration: mintDuration * 24 * 60 * 60,
        txHash: transactionHash
      };

      console.log('📝 Updating backend with NFT edition data...');

      const response = await fetch(`${API_BASE_URL}/moments/${String(moment._id)}/create-nft-edition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(nftEditionData)
      });

      if (response.ok) {
        console.log('✅ Backend updated successfully');
      } else {
        const errorText = await response.text();
        console.error('❌ Backend update failed:', errorText);
        setError('NFT created but backend update failed. Please refresh the page.');
      }
    } catch (error) {
      console.error('❌ Backend update error:', error);
      setError('NFT created but backend sync failed. Please refresh the page.');
    }
  };

  // ✅ FIXED: Record mint in backend (prevent double counting)
  const recordMintInBackend = async (transactionHash, quantity) => {
    try {
      const token = localStorage.getItem('token');
      
      // Check if this transaction was already recorded
      const existingMint = moment.nftMintHistory?.find(mint => mint.txHash === transactionHash);
      if (existingMint) {
        console.log('⚠️ Mint already recorded for this transaction, skipping');
        return;
      }

      const mintData = {
        quantity: quantity,
        minterAddress: address,
        txHash: transactionHash
      };

      console.log('📝 Recording mint in backend:', mintData);

      const response = await fetch(`${API_BASE_URL}/moments/${String(moment._id)}/record-mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(mintData)
      });

      if (response.ok) {
        console.log('✅ Mint recorded in backend');
      } else {
        const errorText = await response.text();
        console.error('❌ Backend mint recording failed:', errorText);
      }
    } catch (error) {
      console.error('❌ Failed to record mint in backend:', error);
    }
  };

  // Utility functions
  const handleViewOnOpenSea = () => {
    if (moment.nftContractAddress) {
      const openSeaUrl = `https://testnets.opensea.io/assets/base-sepolia/${moment.nftContractAddress}/${String(moment._id)}`;
      window.open(openSeaUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const getMintingTimeRemaining = () => {
    if (!moment.nftMintEndTime) return null;
    const now = new Date();
    const endTime = new Date(moment.nftMintEndTime);
    const timeRemaining = endTime - now;
    
    if (timeRemaining <= 0) return null;
    
    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    return { days, hours, isActive: true };
  };

  // Simple wallet connect component
  const SimpleWalletConnect = () => (
    <button
      onClick={() => connectors.length > 0 && connect({ connector: connectors[0] })}
      className="bg-white/20 border border-white/30 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-white/30 transition-colors"
    >
      Connect Wallet
    </button>
  );

  // ===================================================================
  // STEP 1: OWNER + NO NFT CREATED = Show "Create NFT Edition"
  // ===================================================================
  if (isOwner && !hasNFTEdition) {
    return (
      <div className="bg-gradient-to-r from-emerald-500 to-blue-500 text-white p-5 rounded-xl">
        <div className="mb-4">
          <h3 className="text-lg font-bold flex items-center mb-2">
            <Plus className="w-5 h-5 mr-2" />
            Create NFT Edition
            <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded-full">Owner</span>
          </h3>
          <p className="text-sm opacity-90">
            Turn your moment into mintable NFTs and earn 35% of mint revenue
          </p>
        </div>

        {!isConnected ? (
          <div className="text-center">
            <p className="mb-4 text-sm">Connect your wallet to create NFT editions</p>
            <SimpleWalletConnect />
          </div>
        ) : (
          <div>
            {/* Progress indicator */}
            {currentStep !== 'ready' && (
              <div className="bg-white/10 p-4 rounded-lg mb-4 text-center">
                <div className="text-sm mb-2">
                  {currentStep === 'creating' && '📝 Preparing transaction...'}
                  {currentStep === 'confirming' && '⏳ Confirming on blockchain...'}
                  {currentStep === 'updating' && '💾 Updating database...'}
                  {currentStep === 'success' && successMessage}
                </div>
                {txHash && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 text-xs underline"
                  >
                    View Transaction →
                  </a>
                )}
              </div>
            )}

            {/* Edition Settings */}
            <div className="bg-white/10 p-4 rounded-lg mb-4">
              <h4 className="text-sm font-semibold mb-2">⚙️ Edition Settings</h4>
              <div className="text-xs space-y-1 mb-3">
                <div>💵 Price: ~$1 USD (0.001 ETH)</div>
                <div>📊 Supply: Unlimited</div>
                <div>🎯 Rarity: {moment.rarityScore || 0}/7</div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold mb-1">⏰ Minting Duration:</label>
                <select
                  value={mintDuration}
                  onChange={(e) => setMintDuration(parseInt(e.target.value))}
                  disabled={currentStep !== 'ready'}
                  className="w-full bg-white/20 border border-white/30 text-white p-2 rounded text-xs"
                >
                  <option value={1} style={{ background: '#333', color: 'white' }}>1 Day</option>
                  <option value={3} style={{ background: '#333', color: 'white' }}>3 Days</option>
                  <option value={7} style={{ background: '#333', color: 'white' }}>7 Days (Recommended)</option>
                  <option value={14} style={{ background: '#333', color: 'white' }}>14 Days</option>
                  <option value={30} style={{ background: '#333', color: 'white' }}>30 Days</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-100 p-3 rounded-lg mb-4 text-xs">
                ❌ {error}
              </div>
            )}

            <button
              onClick={handleCreateNFTEdition}
              disabled={isCreatingNFT || currentStep !== 'ready'}
              className={`w-full ${
                isCreatingNFT ? 'bg-white/10 cursor-not-allowed opacity-70' : 'bg-white/20 hover:bg-white/30'
              } border border-white/30 text-white p-3 rounded-lg font-semibold flex items-center justify-center transition-colors`}
            >
              {isCreatingNFT ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Creating NFT Edition...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Create NFT Edition
                </>
              )}
            </button>
            
            <div className="text-xs text-white/80 mt-2 leading-tight">
              ℹ️ This creates the edition for minting. Collectors will then mint actual NFT tokens.
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===================================================================
  // STEP 2: OWNER + NFT CREATED = Show "Manage Edition" + MINT ABILITY
  // ===================================================================
  if (isOwner && hasNFTEdition) {
    const timeRemaining = getMintingTimeRemaining();
    
    return (
      <div className="bg-gradient-to-r from-emerald-600 to-blue-600 text-white p-5 rounded-xl">
        <div className="mb-4">
          <h3 className="text-lg font-bold flex items-center mb-2">
            <CheckCircle className="w-5 h-5 mr-2" />
            NFT Edition Active
            <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded-full">Owner</span>
          </h3>
          <p className="text-sm opacity-90">
            Your moment is live for minting! Earning 35% of mint revenue.
          </p>
        </div>

        <div className="bg-white/10 p-4 rounded-lg mb-4">
          <h4 className="text-sm font-semibold mb-2">📊 Edition Stats</h4>
          <div className="text-xs space-y-1">
            <div>💎 Total Minted: {moment.nftMintedCount || 0}</div>
            <div>💰 Your Revenue: ~${((moment.nftMintedCount || 0) * 0.35 * 0.001 * 3500).toFixed(2)} USD</div>
            <div className="flex items-center">
              {timeRemaining?.isActive ? (
                <>
                  <Clock className="w-3 h-3 mr-1" />
                  ⏰ Active: {timeRemaining.days}d {timeRemaining.hours}h remaining
                </>
              ) : (
                '⏰ Minting Ended'
              )}
            </div>
            <div>🔗 Contract: {moment.nftContractAddress?.slice(0, 8)}...</div>
          </div>
        </div>

        {/* Owner Minting Section */}
        {isConnected && timeRemaining?.isActive && (
          <div className="bg-white/10 p-4 rounded-lg mb-4">
            <h4 className="text-sm font-semibold mb-2">🎨 Owner Mint</h4>
            <p className="text-xs opacity-90 mb-3">
              As the owner, you can mint your own NFTs:
            </p>

            {currentStep !== 'ready' && (
              <div className="bg-white/10 p-3 rounded text-center mb-3">
                <div className="text-xs mb-1">
                  {currentStep === 'creating' && '💰 Preparing mint...'}
                  {currentStep === 'confirming' && '⏳ Confirming mint...'}
                  {currentStep === 'success' && successMessage}
                </div>
                {txHash && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 text-xs underline"
                  >
                    View Transaction →
                  </a>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-100 p-2 rounded mb-3 text-xs">
                ❌ {error}
              </div>
            )}

            <div className="flex gap-2">
              <button 
                onClick={() => handleMintNFT(1)}
                disabled={isMinting || currentStep !== 'ready'}
                className={`flex-1 ${
                  isMinting ? 'bg-white/10 opacity-70' : 'bg-white/20 hover:bg-white/30'
                } border border-white/30 text-white p-2 rounded text-xs font-semibold transition-colors`}
              >
                {isMinting ? 'Minting...' : 'Mint 1 NFT'}
              </button>
              <button 
                onClick={() => handleMintNFT(3)}
                disabled={isMinting || currentStep !== 'ready'}
                className="flex-1 bg-white/10 border border-white/30 text-white p-2 rounded text-xs font-semibold hover:bg-white/20 transition-colors disabled:opacity-70"
              >
                Mint 3
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleViewOnOpenSea}
            className="flex-1 bg-white/20 border border-white/30 text-white p-2.5 rounded-lg text-xs font-semibold flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            OpenSea
          </button>
          <button
            onClick={() => alert(`Analytics:\n• Total Minted: ${moment.nftMintedCount || 0}\n• Revenue: ~$${((moment.nftMintedCount || 0) * 0.35 * 0.001 * 3500).toFixed(2)}`)}
            className="flex-1 bg-white/20 border border-white/30 text-white p-2.5 rounded-lg text-xs font-semibold hover:bg-white/30 transition-colors"
          >
            Analytics
          </button>
        </div>
      </div>
    );
  }

  // ===================================================================
  // STEP 3: NON-OWNER + NO NFT = Show simple message
  // ===================================================================
  if (!isOwner && !hasNFTEdition) {
    return (
      <div className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 p-4 rounded-lg text-center text-sm">
        NFT not yet available for this moment
      </div>
    );
  }

  // ===================================================================
  // STEP 4: NON-OWNER + NFT CREATED = Show "Mint NFT"
  // ===================================================================
  if (!isOwner && hasNFTEdition) {
    const timeRemaining = getMintingTimeRemaining();
    
    return (
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-5 rounded-xl">
        <div className="mb-4">
          <h3 className="text-lg font-bold flex items-center mb-2">
            <Zap className="w-5 h-5 mr-2" />
            Mint NFT
            <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded-full">Collector</span>
          </h3>
          <p className="text-sm opacity-90">
            Support the artist and uploader by minting this moment
          </p>
        </div>

        {!timeRemaining?.isActive && (
          <div className="bg-red-500/20 border border-red-500/30 p-3 rounded-lg mb-4 text-center">
            <AlertCircle className="w-4 h-4 mx-auto mb-1" />
            <div className="text-sm font-semibold">Minting Period Ended</div>
            <div className="text-xs opacity-80">This moment is no longer available for minting</div>
          </div>
        )}

        {!isConnected ? (
          <div className="text-center">
            <p className="mb-4 text-sm">Connect your wallet to mint NFTs</p>
            <SimpleWalletConnect />
          </div>
        ) : timeRemaining?.isActive ? (
          <div>
            {currentStep !== 'ready' && (
              <div className="bg-white/10 p-4 rounded-lg mb-4 text-center">
                <div className="text-sm mb-2">
                  {currentStep === 'creating' && '💰 Preparing mint...'}
                  {currentStep === 'confirming' && '⏳ Confirming mint...'}
                  {currentStep === 'success' && successMessage}
                </div>
                {txHash && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 text-xs underline"
                  >
                    View Transaction →
                  </a>
                )}
              </div>
            )}

            <div className="bg-white/10 p-4 rounded-lg mb-4 text-center">
              <div className="text-xs mb-2 opacity-90">💎 Available for Minting</div>
              <div className="text-2xl font-bold mb-1">~$1 USD</div>
              <div className="text-xs opacity-80">
                {moment.nftMintedCount || 0} already minted
              </div>
              {timeRemaining && (
                <div className="text-xs mt-2 flex items-center justify-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {timeRemaining.days}d {timeRemaining.hours}h remaining
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-100 p-3 rounded-lg mb-4 text-xs">
                ❌ {error}
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <button 
                onClick={() => handleMintNFT(1)}
                disabled={isMinting || currentStep !== 'ready'}
                className={`flex-[2] ${
                  isMinting ? 'bg-purple-700 opacity-70' : 'bg-purple-500 hover:bg-purple-600'
                } text-white border-none p-3 rounded-lg text-sm font-semibold flex items-center justify-center transition-colors`}
              >
                {isMinting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Minting...
                  </>
                ) : (
                  'Mint 1 NFT'
                )}
              </button>
              <button 
                onClick={() => handleMintNFT(5)}
                disabled={isMinting || currentStep !== 'ready'}
                className="flex-1 bg-white/20 border border-white/30 text-white p-3 rounded-lg text-sm font-semibold hover:bg-white/30 transition-colors disabled:opacity-70"
              >
                Mint 5
              </button>
            </div>

            <div className="bg-white/10 p-3 rounded-lg text-xs leading-relaxed">
              <strong>Revenue goes to:</strong><br/>
              🎵 UMO: 55% • 📤 Uploader: 35% • ⚙️ Platform: 10%
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm mb-4">Minting has ended for this moment</p>
            <button
              onClick={handleViewOnOpenSea}
              className="bg-white/20 border border-white/30 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/30 transition-colors"
            >
              View on OpenSea
            </button>
          </div>
        )}
      </div>
    );
  }

  // Fallback
  return null;
};

export default MomentMint;