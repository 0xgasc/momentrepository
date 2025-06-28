// src/components/Moment/MomentDetailModal.jsx - FIXED with metadata panel and smaller messages
import React, { useState, useEffect, memo } from 'react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';
import { formatFileSize } from '../../utils';
//web3 components
import MomentMint from '../Web3/MomentMint';

const MomentDetailModal = memo(({ moment, onClose }) => {
  const { user } = useAuth();
  
  // ✅ FIXED: Simplified and more reliable ownership check
  const isOwner = React.useMemo(() => {
    if (!user || !moment?.user) {
      console.log('🔍 Ownership: No user or moment.user');
      return false;
    }

    // Primary check: Compare user IDs directly
    const userLoggedInId = user.id || user._id;
    const momentUploaderId = moment.user._id || moment.user.id;
    
    const isOwnerResult = userLoggedInId === momentUploaderId;
    
    console.log('🔍 FIXED Ownership Check:', {
      userLoggedInId,
      momentUploaderId,
      isOwnerResult,
      userDisplayName: user.displayName,
      momentUploaderName: moment.user.displayName
    });
    
    return isOwnerResult;
  }, [user, moment]);

  // ✅ NEW: Fetch NFT status from API instead of calculating from moment data
  const [nftStatus, setNftStatus] = useState(null);
  const [fetchingNftStatus, setFetchingNftStatus] = useState(true);
  
  // ✅ FIXED: Use API endpoint to get correct NFT status
  useEffect(() => {
    const fetchNftStatus = async () => {
      if (!moment?._id) return;
      
      try {
        setFetchingNftStatus(true);
        console.log(`🔍 Fetching NFT status for moment ${moment._id}...`);
        
        const response = await fetch(`${API_BASE_URL}/moments/${moment._id}/nft-status`);
        
        if (response.ok) {
          const status = await response.json();
          console.log('✅ NFT Status fetched:', status);
          setNftStatus(status);
        } else {
          console.error('❌ Failed to fetch NFT status:', response.status);
          // Fallback to moment data with correct token ID check
          const fallbackStatus = {
            hasNFTEdition: !!(moment.nftContractAddress && moment.nftTokenId !== undefined),
            isMintingActive: false,
            nftData: moment.nftContractAddress ? {
              contractAddress: moment.nftContractAddress,
              tokenId: moment.nftTokenId,
              mintedCount: moment.nftMintedCount || 0
            } : null
          };
          setNftStatus(fallbackStatus);
        }
      } catch (error) {
        console.error('❌ Error fetching NFT status:', error);
        // Fallback to moment data with correct token ID check
        const fallbackStatus = {
          hasNFTEdition: !!(moment.nftContractAddress && moment.nftTokenId !== undefined),
          isMintingActive: false,
          nftData: null
        };
        setNftStatus(fallbackStatus);
      } finally {
        setFetchingNftStatus(false);
      }
    };

    fetchNftStatus();
  }, [moment._id, moment.nftContractAddress, moment.nftTokenId, moment.nftMintedCount]);

  // ✅ FIXED: Get hasNFTEdition from API response
  const hasNFTEdition = nftStatus?.hasNFTEdition || false;
  
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
    
    return {
      ...tierInfo[tier],
      score,
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

  console.log('🔍 MomentDetailModal Debug:', {
    momentId: moment._id,
    fetchingNftStatus,
    nftStatusFromAPI: nftStatus,
    hasNFTEdition,
    isOwner,
    nftTokenId: moment.nftTokenId,
    nftContractAddress: moment.nftContractAddress
  });

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="trading-card-modal" onClick={(e) => e.stopPropagation()}>
          {/* Card Header with Rarity */}
          <div className="card-header" style={headerStyle}>
            <div className="card-title-section">
              <div className="rarity-badge" style={rarityBadgeStyle}>
                <span className="rarity-emoji">{rarityInfo.emoji}</span>
                <span className="rarity-text">{rarityInfo.name}</span>
                <span className="rarity-score">{rarityInfo.score}</span>
              </div>
              <h2 className="card-title">{moment.songName}</h2>
              <p className="card-subtitle">
                {moment.venueName} • {moment.venueCity}
                {moment.venueCountry && `, ${moment.venueCountry}`}
              </p>
              <p className="card-date">{moment.performanceDate}</p>
              <p className="song-performances">
                🎵 {moment.songTotalPerformances || 0} times performed live
              </p>
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

          {/* ✅ FIXED: Simplified Rarity Details (only show if first moment) */}
          {moment.isFirstMomentForSong && (
            <div className="rarity-section">
              <div className="rarity-details">
                <div className="rarity-item">
                  <span className="rarity-label">🏆 First Moment:</span>
                  <span className="rarity-value">First uploaded for this song!</span>
                </div>
              </div>
            </div>
          )}

          {/* Media Display */}
          <div className="card-media">
            {getMediaComponent()}
          </div>

          {/* ✅ ADDED BACK: Metadata Panel */}
          <div className="metadata-panel">
            <div className="metadata-header">
              <h3>Moment Details</h3>
              <div className="metadata-toggles">
                <button
                  onClick={() => setShowFileDetails(!showFileDetails)}
                  className="toggle-button"
                >
                  File Details {showFileDetails ? '▼' : '▶'}
                </button>
                <button
                  onClick={() => setShowEmptyFields(!showEmptyFields)}
                  className="toggle-button"
                >
                  All Fields {showEmptyFields ? '▼' : '▶'}
                </button>
              </div>
            </div>

            {/* Basic Metadata */}
            <div className="metadata-content">
              {/* Performance Info */}
              <div className="metadata-group">
                <h4>Performance Info</h4>
                <div className="metadata-grid">
                  <div className="metadata-item">
                    <span className="metadata-label">Set:</span>
                    <span className="metadata-value">{moment.setName || 'Main Set'}</span>
                  </div>
                  {moment.songPosition && (
                    <div className="metadata-item">
                      <span className="metadata-label">Position:</span>
                      <span className="metadata-value">#{moment.songPosition}</span>
                    </div>
                  )}
                  <div className="metadata-item">
                    <span className="metadata-label">Type:</span>
                    <span className="metadata-value">{moment.momentType || 'Performance'}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {(moment.momentDescription || showEmptyFields) && (
                <div className="metadata-group">
                  <h4>Description</h4>
                  <p className="metadata-description">
                    {moment.momentDescription || <em className="text-gray-400">No description provided</em>}
                  </p>
                </div>
              )}

              {/* Tags */}
              {(moment.emotionalTags || moment.instruments || showEmptyFields) && (
                <div className="metadata-group">
                  <h4>Tags</h4>
                  <div className="metadata-tags">
                    {moment.emotionalTags && (
                      <div className="tag-group">
                        <span className="tag-label">Emotions:</span>
                        <div className="tags">
                          {moment.emotionalTags.split(',').map((tag, i) => (
                            <span key={i} className="tag emotion-tag">{tag.trim()}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {moment.instruments && (
                      <div className="tag-group">
                        <span className="tag-label">Instruments:</span>
                        <div className="tags">
                          {moment.instruments.split(',').map((instrument, i) => (
                            <span key={i} className="tag instrument-tag">{instrument.trim()}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Details */}
              {(moment.specialOccasion || moment.crowdReaction || moment.guestAppearances || moment.uniqueElements || showEmptyFields) && (
                <div className="metadata-group">
                  <h4>Additional Details</h4>
                  <div className="metadata-list">
                    {(moment.specialOccasion || showEmptyFields) && (
                      <div className="metadata-item">
                        <span className="metadata-label">Special Occasion:</span>
                        <span className="metadata-value">{moment.specialOccasion || <em className="text-gray-400">None</em>}</span>
                      </div>
                    )}
                    {(moment.crowdReaction || showEmptyFields) && (
                      <div className="metadata-item">
                        <span className="metadata-label">Crowd Reaction:</span>
                        <span className="metadata-value">{moment.crowdReaction || <em className="text-gray-400">Not specified</em>}</span>
                      </div>
                    )}
                    {(moment.guestAppearances || showEmptyFields) && (
                      <div className="metadata-item">
                        <span className="metadata-label">Guest Appearances:</span>
                        <span className="metadata-value">{moment.guestAppearances || <em className="text-gray-400">None</em>}</span>
                      </div>
                    )}
                    {(moment.uniqueElements || showEmptyFields) && (
                      <div className="metadata-item">
                        <span className="metadata-label">Unique Elements:</span>
                        <span className="metadata-value">{moment.uniqueElements || <em className="text-gray-400">None specified</em>}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* File Details */}
              {showFileDetails && (
                <div className="metadata-group">
                  <h4>File Information</h4>
                  <div className="metadata-list">
                    <div className="metadata-item">
                      <span className="metadata-label">Filename:</span>
                      <span className="metadata-value filename">{moment.fileName || 'Unknown'}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Size:</span>
                      <span className="metadata-value">{moment.fileSize ? formatFileSize(moment.fileSize) : 'Unknown'}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Type:</span>
                      <span className="metadata-value">{moment.mediaType || 'Unknown'}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Audio Quality:</span>
                      <span className="metadata-value quality-badge" data-quality={moment.audioQuality}>
                        {moment.audioQuality || 'good'}
                      </span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Video Quality:</span>
                      <span className="metadata-value quality-badge" data-quality={moment.videoQuality}>
                        {moment.videoQuality || 'good'}
                      </span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Uploaded:</span>
                      <span className="metadata-value">{new Date(moment.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Personal Note */}
              {(moment.personalNote || showEmptyFields) && (
                <div className="metadata-group">
                  <h4>Personal Note</h4>
                  <p className="metadata-description personal-note">
                    {moment.personalNote || <em className="text-gray-400">No personal note added</em>}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ✅ FIXED: NFT Section with Proper API-Based Status */}
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
                  NFT Status
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
                  {fetchingNftStatus && (
                    <span style={{
                      marginLeft: '10px',
                      fontSize: '12px',
                      background: '#6b7280',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      Loading...
                    </span>
                  )}
                </h3>
                <p style={{ 
                  fontSize: '14px', 
                  color: '#6b7280',
                  margin: '0'
                }}>
                  {fetchingNftStatus
                    ? 'Checking NFT status...'
                    : hasNFTEdition 
                      ? 'This moment is available as an NFT'
                      : isOwner 
                        ? 'Create an NFT edition of your moment and earn revenue'
                        : 'NFT not yet available for this moment'
                  }
                </p>
              </div>
              
              {/* ✅ FIXED: Pass correct props from API response */}
              {!fetchingNftStatus && (
                <MomentMint 
                  moment={moment} 
                  user={user} 
                  isOwner={isOwner}
                  hasNFTEdition={hasNFTEdition}
                  isExpanded={true}
                />
              )}
              
              {fetchingNftStatus && (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: '#6b7280'
                }}>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  Fetching NFT status...
                </div>
              )}
            </div>
          )}

          {/* ✅ FIXED: Much smaller message for non-logged in users */}
          {!user && (
            <div style={{ 
              padding: '12px', 
              background: '#f9fafb',
              borderTop: '1px solid #e5e7eb',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '0' }}>
                {fetchingNftStatus
                  ? 'Checking NFT availability...'
                  : hasNFTEdition 
                    ? 'NFT available • Login to mint'
                    : 'NFT not available'
                }
              </p>
            </div>
          )}

          {/* Card Footer */}
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

          @media (max-width: 640px) {
            .trading-card-modal {
              max-width: 95vw;
              max-height: 95vh;
              margin: 0.5rem;
            }
          }

          .card-header {
            color: white;
            padding: 1.5rem;
            border-radius: 14px 14px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }

          @media (max-width: 640px) {
            .card-header {
              padding: 1rem;
            }
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

          @media (max-width: 640px) {
            .card-title {
              font-size: 1.25rem;
            }
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

          .song-performances {
            font-size: 0.8rem;
            opacity: 0.9;
            margin: 0.5rem 0 0 0;
            font-weight: 500;
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

          @media (max-width: 640px) {
            .rarity-section {
              padding: 0.75rem 1rem;
            }
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

          .card-media {
            padding: 1rem;
            background: #f8f9fa;
            border-bottom: 1px solid #e2e8f0;
          }

          .media-container {
            position: relative;
          }

          /* ✅ NEW: Metadata Panel Styles */
          .metadata-panel {
            padding: 1.5rem;
            background: #ffffff;
            border-bottom: 1px solid #e2e8f0;
          }

          @media (max-width: 640px) {
            .metadata-panel {
              padding: 1rem;
            }
          }

          .metadata-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .metadata-header h3 {
            font-size: 1.1rem;
            font-weight: 600;
            color: #1f2937;
            margin: 0;
          }

          .metadata-toggles {
            display: flex;
            gap: 0.5rem;
          }

          .toggle-button {
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            color: #374151;
            padding: 0.25rem 0.5rem;
            border-radius: 6px;
            font-size: 0.75rem;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .toggle-button:hover {
            background: #e5e7eb;
          }

          .metadata-content {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .metadata-group h4 {
            font-size: 0.9rem;
            font-weight: 600;
            color: #374151;
            margin: 0 0 0.5rem 0;
            padding-bottom: 0.25rem;
            border-bottom: 1px solid #e5e7eb;
          }

          .metadata-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 0.75rem;
          }

          .metadata-list {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .metadata-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.25rem 0;
          }

          .metadata-label {
            font-size: 0.8rem;
            color: #6b7280;
            font-weight: 500;
            min-width: 0;
            margin-right: 0.5rem;
          }

          .metadata-value {
            font-size: 0.8rem;
            color: #1f2937;
            text-align: right;
            min-width: 0;
            word-break: break-word;
          }

          .quality-badge {
            background: #f3f4f6;
            color: #374151;
            padding: 0.125rem 0.5rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 500;
            text-transform: capitalize;
          }

          .quality-badge[data-quality="excellent"] {
            background: #dcfce7;
            color: #166534;
          }

          .quality-badge[data-quality="good"] {
            background: #dbeafe;
            color: #1d4ed8;
          }

          .quality-badge[data-quality="fair"] {
            background: #fef3c7;
            color: #d97706;
          }

          .quality-badge[data-quality="poor"] {
            background: #fee2e2;
            color: #dc2626;
          }

          .metadata-description {
            font-size: 0.85rem;
            color: #4b5563;
            line-height: 1.5;
            margin: 0;
            padding: 0.5rem;
            background: #f9fafb;
            border-radius: 6px;
            border-left: 3px solid #e5e7eb;
          }

          .metadata-description.personal-note {
            border-left-color: #3b82f6;
            background: #eff6ff;
          }

          .metadata-tags {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .tag-group {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
          }

          .tag-label {
            font-size: 0.75rem;
            color: #6b7280;
            font-weight: 500;
          }

          .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.25rem;
          }

          .tag {
            background: #f3f4f6;
            color: #374151;
            padding: 0.125rem 0.5rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 500;
          }

          .emotion-tag {
            background: #fef3c7;
            color: #d97706;
          }

          .instrument-tag {
            background: #dbeafe;
            color: #1d4ed8;
          }

          .filename {
            font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
            font-size: 0.7rem;
            background: #f3f4f6;
            padding: 0.125rem 0.25rem;
            border-radius: 3px;
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

          @media (max-width: 640px) {
            .card-footer {
              padding: 0.75rem 1rem;
              flex-direction: column;
              gap: 0.5rem;
            }
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

          @media (max-width: 640px) {
            .download-section {
              text-align: center;
            }
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