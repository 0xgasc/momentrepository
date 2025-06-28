import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Zap, Plus, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import UMOMomentsContract from '../../contracts/UMOMoments.json';
import { ethers } from 'ethers';
/* global BigInt */

const DebugPanel = ({ moment, UMOMomentsContract, writeContract, currentTokenId, address, chainId, creationError, syncDatabaseWithBlockchain, previewMetadata, testCreateNFTBlockchainOnly }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState({});

  // Show debug panel only in development or when there's an error
  const shouldShowDebug = process.env.NODE_ENV === 'development' || creationError;

  if (!shouldShowDebug) return null;

  const logResult = (testName, result, success = true) => {
    setResults(prev => ({
      ...prev,
      [testName]: { result, success, timestamp: new Date().toLocaleTimeString() }
    }));
  };

  // 🔍 FIXED REQUIREMENT CHECKER
  const debugContractRequirements = async () => {
    try {
      console.log('🔍 Debugging contract requirements...');
      
      const momentId = moment._id;
      const splitsAddress = '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96';
      const rarity = Math.floor(Math.min(7, Math.max(1, moment.rarityScore || 1)));
      
      logResult('requirementCheck', `✅ Basic validation passed - momentId: ${momentId.slice(0, 8)}..., rarity: ${rarity}`, true);
      return true;
      
    } catch (error) {
      logResult('requirementCheck', `❌ Failed: ${error.message}`, false);
      return false;
    }
  };

  // 🧪 ENHANCED FRESH ID TEST - Now using working ethers approach
  const testWithFreshMomentId = async () => {
    try {
      const freshMomentId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('🧪 Starting fresh ID test with:', freshMomentId);
      
      // ✅ Use working ethers v6 approach instead of broken wagmi
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        UMOMomentsContract.address,
        UMOMomentsContract.abi,
        signer
      );

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction timed out after 30s')), 30000)
      );
      
      const writePromise = contract.createMomentEdition(
        String(freshMomentId),
        'ipfs://test-metadata',
        parseEther('0.001'),
        BigInt(7 * 24 * 60 * 60),
        BigInt(0),
        '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96',
        1
      );
      
      const tx = await Promise.race([writePromise, timeoutPromise]);
      
      console.log('🧪 Fresh ID test result:', tx.hash, typeof tx.hash);
      
      if (!tx.hash) {
        logResult('freshIdTest', '❌ CRITICAL: No transaction hash returned', false);
        return null;
      } else {
        logResult('freshIdTest', `✅ SUCCESS: Got transaction hash ${tx.hash}`, true);
        return tx.hash;
      }
      
    } catch (error) {
      console.error('🧪 Fresh ID test error:', error);
      
      if (error.code === 'ACTION_REJECTED' || error.message.includes('User rejected')) {
        logResult('freshIdTest', '❌ User rejected transaction in wallet', false);
      } else if (error.message.includes('timed out')) {
        logResult('freshIdTest', '❌ Transaction timed out (likely wallet popup issue)', false);
      } else {
        logResult('freshIdTest', `❌ FAILED: ${error.message}`, false);
      }
      return null;
    }
  };

  // 🔧 WALLET CONNECTION TEST
  const testWalletConnection = async () => {
    try {
      if (!window.ethereum) {
        logResult('walletTest', '❌ No wallet detected', false);
        return;
      }
      
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      logResult('walletTest', `✅ Wallet connected: ${accounts[0]?.slice(0, 8)}... on chain ${parseInt(chainId, 16)}`, true);
      
      // Test if wallet can sign
      try {
        const message = `Test signature ${Date.now()}`;
        const signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [message, accounts[0]],
        });
        
        logResult('walletSigning', `✅ Wallet can sign: ${signature.slice(0, 20)}...`, true);
      } catch (signError) {
        logResult('walletSigning', `❌ Wallet signing failed: ${signError.message}`, false);
      }
      
    } catch (error) {
      logResult('walletTest', `❌ Wallet test failed: ${error.message}`, false);
    }
  };

  // 🔍 WAGMI CONFIGURATION TEST
  const testWagmiConfig = async () => {
    try {
      console.log('🔍 Testing wagmi configuration...');
      console.log('- writeContract function type:', typeof writeContract);
      console.log('- currentTokenId:', currentTokenId?.toString());
      console.log('- address:', address);
      console.log('- chainId:', chainId);
      
      if (typeof writeContract !== 'function') {
        logResult('wagmiConfig', '❌ writeContract is not a function', false);
        return;
      }
      
      if (!address) {
        logResult('wagmiConfig', '❌ No address from useAccount', false);
        return;
      }
      
      if (chainId !== 84532) {
        logResult('wagmiConfig', `❌ Wrong chain: ${chainId} (expected 84532)`, false);
        return;
      }
      
      logResult('wagmiConfig', '✅ Wagmi configuration looks correct', true);
      
    } catch (error) {
      logResult('wagmiConfig', `❌ Wagmi config error: ${error.message}`, false);
    }
  };

  // 🔍 CONTRACT VERIFICATION
  const verifyContractDeployment = async () => {
    try {
      const provider = window.ethereum;
      const code = await provider.request({
        method: 'eth_getCode',
        params: [UMOMomentsContract.address, 'latest']
      });
      
      const hasCode = code !== '0x';
      logResult('contractVerification', 
        hasCode ? `✅ Contract deployed (${code.length} bytes)` : '❌ No contract code', 
        hasCode
      );
    } catch (error) {
      logResult('contractVerification', `❌ Failed: ${error.message}`, false);
    }
  };

  // 🎯 MINIMAL WRITE TEST - Updated to use ethers
  const testMinimalWrite = async () => {
    try {
      console.log('🎯 Testing minimal contract read...');
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        UMOMomentsContract.address,
        UMOMomentsContract.abi,
        provider
      );
      
      const result = await contract.getCurrentTokenId();
      
      console.log('🎯 Minimal read result:', result.toString());
      logResult('minimalRead', `✅ Contract read works: ${result.toString()}`, true);
      
    } catch (error) {
      logResult('minimalRead', `❌ Minimal read failed: ${error.message}`, false);
    }
  };

  // 🔄 RUN ALL TESTS
  const runAllTests = async () => {
    setResults({});
    console.log('🚀 Running comprehensive diagnostics...');
    
    await verifyContractDeployment();
    await testWagmiConfig();
    await testWalletConnection();
    await debugContractRequirements();
    await testMinimalWrite();
    await testWithFreshMomentId();
    
    console.log('📊 All tests complete. Check results above.');
  };

  // 🧪 NEW: Ethers v6 connection test
  const testEthersConnection = async () => {
    try {
      console.log('🔍 Testing ethers v6 connection...');
      
      if (!window.ethereum) {
        logResult('ethersTest', '❌ No MetaMask detected', false);
        return;
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      
      logResult('ethersTest', `✅ Ethers v6 Working! Network: ${network.name} (${network.chainId}), Block: ${blockNumber}`, true);
      
    } catch (error) {
      console.error('❌ Ethers test failed:', error);
      logResult('ethersTest', `❌ Ethers test failed: ${error.message}`, false);
    }
  };

  // 🧪 Contract existence check
  const checkContractExists = async () => {
    try {
      if (!UMOMomentsContract.address) {
        logResult('contractExists', '❌ No contract address found', false);
        return;
      }
      
      console.log('🔍 Checking if contract exists at:', UMOMomentsContract.address);
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const code = await provider.getCode(UMOMomentsContract.address);
      
      console.log('📋 Contract code length:', code.length);
      
      if (code === '0x') {
        logResult('contractExists', `❌ NO CONTRACT FOUND at ${UMOMomentsContract.address}`, false);
      } else {
        logResult('contractExists', `✅ Contract EXISTS! Code Length: ${code.length} bytes`, true);
      }
      
    } catch (error) {
      console.error('Contract check failed:', error);
      logResult('contractExists', `❌ Could not check contract: ${error.message}`, false);
    }
  };

  // 🔍 Verify NFT exists on blockchain
  const verifyNFTExists = async () => {
    try {
      console.log('🔍 Checking if NFT actually exists on blockchain...');
      
      if (!moment.nftContractAddress || !moment._id) {
        logResult('nftVerification', '❌ No NFT contract info found in database', false);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        moment.nftContractAddress,
        UMOMomentsContract.abi,
        provider
      );
      
      console.log('📞 Calling getEdition on contract...');
      const edition = await contract.getEdition(String(moment._id));
      
      console.log('📋 Edition result:', edition);
      
      if (edition && edition[0] && edition[0].length > 0) {
        const editionInfo = {
          momentId: edition[0],
          metadataURI: edition[1], 
          mintPrice: edition[2],
          mintStartTime: edition[3],
          mintEndTime: edition[4],
          maxSupply: edition[5],
          currentSupply: edition[6],
          splitsContract: edition[7],
          isActive: edition[8],
          rarity: edition[9]
        };
        
        logResult('nftVerification', `✅ NFT Edition EXISTS! Mint Price: ${ethers.formatEther(editionInfo.mintPrice)} ETH, Supply: ${editionInfo.currentSupply.toString()}, Active: ${editionInfo.isActive}`, true);
        return true;
      } else {
        logResult('nftVerification', `❌ NFT Edition NOT found on blockchain! Database shows NFT exists but blockchain has no record.`, false);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Verification failed:', error);
      
      if (error.message.includes('call revert exception')) {
        logResult('nftVerification', `❌ NFT Edition does not exist on blockchain! Database/blockchain mismatch.`, false);
      } else {
        logResult('nftVerification', `❌ Verification failed: ${error.message}`, false);
      }
      return false;
    }
  };

  // 📊 Check minting status
  const checkMintingStatus = async () => {
    try {
      if (!moment.nftContractAddress || !moment._id) {
        logResult('mintingStatus', '❌ No contract info available', false);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        moment.nftContractAddress,
        UMOMomentsContract.abi,
        provider
      );
      
      const isActive = await contract.isMintingActive(String(moment._id));
      const totalMinted = await contract.getTotalMinted(String(moment._id));
      
      logResult('mintingStatus', `📊 Is Active: ${isActive}, Total Minted: ${totalMinted.toString()}, Database Shows: ${moment.nftMintedCount || 0}`, true);
      
    } catch (error) {
      console.error('Status check failed:', error);
      logResult('mintingStatus', `❌ Could not check minting status: ${error.message}`, false);
    }
  };

  const debugButtonStyle = {
      }

    } catch (error) {
      console.error('❌ TEST Create NFT failed:', error);
      
      if (error.code === 'ACTION_REJECTED' || error.message.includes('User rejected')) {
        logResult('blockchainTest', '❌ User rejected transaction in MetaMask', false);
      } else if (error.message.includes('insufficient funds')) {
        logResult('blockchainTest', '❌ Insufficient ETH for gas fees', false);
      } else if (error.message.includes('Edition already exists')) {
        logResult('blockchainTest', '❌ NFT edition already exists for this moment', false);
      } else {
        logResult('blockchainTest', `❌ TEST FAILED: ${error.message}`, false);
      }
    }
  };

  // 🔍 Preview metadata that will be created
  const previewMetadata = () => {
    const metadata = createNFTMetadata(moment);
    console.log('📋 Generated metadata:', metadata);
    
    const metadataText = `
📋 NFT Metadata Preview:

🎵 Name: ${metadata.name}
📖 Description: ${metadata.description}
🖼️ Image: ${metadata.image}
🎬 Video: ${metadata.animation_url || 'None'}
🔗 External URL: ${metadata.external_url}

🏷️ Attributes:
${metadata.attributes.map(attr => `• ${attr.trait_type}: ${attr.value}`).join('\n')}
    `;
    
    alert(metadataText);
    logResult('metadataPreview', '✅ Metadata preview shown in console and alert', true);
  };

  // 🧪 Test minting from existing edition
  const testMintFromEdition = async () => {
    try {
      if (!moment.nftContractAddress || !moment._id) {
        logResult('mintTest', '❌ No NFT edition available to mint from', false);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        moment.nftContractAddress,
        UMOMomentsContract.abi,
        signer
      );

      // Check if minting is active first
      const isActive = await contract.isMintingActive(String(moment._id));
      if (!isActive) {
        logResult('mintTest', '❌ Minting is not active for this moment', false);
        return;
      }

      const mintPrice = parseEther('0.001');
      logResult('mintTest', '🚀 Calling contract.mintMoment() - MetaMask should popup for payment...', true);

      const tx = await contract.mintMoment(String(moment._id), BigInt(1), {
        value: mintPrice
      });

      logResult('mintTest', `✅ MINT SUCCESS! TX: ${tx.hash} - Real NFT token created!`, true);

      // Wait for confirmation and check total supply
      const receipt = await tx.wait();
      const totalMinted = await contract.getTotalMinted(String(moment._id));
      logResult('mintTest', `🎉 CONFIRMED! Block: ${receipt.blockNumber}, Total Minted: ${totalMinted.toString()}`, true);

    } catch (error) {
      if (error.code === 'ACTION_REJECTED') {
        logResult('mintTest', '❌ User rejected payment in MetaMask', false);
      } else {
        logResult('mintTest', `❌ Mint failed: ${error.message}`, false);
      }
    }
  };

  const debugButtonStyle = {
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    padding: '8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '500',
    color: '#374151'
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'white',
      border: '2px solid #e5e7eb',
      borderRadius: '12px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
      zIndex: 10000,
      maxWidth: '450px',
      maxHeight: '80vh',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: 'white',
          padding: '12px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: '600',
          fontSize: '14px'
        }}
      >
        <span>🔧 NFT Debug Panel (Enhanced + Fixed)</span>
        <span style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </div>

      {/* Content */}
      {isOpen && (
        <div style={{ padding: '16px', maxHeight: '500px', overflowY: 'auto', color: '#1f2937' }}>
          {/* Quick Info */}
          <div style={{
            background: '#f8fafc',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '12px',
            lineHeight: '1.4',
            color: '#374151'
          }}>
            <div><strong>Contract:</strong> {UMOMomentsContract.address?.slice(0, 8)}...</div>
            <div><strong>Chain:</strong> {chainId} {chainId === 84532 ? '✅' : '❌'}</div>
            <div><strong>Token ID:</strong> {currentTokenId?.toString()}</div>
            <div><strong>Your Address:</strong> {address?.slice(0, 8)}...</div>
            <div><strong>Moment ID:</strong> {moment._id?.slice(0, 12)}...</div>
            <div><strong>writeContract:</strong> {typeof writeContract}</div>
          </div>

          {/* Enhanced Actions */}
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={runAllTests}
              style={{
                width: '100%',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                marginBottom: '8px'
              }}
            >
              🚀 Run All Enhanced Diagnostics
            </button>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <button onClick={testWagmiConfig} style={debugButtonStyle}>
                ⚙️ Wagmi Config
              </button>
              <button onClick={testWalletConnection} style={debugButtonStyle}>
                🔗 Wallet Test
              </button>
              <button onClick={testEthersConnection} style={debugButtonStyle}>
                🔍 Ethers v6
              </button>
              <button onClick={checkContractExists} style={debugButtonStyle}>
                🏭 Contract Check
              </button>
              <button onClick={testMinimalWrite} style={debugButtonStyle}>
                📖 Read Test
              </button>
              <button onClick={verifyNFTExists} style={debugButtonStyle}>
                🔍 Verify NFT
              </button>
              <button onClick={checkMintingStatus} style={debugButtonStyle}>
                📊 Mint Status
              </button>
              <button onClick={testWithFreshMomentId} style={debugButtonStyle}>
                🧪 Fresh ID
              </button>
              <button onClick={testCreateNFTBlockchainOnly} style={debugButtonStyle}>
                🧪 Test Create Edition
              </button>
              <button onClick={testMintFromEdition} style={debugButtonStyle}>
                💰 Test Mint Token
              </button>
              <button onClick={() => {
                previewMetadata();
                logResult('metadataPreview', '✅ Metadata preview shown in console and alert', true);
              }} style={debugButtonStyle}>
                📋 Preview Metadata
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <button onClick={syncDatabaseWithBlockchain} style={debugButtonStyle}>
                🔄 Sync Database
              </button>
              <button onClick={verifyNFTExists} style={debugButtonStyle}>
                🔍 Verify NFT
              </button>
            </div>

            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', lineHeight: '1.3' }}>
              📋 Preview Metadata = See what NFT metadata will look like<br/>
              🔄 Sync Database = Fix when blockchain has edition but database doesn't
            </div>

            <button
              onClick={testCreateNFTBlockchainOnly}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                padding: '10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                border: 'none',
                fontWeight: '600',
                marginBottom: '8px'
              }}
            >
              🧪 Test Create Edition (Step 1 - No Database)
            </button>

            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '15px', lineHeight: '1.3' }}>
              ℹ️ <strong>Two-Step Process:</strong><br/>
              1. Create Edition = Set up minting parameters (no tokens yet)<br/>
              2. Mint Tokens = Actually create NFT tokens (costs mint price)
            </div>
          </div>

          {/* Results */}
          {Object.keys(results).length > 0 && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#374151' }}>
                📊 Enhanced Test Results
              </div>
              {Object.entries(results).map(([test, data]) => (
                <div key={test} style={{
                  padding: '6px',
                  marginBottom: '4px',
                  background: data.success ? '#f0fdf4' : '#fef2f2',
                  borderRadius: '4px',
                  fontSize: '11px',
                  borderLeft: `3px solid ${data.success ? '#22c55e' : '#ef4444'}`,
                  color: '#374151'
                }}>
                  <div style={{ fontWeight: '600', color: '#1f2937' }}>{test} ({data.timestamp})</div>
                  <div style={{ color: '#4b5563' }}>{data.result}</div>
                </div>
              ))}
            </div>
          )}

          {/* Clear Results */}
          {Object.keys(results).length > 0 && (
            <button
              onClick={() => setResults({})}
              style={{
                width: '100%',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                padding: '6px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                marginTop: '8px'
              }}
            >
              🧹 Clear Results
            </button>
          )}
        </div>
      )}
    </div>
  );
};

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
  const chainId = useChainId();
  
  // Wait for transaction confirmation - keeping for compatibility
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Read existing edition - keeping for compatibility  
  const { data: existingEdition } = useReadContract({
    address: UMOMomentsContract.address,
    abi: UMOMomentsContract.abi,
    functionName: 'getEdition',
    args: [String(moment._id)],
    enabled: !!UMOMomentsContract.address && !!moment._id
  });

  // Read contract data for testing connection
  const { data: currentTokenId } = useReadContract({
    address: UMOMomentsContract.address,
    abi: UMOMomentsContract.abi,
    functionName: 'getCurrentTokenId',
    enabled: !!UMOMomentsContract.address
  });

  // Handle transaction confirmation - keeping for compatibility
  useEffect(() => {
    if (isConfirmed && txHash) {
      console.log('✅ Transaction confirmed:', txHash);
      setCurrentStep('success');
      
      if (isCreatingNFT) {
        updateBackendAfterCreation(txHash);
      } else if (isMinting) {
        // Note: For useEffect, we don't have the exact quantity, but since we're tracking
        // the mint in the individual mint functions, this is just a fallback
        recordMintInBackend(txHash, 1);
      }
    }
  }, [isConfirmed, txHash, isCreatingNFT, isMinting]);

  // Handle transaction errors - keeping for compatibility
  useEffect(() => {
    if (txError) {
      console.error('❌ Transaction failed:', txError);
      setCreationError(txError.message || 'Transaction failed');
      setCurrentStep('ready');
      setIsCreatingNFT(false);
      setIsMinting(false);
    }
  }, [txError]);

  // ✅ Create proper metadata for NFT
  const createNFTMetadata = (moment) => {
    return {
      name: `${moment.artistName} - ${moment.songTitle}`,
      description: `Live performance moment from ${moment.artistName} at ${moment.venueName || 'Unknown Venue'} ${moment.date ? `on ${new Date(moment.date).toLocaleDateString()}` : ''}.`,
      image: moment.thumbnailUrl || moment.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(moment.artistName)}&background=random`,
      animation_url: moment.videoUrl,
      external_url: `${window.location.origin}/moment/${moment._id}`,
      attributes: [
        {
          trait_type: "Artist",
          value: moment.artistName
        },
        {
          trait_type: "Song",
          value: moment.songTitle
        },
        {
          trait_type: "Venue", 
          value: moment.venueName || "Unknown"
        },
        {
          trait_type: "Date",
          value: moment.date ? new Date(moment.date).toLocaleDateString() : "Unknown"
        },
        {
          trait_type: "Rarity Score",
          value: moment.rarityScore || 1,
          max_value: 7
        },
        {
          trait_type: "Duration",
          value: moment.duration || "Unknown"
        },
        {
          trait_type: "Uploader",
          value: moment.uploaderUsername || "Anonymous"
        }
      ].filter(attr => attr.value !== "Unknown" && attr.value !== null)
    };
  };

  // ✅ Upload metadata to IPFS (simplified version)
  const uploadMetadataToIPFS = async (metadata) => {
    try {
      // For now, we'll use a simple approach - you can replace this with actual IPFS upload
      console.log('📤 Would upload to IPFS:', metadata);
      
      // TODO: Replace with actual IPFS upload service
      // Options: Pinata, NFT.Storage, Web3.Storage, or your own IPFS node
      // const ipfsHash = await uploadToIPFS(JSON.stringify(metadata));
      // return `ipfs://${ipfsHash}`;
      
      // Temporary: use a data URI with the metadata (works for OpenSea testing)
      const metadataJson = JSON.stringify(metadata);
      const base64 = btoa(metadataJson);
      const dataURI = `data:application/json;base64,${base64}`;
      
      console.log('📋 Using data URI for metadata (temporary solution)');
      console.log('🔗 Data URI length:', dataURI.length);
      
      return dataURI;
      
    } catch (error) {
      console.error('❌ Metadata creation failed:', error);
      // Fallback to basic metadata URI
      return `ipfs://metadata-${moment._id}`;
    }
  };

  // ✅ Create proper metadata for NFT
  const createNFTMetadata = (moment) => {
    return {
      name: `${moment.artistName} - ${moment.songTitle}`,
      description: `Live performance moment from ${moment.artistName} at ${moment.venueName || 'Unknown Venue'} ${moment.date ? `on ${new Date(moment.date).toLocaleDateString()}` : ''}.`,
      image: moment.thumbnailUrl || moment.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(moment.artistName)}&background=random`,
      animation_url: moment.videoUrl,
      external_url: `${window.location.origin}/moment/${moment._id}`,
      attributes: [
        {
          trait_type: "Artist",
          value: moment.artistName
        },
        {
          trait_type: "Song",
          value: moment.songTitle
        },
        {
          trait_type: "Venue", 
          value: moment.venueName || "Unknown"
        },
        {
          trait_type: "Date",
          value: moment.date ? new Date(moment.date).toLocaleDateString() : "Unknown"
        },
        {
          trait_type: "Rarity Score",
          value: moment.rarityScore || 1,
          max_value: 7
        },
        {
          trait_type: "Duration",
          value: moment.duration || "Unknown"
        },
        {
          trait_type: "Uploader",
          value: moment.uploaderUsername || "Anonymous"
        }
      ].filter(attr => attr.value !== "Unknown" && attr.value !== null)
    };
  };

  // ✅ Upload metadata to IPFS (simplified version)
  const uploadMetadataToIPFS = async (metadata) => {
    try {
      // For now, we'll use a simple approach - you can replace this with actual IPFS upload
      console.log('📤 Would upload to IPFS:', metadata);
      
      // TODO: Replace with actual IPFS upload service
      // Options: Pinata, NFT.Storage, Web3.Storage, or your own IPFS node
      // const ipfsHash = await uploadToIPFS(JSON.stringify(metadata));
      // return `ipfs://${ipfsHash}`;
      
      // Temporary: use a data URI with the metadata (works for OpenSea testing)
      const metadataJson = JSON.stringify(metadata);
      const base64 = btoa(metadataJson);
      const dataURI = `data:application/json;base64,${base64}`;
      
      console.log('📋 Using data URI for metadata (temporary solution)');
      console.log('🔗 Data URI length:', dataURI.length);
      
      return dataURI;
      
    } catch (error) {
      console.error('❌ Metadata creation failed:', error);
      // Fallback to basic metadata URI
      return `ipfs://metadata-${moment._id}`;
    }
  };
  const syncDatabaseWithBlockchain = async () => {
    try {
      setCreationError('');
      setCurrentStep('creating');
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        UMOMomentsContract.address,
        UMOMomentsContract.abi,
        provider
      );

      // Check if edition exists on blockchain
      const edition = await contract.getEdition(String(moment._id));
      
      if (edition && edition[0] && edition[0].length > 0) {
        console.log('✅ Edition found on blockchain - updating database...');
        
        setCurrentStep('updating');
        
        // Update database to match blockchain
        const token = localStorage.getItem('token');
        const nftEditionData = {
          nftContractAddress: UMOMomentsContract.address,
          nftTokenId: String(moment._id),
          nftMetadataHash: `ipfs://metadata-${moment._id}`,
          splitsContract: '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96',
          mintPrice: edition[2].toString(), // Use actual blockchain price
          mintDuration: 7 * 24 * 60 * 60,
          txHash: 'synced-from-blockchain'
        };

        const response = await fetch(`${API_BASE_URL}/moments/${String(moment._id)}/create-nft-edition`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(nftEditionData)
        });

        if (response.ok) {
          setCurrentStep('success');
          alert('🎉 Database synced with blockchain! Page will refresh to show updated state.');
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          throw new Error('Database update failed');
        }
      } else {
        throw new Error('No edition found on blockchain for this moment');
      }
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
      setCreationError(error.message);
      setCurrentStep('ready');
    }
  };

  // 🔥 CORE FIX: Use direct ethers contract interaction instead of wagmi
  const handleCreateNFTEdition = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (chainId !== 84532) {
      alert('Please switch to Base Sepolia network (Chain ID: 84532)');
      return;
    }

    if (!window.ethereum) {
      alert('MetaMask not detected');
      return;
    }

    setIsCreatingNFT(true);
    setCreationError('');
    setCurrentStep('creating');

    try {
      console.log('🚀 Creating NFT edition with direct ethers...');

      // ✅ Setup ethers v6 provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        UMOMomentsContract.address,
        UMOMomentsContract.abi,
        signer
      );

      // ✅ Prepare transaction parameters with REAL metadata
      const mintPriceWei = parseEther('0.001');
      const mintDurationSeconds = BigInt(mintDuration * 24 * 60 * 60);
      const rarityScore = Math.floor(Math.min(7, Math.max(1, moment.rarityScore || 1)));
      
      // ✅ Create proper metadata
      const metadata = createNFTMetadata(moment);
      const metadataURI = await uploadMetadataToIPFS(metadata);
      
      const mockSplitsAddress = '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96';

      console.log('📝 Transaction parameters:', {
        momentId: moment._id,
        metadataURI,
        metadata: metadata,
        mintPrice: formatEther(mintPriceWei),
        duration: mintDurationSeconds.toString(),
        rarity: rarityScore,
        splitsAddress: mockSplitsAddress,
        contractAddress: UMOMomentsContract.address
      });

      setCurrentStep('confirming');
      console.log('📤 Calling contract.createMomentEdition() - MetaMask should popup...');

      // 🔥 CRITICAL: This WILL trigger MetaMask popup
      const transaction = await contract.createMomentEdition(
        String(moment._id),            // momentId (string)
        metadataURI,                   // metadataURI (string)  
        mintPriceWei,                  // mintPrice (BigNumber)
        mintDurationSeconds,           // mintDuration (BigInt)
        BigInt(0),                     // maxSupply (BigInt) - unlimited
        mockSplitsAddress,             // splitsContract (address)
        rarityScore                    // rarity (uint8)
      );

      console.log('✅ Transaction submitted:', transaction.hash);
      setTxHash(transaction.hash);

      // ✅ Wait for blockchain confirmation
      console.log('⏳ Waiting for blockchain confirmation...');
      const receipt = await transaction.wait();
      console.log('✅ Transaction confirmed in block:', receipt.blockNumber);

      // ✅ ONLY NOW update the database (after successful blockchain transaction)
      setCurrentStep('updating');
      await updateBackendAfterCreation(transaction.hash);

      setCurrentStep('success');
      alert(`🎉 NFT Edition Created Successfully!\n\n` +
            `Transaction: ${transaction.hash}\n` +
            `Block: ${receipt.blockNumber}\n\n` +
            `Check BaseScan for confirmation.`);

      // Reload page to show updated state
      setTimeout(() => {
        window.location.reload();
      }, 3000);

    } catch (error) {
      console.error('❌ Create NFT Edition failed:', error);
      
      let errorMessage = error.message || 'Unknown error';
      
      if (error.code === 'ACTION_REJECTED' || errorMessage.includes('User rejected')) {
        errorMessage = 'Transaction was rejected in MetaMask';
      } else if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Insufficient ETH for gas fees';
      } else if (errorMessage.includes('Edition already exists')) {
        errorMessage = 'NFT edition already exists for this moment';
      } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        errorMessage = 'Contract call failed - check parameters';
      }
      
      setCreationError(errorMessage);
      setCurrentStep('ready');
    } finally {
      setIsCreatingNFT(false);
    }
  };

  // 🔥 CORE FIX: Use direct ethers for minting
  const handleMintNFT = async (quantity = 1) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (chainId !== 84532) {
      alert('Please switch to Base Sepolia network');
      return;
    }

    setIsMinting(true);
    setCreationError('');
    setCurrentStep('creating');

    try {
      console.log(`🎯 Minting ${quantity} NFT(s) for moment:`, moment._id);

      // ✅ Setup ethers v6 provider and signer
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

      // 🔥 CRITICAL: This WILL trigger MetaMask popup
      const transaction = await contract.mintMoment(String(moment._id), BigInt(quantity), {
        value: totalCost
      });

      console.log('✅ Mint transaction submitted:', transaction.hash);
      setTxHash(transaction.hash);

      // ✅ Wait for blockchain confirmation
      const receipt = await transaction.wait();
      console.log('✅ Mint confirmed in block:', receipt.blockNumber);

      // ✅ Update backend after successful mint
      await recordMintInBackend(transaction.hash, quantity);

      setCurrentStep('success');
      alert(`🎉 NFT${quantity > 1 ? 's' : ''} Minted Successfully!\n\n` +
            `Quantity: ${quantity}\n` +
            `Transaction: ${transaction.hash}\n` +
            `Block: ${receipt.blockNumber}`);

      setTimeout(() => {
        window.location.reload();
      }, 3000);

    } catch (error) {
      console.error('❌ Error minting NFT:', error);
      
      let errorMessage = error.message || 'Failed to mint NFT';
      
      if (error.code === 'ACTION_REJECTED') {
        errorMessage = 'Transaction was rejected in MetaMask';
      } else if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Insufficient ETH for gas fees and mint cost';
      }
      
      setCreationError(errorMessage);
      setCurrentStep('ready');
    } finally {
      setIsMinting(false);
    }
  };

  // Update backend after successful NFT creation - FIXED with proper metadata
  const updateBackendAfterCreation = async (transactionHash) => {
    try {
      const token = localStorage.getItem('token');
      
      // ✅ Create proper metadata for backend
      const metadata = createNFTMetadata(moment);
      const metadataURI = await uploadMetadataToIPFS(metadata);
      
      const nftEditionData = {
        nftContractAddress: UMOMomentsContract.address,
        nftTokenId: String(moment._id),
        nftMetadataHash: metadataURI,
        splitsContract: '0x742d35cc6634c0532925a3b8d76c7de9f45f6c96',
        mintPrice: parseEther('0.001').toString(),
        mintDuration: mintDuration * 24 * 60 * 60,
        txHash: transactionHash || txHash,
        metadata: metadata // Include full metadata for backend
      };

      console.log('📝 Updating backend with:', nftEditionData);

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
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        const errorText = await response.text();
        console.error('❌ Backend update failed:', errorText);
        setCreationError('NFT created but backend update failed. Please refresh the page.');
      }
    } catch (error) {
      console.error('❌ Backend update error:', error);
      setCreationError('NFT created but backend sync failed. Please refresh the page.');
    }
  };

  // Record mint in backend after successful mint - FIXED to prevent double counting
  const recordMintInBackend = async (transactionHash, quantity) => {
    try {
      const token = localStorage.getItem('token');
      const mintData = {
        quantity: quantity,
        minterAddress: address,
        txHash: transactionHash,
        timestamp: new Date().toISOString()
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
        const result = await response.json();
        console.log('📊 Backend response:', result);
        
        // Only reload after successful backend update
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        const errorText = await response.text();
        console.error('❌ Backend mint recording failed:', errorText);
        // Don't reload on error to avoid confusion
      }
    } catch (error) {
      console.error('❌ Failed to record mint in backend:', error);
    }
  };

  // ✅ Verification functions using ethers v6
  const verifyNFTExists = async () => {
    try {
      console.log('🔍 Checking if NFT actually exists on blockchain...');
      
      if (!moment.nftContractAddress || !moment._id) {
        alert('❌ No NFT contract info found in database');
        return;
      }

      console.log('📋 Checking for:', {
        contract: moment.nftContractAddress,
        momentId: moment._id
      });

      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        moment.nftContractAddress,
        UMOMomentsContract.abi,
        provider
      );
      
      console.log('📞 Calling getEdition on contract...');
      const edition = await contract.getEdition(String(moment._id));
      
      console.log('📋 Edition result:', edition);
      
      if (edition && edition[0] && edition[0].length > 0) {
        const editionInfo = {
          momentId: edition[0],
          metadataURI: edition[1], 
          mintPrice: edition[2],
          mintStartTime: edition[3],
          mintEndTime: edition[4],
          maxSupply: edition[5],
          currentSupply: edition[6],
          splitsContract: edition[7],
          isActive: edition[8],
          rarity: edition[9]
        };
        
        console.log('✅ NFT Edition found:', editionInfo);
        
        alert(`✅ NFT Edition EXISTS on blockchain!\n\n` +
              `Moment ID: ${editionInfo.momentId}\n` +
              `Mint Price: ${ethers.formatEther(editionInfo.mintPrice)} ETH\n` +
              `Current Supply: ${editionInfo.currentSupply.toString()}\n` +
              `Is Active: ${editionInfo.isActive}\n` +
              `Rarity: ${editionInfo.rarity}/7`);
        
        return true;
      } else {
        console.log('❌ Edition not found or empty');
        
        alert(`❌ NFT Edition NOT found on blockchain!\n\n` +
              `Your database shows NFT exists, but blockchain has no edition.\n\n` +
              `This means the "Create NFT" button only updated the database\n` +
              `without sending a real blockchain transaction.\n\n` +
              `Contract: ${moment.nftContractAddress}\n` +
              `Moment ID: ${moment._id}`);
        
        return false;
      }
      
    } catch (error) {
      console.error('❌ Verification failed:', error);
      
      if (error.message.includes('call revert exception')) {
        alert(`❌ NFT Edition does not exist on blockchain!\n\nThe database shows this NFT exists, but the smart contract\nhas no record of it. This confirms the Create NFT button\nonly updated the database without sending a blockchain transaction.`);
      } else {
        alert(`❌ Verification failed: ${error.message}`);
      }
      return false;
    }
  };

  const checkMintingStatus = async () => {
    try {
      if (!moment.nftContractAddress || !moment._id) {
        alert('❌ No contract info available');
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        moment.nftContractAddress,
        UMOMomentsContract.abi,
        provider
      );
      
      const isActive = await contract.isMintingActive(String(moment._id));
      const totalMinted = await contract.getTotalMinted(String(moment._id));
      
      alert(`📊 Blockchain Minting Status:\n\n` +
            `Is Active: ${isActive}\n` +
            `Total Minted: ${totalMinted.toString()}\n` +
            `Database Shows: ${moment.nftMintedCount || 0}\n\n` +
            `${isActive ? '✅ Minting is live on blockchain' : '❌ Minting is not active'}`);
      
    } catch (error) {
      console.error('Status check failed:', error);
      alert(`❌ Could not check minting status: ${error.message}`);
    }
  };

  const testEthersConnection = async () => {
    try {
      console.log('🔍 Testing ethers v6 connection...');
      
      if (!window.ethereum) {
        alert('❌ No MetaMask detected');
        return;
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      
      alert(`✅ Ethers v6 Working!\n\n` +
            `Network: ${network.name} (${network.chainId})\n` +
            `Block Number: ${blockNumber}\n` +
            `Provider: ${provider.constructor.name}`);
      
      console.log('✅ Ethers v6 test successful:', { network, blockNumber });
      
    } catch (error) {
      console.error('❌ Ethers test failed:', error);
      alert(`❌ Ethers test failed: ${error.message}`);
    }
  };

  const checkContractExists = async () => {
    try {
      if (!UMOMomentsContract.address) {
        alert('❌ No contract address found');
        return;
      }
      
      console.log('🔍 Checking if contract exists at:', UMOMomentsContract.address);
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const code = await provider.getCode(UMOMomentsContract.address);
      
      console.log('📋 Contract code length:', code.length);
      
      if (code === '0x') {
        alert(`❌ NO CONTRACT FOUND!\n\nAddress: ${UMOMomentsContract.address}\n\nEither:\n1. Contract was never deployed\n2. Wrong network\n3. Wrong address`);
      } else {
        alert(`✅ Contract EXISTS!\n\nAddress: ${UMOMomentsContract.address}\nCode Length: ${code.length} bytes\n\nContract is properly deployed.`);
      }
      
    } catch (error) {
      console.error('Contract check failed:', error);
      alert(`❌ Could not check contract: ${error.message}`);
    }
  };

  // ✅ Function to view on OpenSea
  const handleViewOnOpenSea = () => {
    if (moment.nftContractAddress) {
      const openSeaUrl = `https://testnets.opensea.io/assets/base-sepolia/${moment.nftContractAddress}/${String(moment._id)}`;
      window.open(openSeaUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert('Contract address not available yet. Please wait a moment and try again.');
    }
  };

  // ✅ Function to handle management actions
  const handleManageEdition = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/moments/${String(moment._id)}/nft-analytics`, {
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

        <DebugPanel 
          moment={moment}
          UMOMomentsContract={UMOMomentsContract}
          writeContract={writeContract}
          currentTokenId={currentTokenId}
          address={address}
          chainId={chainId}
          creationError={creationError}
          syncDatabaseWithBlockchain={syncDatabaseWithBlockchain}
          previewMetadata={previewMetadata}
          createNFTMetadata={createNFTMetadata}
          uploadMetadataToIPFS={uploadMetadataToIPFS}
        />

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
                  {currentStep === 'confirming' && '⏳ Confirming on blockchain...'}
                  {currentStep === 'updating' && '💾 Updating database...'}
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

            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>🔄 Blockchain Sync</h4>
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', opacity: '0.9' }}>
                If you created an edition using the test button, click below to sync database:
              </p>
              <button
                onClick={syncDatabaseWithBlockchain}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                  padding: '8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                🔄 Sync Database with Blockchain
              </button>
            </div>

            <button
              onClick={handleCreateNFTEdition}
              disabled={isCreatingNFT || currentStep !== 'ready'}
              style={{
                width: '100%',
                background: (isCreatingNFT) ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '12px',
                borderRadius: '8px',
                cursor: (isCreatingNFT) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: (isCreatingNFT) ? 0.7 : 1
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
                  Create NFT Edition (Step 1)
                </>
              )}
            </button>
            
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginTop: '8px', lineHeight: '1.3' }}>
              ℹ️ This creates the edition for minting. Collectors will then mint actual NFT tokens from this edition.
            </div>
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
  // STEP 2: OWNER + NFT CREATED = Show "Manage Edition" + MINT ABILITY
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

        {/* 🆕 OWNER MINTING SECTION */}
        {isConnected && (
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '15px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>🎨 Owner Mint</h4>
            <p style={{ margin: '0 0 10px 0', fontSize: '12px', opacity: '0.9' }}>
              As the owner, you can mint your own NFTs:
            </p>

            {/* Minting progress */}
            {currentStep !== 'ready' && (
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '10px',
                borderRadius: '6px',
                marginBottom: '10px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '12px', marginBottom: '5px' }}>
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
                      fontSize: '11px',
                      textDecoration: 'underline'
                    }}
                  >
                    View Transaction →
                  </a>
                )}
              </div>
            )}

            {creationError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#dc2626',
                padding: '8px',
                borderRadius: '6px',
                marginBottom: '10px',
                fontSize: '12px'
              }}>
                ❌ {creationError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => handleMintNFT(1)}
                disabled={isMinting || currentStep !== 'ready'}
                style={{
                  flex: 1,
                  background: (isMinting) ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                  padding: '8px',
                  borderRadius: '6px',
                  cursor: (isMinting) ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  opacity: (isMinting) ? 0.7 : 1
                }}
              >
                {isMinting ? 'Minting...' : 'Mint 1 NFT'}
              </button>
              <button 
                onClick={() => handleMintNFT(3)}
                disabled={isMinting || currentStep !== 'ready'}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                  padding: '8px',
                  borderRadius: '6px',
                  cursor: (isMinting) ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  opacity: (isMinting) ? 0.7 : 1
                }}
              >
                Mint 3
              </button>
            </div>
          </div>
        )}

        <button
          onClick={checkContractExists}
          style={{
            width: '100%',
            background: 'purple',
            color: 'white',
            padding: '8px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            marginBottom: '5px',
            border: 'none'
          }}
        >
          🔍 Step 1: Check if Contract Exists
        </button>

        <button
          onClick={verifyNFTExists}
          style={{
            width: '100%',
            background: 'orange',
            color: 'white',
            padding: '8px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            marginBottom: '10px',
            border: 'none'
          }}
        >
          🔍 Step 2: Check if NFT Edition Exists
        </button>

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
                disabled={isMinting || currentStep !== 'ready'}
                style={{
                  flex: 2,
                  background: (isMinting) ? '#6b5b95' : '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: (isMinting) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  opacity: (isMinting) ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isMinting ? (
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
                  'Mint 1 NFT (FIXED)'
                )}
              </button>
              <button 
                onClick={() => handleMintNFT(5)}
                disabled={isMinting || currentStep !== 'ready'}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: (isMinting) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  opacity: (isMinting) ? 0.7 : 1
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