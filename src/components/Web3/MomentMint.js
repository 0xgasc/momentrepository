/* global BigInt */
import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useWaitForTransactionReceipt, useWriteContract, useReadContract } from 'wagmi';
import { Plus, Zap } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import UMOMomentsERC1155Contract from '../../contracts/UMOMomentsERC1155.json';
import UMOMomentsERC1155V2Contract from '../../contracts/UMOMomentsERC1155V2.json';
import { parseEther, formatEther } from 'viem';
// Removed: import { useSplits } from '../../utils/splitsIntegration'; // No longer needed with V2 contract

const MomentMint = ({ moment, user, isOwner, hasNFTEdition, isExpanded = false, onRefresh }) => {
  // State management
  const [isCreatingNFT, setIsCreatingNFT] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState('');
  const [mintDuration, setMintDuration] = useState(7);
  const [customPrice, setCustomPrice] = useState(0.0001); // Default price in ETH (0.0001 ETH = ~$0.30)
  const ETH_PRICE_USD = 3000; // Current ETH price
  const customPriceUSD = customPrice * ETH_PRICE_USD; // Convert to USD for display
  const [txHash, setTxHash] = useState(null);
  const [currentStep, setCurrentStep] = useState('ready');
  const [successMessage, setSuccessMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [randomSeed, setRandomSeed] = useState(0);
  const [lastMintQuantity, setLastMintQuantity] = useState(0);
  const [pendingMintRecord, setPendingMintRecord] = useState(null);
  const [mintQuantity, setMintQuantity] = useState(1); // User-selected quantity
  
  // Editable metadata state
  const [editableMetadata, setEditableMetadata] = useState({
    description: moment.momentDescription || '',
    audioQuality: moment.audioQuality || 'good',
    videoQuality: moment.videoQuality || 'good',
    specialOccasion: moment.specialOccasion || '',
    instruments: moment.instruments || '',
    emotionalTags: moment.emotionalTags || '',
    crowdReaction: moment.crowdReaction || '',
    uniqueElements: moment.uniqueElements || ''
  });
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  
  // 0xSplits integration
  // Removed: const { createSplit, isReady: splitsReady } = useSplits(); // No longer needed with V2 contract
  const { 
    writeContract, 
    data: writeContractData, 
    isPending: writeContractPending,
    isSuccess: writeContractSuccess,
    error: writeContractError 
  } = useWriteContract();
  
  // Transaction confirmation - use the hash from writeContract hook
  const { isSuccess: isConfirmed, error: txError, isLoading: txLoading } = useWaitForTransactionReceipt({
    hash: writeContractData,
  });

  // Debug transaction state changes
  useEffect(() => {
    if (txHash) {
      console.log('🔍 Transaction state update:', {
        txHash,
        isConfirmed,
        txLoading,
        txError: !!txError,
        currentStep,
        pendingMintRecord
      });
    }
  }, [txHash, isConfirmed, txLoading, txError, currentStep, pendingMintRecord]);

  // Read user's NFT balance for this token (use correct contract based on NFT)
  const isV2NFT = moment.nftContractAddress === UMOMomentsERC1155V2Contract.address;
  const balanceContract = isV2NFT ? UMOMomentsERC1155V2Contract : UMOMomentsERC1155Contract;
  
  const { data: userBalance, refetch: refetchBalance } = useReadContract({
    address: balanceContract.address,
    abi: balanceContract.abi,
    functionName: 'balanceOf',
    args: [address, moment.nftTokenId],
    enabled: !!(isConnected && address && hasNFTEdition && moment.nftTokenId)
  });

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && writeContractData && currentStep !== 'success') {
      console.log('✅ Transaction confirmed:', writeContractData);
      console.log('📊 Transaction state:', {
        isConfirmed,
        writeContractData,
        currentStep,
        isCreatingNFT,
        isMinting,
        lastMintQuantity,
        pendingMintRecord
      });
      setCurrentStep('success');
      
      if (isCreatingNFT) {
        setSuccessMessage('🎉 NFT Edition Created Successfully! Refreshing...');
        setIsCreatingNFT(false); // Reset creation state
        if (onRefresh) {
          console.log('🔄 Calling onRefresh for NFT creation');
          // Force refresh to get updated moment data with new price
          setTimeout(() => {
            onRefresh();
          }, 1000);
        }
      } else if (pendingMintRecord) {
        setSuccessMessage('🎉 NFT Minted Successfully! Updating records...');
        console.log('🎯 About to call recordMintInDatabase() with pending record:', pendingMintRecord);
        
        // Clear success message after 3 seconds to allow more minting
        setTimeout(() => {
          setSuccessMessage('');
          setCurrentStep('ready');
        }, 3000);
        
        // Update pending record with real transaction hash
        const updatedRecord = {
          ...pendingMintRecord,
          txHash: writeContractData
        };
        
        // Record the mint in the database using the pending record
        recordMintInDatabaseWithData(updatedRecord);
        // Clear pending record
        setPendingMintRecord(null);
        // Reset minting flag after recording
        setIsMinting(false);
        
        // Refresh the modal to show updated mint counts
        if (onRefresh) {
          console.log('🔄 Refreshing after successful mint');
          setTimeout(() => {
            onRefresh();
          }, 2000); // Give time for success message to be seen
        }
      } else {
        console.warn('⚠️ Transaction confirmed but no pending mint record found!');
        console.warn('⚠️ Attempting emergency record with fallback data');
        // Emergency fallback - try to record with whatever data we have
        if (lastMintQuantity > 0) {
          const emergencyRecord = {
            quantity: lastMintQuantity,
            txHash: writeContractData,
            minterAddress: address
          };
          recordMintInDatabaseWithData(emergencyRecord);
        }
      }
    }
  }, [isConfirmed, writeContractData, currentStep, isCreatingNFT, isMinting, pendingMintRecord]);

  // Handle transaction errors
  useEffect(() => {
    if (txError || writeContractError) {
      const error = txError || writeContractError;
      console.error('❌ Transaction failed:', error);
      setError(error.message || 'Transaction failed');
      setCurrentStep('ready');
      setIsCreatingNFT(false);
      setIsMinting(false);
      setPendingMintRecord(null);
    }
  }, [txError, writeContractError]);

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
    
    let description = editableMetadata.description || 
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
        value: editableMetadata.audioQuality
      },
      {
        trait_type: "Video Quality",
        value: editableMetadata.videoQuality
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
    
    if (editableMetadata.specialOccasion) {
      attributes.push({
        trait_type: "Special Occasion",
        value: editableMetadata.specialOccasion
      });
    }
    
    if (editableMetadata.instruments) {
      // Split instruments and add each as separate attribute
      editableMetadata.instruments.split(',').forEach(instrument => {
        attributes.push({
          trait_type: "Instrument",
          value: instrument.trim()
        });
      });
    }
    
    if (editableMetadata.emotionalTags) {
      // Split emotional tags and add each as separate attribute
      editableMetadata.emotionalTags.split(',').forEach(tag => {
        attributes.push({
          trait_type: "Emotion",
          value: tag.trim()
        });
      });
    }
    
    if (editableMetadata.crowdReaction) {
      attributes.push({
        trait_type: "Crowd Reaction",
        value: editableMetadata.crowdReaction
      });
    }
    
    if (editableMetadata.uniqueElements) {
      attributes.push({
        trait_type: "Unique Elements",
        value: editableMetadata.uniqueElements
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
    setCurrentStep('launching-token');
    setShowPreview(false); // Close preview modal when creating NFT

    try {
      console.log('🚀 Launching token...');
      
      // Brief delay to show the launching message
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('🚀 Creating NFT edition...');

      // Generate NFT card - use preview if available, otherwise generate random
      let cardUrl = null;
      console.log('🎨 Generating NFT card...');
      setCurrentStep('generating-card');
      
      const token = localStorage.getItem('token');
      
      // If user previewed a card, use that seed; otherwise generate random
      const useRandomSeed = randomSeed > 0 ? randomSeed : Math.floor(Math.random() * 1000) + 1;
      console.log('🎲 Using seed for NFT card:', useRandomSeed, randomSeed > 0 ? '(from preview)' : '(random)');
      
      const cardResponse = await fetch(`${API_BASE_URL}/moments/${moment._id}/generate-nft-card-with-settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          randomSeed: useRandomSeed
        })
      });

      if (cardResponse.ok) {
        const cardResult = await cardResponse.json();
        cardUrl = cardResult.cardUrl;
        console.log('✅ NFT card generated:', cardUrl);
      } else {
        const errorText = await cardResponse.text();
        console.error('❌ Card generation failed:', errorText);
        throw new Error('Failed to generate NFT card');
      }

      // Create metadata
      const metadata = createNFTMetadata(moment, cardUrl);
      const metadataURI = await uploadMetadataToIrys(metadata);
      
      console.log('📝 Creating NFT edition with metadata:', metadataURI);
      setCurrentStep('creating-contract');

      // V2 Contract has built-in revenue splits - no need for 0xSplits!
      console.log('✅ Using V2 contract with built-in revenue splits (65% UMO, 30% Creator, 5% Platform)');
      const splitsContract = null; // V2 contract handles splits automatically
      
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
          splitsContract: splitsContract,
          uploaderAddress: address, // Pass the uploader's wallet address
          mintPrice: parseEther(customPrice.toString()).toString(),
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
      
      // NFT creation success - show message and refresh immediately
      setSuccessMessage('🎉 NFT Edition Created Successfully! Refreshing...');
      setCurrentStep('success');
      setIsCreatingNFT(false); // Reset creation state
      
      if (onRefresh) {
        console.log('🔄 Calling onRefresh immediately after NFT creation', {
          hasOnRefresh: !!onRefresh,
          randomSeed,
          currentStep,
          isPreviewMode: showPreview
        });
        setTimeout(() => {
          onRefresh();
        }, 1000);
      } else {
        console.warn('⚠️ onRefresh not available for modal refresh!');
      }
      
    } catch (error) {
      console.error('❌ NFT creation failed:', error);
      setError(error.message || 'Failed to create NFT');
      setCurrentStep('ready');
      setIsCreatingNFT(false); // Reset on error too
    }
  };

  // Record mint in database with specific data
  const recordMintInDatabaseWithData = async (mintData) => {
    try {
      console.log('📝 Recording mint in database with data:', {
        momentId: moment._id,
        quantity: mintData.quantity,
        minterAddress: mintData.minterAddress,
        txHash: mintData.txHash,
        currentMintCount: moment.nftMintedCount
      });

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/moments/${moment._id}/record-mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          quantity: mintData.quantity,
          minterAddress: mintData.minterAddress,
          txHash: mintData.txHash
        })
      });

      const result = await response.json();
      console.log('📝 Record mint response:', response.status, result);
      console.log('📝 Response details:', {
        success: result.success,
        totalMinted: result.totalMinted,
        isDuplicate: result.isDuplicate,
        error: result.error
      });

      if (response.ok) {
        console.log('✅ Mint recorded in database:', result);
        // Refetch balance and refresh data
        refetchBalance();
        if (onRefresh) {
          console.log('🔄 Calling onRefresh callback');
          onRefresh();
        }
      } else {
        console.error('❌ Failed to record mint in database:', result);
        // Still refresh to show updated balance
        refetchBalance();
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      console.error('❌ Error recording mint:', error);
      // Still refresh to show updated balance
      refetchBalance();
      if (onRefresh) onRefresh();
    }
  };

  // Record mint in database for tracking
  // eslint-disable-next-line no-unused-vars
  const recordMintInDatabase = async () => {
    try {
      console.log('📝 Recording mint in database...', {
        momentId: moment._id,
        quantity: lastMintQuantity,
        minterAddress: address,
        txHash: txHash,
        currentMintCount: moment.nftMintedCount
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
      console.log('📝 Response details:', {
        success: result.success,
        totalMinted: result.totalMinted,
        isDuplicate: result.isDuplicate,
        error: result.error
      });

      if (response.ok) {
        console.log('✅ Mint recorded in database:', result);
        // Refetch balance and refresh data
        refetchBalance();
        if (onRefresh) {
          console.log('🔄 Calling onRefresh callback');
          onRefresh();
        }
      } else {
        console.error('❌ Failed to record mint in database:', result);
        // Still refresh to show updated balance
        refetchBalance();
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      console.error('❌ Error recording mint:', error);
      // Still refresh to show updated balance
      refetchBalance();
      if (onRefresh) onRefresh();
    }
  };

  // Handle NFT minting for collectors
  const handleMintNFT = async (quantity) => {
    console.log('🔥 FUNCTION START - handleMintNFT called');
    console.log('🚀 MINT BUTTON CLICKED - Starting mint process...', { quantity });
    
    if (!isConnected) {
      console.error('❌ Wallet not connected');
      setError('Please connect your wallet first');
      return;
    }

    console.log('✅ Wallet connected, proceeding with mint...');
    setIsMinting(true);
    setError('');
    setSuccessMessage(''); // Clear any previous success message
    setCurrentStep('minting');
    setLastMintQuantity(quantity); // Store quantity for database recording

    try {
      // Validate required data
      if (!moment.nftTokenId && moment.nftTokenId !== 0) {
        throw new Error('NFT Token ID is missing. The NFT edition may not have been created yet.');
      }
      
      if (!moment.nftContractAddress) {
        throw new Error('NFT Contract Address is missing. The NFT edition may not have been created yet.');
      }
      
      if (!quantity || quantity < 1) {
        throw new Error('Invalid quantity. Must be at least 1.');
      }
      
      console.log('🎯 Minting NFT with user wallet...', { 
        quantity, 
        tokenId: moment.nftTokenId,
        contractAddress: moment.nftContractAddress,
        userAddress: address
      });
      
      // Use the custom price set by the owner when creating the NFT edition
      const mintPriceWei = moment.nftMintPrice || '50000000000000'; // Fallback to 0.00005 ETH
      const totalValue = BigInt(mintPriceWei) * BigInt(quantity);

      console.log('💰 Calculated mint cost:', {
        momentNftMintPrice: moment.nftMintPrice,
        mintPriceWei: mintPriceWei,
        totalValue: totalValue.toString(),
        quantity,
        priceInEth: parseFloat(mintPriceWei) / 1e18
      });

      // Determine which contract to use based on the NFT's contract address
      const isV2Contract = moment.nftContractAddress === UMOMomentsERC1155V2Contract.address;
      const contractToUse = isV2Contract ? UMOMomentsERC1155V2Contract : UMOMomentsERC1155Contract;
      
      console.log(`📝 About to call writeContract with ${isV2Contract ? 'V2 (with splits)' : 'V1 (legacy)'}:`, {
        address: contractToUse.address,
        functionName: 'mintMoment',
        args: [moment.nftTokenId, quantity],
        value: totalValue.toString(),
        contractVersion: isV2Contract ? 'V2' : 'V1',
        hasSplits: isV2Contract
      });

      // Store mint data for when transaction confirms
      setPendingMintRecord({
        quantity: quantity,
        txHash: 'pending', // Will be updated when we get the real hash
        minterAddress: address
      });

      // Call contract directly with user's wallet
      // Note: In Wagmi v2, writeContract may return undefined even on success
      console.log(`📝 Calling writeContract on ${isV2Contract ? 'V2' : 'V1'} contract...`);
      const hash = await writeContract({
        address: contractToUse.address,
        abi: contractToUse.abi,
        functionName: 'mintMoment',
        args: [moment.nftTokenId, quantity],
        value: totalValue
      });

      console.log('✅ writeContract completed, hash:', hash);
      
      // Don't rely on the hash from writeContract - it might be undefined
      // The useWaitForTransactionReceipt hook will handle the actual transaction monitoring
      console.log('⏳ Transaction submitted to MetaMask, waiting for confirmation...');
      
    } catch (error) {
      console.error('❌ NFT mint failed:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        cause: error.cause,
        stack: error.stack
      });
      setError(`Failed to mint NFT: ${error.message}`);
      setCurrentStep('ready');
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

        {!isConnected ? (
          <SimpleWalletConnect />
        ) : (
          <div>
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1">Available for:</label>
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

            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1">Price:</label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0.0001"
                  max="0.015"
                  step="0.0001"
                  value={customPrice}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setCustomPrice(value);
                  }}
                  disabled={currentStep !== 'ready'}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs opacity-70">
                  <span>0.0001 ETH</span>
                  <span>0.015 ETH</span>
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-white">
                    {customPrice.toFixed(6)} ETH
                  </div>
                  <div className="text-xs opacity-70">
                    ≈ ${customPriceUSD.toFixed(2)} USD
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-100 p-3 rounded-lg mb-4 text-xs">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => setShowMetadataEditor(!showMetadataEditor)}
                className="w-full bg-purple-600/80 hover:bg-purple-600 border border-white/30 text-white p-3 rounded-lg font-semibold"
              >
                {showMetadataEditor ? 'Hide Details' : '📝 Edit Details'}
              </button>

              {showMetadataEditor && (
                <div className="bg-white/10 p-4 rounded-lg space-y-3 text-sm">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Description:</label>
                    <textarea
                      value={editableMetadata.description}
                      onChange={(e) => setEditableMetadata(prev => ({...prev, description: e.target.value}))}
                      className="w-full bg-white/20 border border-white/30 text-white p-2 rounded text-xs"
                      rows="3"
                      placeholder="Describe this moment..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Audio Quality:</label>
                      <select
                        value={editableMetadata.audioQuality}
                        onChange={(e) => setEditableMetadata(prev => ({...prev, audioQuality: e.target.value}))}
                        className="w-full bg-white/20 border border-white/30 text-white p-2 rounded text-xs"
                      >
                        <option value="excellent">Excellent</option>
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                        <option value="poor">Poor</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Video Quality:</label>
                      <select
                        value={editableMetadata.videoQuality}
                        onChange={(e) => setEditableMetadata(prev => ({...prev, videoQuality: e.target.value}))}
                        className="w-full bg-white/20 border border-white/30 text-white p-2 rounded text-xs"
                      >
                        <option value="excellent">Excellent</option>
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                        <option value="poor">Poor</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Instruments (comma-separated):</label>
                    <input
                      value={editableMetadata.instruments}
                      onChange={(e) => setEditableMetadata(prev => ({...prev, instruments: e.target.value}))}
                      className="w-full bg-white/20 border border-white/30 text-white p-2 rounded text-xs"
                      placeholder="guitar, bass, drums..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Emotions (comma-separated):</label>
                    <input
                      value={editableMetadata.emotionalTags}
                      onChange={(e) => setEditableMetadata(prev => ({...prev, emotionalTags: e.target.value}))}
                      className="w-full bg-white/20 border border-white/30 text-white p-2 rounded text-xs"
                      placeholder="energetic, dreamy, intense..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Special Occasion:</label>
                    <input
                      value={editableMetadata.specialOccasion}
                      onChange={(e) => setEditableMetadata(prev => ({...prev, specialOccasion: e.target.value}))}
                      className="w-full bg-white/20 border border-white/30 text-white p-2 rounded text-xs"
                      placeholder="debut, anniversary, birthday..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Crowd Reaction:</label>
                    <input
                      value={editableMetadata.crowdReaction}
                      onChange={(e) => setEditableMetadata(prev => ({...prev, crowdReaction: e.target.value}))}
                      className="w-full bg-white/20 border border-white/30 text-white p-2 rounded text-xs"
                      placeholder="wild, singing along, mesmerized..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Unique Elements:</label>
                    <input
                      value={editableMetadata.uniqueElements}
                      onChange={(e) => setEditableMetadata(prev => ({...prev, uniqueElements: e.target.value}))}
                      className="w-full bg-white/20 border border-white/30 text-white p-2 rounded text-xs"
                      placeholder="jam session, solo, cover..."
                    />
                  </div>
                </div>
              )}

              {/* Status Display */}
              {isCreatingNFT && currentStep !== 'success' && (
                <div className="w-full bg-blue-600/20 border border-blue-500/30 text-blue-100 p-4 rounded-lg mb-4 text-center">
                  <div className="text-lg font-semibold mb-2">
                    {currentStep === 'launching-token' ? '🚀 Launching Token...' :
                     currentStep === 'generating-card' ? '🎨 Generating Card...' :
                     currentStep === 'creating-contract' ? '🔧 Creating NFT Contract...' :
                     currentStep === 'confirming' ? '⏳ Creating Edition...' :
                     '🔄 Processing...'}
                  </div>
                  <div className="text-xs opacity-80">
                    {currentStep === 'launching-token' ? 'Initializing your NFT collection...' :
                     currentStep === 'generating-card' ? 'Creating your artifact card design...' :
                     currentStep === 'creating-contract' ? 'Setting up smart contract...' :
                     currentStep === 'confirming' ? 'Please confirm in your wallet...' :
                     'Please wait...'}
                  </div>
                </div>
              )}

              {currentStep !== 'success' && !isCreatingNFT && (
                <button
                  onClick={handleGeneratePreview}
                  disabled={isGeneratingPreview || isCreatingNFT}
                  className={`w-full ${
                    isGeneratingPreview || isCreatingNFT ? 'bg-white/10 cursor-not-allowed' : 'bg-green-600/80 hover:bg-green-600'
                  } border border-white/30 text-white p-3 rounded-lg font-semibold`}
                >
                  {isGeneratingPreview ? 'Generating Preview...' : '🎨 Preview Artifact Card'}
                </button>
              )}

              
              {currentStep === 'ready' && !isCreatingNFT && (
                <p className="text-xs text-center mt-2 opacity-80">
                  {randomSeed > 0 
                    ? '✨ Will use your previewed card design' 
                    : '🎲 Will generate a random card design'}
                </p>
              )}
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
                    disabled={isGeneratingPreview || isCreatingNFT}
                    className={`w-full py-3 px-4 rounded-lg font-medium ${
                      isGeneratingPreview || isCreatingNFT
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
                    disabled={isCreatingNFT}
                    className={`flex-1 py-2 px-4 rounded-lg font-semibold ${
                      isCreatingNFT 
                        ? 'bg-blue-400 text-blue-100 cursor-not-allowed' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isCreatingNFT ? 'Creating...' : 'Create Artifact'}
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
            {isOwner ? '' : 'Support the artist and uploader by minting this moment'}
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
                💎 Available to Collect
              </div>
              <div className="text-2xl font-bold mb-1">
                {(() => {
                  const priceInEth = moment.nftMintPrice ? 
                    parseFloat(formatEther(BigInt(moment.nftMintPrice))) : 0.00005;
                  const priceInUsd = priceInEth * 2500;
                  console.log('💎 Price Display Debug:', {
                    momentNftMintPrice: moment.nftMintPrice,
                    priceInEth,
                    priceInUsd
                  });
                  return `~$${priceInUsd.toFixed(2)} USD`;
                })()}
              </div>
              <div className="text-xs opacity-70">
                {(() => {
                  const priceInEth = moment.nftMintPrice ? 
                    parseFloat(formatEther(BigInt(moment.nftMintPrice))) : 0.00005;
                  return `${priceInEth.toFixed(4)} ETH per NFT`;
                })()}
              </div>
              <div className="text-xs opacity-80">
                {moment.nftMintedCount || 0} already minted
                {/* Debug info */}
                {process.env.NODE_ENV === 'development' && (
                  <span className="ml-2 text-yellow-400">
                    (DB: {moment.nftMintedCount}, History: {
                      moment.nftMintHistory?.reduce((total, mint) => total + (mint.quantity || 1), 0) || 0
                    })
                  </span>
                )}
              </div>
              {userBalance && Number(userBalance) > 0 && (
                <div className="text-xs mt-2 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-lg text-green-200">
                  ✅ You own {Number(userBalance)} NFT{Number(userBalance) !== 1 ? 's' : ''}
                </div>
              )}
              
              {/* Manual fix button for debugging */}
              {userBalance && Number(userBalance) > 0 && Number(userBalance) > moment.nftMintedCount && (
                <button
                  onClick={async () => {
                    console.log('🔧 Manually fixing mint count...');
                    const difference = Number(userBalance) - moment.nftMintedCount;
                    const message = `You own ${Number(userBalance)} NFTs but database shows ${moment.nftMintedCount}. Add ${difference} missing mint(s) to database?`;
                    
                    if (window.confirm(message)) {
                      try {
                        const token = localStorage.getItem('token');
                        
                        // Add missing mints one by one
                        for (let i = 0; i < difference; i++) {
                          const response = await fetch(`${API_BASE_URL}/moments/${moment._id}/fix-mint-count`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ forceAdd: true })
                          });
                          const result = await response.json();
                          console.log(`🔧 Added mint ${i + 1}/${difference}:`, result);
                        }
                        
                        if (onRefresh) {
                          onRefresh();
                        }
                      } catch (error) {
                        console.error('❌ Fix failed:', error);
                      }
                    }
                  }}
                  className="mt-2 text-xs underline text-yellow-400 hover:text-yellow-300"
                >
                  🔧 Fix mint count
                </button>
              )}
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-100 p-3 rounded-lg mb-4 text-xs">
                {error}
              </div>
            )}

            {successMessage && currentStep === 'success' && (
              <div className="bg-green-500/20 border border-green-500/30 text-green-100 p-3 rounded-lg mb-4 text-xs">
                {successMessage}
              </div>
            )}

            {/* Quantity Input */}
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1">Quantity to Mint:</label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={mintQuantity}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value >= 1 && value <= 10) {
                        setMintQuantity(value);
                      }
                    }}
                    disabled={isMinting || currentStep !== 'ready'}
                    className="w-full bg-white/20 border border-white/30 text-white p-2 rounded text-sm"
                    placeholder="1"
                  />
                  <div className="text-xs opacity-70 mt-1">
                    {(() => {
                      const priceInEth = moment.nftMintPrice ? 
                        parseFloat(formatEther(BigInt(moment.nftMintPrice))) : 0.00005;
                      const totalEth = priceInEth * mintQuantity;
                      const totalUsd = totalEth * 2500;
                      return `Total: ${totalEth.toFixed(4)} ETH (~$${totalUsd.toFixed(2)} USD)`;
                    })()}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    console.log('🖱️ MINT BUTTON CLICKED!', {
                      mintQuantity,
                      isMinting,
                      currentStep,
                      disabled: isMinting || currentStep !== 'ready'
                    });
                    handleMintNFT(mintQuantity);
                  }}
                  disabled={isMinting || currentStep !== 'ready'}
                  className={`px-6 py-2 rounded-lg font-semibold text-sm ${
                    isMinting || currentStep !== 'ready' 
                      ? 'bg-purple-800 cursor-not-allowed opacity-70' 
                      : 'bg-purple-700 hover:bg-purple-600'
                  }`}
                >
                  {isMinting ? 'Collecting...' : `Collect ${mintQuantity}`}
                </button>
              </div>
            </div>

            <div className="bg-white/10 p-3 rounded-lg text-xs leading-relaxed mb-3">
              <strong>Revenue split:</strong><br/>
              🎵 UMO: 65% • 📤 Creator: 30% • ⚙️ Platform: 5%
            </div>

            {/* OpenSea Link - only show if NFT has been minted at least once */}
            {moment.nftContractAddress && moment.nftTokenId && (moment.nftMintedCount > 0) && (
              <a
                href={`https://testnets.opensea.io/assets/base_sepolia/${moment.nftContractAddress.toLowerCase()}/${moment.nftTokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-2 px-4 bg-blue-600/20 border border-blue-500/30 text-blue-200 rounded-lg hover:bg-blue-600/30 transition-colors text-xs font-medium"
              >
                🌊 View on OpenSea
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  // Return null for other states (simplified)
  return (
    <>
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider::-webkit-slider-track {
          height: 8px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.2);
        }

        .slider::-moz-range-track {
          height: 8px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.2);
        }

        .slider:focus {
          outline: none;
        }

        .slider:focus::-webkit-slider-thumb {
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
        }
      `}</style>
      {null}
    </>
  );
};

export default MomentMint;