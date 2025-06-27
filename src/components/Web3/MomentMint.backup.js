// src/components/Web3/MomentMint.js - WITH REAL BLOCKCHAIN INTEGRATION
import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt, useReadContract, readContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Zap, AlertCircle, Plus, ExternalLink, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import { CONTRACTS } from '../../config/web3Config';

const MomentMint = ({ moment, user, isOwner, hasNFTEdition, isExpanded = false }) => {
  const [showNFTCreator, setShowNFTCreator] = useState(false);
  const [isCreatingNFT, setIsCreatingNFT] = useState(false);
  const [creationError, setCreationError] = useState('');
  const [mintDuration, setMintDuration] = useState(7); // Default 7 days
  const [txHash, setTxHash] = useState(null);
  
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { writeContract } = useWriteContract();
  
  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && txHash) {
      console.log('✅ Transaction confirmed:', txHash);
      alert('Transaction confirmed! Your NFT edition has been created successfully.');
      setTxHash(null);
      // Refresh the page to show updated state
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  }, [isConfirmed, txHash]);
  
  // Read contract data for existing NFT editions
  const { data: editionData } = useReadContract({
    address: CONTRACTS.UMO_MOMENTS.address,
    abi: CONTRACTS.UMO_MOMENTS.abi,
    functionName: 'getEdition',
    args: [moment._id],
    enabled: !!moment._id
  });
  
  console.log('🎯 MomentMint rendering with workflow state:', {
    isOwner,
    hasNFTEdition,
    isConnected,
    userDisplayName: user?.displayName,
    momentUploader: moment?.user?.displayName,
    editionData
  });

  // ✅ REAL Function to create NFT edition on blockchain
  const handleCreateNFTEdition = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    setIsCreatingNFT(true);
    setCreationError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Please log in to create NFT editions');
      }

      console.log('🚀 Creating NFT edition on blockchain for moment:', moment._id);

      // Step 1: Upload metadata to Irys/Arweave
      const metadata = {
        name: `UMO Moment: ${moment.songName}`,
        description: `A moment from UMO's performance at ${moment.venueName}, ${moment.venueCity} on ${moment.performanceDate}`,
        image: moment.mediaUrl,
        external_url: `${window.location.origin}/moments/${moment._id}`,
        attributes: [
          { trait_type: 'Song', value: moment.songName },
          { trait_type: 'Venue', value: `${moment.venueName}, ${moment.venueCity}` },
          { trait_type: 'Date', value: moment.performanceDate },
          { trait_type: 'Rarity', value: moment.rarityTier || 'common', max_value: 7 },
          { trait_type: 'Rarity Score', value: moment.rarityScore || 0, max_value: 7 },
          { trait_type: 'Uploader', value: moment.user?.displayName || 'Unknown' },
          { trait_type: 'File Type', value: moment.mediaType || 'unknown' },
          { trait_type: 'First Moment for Song', value: moment.isFirstMomentForSong ? 'Yes' : 'No' }
        ].filter(attr => attr.value),
        properties: {
          files: [{ uri: moment.mediaUrl, type: moment.mediaType }],
          category: moment.mediaType?.includes('video') ? 'video' : 'audio'
        }
      };

      // Upload metadata to Irys (using your existing uploader)
      const metadataResponse = await fetch(`${API_BASE_URL}/upload-metadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(metadata)
      });

      if (!metadataResponse.ok) {
        throw new Error('Failed to upload metadata');
      }

      const { metadataUri } = await metadataResponse.json();
      console.log('📄 Metadata uploaded:', metadataUri);

      // Step 2: Create 0xSplits contract for revenue distribution
      const splitsData = {
        recipients: [
          {
            address: process.env.REACT_APP_MOCK_UMO_ADDRESS, // UMO (55%)
            percentage: 55
          },
          {
            address: address, // Uploader (35%)
            percentage: 35
          },
          {
            address: process.env.REACT_APP_MOCK_PLATFORM_ADDRESS, // Platform (10%)
            percentage: 10
          }
        ]
      };

      const splitsResponse = await fetch(`${API_BASE_URL}/create-splits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(splitsData)
      });

      if (!splitsResponse.ok) {
        throw new Error('Failed to create splits contract');
      }

      const { splitsAddress } = await splitsResponse.json();
      console.log('💰 Splits contract created:', splitsAddress);

      // Step 3: Create NFT edition on smart contract
      const mintPriceWei = parseEther('0.001'); // ~$1 USD equivalent
      const mintDurationSeconds = mintDuration * 24 * 60 * 60; // Convert days to seconds
      const rarityScore = Math.min(7, Math.max(1, moment.rarityScore || 1)); // Ensure 1-7 range

      console.log('📝 Creating edition on contract with params:', {
        momentId: moment._id,
        metadataUri,
        mintPrice: formatEther(mintPriceWei),
        duration: mintDurationSeconds,
        splitsAddress,
        rarity: rarityScore
      });

      const hash = await writeContract({
        address: CONTRACTS.UMO_MOMENTS.address,
        abi: CONTRACTS.UMO_MOMENTS.abi,
        functionName: 'createPublicMomentEdition',
        args: [
          moment._id,
          metadataUri,
          mintPriceWei,
          mintDurationSeconds,
          0, // Unlimited supply
          splitsAddress,
          rarityScore
        ],
      });

      setTxHash(hash);
      console.log('✅ NFT edition creation transaction submitted:', hash);

      // Step 4: Update backend with blockchain data
      const nftEditionData = {
        nftContractAddress: CONTRACTS.UMO_MOMENTS.address,
        nftTokenId: moment._id, // Use moment ID as token identifier
        nftMetadataHash: metadataUri,
        splitsContract: splitsAddress,
        mintPrice: mintPriceWei.toString(),
        mintDuration: mintDurationSeconds,
        txHash: hash
      };

      const backendResponse = await fetch(`${API_BASE_URL}/moments/${moment._id}/create-nft-edition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(nftEditionData)
      });

      if (!backendResponse.ok) {
        const errorData = await backendResponse.json();
        throw new Error(errorData.error || 'Failed to update backend');
      }

      console.log('✅ Backend updated successfully');

    } catch (error) {
      console.error('❌ Error creating NFT edition:', error);
      setCreationError(error.message);
    } finally {
      setIsCreatingNFT(false);
    }
  };

  // ✅ REAL Function to mint NFT on blockchain
  const handleMintNFT = async (quantity = 1) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    setIsCreatingNFT(true);
    setCreationError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Please log in to mint NFTs');
      }

      console.log(`🎯 Minting ${quantity} NFT(s) on blockchain for moment:`, moment._id);

      // Get edition data to calculate price
      const edition = await readContract({
        address: CONTRACTS.UMO_MOMENTS.address,
        abi: CONTRACTS.UMO_MOMENTS.abi,
        functionName: 'getEdition',
        args: [moment._id]
      });

      if (!edition || !edition.isActive) {
        throw new Error('NFT edition is not active');
      }

      const totalCost = edition.mintPrice * BigInt(quantity);
      console.log(`💰 Minting ${quantity} NFT(s) for ${formatEther(totalCost)} ETH`);

      // Mint on blockchain
      const hash = await writeContract({
        address: CONTRACTS.UMO_MOMENTS.address,
        abi: CONTRACTS.UMO_MOMENTS.abi,
        functionName: 'mintMoment',
        args: [moment._id, quantity],
        value: totalCost
      });

      setTxHash(hash);
      console.log('✅ Mint transaction submitted:', hash);

      // Record mint in backend after blockchain confirmation
      const mintData = {
        quantity: quantity,
        minterAddress: address,
        txHash: hash
      };

      const response = await fetch(`${API_BASE_URL}/moments/${moment._id}/record-mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(mintData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to record mint');
      }

      const result = await response.json();
      console.log('✅ Mint recorded in backend:', result);

    } catch (error) {
      console.error('❌ Error minting NFT:', error);
      setCreationError(error.message);
    } finally {
      setIsCreatingNFT(false);
    }
  };

  // ✅ Function to handle management actions
  const handleManageEdition = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/moments/${moment._id}/nft-analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const analytics = await response.json();
        const analyticsText = `
NFT Edition Analytics:
• Contract: ${moment.nftContractAddress?.slice(0, 10)}...
• Total Minted: ${analytics.totalMints}
• Your Revenue: ~$${parseFloat(analytics.uploaderRevenue) / 1e18 * 3500} USD
• Status: ${analytics.timeRemaining.isActive ? 'Active' : 'Ended'}
• Days Remaining: ${analytics.timeRemaining.days}
        `;
        alert(analyticsText);
      } else {
        alert('Failed to load analytics');
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      alert('Failed to load analytics');
    }
  };

  // ✅ Function to open on OpenSea (fixed URL format)
  const handleViewOnOpenSea = () => {
    if (moment.nftContractAddress && moment.nftTokenId) {
      // Correct OpenSea URL format for Base Sepolia testnet
      const openSeaUrl = `https://testnets.opensea.io/assets/base-sepolia/${moment.nftContractAddress}/${moment.nftTokenId}`;
      window.open(openSeaUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert('NFT not fully deployed yet. Please wait a few minutes and try again.');
    }
  };

  // Simple wallet connect button without icons
  const SimpleWalletConnect = () => {
    const handleConnect = async () => {
      if (connectors.length > 0) {
        await connect({ connector: connectors[0] });
      }
    };

    return (
      <button
        onClick={handleConnect}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '600'
        }}
      >
        Connect Wallet
      </button>
    );
  };

  // ===================================================================
  // STEP 1: OWNER + NO NFT CREATED = Show "Create NFT Edition"
  // ===================================================================
  if (isOwner && !hasNFTEdition) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
        color: 'white',
        padding: '20px',
        borderRadius: '12px'
      }}>
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ 
            margin: '0 0 8px 0', 
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Plus style={{ width: '20px', height: '20px', marginRight: '8px' }} />
            Create NFT Edition
            <span style={{
              marginLeft: '10px',
              fontSize: '12px',
              background: 'rgba(255,255,255,0.2)',
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              Owner
            </span>
          </h3>
          <p style={{ margin: '0', fontSize: '14px', opacity: '0.9' }}>
            Turn your moment into mintable NFTs and earn 35% of revenue
          </p>
        </div>

        {!isConnected ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}>
              Connect your wallet to create NFT editions
            </p>
            <SimpleWalletConnect />
          </div>
        ) : (
          <div>
            {/* ✅ Metadata Preview Section */}
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>📋 NFT Metadata Preview</h4>
              <div style={{ fontSize: '12px', lineHeight: '1.4', color: 'rgba(255,255,255,0.9)' }}>
                <div><strong>Song:</strong> {moment.songName}</div>
                <div><strong>Venue:</strong> {moment.venueName}, {moment.venueCity}</div>
                <div><strong>Date:</strong> {moment.performanceDate}</div>
                <div><strong>Rarity:</strong> {moment.rarityTier || 'common'} ({moment.rarityScore || 0}/7)</div>
                {moment.setName && <div><strong>Set:</strong> {moment.setName}</div>}
                {moment.songPosition && <div><strong>Position:</strong> #{moment.songPosition}</div>}
                {moment.momentDescription && <div><strong>Description:</strong> {moment.momentDescription}</div>}
                {moment.emotionalTags && <div><strong>Tags:</strong> {moment.emotionalTags}</div>}
                {moment.instruments && <div><strong>Instruments:</strong> {moment.instruments}</div>}
                {moment.specialOccasion && <div><strong>Occasion:</strong> {moment.specialOccasion}</div>}
                <div><strong>Quality:</strong> Audio: {moment.audioQuality || 'good'}, Video: {moment.videoQuality || 'good'}</div>
                <div><strong>File Type:</strong> {moment.mediaType || 'unknown'} ({moment.fileName})</div>
                {moment.isFirstMomentForSong && <div><strong>🏆 First Moment:</strong> Yes</div>}
              </div>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>💰 Revenue Split</h4>
              <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                <div>🎵 UMO (Artist): 55%</div>
                <div>📤 You (Uploader): 35%</div>
                <div>⚙️ Platform: 10%</div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>⚙️ Edition Settings</h4>
              <div style={{ fontSize: '13px', lineHeight: '1.4', marginBottom: '10px' }}>
                <div>💵 Price: ~$1 USD (in ETH)</div>
                <div>📊 Supply: Unlimited</div>
                <div>🎯 Rarity: {moment.rarityScore || 0}/7</div>
              </div>
              
              {/* ✅ Mint Duration Selector */}
              <div style={{ marginTop: '10px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '5px', 
                  fontSize: '13px', 
                  fontWeight: '600' 
                }}>
                  ⏰ Minting Duration:
                </label>
                <select
                  value={mintDuration}
                  onChange={(e) => setMintDuration(parseInt(e.target.value))}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: 'white',
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    width: '100%'
                  }}
                >
                  <option value={1} style={{ background: '#333', color: 'white' }}>1 Day</option>
                  <option value={3} style={{ background: '#333', color: 'white' }}>3 Days</option>
                  <option value={7} style={{ background: '#333', color: 'white' }}>7 Days (Recommended)</option>
                  <option value={14} style={{ background: '#333', color: 'white' }}>14 Days</option>
                  <option value={30} style={{ background: '#333', color: 'white' }}>30 Days</option>
                </select>
                <p style={{ 
                  margin: '5px 0 0 0', 
                  fontSize: '11px', 
                  opacity: '0.8' 
                }}>
                  How long collectors can mint this NFT
                </p>
              </div>
            </div>

            {creationError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#dc2626',
                padding: '10px',
                borderRadius: '8px',
                marginBottom: '15px',
                fontSize: '13px'
              }}>
                ❌ {creationError}
              </div>
            )}

            <button
              onClick={handleCreateNFTEdition}
              disabled={isCreatingNFT}
              style={{
                width: '100%',
                background: isCreatingNFT ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '12px',
                borderRadius: '8px',
                cursor: isCreatingNFT ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isCreatingNFT ? 0.7 : 1
              }}
            >
              {isCreatingNFT ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginRight: '8px'
                  }} />
                  Creating NFT Edition...
                </>
              ) : (
                <>
                  <Zap style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                  Create NFT Edition
                </>
              )}
            </button>
            
            {isCreatingNFT && (
              <p style={{ margin: '10px 0 0 0', fontSize: '12px', textAlign: 'center', opacity: '0.8' }}>
                This will create a {mintDuration}-day minting window for collectors
              </p>
            )}
          </div>
        )}

        {/* Debug info for owners */}
        <div style={{
          marginTop: '15px',
          padding: '10px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '6px',
          fontSize: '12px'
        }}>
          🔧 <strong>Step 1:</strong> Owner can create NFT | Wallet {isConnected ? '✅' : '❌'} | NFT Edition ❌
        </div>
        
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // ===================================================================
  // STEP 2: OWNER + NFT CREATED = Show "Manage Edition"
  // ===================================================================
  if (isOwner && hasNFTEdition) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #059669 0%, #2563eb 100%)',
        color: 'white',
        padding: '20px',
        borderRadius: '12px'
      }}>
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ 
            margin: '0 0 8px 0', 
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <CheckCircle style={{ width: '20px', height: '20px', marginRight: '8px' }} />
            NFT Edition Active
            <span style={{
              marginLeft: '10px',
              fontSize: '12px',
              background: 'rgba(255,255,255,0.2)',
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              Owner
            </span>
          </h3>
          <p style={{ margin: '0', fontSize: '14px', opacity: '0.9' }}>
            Your moment is live for minting! Earning 35% of mint revenue.
          </p>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.1)',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '15px'
        }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>📊 Edition Stats</h4>
          <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
            <div>💎 Total Minted: {moment.nftMintedCount || 0}</div>
            <div>💰 Your Revenue: ~${((moment.nftMintedCount || 0) * 0.35).toFixed(2)}</div>
            <div>⏰ Time Remaining: {moment.nftMintEndTime ? 'Active' : 'Ended'}</div>
            <div>🔗 Contract: {moment.nftContractAddress?.slice(0, 8)}...</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleViewOnOpenSea}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              padding: '10px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            View on OpenSea
          </button>
          <button
            onClick={handleManageEdition}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              padding: '10px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            Manage Edition
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
      <div style={{
        background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
        color: '#6b7280',
        padding: '15px',
        borderRadius: '8px',
        textAlign: 'center',
        fontSize: '14px'
      }}>
        NFT not yet available for this moment
      </div>
    );
  }

  // ===================================================================
  // STEP 4: NON-OWNER + NFT CREATED = Show "Mint NFT"
  // ===================================================================
  if (!isOwner && hasNFTEdition) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
        color: 'white',
        padding: '20px',
        borderRadius: '12px'
      }}>
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ 
            margin: '0 0 8px 0', 
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Zap style={{ width: '20px', height: '20px', marginRight: '8px' }} />
            Mint NFT
            <span style={{
              marginLeft: '10px',
              fontSize: '12px',
              background: 'rgba(255,255,255,0.2)',
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              Collector
            </span>
          </h3>
          <p style={{ margin: '0', fontSize: '14px', opacity: '0.9' }}>
            Support the artist and uploader by minting this moment
          </p>
        </div>

        {!isConnected ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}>
              Connect your wallet to mint NFTs
            </p>
            <SimpleWalletConnect />
          </div>
        ) : (
          <div>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '15px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '13px', marginBottom: '10px', opacity: '0.9' }}>
                💎 Available for Minting
              </div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 5px 0' }}>
                ~$1 USD
              </div>
              <div style={{ fontSize: '12px', opacity: '0.8' }}>
                {moment.nftMintedCount || 0} already minted
              </div>
            </div>

            {creationError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#dc2626',
                padding: '10px',
                borderRadius: '8px',
                marginBottom: '15px',
                fontSize: '13px'
              }}>
                ❌ {creationError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <button 
                onClick={() => handleMintNFT(1)}
                disabled={isCreatingNFT}
                style={{
                  flex: 2,
                  background: isCreatingNFT ? '#6b5b95' : '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: isCreatingNFT ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  opacity: isCreatingNFT ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isCreatingNFT ? (
                  <>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      marginRight: '6px'
                    }} />
                    Minting...
                  </>
                ) : (
                  'Mint 1 NFT'
                )}
              </button>
              <button 
                onClick={() => handleMintNFT(5)}
                disabled={isCreatingNFT}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: isCreatingNFT ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  opacity: isCreatingNFT ? 0.7 : 1
                }}
              >
                Mint 5
              </button>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '12px',
              lineHeight: '1.4'
            }}>
              <strong>Revenue goes to:</strong><br/>
              🎵 UMO: 55% • 📤 Uploader: 35% • ⚙️ Platform: 10%
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback (shouldn't reach here)
  return (
    <div style={{
      background: '#ef4444',
      color: 'white',
      padding: '20px',
      borderRadius: '12px',
      textAlign: 'center'
    }}>
      <h3>❌ Workflow Error</h3>
      <p style={{ fontSize: '14px' }}>
        Unexpected state: isOwner={String(isOwner)}, hasNFTEdition={String(hasNFTEdition)}
      </p>
    </div>
  );
};

export default MomentMint;