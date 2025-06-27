// src/components/Web3/MomentMint.js - PROPER VERSION WITH OWNERSHIP
import React, { useState } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { Wallet, Zap, AlertCircle, Plus, ExternalLink } from 'lucide-react';
import WalletConnect from './WalletConnect';

const MomentMint = ({ moment, user, isExpanded = false }) => {
  const [showNFTCreator, setShowNFTCreator] = useState(false);
  
  const { address, isConnected } = useAccount();
  
  // ✅ FIXED: Proper ownership check
  const isOwner = user && moment.user && (
    user.id === moment.user._id ||  
    user.id === moment.user.id ||   
    user._id === moment.user._id || 
    user.username === moment.user.username || 
    user.email === moment.user.email
  );
  
  console.log('🎯 MomentMint rendering:', {
    userLoggedIn: !!user,
    isConnected,
    isOwner,
    currentUser: user?.displayName,
    momentUploader: moment?.user?.displayName,
    userIds: {
      currentUserId: user?.id,
      momentUserId: moment?.user?._id
    }
  });

  // Check if NFT edition exists (simplified for now)
  const [hasNFTEdition, setHasNFTEdition] = useState(false);

  // ✅ FOR OWNERS: Show NFT creation options
  if (isOwner) {
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
            <Wallet style={{ width: '48px', height: '48px', margin: '0 auto 15px', opacity: '0.7' }} />
            <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}>
              Connect your wallet to create NFT editions
            </p>
            <WalletConnect />
          </div>
        ) : !hasNFTEdition ? (
          <div>
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
              <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                <div>💵 Price: ~$1 USD (in ETH)</div>
                <div>⏰ Duration: 7 days</div>
                <div>📊 Supply: Unlimited</div>
                <div>🎯 Rarity: {moment.rarityScore || 0}/7</div>
              </div>
            </div>

            <button
              onClick={() => setShowNFTCreator(true)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Zap style={{ width: '16px', height: '16px', marginRight: '8px' }} />
              Create NFT Edition
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', margin: '0 0 15px 0' }}>✅</div>
            <p style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: '600' }}>
              NFT Edition Created!
            </p>
            <p style={{ margin: '0', fontSize: '14px', opacity: '0.9' }}>
              Your moment is now available for minting
            </p>
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
          🔧 <strong>Owner Debug:</strong> Wallet {isConnected ? '✅' : '❌'} | Edition {hasNFTEdition ? '✅' : '❌'}
        </div>
      </div>
    );
  }

  // ✅ FOR NON-OWNERS: Show minting options
  if (user && !isOwner) {
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
            Mint as NFT
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
            <Wallet style={{ width: '48px', height: '48px', margin: '0 auto 15px', opacity: '0.7' }} />
            <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}>
              Connect your wallet to mint NFTs
            </p>
            <WalletConnect />
          </div>
        ) : !hasNFTEdition ? (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '8px'
          }}>
            <AlertCircle style={{ width: '48px', height: '48px', margin: '0 auto 15px', opacity: '0.7' }} />
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600' }}>
              NFT Not Available Yet
            </p>
            <p style={{ margin: '0', fontSize: '13px', opacity: '0.8' }}>
              The uploader hasn't created an NFT edition for this moment
            </p>
          </div>
        ) : (
          <div>
            {/* Minting interface would go here */}
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '15px',
              textAlign: 'center'
            }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>💎 Available for Minting</p>
              <div style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
                ~$1 USD
              </div>
              <button style={{
                background: '#8b5cf6',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Mint NFT
              </button>
            </div>
          </div>
        )}

        {/* Debug info for non-owners */}
        <div style={{
          marginTop: '15px',
          padding: '10px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '6px',
          fontSize: '12px'
        }}>
          🔧 <strong>Collector Debug:</strong> Not owner | Wallet {isConnected ? '✅' : '❌'}
        </div>
      </div>
    );
  }

  // ✅ FOR NON-LOGGED IN USERS: Show login prompt
  return (
    <div style={{
      background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
      color: 'white',
      padding: '20px',
      borderRadius: '12px',
      textAlign: 'center'
    }}>
      <Wallet style={{ width: '48px', height: '48px', margin: '0 auto 15px', opacity: '0.7' }} />
      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>
        🎯 NFT Features Available
      </h3>
      <p style={{ margin: '0 0 15px 0', fontSize: '14px', opacity: '0.9' }}>
        Login to create NFT editions or mint moments as collectibles
      </p>
      
      <button
        onClick={() => window.alert('Please use the login button in the header')}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        Login Required
      </button>

      {/* Debug info for non-logged users */}
      <div style={{
        marginTop: '15px',
        padding: '10px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '6px',
        fontSize: '12px'
      }}>
        🔧 <strong>Guest Debug:</strong> No user logged in
      </div>
    </div>
  );
};

export default MomentMint;