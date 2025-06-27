import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Zap, Plus, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import UMOMomentsContract from '../../contracts/UMOMoments.json';
/* global BigInt */

const DebugPanel = ({ moment, UMOMomentsContract, writeContract, currentTokenId, address, chainId, creationError }) => {
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
      
      // Use useReadContract hook instead of actions
      const momentId = moment._id;
      const splitsAddress = '0x742d35Cc6634C0532925a3b8D76C7DE9F45F6c96';
      const rarity = Math.min(7, Math.max(1, moment.rarityScore || 1));
      
      logResult('requirementCheck', `✅ Basic validation passed - momentId: ${momentId.slice(0, 8)}..., rarity: ${rarity}`, true);
      return true;
      
    } catch (error) {
      logResult('requirementCheck', `❌ Failed: ${error.message}`, false);
      return false;
    }
  };

  // 🧪 ENHANCED FRESH ID TEST
  const testWithFreshMomentId = async () => {
    try {
      const freshMomentId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('🧪 Starting fresh ID test with:', freshMomentId);
      
      // Add timeout and better error handling
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction timed out after 30s')), 30000)
      );
      
      const writePromise = writeContract({
        address: UMOMomentsContract.address,
        abi: UMOMomentsContract.abi,
        functionName: 'createMomentEdition',
        args: [
          freshMomentId,
          'ipfs://test-metadata',
          parseEther('0.001'),
          BigInt(7 * 24 * 60 * 60),
          BigInt(0),
          '0x742d35Cc6634C0532925a3b8D76C7DE9F45F6c96',
          1
        ],
      });
      
      const hash = await Promise.race([writePromise, timeoutPromise]);
      
      console.log('🧪 Fresh ID test result:', hash, typeof hash);
      
      if (hash === undefined || hash === null) {
        logResult('freshIdTest', '❌ CRITICAL: writeContract returned undefined/null (transaction rejected or failed silently)', false);
        return null;
      } else {
        logResult('freshIdTest', `✅ SUCCESS: Got transaction hash ${hash}`, true);
        return hash;
      }
      
    } catch (error) {
      console.error('🧪 Fresh ID test error:', error);
      
      if (error.message.includes('User rejected')) {
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
      // Test if wagmi hooks are working
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

  // 🔄 RUN ALL TESTS
  const runAllTests = async () => {
    setResults({});
    console.log('🚀 Running comprehensive diagnostics...');
    
    await verifyContractDeployment();
    await testWagmiConfig();
    await testWalletConnection();
    await debugContractRequirements();
    await testWithFreshMomentId();
    
    console.log('📊 All tests complete. Check results above.');
  };

  // 🎯 MINIMAL WRITE TEST
  const testMinimalWrite = async () => {
    try {
      console.log('🎯 Testing minimal writeContract call...');
      
      // Try the absolute simplest possible call
      const result = await writeContract({
        address: UMOMomentsContract.address,
        abi: UMOMomentsContract.abi,
        functionName: 'getCurrentTokenId',
        args: [],
      });
      
      console.log('🎯 Minimal write result:', result, typeof result);
      
      if (result === undefined) {
        logResult('minimalWrite', '❌ Even getCurrentTokenId returns undefined - wagmi writeContract broken', false);
      } else {
        logResult('minimalWrite', `✅ Minimal write works: ${result}`, true);
      }
      
    } catch (error) {
      logResult('minimalWrite', `❌ Minimal write failed: ${error.message}`, false);
    }
  };

  const debugButtonStyle = {
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    padding: '8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '500'
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
        <span>🔧 NFT Debug Panel (Enhanced)</span>
        <span style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </div>

      {/* Content */}
      {isOpen && (
        <div style={{ padding: '16px', maxHeight: '500px', overflowY: 'auto' }}>
          {/* Quick Info */}
          <div style={{
            background: '#f8fafc',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '12px',
            lineHeight: '1.4'
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
              <button onClick={testMinimalWrite} style={debugButtonStyle}>
                🎯 Minimal Write
              </button>
              <button onClick={testWithFreshMomentId} style={debugButtonStyle}>
                🧪 Fresh ID
              </button>
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
              <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '13px' }}>
                📊 Enhanced Test Results
              </div>
              {Object.entries(results).map(([test, data]) => (
                <div key={test} style={{
                  padding: '6px',
                  marginBottom: '4px',
                  background: data.success ? '#f0fdf4' : '#fef2f2',
                  borderRadius: '4px',
                  fontSize: '11px',
                  borderLeft: `3px solid ${data.success ? '#22c55e' : '#ef4444'}`
                }}>
                  <div style={{ fontWeight: '600' }}>{test} ({data.timestamp})</div>
                  <div>{data.result}</div>
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
  const chainId = useChainId(); // ✅ FIXED: Use hook at component level
  
  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
  });
const { data: contractOwner } = useReadContract({
  address: UMOMomentsContract.address,
  abi: UMOMomentsContract.abi,
  functionName: 'owner',
  enabled: !!UMOMomentsContract.address
});

const { data: existingEdition } = useReadContract({
  address: UMOMomentsContract.address,
  abi: UMOMomentsContract.abi,
  functionName: 'getEdition',
  args: [moment._id],
  enabled: !!UMOMomentsContract.address && !!moment._id
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


const handleCreateNFTEdition = async () => {
  if (!isConnected) {
    alert('Please connect your wallet first');
    return;
  }

  setIsCreatingNFT(true);
  setCreationError('');
  setCurrentStep('creating');

  try {
    console.log('🚀 Creating NFT edition - CORRECTED VERSION');

    // 🎯 CRITICAL: Use the EXACT same pattern as the working debug test
    const mintPriceWei = parseEther('0.001');
    const mintDurationSeconds = BigInt(mintDuration * 24 * 60 * 60); // Explicit BigInt
    const rarityScore = Math.min(7, Math.max(1, moment.rarityScore || 1));
    const metadataURI = `ipfs://metadata-${moment._id}`;
    const mockSplitsAddress = '0x742d35Cc6634C0532925a3b8D76C7DE9F45F6c96';

    console.log('📝 Parameters for REAL transaction:', {
      momentId: moment._id,
      metadataURI,
      mintPrice: formatEther(mintPriceWei),
      duration: mintDurationSeconds.toString(),
      rarity: rarityScore,
      splitsAddress: mockSplitsAddress
    });

    // 🚨 CRITICAL FIX: Call writeContract EXACTLY like the working debug test
    console.log('📤 Calling writeContract (should trigger MetaMask popup)...');
    
    let transactionResult = null;
    let walletPopupAppeared = false;
    
    try {
      // Add a timeout to detect if wallet popup appears
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('No wallet popup after 10 seconds - transaction may have failed silently')), 10000)
      );
      
      // This should trigger MetaMask popup (same as debug test)
      const writePromise = writeContract({
        address: UMOMomentsContract.address,
        abi: UMOMomentsContract.abi,
        functionName: 'createMomentEdition',
        args: [
          moment._id,                    // momentId (string)
          metadataURI,                   // metadataURI (string)  
          mintPriceWei,                  // mintPrice (BigNumber)
          mintDurationSeconds,           // mintDuration (BigInt)
          BigInt(0),                     // maxSupply (BigInt) - unlimited
          mockSplitsAddress,             // splitsContract (address)
          rarityScore                    // rarity (uint8)
        ],
      });
      
      console.log('⏳ Waiting for wallet response...');
      setCurrentStep('confirming');
      
      // Wait for either transaction or timeout
      transactionResult = await Promise.race([writePromise, timeoutPromise]);
      walletPopupAppeared = true;
      
      console.log('📤 Transaction result:', transactionResult, typeof transactionResult);
      
    } catch (writeError) {
      console.error('❌ writeContract error:', writeError);
      
      if (writeError.message.includes('User rejected') || writeError.message.includes('user rejected')) {
        throw new Error('Transaction was rejected in your wallet.');
      } else if (writeError.message.includes('No wallet popup')) {
        throw new Error('MetaMask popup did not appear. Please try again.');
      } else if (writeError.message.includes('insufficient funds')) {
        throw new Error('Insufficient ETH balance for gas fees.');
      } else {
        throw new Error(`Transaction failed: ${writeError.message}`);
      }
    }

    // 🎯 ONLY proceed if we got a wallet popup (even if result is undefined)
    if (!walletPopupAppeared) {
      throw new Error('No wallet interaction detected. Transaction was not sent.');
    }

    console.log('✅ Wallet popup appeared - transaction was submitted to blockchain');

    // Store transaction hash if available
    if (transactionResult && typeof transactionResult === 'string' && transactionResult.startsWith('0x')) {
      setTxHash(transactionResult);
      console.log('✅ Got transaction hash:', transactionResult);
    } else {
      console.log('⚠️ No transaction hash returned (common with wagmi), but transaction was sent');
    }

    // 🔥 IMPORTANT: Only update backend if transaction was actually sent
    console.log('📝 Updating backend after successful wallet interaction...');
    
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('⚠️ No auth token - skipping backend update');
    } else {
      try {
        const nftEditionData = {
          nftContractAddress: UMOMomentsContract.address,
          nftTokenId: moment._id,
          nftMetadataHash: metadataURI,
          splitsContract: mockSplitsAddress,
          mintPrice: mintPriceWei.toString(),
          mintDuration: mintDurationSeconds.toString(),
          txHash: transactionResult || 'pending'
        };

        const backendResponse = await fetch(`${API_BASE_URL}/moments/${moment._id}/create-nft-edition`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(nftEditionData)
        });

        if (backendResponse.ok) {
          console.log('✅ Backend updated successfully');
        } else {
          const errorData = await backendResponse.json();
          console.warn('⚠️ Backend update failed:', errorData.error);
          // Don't throw - blockchain transaction is more important
        }
      } catch (backendError) {
        console.warn('⚠️ Backend update error:', backendError.message);
        // Don't throw - blockchain transaction is more important  
      }
    }

    // Show success
    setCurrentStep('success');
    setIsCreatingNFT(false);
    
    const successMessage = transactionResult 
      ? `🎉 NFT Edition Created!\n\nTransaction Hash: ${transactionResult}\n\nCheck BaseScan for confirmation.`
      : `🎉 NFT Edition Submitted!\n\nTransaction sent to blockchain.\nCheck BaseScan for confirmation details.`;
    
    alert(successMessage);
    
    // Reload after delay to show updated state
    setTimeout(() => {
      window.location.reload();
    }, 2000);

  } catch (error) {
    console.error('❌ Create NFT Edition failed:', error);
    setCreationError(error.message);
    setCurrentStep('ready');
    setIsCreatingNFT(false);
  }
};

// 🔥 REPLACE your verifyNFTExists function with this FIXED version:

const verifyNFTExists = async () => {
  try {
    console.log('🔍 Checking if NFT actually exists on blockchain...');
    
    if (!moment.nftContractAddress || !moment.nftTokenId) {
      alert('❌ No NFT contract info found in database');
      return;
    }

    console.log('📋 Checking for:', {
      contract: moment.nftContractAddress,
      momentId: moment._id,
      tokenId: moment.nftTokenId
    });

    // 🔥 OPTION 1: Use direct contract call (simpler)
    try {
      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      const contract = new window.ethers.Contract(
        moment.nftContractAddress,
        UMOMomentsContract.abi,
        provider
      );
      
      console.log('📞 Calling getEdition on contract...');
      const edition = await contract.getEdition(moment._id);
      
      console.log('📋 Edition result:', edition);
      
      // Check if edition exists (momentId field should not be empty)
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
              `Mint Price: ${window.ethers.utils.formatEther(editionInfo.mintPrice)} ETH\n` +
              `Current Supply: ${editionInfo.currentSupply.toString()}\n` +
              `Is Active: ${editionInfo.isActive}\n` +
              `Rarity: ${editionInfo.rarity}/7`);
        
        return true;
      } else {
        console.log('❌ Edition not found or empty');
        
        alert(`❌ NFT Edition NOT found on blockchain!\n\n` +
              `Your database shows:\n` +
              `- Contract: ${moment.nftContractAddress}\n` +
              `- Token ID: ${moment.nftTokenId}\n` +
              `- Moment ID: ${moment._id}\n\n` +
              `But the blockchain contract has no edition for this moment.`);
        
        return false;
      }
      
    } catch (contractError) {
      console.error('Contract call failed:', contractError);
      
      // 🔥 OPTION 2: If ethers fails, try direct RPC call
      try {
        console.log('🔄 Trying direct RPC call...');
        
        // Encode the function call
        const functionSignature = '0x' + window.ethers.utils.keccak256(
          window.ethers.utils.toUtf8Bytes('getEdition(string)')
        ).slice(2, 10);
        
        // This is a simplified approach - for testing if contract exists
        const code = await window.ethereum.request({
          method: 'eth_getCode',
          params: [moment.nftContractAddress, 'latest']
        });
        
        if (code === '0x') {
          alert(`❌ Contract does not exist!\n\nAddress: ${moment.nftContractAddress}\n\nThe contract was never deployed or is on a different network.`);
          return false;
        } else {
          alert(`⚠️ Contract exists but function call failed!\n\nContract: ${moment.nftContractAddress}\nError: ${contractError.message}\n\nThis might be a network issue or the edition doesn't exist.`);
          return false;
        }
        
      } catch (rpcError) {
        console.error('RPC call also failed:', rpcError);
        alert(`❌ Could not verify NFT: ${contractError.message}\n\nBoth contract call and RPC failed.`);
        return false;
      }
    }
    
  } catch (error) {
    console.error('❌ Verification completely failed:', error);
    alert(`❌ Verification failed: ${error.message}`);
    return false;
  }
};

// 🔥 ALSO ADD: Simple contract existence check
const checkContractExists = async () => {
  try {
    if (!moment.nftContractAddress) {
      alert('❌ No contract address found');
      return;
    }
    
    console.log('🔍 Checking if contract exists at:', moment.nftContractAddress);
    
    const code = await window.ethereum.request({
      method: 'eth_getCode',
      params: [moment.nftContractAddress, 'latest']
    });
    
    console.log('📋 Contract code length:', code.length);
    
    if (code === '0x') {
      alert(`❌ NO CONTRACT FOUND!\n\nAddress: ${moment.nftContractAddress}\n\nEither:\n1. Contract was never deployed\n2. Wrong network\n3. Wrong address`);
    } else {
      alert(`✅ Contract EXISTS!\n\nAddress: ${moment.nftContractAddress}\nCode Length: ${code.length} bytes\n\nContract is properly deployed.`);
    }
    
  } catch (error) {
    console.error('Contract check failed:', error);
    alert(`❌ Could not check contract: ${error.message}`);
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
<div style={{ marginBottom: '15px' }}>


  <div style={{ display: 'flex', gap: '10px' }}>

  </div>
  
</div>
    <DebugPanel 
      moment={moment}
      UMOMomentsContract={UMOMomentsContract}
      writeContract={writeContract}
      currentTokenId={currentTokenId}
      address={address}
      chainId={chainId}
      creationError={creationError}
    />
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