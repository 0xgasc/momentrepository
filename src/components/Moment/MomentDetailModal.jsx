// src/components/Moment/MomentDetailModal.jsx - PROPERLY FIXED HOOKS
import React, { useState, memo } from 'react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';
import { formatFileSize } from '../../utils';
//web3 components
import MomentMint from '../Web3/MomentMint';
import { WalletConnectCompact } from '../Web3/WalletConnect';

// ✅ FIXED: Import wagmi hooks at module level (not inside component)
import { useAccount, useChainId, useConfig } from 'wagmi';

// ✅ FIXED: Separate component for Web3 debug that properly uses hooks
const Web3DebugInfo = ({ moment, user }) => {
  // ✅ FIXED: Hooks called unconditionally at component level
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const config = useConfig();

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.9)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      maxWidth: '300px',
      zIndex: 100000,
      border: '1px solid #444'
    }}>
      <h4 style={{ margin: '0 0 10px 0', color: '#00ff00' }}>🐛 Web3 Debug Info</h4>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Wallet:</strong><br/>
        Connected: {isConnected ? '✅ YES' : '❌ NO'}<br/>
        Address: {address ? `${address.slice(0,6)}...${address.slice(-4)}` : 'None'}<br/>
        Connector: {connector?.name || 'None'}<br/>
        Chain ID: {chainId || 'None'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>User Auth:</strong><br/>
        Logged in: {user ? '✅ YES' : '❌ NO'}<br/>
        User ID: {user?.id || 'None'}<br/>
        Display: {user?.displayName || 'None'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Moment:</strong><br/>
        ID: {moment?._id?.slice(0, 8) || 'None'}...<br/>
        Uploader: {moment?.user?.displayName || 'None'}<br/>
        User ID: {moment?.user?._id?.slice(0, 8) || 'None'}...
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Environment:</strong><br/>
        Contract: {process.env.REACT_APP_UMO_MOMENTS_CONTRACT?.slice(0, 8) || 'None'}...<br/>
        WC Project: {process.env.REACT_APP_WALLETCONNECT_PROJECT_ID ? '✅ SET' : '❌ MISSING'}
      </div>
      
      <div>
        <strong>Ownership Check:</strong><br/>
        Is Owner: {user && moment?.user && (
          user.id === moment.user._id ||  
          user.id === moment.user.id ||   
          user._id === moment.user._id || 
          user.username === moment.user.username || 
          user.email === moment.user.email
        ) ? '✅ YES' : '❌ NO'}
      </div>
    </div>
  );
};

// ✅ FIXED: Error boundary component for Web3 debug
const Web3Debug = ({ moment, user }) => {
  try {
    return <Web3DebugInfo moment={moment} user={user} />;
  } catch (error) {
    return (
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: 'red',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        fontSize: '12px',
        zIndex: 100000
      }}>
        ❌ Web3 Error: {error.message}
      </div>
    );
  }
};

const MomentDetailModal = memo(({ moment, onClose }) => {
  const { user } = useAuth();
  
  // ✅ FIXED: Better ownership check with multiple fallbacks
  const isOwner = user && moment.user && (
    user.id === moment.user._id ||  // Standard ObjectId comparison
    user.id === moment.user.id ||   // Alternative ID format
    user._id === moment.user._id || // Alternative user format
    user.username === moment.user.username || // Username fallback
    user.email === moment.user.email // Email fallback
  );
  
  // ✅ FIXED: Add debugging
  console.log('🔍 Ownership Debug:', {
    userLoggedIn: !!user,
    userInfo: user ? {
      id: user.id,
      _id: user._id,
      username: user.username,
      email: user.email,
      displayName: user.displayName
    } : null,
    momentUser: moment.user ? {
      _id: moment.user._id,
      id: moment.user.id,
      username: moment.user.username,
      email: moment.user.email,
      displayName: moment.user.displayName
    } : null,
    isOwner: isOwner
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [showFileDetails, setShowFileDetails] = useState(false);
  const [showEmptyFields, setShowEmptyFields] = useState(false);
  const [editedData, setEditedData] = useState({
    setName: moment.setName || '',
    momentDescription: moment.momentDescription || '',
    emotionalTags: moment.emotionalTags || '',
    momentType: moment.momentType || 'performance',
    specialOccasion: moment.specialOccasion || '',
    instruments: moment.instruments || '',
    audioQuality: moment.audioQuality || 'good',
    videoQuality: moment.videoQuality || 'good',
    crowdReaction: moment.crowdReaction || '',
    guestAppearances: moment.guestAppearances || '',
    personalNote: moment.personalNote || '',
    uniqueElements: moment.uniqueElements || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleDownload = () => {
    try {
      window.open(moment.mediaUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to open file. Please try again.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Please log in again to save changes');
      }

      const response = await fetch(`${API_BASE_URL}/moments/${moment._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editedData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save changes');
      }

      setIsEditing(false);
      window.location.reload();
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Get rarity display info
  const getRarityInfo = () => {
    const tierInfo = {
      legendary: { emoji: '🌟', color: '#FFD700', bgColor: '#FFF8DC', name: 'Legendary' },
      epic: { emoji: '💎', color: '#9B59B6', bgColor: '#F4F1FF', name: 'Epic' },
      rare: { emoji: '🔥', color: '#E74C3C', bgColor: '#FFEBEE', name: 'Rare' },
      uncommon: { emoji: '⭐', color: '#3498DB', bgColor: '#E3F2FD', name: 'Uncommon' },
      common: { emoji: '📀', color: '#95A5A6', bgColor: '#F5F5F5', name: 'Common' }
    };
    
    const tier = moment.rarityTier || 'common';
    const score = moment.rarityScore || 0;
    const percentage = Math.round((score / 7) * 100);
    
    return {
      ...tierInfo[tier],
      score,
      percentage,
      tier
    };
  };

  const rarityInfo = getRarityInfo();

  const getMediaComponent = () => {
    const isVideo = moment.mediaType === 'video' || 
                   moment.fileName?.toLowerCase().includes('.mov') ||
                   moment.fileName?.toLowerCase().includes('.mp4') ||
                   moment.fileName?.toLowerCase().includes('.webm');
    
    const isImage = moment.mediaType === 'image' || 
                   moment.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);

    if (isVideo) {
      return (
        <div className="media-container">
          {!videoLoaded && !mediaError && (
            <div className="media-loading">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading video...</p>
            </div>
          )}
          <video
            src={moment.mediaUrl}
            controls
            preload="metadata"
            className={`media-element ${videoLoaded ? 'loaded' : 'loading'}`}
            onLoadedData={() => {
              setVideoLoaded(true);
              setMediaError(false);
            }}
            onError={() => {
              setMediaError(true);
              setVideoLoaded(false);
            }}
            style={{
              width: '100%',
              maxHeight: '300px',
              borderRadius: '8px',
              backgroundColor: '#000',
              objectFit: 'contain'
            }}
            playsInline
            controlsList="nodownload nofullscreen"
            disablePictureInPicture
          >
            Your browser does not support the video tag.
          </video>
          {mediaError && (
            <div className="media-error">
              <p className="text-sm text-red-600 mb-2">Unable to load video preview</p>
              <button
                onClick={handleDownload}
                className="text-blue-600 hover:text-blue-800 underline text-sm"
              >
                Click here to download and view externally
              </button>
            </div>
          )}
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="media-container">
          {!imageLoaded && !mediaError && (
            <div className="media-loading">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading image...</p>
            </div>
          )}
          <img
            src={moment.mediaUrl}
            alt={moment.fileName || 'Moment media'}
            className={`media-element ${imageLoaded ? 'loaded' : 'loading'}`}
            onLoad={() => {
              setImageLoaded(true);
              setMediaError(false);
            }}
            onError={() => {
              setMediaError(true);
              setImageLoaded(false);
            }}
            style={{
              width: '100%',
              maxHeight: '300px',
              objectFit: 'contain',
              borderRadius: '8px'
            }}
          />
          {mediaError && (
            <div className="media-error">
              <p className="text-sm text-red-600 mb-2">Unable to load image preview</p>
              <button
                onClick={handleDownload}
                className="text-blue-600 hover:text-blue-800 underline text-sm"
              >
                Click here to download and view externally
              </button>
            </div>
          )}
        </div>
      );
    }

    // Audio or unknown file type
    return (
      <div className="media-container audio-placeholder">
        <div className="text-center py-8">
          <div className="text-4xl mb-2">🎵</div>
          <p className="text-gray-600 mb-4">{moment.fileName}</p>
          <p className="text-sm text-gray-500 mb-4">
            {moment.fileSize ? formatFileSize(moment.fileSize) : 'Unknown size'} • {moment.mediaType || 'Audio'}
          </p>
          <button
            onClick={handleDownload}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Click here to download and play
          </button>
        </div>
      </div>
    );
  };

  const headerStyle = {
    background: `linear-gradient(135deg, ${rarityInfo.color} 0%, #1d4ed8 100%)`
  };

  const rarityBadgeStyle = {
    backgroundColor: rarityInfo.bgColor,
    color: rarityInfo.color
  };

  const progressFillStyle = {
    width: `${rarityInfo.percentage}%`,
    backgroundColor: rarityInfo.color
  };

  return (
    <>
      {/* ✅ FIXED: Debug overlay with proper hook usage */}
      <Web3Debug moment={moment} user={user} />
      
      <div className="modal-overlay" onClick={onClose}>
        <div className="trading-card-modal" onClick={(e) => e.stopPropagation()}>
          {/* Card Header with Rarity */}
          <div className="card-header" style={headerStyle}>
            <div className="card-title-section">
              <div className="rarity-badge" style={rarityBadgeStyle}>
                <span className="rarity-emoji">{rarityInfo.emoji}</span>
                <span className="rarity-text">{rarityInfo.name}</span>
                <span className="rarity-score">{rarityInfo.score}/7</span>
              </div>
              <h2 className="card-title">{moment.songName}</h2>
              <p className="card-subtitle">
                {moment.venueName} • {moment.venueCity}
                {moment.venueCountry && `, ${moment.venueCountry}`}
              </p>
              <p className="card-date">{moment.performanceDate}</p>
            </div>
            
            <div className="card-controls">
              {isOwner && (
                <button
                  onClick={() => {
                    setIsEditing(!isEditing);
                    setError('');
                  }}
                  className={`edit-button ${isEditing ? 'editing' : ''}`}
                >
                  {isEditing ? '✕' : '✏️'}
                </button>
              )}
              <button onClick={onClose} className="close-button">✕</button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Basic Debug section */}
          <div style={{background: 'blue', color: 'white', padding: '10px', fontSize: '12px'}}>
            <strong>BASIC DEBUG:</strong><br/>
            User: {user?.displayName || 'Not logged in'}<br/>
            Moment uploader: {moment.user?.displayName || 'Unknown'}<br/>
            Is Owner: {isOwner ? 'YES' : 'NO'}<br/>
            User ID: {user?.id}<br/>
            Moment User ID: {moment.user?._id}
          </div>

          {/* Rarity Details */}
          <div className="rarity-section">
            <div className="rarity-details">
              <div className="rarity-item">
                <span className="rarity-label">Song Performances:</span>
                <span className="rarity-value">{moment.songTotalPerformances || 0} times live</span>
              </div>
              {moment.isFirstMomentForSong && (
                <div className="rarity-item">
                  <span className="rarity-label">🏆 First Moment:</span>
                  <span className="rarity-value">First uploaded for this song!</span>
                </div>
              )}
              <div className="rarity-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={progressFillStyle}></div>
                </div>
                <span className="progress-text">{rarityInfo.percentage}% rarity</span>
              </div>
            </div>
          </div>

          {/* Media Display */}
          <div className="card-media">
            {getMediaComponent()}
          </div>

          {/* ✅ FIXED: NFT Section - Now properly placed and visible */}
          {user && (
            <div style={{ 
              padding: '20px', 
              background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
              borderTop: '2px solid #d1d5db',
              borderBottom: '2px solid #d1d5db'
            }}>
              <div style={{ marginBottom: '15px' }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  color: '#1f2937', 
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <span style={{ marginRight: '8px' }}>🎯</span>
                  NFT Minting
                  {isOwner && (
                    <span style={{
                      marginLeft: '10px',
                      fontSize: '12px',
                      background: '#10b981',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      You uploaded this
                    </span>
                  )}
                </h3>
                <p style={{ 
                  fontSize: '14px', 
                  color: '#6b7280',
                  margin: '0'
                }}>
                  {isOwner 
                    ? 'Create an NFT edition of your moment and earn 35% of mint revenue'
                    : 'Mint this moment as an NFT to support the uploader and artist'
                  }
                </p>
              </div>
              
              {/* ✅ FIXED: MomentMint component with proper props */}
              <div style={{ background: 'yellow', padding: '10px', marginBottom: '10px' }}>
                <strong>BEFORE MOMENTMINT COMPONENT</strong>
              </div>
              
              <MomentMint 
                moment={moment} 
                user={user} 
                isExpanded={true}
              />
              
              <div style={{ background: 'green', padding: '10px', marginTop: '10px', color: 'white' }}>
                <strong>AFTER MOMENTMINT COMPONENT</strong>
              </div>
            </div>
          )}

          {/* ✅ FIXED: Show wallet connect for non-logged in users */}
          {!user && (
            <div style={{ 
              padding: '20px', 
              background: '#f9fafb',
              borderTop: '1px solid #e5e7eb',
              textAlign: 'center'
            }}>
              <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#374151' }}>
                🎯 NFT Minting Available
              </h3>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '15px' }}>
                Login to create NFT editions or mint moments as collectibles
              </p>
              <div style={{ display: 'inline-block' }}>
                <WalletConnectCompact />
              </div>
            </div>
          )}

          {/* Simplified content for debugging */}
          <div className="card-content">
            <p style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              📋 Modal content truncated for debugging - NFT section above should be visible
            </p>
          </div>

          <div className="card-footer">
            <div className="uploader-info">
              <span className="uploader-text">
                Captured by {moment.user?.displayName || 'Anonymous'}
              </span>
            </div>
            
            <div className="download-section">
              <button
                onClick={handleDownload}
                className="download-link"
              >
                Click here to download
              </button>
            </div>
          </div>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.8);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
          }

          .trading-card-modal {
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
            border: 2px solid #e2e8f0;
            max-width: 500px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            position: relative;
          }

          .card-header {
            color: white;
            padding: 1.5rem;
            border-radius: 14px 14px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }

          .card-title-section {
            flex: 1;
          }

          .rarity-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-bottom: 0.75rem;
            border: 1px solid rgba(255,255,255,0.3);
          }

          .card-title {
            font-size: 1.5rem;
            font-weight: bold;
            margin: 0 0 0.5rem 0;
            line-height: 1.2;
          }

          .card-subtitle {
            font-size: 0.9rem;
            opacity: 0.9;
            margin: 0 0 0.25rem 0;
          }

          .card-date {
            font-size: 0.8rem;
            opacity: 0.8;
            margin: 0;
          }

          .card-controls {
            display: flex;
            gap: 0.5rem;
            margin-left: 1rem;
          }

          .edit-button, .close-button {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.9rem;
            transition: all 0.2s ease;
          }

          .edit-button:hover, .close-button:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: scale(1.05);
          }

          .error-message {
            background-color: #fee2e2;
            color: #dc2626;
            padding: 1rem;
            margin: 0;
            border-bottom: 1px solid #fecaca;
          }

          .rarity-section {
            padding: 1rem 1.5rem;
            background: linear-gradient(90deg, #f8f9fa 0%, #ffffff 100%);
            border-bottom: 1px solid #e2e8f0;
          }

          .rarity-details {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }

          .rarity-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .rarity-label {
            font-weight: 600;
            color: #4b5563;
            font-size: 0.8rem;
          }

          .rarity-value {
            color: #1f2937;
            font-size: 0.8rem;
            font-weight: 500;
          }

          .rarity-progress {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }

          .progress-bar {
            flex: 1;
            height: 8px;
            background: #e5e7eb;
            border-radius: 4px;
            overflow: hidden;
          }

          .progress-fill {
            height: 100%;
            transition: width 0.3s ease;
            border-radius: 4px;
          }

          .progress-text {
            font-size: 0.75rem;
            color: #6b7280;
            font-weight: 600;
            min-width: 60px;
            text-align: right;
          }

          .card-media {
            padding: 1rem;
            background: #f8f9fa;
            border-bottom: 1px solid #e2e8f0;
          }

          .media-container {
            position: relative;
          }

          .card-content {
            padding: 1.5rem;
          }

          .card-footer {
            border-top: 1px solid #e2e8f0;
            padding: 1rem 1.5rem;
            background: #f8f9fa;
            border-radius: 0 0 14px 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
          }

          .uploader-info {
            flex: 1;
          }

          .uploader-text {
            color: #6b7280;
            font-size: 0.8rem;
          }

          .download-section {
            flex: 1;
            text-align: right;
          }

          .download-link {
            background: none;
            border: none;
            color: #3b82f6;
            text-decoration: underline;
            cursor: pointer;
            font-size: 0.85rem;
            padding: 0;
          }

          .download-link:hover {
            color: #1d4ed8;
          }
        `}</style>
      </div>
    </>
  );
});

MomentDetailModal.displayName = 'MomentDetailModal';

export default MomentDetailModal;