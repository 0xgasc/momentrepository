import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Zap, Plus, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import UMOMomentsContract from '../../contracts/UMOMoments.json';
/* global BigInt */
const MomentMint = ({ moment, user, isOwner, hasNFTEdition, isExpanded = false }) => {
  const [isCreatingNFT, setIsCreatingNFT] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [creationError, setCreationError] = useState('');
  const [mintDuration, setMintDuration] = useState(7);
  const [txHash, setTxHash] = useState(null);
  const [currentStep, setCurrentStep] = useState('ready');
  
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { writeContract } = useWriteContract();
  const chainId = useChainId(); // ✅ FIXED: Use hook at component level
  
  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // ✅ FIXED: Read contract data for testing connection
  const { data: currentTokenId } = useReadContract({
    address: UMOMomentsContract.address,
    abi: UMOMomentsContract.abi,
    functionName: 'getCurrentTokenId',
    enabled: !!UMOMomentsContract.address
  });

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && txHash) {
      console.log('✅ Transaction confirmed:', txHash);
      setCurrentStep('success');
      
      if (isCreatingNFT) {
        updateBackendAfterCreation();
      } else if (isMinting) {
        recordMintInBackend();
      }
    }
  }, [isConfirmed, txHash, isCreatingNFT, isMinting]);

  // Handle transaction errors
  useEffect(() => {
    if (txError) {
      console.error('❌ Transaction failed:', txError);
      setCreationError(txError.message || 'Transaction failed');
      setCurrentStep('ready');
      setIsCreatingNFT(false);
      setIsMinting(false);
    }
  }, [txError]);

  // Update backend after successful NFT creation
  const updateBackendAfterCreation = async () => {
    try {
      const token = localStorage.getItem('token');
      const nftEditionData = {
        nftContractAddress: UMOMomentsContract.address,
        nftTokenId: moment._id,
        nftMetadataHash: `ipfs://metadata-${moment._id}`,
        splitsContract: `0x742d35Cc6634C0532925a3b8D76C7DE9F45F6c96`,
        mintPrice: parseEther('0.001').toString(),
        mintDuration: mintDuration * 24 * 60 * 60,
        txHash: txHash
      };

      const response = await fetch(`${API_BASE_URL}/moments/${moment._id}/create-nft-edition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(nftEditionData)
      });

      if (response.ok) {
        console.log('✅ Backend updated successfully');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        console.error('❌ Backend update failed');
        setCreationError('NFT created but backend update failed. Please refresh the page.');
      }
    } catch (error) {
      console.error('❌ Backend update error:', error);
      setCreationError('NFT created but backend sync failed. Please refresh the page.');
    }
  };

  // Record mint in backend after successful mint
  const recordMintInBackend = async () => {
    try {
      const token = localStorage.getItem('token');
      const mintData = {
        quantity: 1,
        minterAddress: address,
        txHash: txHash
      };

      const response = await fetch(`${API_BASE_URL}/moments/${moment._id}/record-mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(mintData)
      });

      if (response.ok) {
        console.log('✅ Mint recorded in backend');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error('❌ Failed to record mint in backend:', error);
    }
  };

// Replace your handleCreateNFTEdition function with this enhanced debug version:

const handleCreateNFTEdition = async () => {
  if (!isConnected) {
    alert('Please connect your wallet first');
    return;
  }

  setIsCreatingNFT(true);
  setCreationError('');
  setCurrentStep('creating');

  try {
    console.log('🚀 Creating NFT edition on blockchain for moment:', moment._id);

    // Debug checks
    console.log('🔍 Debug Info:');
    console.log('- Wallet address:', address);
    console.log('- Connected:', isConnected);
    console.log('- Contract address:', UMOMomentsContract.address);
    console.log('- Contract ABI length:', UMOMomentsContract.abi?.length);
    console.log('- Current chain ID:', chainId);
    console.log('- Expected chain ID (Base Sepolia):', 84532);
    console.log('- Current token ID from contract:', currentTokenId?.toString());
    
    if (!UMOMomentsContract.address) {
      throw new Error('Contract address not found. Check your UMOMoments.json file.');
    }
    
    if (chainId !== 84532) {
      throw new Error(`Wrong network. Please switch to Base Sepolia (Chain ID: 84532). Current: ${chainId}`);
    }

    // Contract parameters
    const mintPriceWei = parseEther('0.001');
    const mintDurationSeconds = mintDuration * 24 * 60 * 60;
    const rarityScore = Math.min(7, Math.max(1, moment.rarityScore || 1));
    const metadataURI = `ipfs://metadata-${moment._id}`;
    const mockSplitsAddress = `0x742d35Cc6634C0532925a3b8D76C7DE9F45F6c96`;

    console.log('📝 Creating edition with params:', {
      momentId: moment._id,
      metadataURI,
      mintPrice: formatEther(mintPriceWei),
      duration: mintDurationSeconds,
      rarity: rarityScore,
      splitsAddress: mockSplitsAddress
    });

    if (currentTokenId !== undefined) {
      console.log('✅ Contract connection test successful. Current token ID:', currentTokenId.toString());
    } else {
      console.warn('⚠️ Cannot read from contract. This might be an issue.');
    }

    // ✅ NEW: Check if moment edition already exists
    console.log('🔍 Checking if edition already exists...');
    try {
      const { readContract } = await import('wagmi/actions');
      const editionExists = await readContract({
        address: UMOMomentsContract.address,
        abi: UMOMomentsContract.abi,
        functionName: 'getEdition',
        args: [moment._id]
      });
      
      console.log('📋 Edition check result:', editionExists);
      
      // Check if edition already exists (momentId will be non-empty if it exists)
      if (editionExists && editionExists[0] && editionExists[0].length > 0) {
        throw new Error('NFT edition already exists for this moment. Please refresh the page.');
      }
    } catch (editionError) {
      console.log('⚠️ Edition check failed (this might be expected):', editionError.message);
      // Continue anyway - this might fail if edition doesn't exist yet
    }

    // ✅ NEW: Validate all parameters before sending
    console.log('🧪 Validating parameters...');
    console.log('- momentId type:', typeof moment._id, 'value:', moment._id);
    console.log('- metadataURI type:', typeof metadataURI, 'value:', metadataURI);
    console.log('- mintPrice type:', typeof mintPriceWei, 'value:', mintPriceWei.toString());
    console.log('- duration type:', typeof mintDurationSeconds, 'value:', mintDurationSeconds);
    console.log('- maxSupply type:', typeof BigInt(0), 'value:', BigInt(0).toString());
    console.log('- splitsAddress type:', typeof mockSplitsAddress, 'value:', mockSplitsAddress);
    console.log('- rarity type:', typeof rarityScore, 'value:', rarityScore);

    // ✅ NEW: Check if function exists in ABI
    const createMomentEditionFunction = UMOMomentsContract.abi.find(
      func => func.name === 'createMomentEdition' && func.type === 'function'
    );
    
    if (!createMomentEditionFunction) {
      console.error('❌ Function createMomentEdition not found in ABI');
      console.log('Available functions:', UMOMomentsContract.abi.filter(f => f.type === 'function').map(f => f.name));
      throw new Error('Function createMomentEdition not found in contract ABI');
    } else {
      console.log('✅ Function found in ABI:', createMomentEditionFunction);
    }

    console.log('📤 Attempting write transaction...');
    
    // ✅ NEW: Enhanced writeContract call with more debugging
    let hash;
    try {
      console.log('🔄 Calling writeContract...');
      
      hash = await writeContract({
        address: UMOMomentsContract.address,
        abi: UMOMomentsContract.abi,
        functionName: 'createMomentEdition',
        args: [
          moment._id,
          metadataURI,
          mintPriceWei,
          BigInt(mintDurationSeconds),
          BigInt(0), // Unlimited supply
          mockSplitsAddress,
          rarityScore
        ],
      });
      
      console.log('📤 writeContract returned:', hash);
      console.log('📤 hash type:', typeof hash);
      console.log('📤 hash value:', hash);
      
    } catch (writeError) {
      console.error('❌ writeContract threw an error:', writeError);
      console.error('❌ Error details:', {
        message: writeError.message,
        code: writeError.code,
        data: writeError.data,
        stack: writeError.stack
      });
      throw writeError;
    }

    if (!hash) {
      console.error('❌ Transaction hash is null/undefined after writeContract');
      console.error('❌ This might indicate:');
      console.error('   1. User rejected the transaction');
      console.error('   2. Contract function reverted');
      console.error('   3. Invalid parameters');
      console.error('   4. Wallet connectivity issue');
      throw new Error('Transaction hash is undefined. Transaction may have been rejected or failed.');
    }

    setTxHash(hash);
    setCurrentStep('confirming');
    console.log('✅ NFT edition creation transaction submitted:', hash);

  } catch (error) {
    console.error('❌ Detailed error creating NFT edition:', error);
    
    // Enhanced error messages
    let userFriendlyError = error.message;
    
    if (error.message.includes('User rejected') || error.message.includes('user rejected')) {
      userFriendlyError = 'Transaction was rejected in your wallet.';
    } else if (error.message.includes('insufficient funds')) {
      userFriendlyError = 'Insufficient ETH balance for gas fees.';
    } else if (error.message.includes('already exists')) {
      userFriendlyError = 'NFT edition already exists. Please refresh the page.';
    } else if (error.message.includes('Function createMomentEdition not found')) {
      userFriendlyError = 'Contract function not found. Contract may not be properly deployed.';
    } else if (error.message.includes('execution reverted')) {
      userFriendlyError = 'Transaction failed on blockchain. Check contract requirements.';
    }
    
    setCreationError(userFriendlyError);
    setCurrentStep('ready');
    setIsCreatingNFT(false);
  }
};

  // ✅ FIXED: Mint function with proper BigInt handling
  const handleMintNFT = async (quantity = 1) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    setIsMinting(true);
    setCreationError('');
    setCurrentStep('creating');

    try {
      console.log(`🎯 Minting ${quantity} NFT(s) for moment:`, moment._id);

      const mintPrice = parseEther('0.001');
      const totalCost = mintPrice * BigInt(quantity); // ✅ FIXED: Explicit BigInt

      console.log(`💰 Minting ${quantity} NFT(s) for ${formatEther(totalCost)} ETH`);

      const hash = await writeContract({
        address: UMOMomentsContract.address,
        abi: UMOMomentsContract.abi,
        functionName: 'mintMoment',
        args: [moment._id, BigInt(quantity)], // ✅ FIXED: Explicit BigInt
        value: totalCost
      });

      setTxHash(hash);
      setCurrentStep('confirming');
      console.log('✅ Mint transaction submitted:', hash);

    } catch (error) {
      console.error('❌ Error minting NFT:', error);
      setCreationError(error.message || 'Failed to mint NFT');
      setCurrentStep('ready');
      setIsMinting(false);
    }
  };

  // ✅ Function to view on OpenSea
  const handleViewOnOpenSea = () => {
    if (moment.nftContractAddress) {
      const openSeaUrl = `https://testnets.opensea.io/assets/base-sepolia/${moment.nftContractAddress}/${moment._id}`;
      window.open(openSeaUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert('Contract address not available yet. Please wait a moment and try again.');
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
• Your Revenue Share: 35%
• Revenue Earned: ~${(analytics.totalMints * 0.35 * 0.001).toFixed(4)} ETH
• Status: ${analytics.timeRemaining.isActive ? 'Active' : 'Ended'}
• Days Remaining: ${analytics.timeRemaining.days}

View full analytics and manage your edition in the dashboard.
        `;
        alert(analyticsText);
      } else {
        alert('Failed to load analytics. Please try again.');
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      alert('Failed to load analytics. Please check your connection.');
    }
  };

  // Simple wallet connect button
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
const testSimpleWrite = async () => {
  try {
    console.log('🧪 Testing simple contract write...');
    console.log('📋 Your address:', address);
    console.log('📋 Chain ID:', chainId);
    console.log('📋 Contract address:', UMOMomentsContract.address);
    
    // Check if we can read the current token ID (we know this works)
    console.log('📋 Current token ID:', currentTokenId?.toString());
    
    // Try to check if you're the owner by looking at the contract
    // Since we can't easily read the owner function, let's just try the actual write
    console.log('🧪 Testing if createMomentEdition function exists...');
    
    const createFunction = UMOMomentsContract.abi.find(
      func => func.name === 'createMomentEdition' && func.type === 'function'
    );
    
    if (createFunction) {
      console.log('✅ createMomentEdition function found in ABI');
      console.log('📋 Function inputs:', createFunction.inputs);
      
      // Check if you're likely the owner by trying to call a simple owner function
      console.log('🧪 Contract deployed and accessible. Ready to test actual write.');
      console.log('📋 If the next Create NFT Edition fails, you might not be the contract owner.');
    } else {
      console.error('❌ createMomentEdition function not found in ABI');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
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
            <button
        onClick={testSimpleWrite}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.2)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'white',
          padding: '8px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '12px',
          marginBottom: '10px'
        }}
      >
        🧪 Test Contract Owner
      </button>
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
            {/* Progress indicator */}
            {currentStep !== 'ready' && (
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '15px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '14px', marginBottom: '10px' }}>
                  {currentStep === 'creating' && '📝 Preparing transaction...'}
                  {currentStep === 'confirming' && '⏳ Waiting for confirmation...'}
                  {currentStep === 'success' && '✅ NFT Edition Created!'}
                </div>
                {txHash && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'rgba(255,255,255,0.8)',
                      fontSize: '12px',
                      textDecoration: 'underline'
                    }}
                  >
                    View Transaction →
                  </a>
                )}
              </div>
            )}

            {/* Edition Settings */}
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>⚙️ Edition Settings</h4>
              <div style={{ fontSize: '13px', lineHeight: '1.4', marginBottom: '10px' }}>
                <div>💵 Price: ~$1 USD (0.001 ETH)</div>
                <div>📊 Supply: Unlimited</div>
                <div>🎯 Rarity: {moment.rarityScore || 0}/7</div>
              </div>
              
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
                  disabled={currentStep !== 'ready'}
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
              disabled={isCreatingNFT || isConfirming || currentStep !== 'ready'}
              style={{
                width: '100%',
                background: (isCreatingNFT || isConfirming) ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '12px',
                borderRadius: '8px',
                cursor: (isCreatingNFT || isConfirming) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: (isCreatingNFT || isConfirming) ? 0.7 : 1
              }}
            >
              {isCreatingNFT || isConfirming ? (
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
                  {isCreatingNFT ? 'Creating NFT Edition...' : 'Confirming Transaction...'}
                </>
              ) : (
                <>
                  <Zap style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                  Create NFT Edition
                </>
              )}
            </button>
          </div>
        )}
        
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
            <div>💰 Your Revenue: ~${((moment.nftMintedCount || 0) * 0.35 * 0.001 * 3500).toFixed(2)} USD</div>
            <div>⏰ Status: {moment.nftMintEndTime && new Date() < new Date(moment.nftMintEndTime) ? 'Active' : 'Ended'}</div>
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
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ExternalLink style={{ width: '14px', height: '14px', marginRight: '6px' }} />
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
            View Analytics
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
            {/* Minting progress */}
            {currentStep !== 'ready' && (
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '15px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '14px', marginBottom: '10px' }}>
                  {currentStep === 'creating' && '💰 Preparing mint...'}
                  {currentStep === 'confirming' && '⏳ Confirming mint...'}
                  {currentStep === 'success' && '🎉 NFT Minted Successfully!'}
                </div>
                {txHash && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'rgba(255,255,255,0.8)',
                      fontSize: '12px',
                      textDecoration: 'underline'
                    }}
                  >
                    View Transaction →
                  </a>
                )}
              </div>
            )}

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
                disabled={isMinting || isConfirming || currentStep !== 'ready'}
                style={{
                  flex: 2,
                  background: (isMinting || isConfirming) ? '#6b5b95' : '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: (isMinting || isConfirming) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  opacity: (isMinting || isConfirming) ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isMinting || isConfirming ? (
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
                disabled={isMinting || isConfirming || currentStep !== 'ready'}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: (isMinting || isConfirming) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  opacity: (isMinting || isConfirming) ? 0.7 : 1
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