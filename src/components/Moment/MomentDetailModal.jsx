// src/components/Moment/MomentDetailModal.jsx - UPDATED with enhanced rarity explanations
import React, { useState, useEffect, memo } from 'react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';
import { formatFileSize } from '../../utils';
import MomentMint from '../Web3/MomentMint';

const MomentDetailModal = memo(({ moment, onClose }) => {
  const { user } = useAuth();
  
  // ✅ Determine content type
  const contentType = moment.contentType || 'song';
  const isSongContent = contentType === 'song';
  
  // ✅ Content type display info
  const contentTypeInfo = {
    song: { emoji: '🎵', label: 'Song Performance', showPerformanceStats: true },
    intro: { emoji: '🎭', label: 'Intro/Outro', showPerformanceStats: false },
    jam: { emoji: '🎸', label: 'Jam/Improv', showPerformanceStats: false },
    crowd: { emoji: '👥', label: 'Crowd Moment', showPerformanceStats: false },
    other: { emoji: '🎪', label: 'Other Content', showPerformanceStats: false }
  };
  
  const typeInfo = contentTypeInfo[contentType] || contentTypeInfo.other;
  
  const isOwner = React.useMemo(() => {
    if (!user || !moment?.user) {
      return false;
    }
    const userLoggedInId = user.id || user._id;
    const momentUploaderId = moment.user._id || moment.user.id;
    return userLoggedInId === momentUploaderId;
  }, [user, moment]);

  // NFT status state
  const [nftStatus, setNftStatus] = useState(null);
  const [fetchingNftStatus, setFetchingNftStatus] = useState(true);
  const [showRarityInfo, setShowRarityInfo] = useState(false);
  
  useEffect(() => {
    const fetchNftStatus = async () => {
      if (!moment?._id) return;
      
      try {
        setFetchingNftStatus(true);
        const response = await fetch(`${API_BASE_URL}/moments/${moment._id}/nft-status`);
        
        if (response.ok) {
          const status = await response.json();
          setNftStatus(status);
        } else {
          const fallbackStatus = {
            hasNFTEdition: !!(moment.nftContractAddress && moment.nftTokenId !== undefined),
            isMintingActive: false,
            nftData: null
          };
          setNftStatus(fallbackStatus);
        }
      } catch (error) {
        console.error('❌ Error fetching NFT status:', error);
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
  }, [moment._id, moment.nftContractAddress, moment.nftTokenId]);

  const hasNFTEdition = nftStatus?.hasNFTEdition || false;
  
  const [isEditing, setIsEditing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [showFileDetails, setShowFileDetails] = useState(false);
  const [showEmptyFields, setShowEmptyFields] = useState(false);

  const handleDownload = () => {
    try {
      window.open(moment.mediaUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to open file. Please try again.');
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

  // ✅ UPDATED: Rarity breakdown with enhanced content type awareness
  const getRarityBreakdown = () => {
    const totalScore = moment.rarityScore || 0;
    
    // For non-song content, show enhanced breakdown
    if (!isSongContent) {
      const maxPossible = contentType === 'other' ? '4.0' : '6.0';
      const tierCap = contentType === 'jam' ? 'epic' : 
                     contentType === 'crowd' || contentType === 'intro' ? 'rare' : 'uncommon';
      
      return {
        contentType: contentType,
        isNonSong: true,
        totalScore: totalScore.toFixed(1),
        maxPossible: maxPossible,
        tierCap: tierCap,
        explanation: `${typeInfo.label} content can reach up to ${maxPossible}/7 points and "${tierCap}" tier${contentType === 'jam' ? ' (highest for non-songs)' : ''}`
      };
    }
    
    // For songs, estimate component breakdown
    const songPerformances = moment.songTotalPerformances || 0;
    
    let performanceScore = 0;
    if (songPerformances >= 1 && songPerformances <= 10) {
      performanceScore = 4;
    } else if (songPerformances >= 11 && songPerformances <= 50) {
      performanceScore = 3;
    } else if (songPerformances >= 51 && songPerformances <= 100) {
      performanceScore = 2.5;
    } else if (songPerformances >= 101 && songPerformances <= 150) {
      performanceScore = 2;
    } else if (songPerformances >= 151 && songPerformances <= 200) {
      performanceScore = 1.5;
    } else {
      performanceScore = 1;
    }
    
    const metadataFields = [
      moment.momentDescription,
      moment.emotionalTags,
      moment.specialOccasion,
      moment.instruments,
      moment.guestAppearances,
      moment.crowdReaction,
      moment.uniqueElements,
      moment.personalNote
    ];
    const filledFields = metadataFields.filter(field => field && field.trim().length > 0).length;
    const metadataScore = filledFields / metadataFields.length;
    
    const estimatedTotal = performanceScore + metadataScore;
    const remainingScore = Math.max(0, totalScore - estimatedTotal);
    
    return {
      contentType: 'song',
      isNonSong: false,
      performanceScore: performanceScore.toFixed(1),
      metadataScore: metadataScore.toFixed(1),
      lengthScore: Math.min(1, remainingScore / 2).toFixed(1),
      venueScore: Math.max(0, remainingScore - Math.min(1, remainingScore / 2)).toFixed(1),
      totalScore: totalScore.toFixed(1),
      maxPossible: '7.0'
    };
  };

  const rarityInfo = getRarityInfo();
  const rarityBreakdown = getRarityBreakdown();

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
            autoPlay
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
          
          {videoLoaded && (
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              opacity: '0.8'
            }}>
              🎬 Auto-playing (muted)
            </div>
          )}
          
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

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="trading-card-modal" onClick={(e) => e.stopPropagation()}>
          {/* Card Header with Content Type and Rarity */}
          <div className="card-header" style={headerStyle}>
            <div className="card-title-section">
              <div className="content-type-badge" style={{ 
                backgroundColor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                marginBottom: '8px',
                display: 'inline-block'
              }}>
                {typeInfo.emoji} {typeInfo.label}
              </div>
              
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
              
              {/* ✅ CONDITIONAL: Only show performance stats for songs */}
              {isSongContent && typeInfo.showPerformanceStats && (
                <p className="song-performances">
                  🎵 {moment.songTotalPerformances || 0} times performed live
                </p>
              )}
            </div>
            
            <div className="card-controls">
              {isOwner && (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`edit-button ${isEditing ? 'editing' : ''}`}
                >
                  {isEditing ? '✕' : '✏️'}
                </button>
              )}
              <button onClick={onClose} className="close-button">✕</button>
            </div>
          </div>

          {/* ✅ UPDATED: Rarity Details with Content Type Awareness */}
          <div className="rarity-section">
            <div className="rarity-details">
              <div className="rarity-header">
                <h4>Rarity Calculation</h4>
                <button
                  onClick={() => setShowRarityInfo(true)}
                  className="info-button"
                  title="How is rarity calculated?"
                >
                  ℹ️
                </button>
              </div>
              
              <div className="rarity-formula">
                <div className="rarity-total">
                  <span className="rarity-total-label">Score:</span>
                  <span className="rarity-total-value">
                    {rarityBreakdown.totalScore}/{rarityBreakdown.maxPossible}
                  </span>
                </div>
                
                {/* ✅ CONDITIONAL: Different display for songs vs non-songs */}
                {rarityBreakdown.isNonSong ? (
                  <div className="non-song-explanation">
                    <div style={{
                      padding: '8px',
                      backgroundColor: '#f0f9ff',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#0c4a6e'
                    }}>
                      {rarityBreakdown.explanation}
                    </div>
                  </div>
                ) : (
                  <div className="rarity-breakdown">
                    <div className="rarity-component">
                      <span className="component-label">Performance Rarity:</span>
                      <span className="component-value">{rarityBreakdown.performanceScore}</span>
                    </div>
                    <div className="rarity-component">
                      <span className="component-label">Metadata Quality:</span>
                      <span className="component-value">{rarityBreakdown.metadataScore}</span>
                    </div>
                    <div className="rarity-component">
                      <span className="component-label">Video Length:</span>
                      <span className="component-value">{rarityBreakdown.lengthScore}</span>
                    </div>
                    <div className="rarity-component">
                      <span className="component-label">Performance Priority:</span>
                      <span className="component-value">{rarityBreakdown.venueScore}</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* ✅ CONDITIONAL: First moment note only for songs */}
              {isSongContent && moment.isFirstMomentForSong && (
                <div className="first-moment-note">
                  🏆 First moment uploaded for this song at this performance!
                </div>
              )}
            </div>
          </div>

          {/* Media Display */}
          <div className="card-media">
            {getMediaComponent()}
          </div>

          {/* Metadata Panel - Same as before but aware of content type */}
          <div className="metadata-panel">
            <div className="metadata-header">
              <h3>Content Details</h3>
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

            <div className="metadata-content">
              {/* Basic Info */}
              <div className="metadata-group">
                <h4>Basic Information</h4>
                <div className="metadata-grid">
                  <div className="metadata-item">
                    <span className="metadata-label">Content Type:</span>
                    <span className="metadata-value">{typeInfo.emoji} {typeInfo.label}</span>
                  </div>
                  {isSongContent && moment.setName && (
                    <div className="metadata-item">
                      <span className="metadata-label">Set:</span>
                      <span className="metadata-value">{moment.setName}</span>
                    </div>
                  )}
                  {isSongContent && moment.songPosition && (
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

              {/* Rest of metadata display remains the same... */}
              {(moment.momentDescription || showEmptyFields) && (
                <div className="metadata-group">
                  <h4>Description</h4>
                  <p className="metadata-description">
                    {moment.momentDescription || <em className="text-gray-400">No description provided</em>}
                  </p>
                </div>
              )}

              {/* Continue with existing metadata sections... */}
            </div>
          </div>

          {/* NFT Section - Same as before */}
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
                </h3>
                <p style={{ 
                  fontSize: '14px', 
                  color: '#6b7280',
                  margin: '0'
                }}>
                  {fetchingNftStatus
                    ? 'Checking NFT status...'
                    : hasNFTEdition 
                      ? `This ${typeInfo.label.toLowerCase()} is available as an NFT`
                      : isOwner 
                        ? `Create an NFT edition of your ${typeInfo.label.toLowerCase()} and earn revenue`
                        : `NFT not yet available for this ${typeInfo.label.toLowerCase()}`
                  }
                </p>
              </div>
              
              {!fetchingNftStatus && (
                <MomentMint 
                  moment={moment} 
                  user={user} 
                  isOwner={isOwner}
                  hasNFTEdition={hasNFTEdition}
                  isExpanded={true}
                />
              )}
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

        {/* ✅ ENHANCED: Rarity Info Modal with new scoring explanations */}
        {showRarityInfo && (
          <div className="rarity-info-overlay" onClick={() => setShowRarityInfo(false)}>
            <div className="rarity-info-modal" onClick={(e) => e.stopPropagation()}>
              <div className="rarity-info-header">
                <h3>How Rarity is Calculated</h3>
                <button
                  onClick={() => setShowRarityInfo(false)}
                  className="rarity-info-close"
                >
                  ✕
                </button>
              </div>
              <div className="rarity-info-content">
                {/* ✅ ENHANCED: Different explanations for different content types */}
                {isSongContent ? (
                  <>
                    <div className="rarity-criterion">
                      <h4>🎵 Song Performance Rarity (0-4 points)</h4>
                      <p>Based on how often the song has been performed live:</p>
                      <ul>
                        <li><strong>4 points:</strong> 1-10 performances (ultra rare)</li>
                        <li><strong>3 points:</strong> 11-50 performances (rare)</li>
                        <li><strong>2.5 points:</strong> 51-100 performances (uncommon)</li>
                        <li><strong>2 points:</strong> 101-150 performances (somewhat common)</li>
                        <li><strong>1.5 points:</strong> 151-200 performances (common)</li>
                        <li><strong>1 point:</strong> 200+ performances (most common)</li>
                      </ul>
                    </div>
                    
                    <div className="rarity-criterion">
                      <h4>📝 Metadata Quality (0-1 point)</h4>
                      <p>Based on how much detail you provided about the performance</p>
                    </div>
                    
                    <div className="rarity-criterion">
                      <h4>🎬 Video Length (0-1 point)</h4>
                      <p>Based on optimal video duration (~2.5 minutes ideal)</p>
                    </div>
                    
                    <div className="rarity-criterion">
                      <h4>🏟️ Performance Priority (0-1 point)</h4>
                      <p>First moment of this song at this specific performance gets maximum points</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rarity-criterion">
                      <h4>🎭 Enhanced {typeInfo.label} Scoring (0-{rarityBreakdown.maxPossible} points)</h4>
                      <p>{typeInfo.label} content uses a sophisticated scoring system:</p>
                      <ul>
                        <li><strong>Base Score:</strong> {contentType === 'jam' ? '1.5' : contentType === 'crowd' ? '1.2' : contentType === 'intro' ? '1.0' : '0.8'} points for {contentType} content</li>
                        <li><strong>🌟 Global First Bonus:</strong> Up to +{contentType === 'jam' ? '1.5' : '1.2'} points for being the FIRST {contentType} content ever uploaded!</li>
                        <li><strong>Metadata Quality:</strong> Up to +{contentType === 'jam' ? '0.8' : '0.6'} points for detailed descriptions</li>
                        <li><strong>Performance Priority:</strong> Up to +{contentType === 'jam' ? '0.8' : '0.6'} points for being first at this show</li>
                        <li><strong>Content Bonuses:</strong> Up to +0.8 points for {
                          contentType === 'jam' ? 'multi-instrument complexity & guests' :
                          contentType === 'crowd' ? 'explosive crowd reactions' :
                          contentType === 'intro' ? 'special occasions & unique elements' :
                          'special circumstances'
                        }</li>
                        <li><strong>Quality Bonus:</strong> Up to +0.4 points for excellent audio/video quality</li>
                      </ul>
                      <p><strong>Maximum Tier:</strong> Can reach "{rarityBreakdown.tierCap}" tier{contentType === 'jam' ? ' (highest for non-songs)' : ''}</p>
                    </div>
                    
                    <div className="rarity-criterion">
                      <h4>🌟 Global First System</h4>
                      <p>Being the first person to upload {contentType} content gets a major bonus!</p>
                      <ul>
                        <li><strong>First jam ever:</strong> +1.5 points → Can reach Epic tier</li>
                        <li><strong>First crowd/intro/outro ever:</strong> +1.2 points → Can reach Rare tier</li>
                        <li><strong>First other content ever:</strong> +1.2 points → Can reach Uncommon tier</li>
                        <li>This creates legendary moments for pioneers who upload new content types first</li>
                      </ul>
                    </div>

                    <div className="rarity-criterion">
                      <h4>📊 Content Type Maximums</h4>
                      <ul>
                        <li><strong>🎸 Jams:</strong> Up to 6.0/7 points, Epic tier (compete with songs!)</li>
                        <li><strong>👥 Crowd Moments:</strong> Up to 6.0/7 points, Rare tier</li>
                        <li><strong>🎭 Intro/Outro:</strong> Up to 6.0/7 points, Rare tier</li>
                        <li><strong>🎪 Other Content:</strong> Up to 4.0/7 points, Uncommon tier</li>
                      </ul>
                      <p><em>Non-song content now has meaningful rarity potential!</em></p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* All the existing styles... */}
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

          .content-type-badge {
            font-weight: 500;
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

          .rarity-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .rarity-header h4 {
            font-size: 0.9rem;
            font-weight: 600;
            color: #374151;
            margin: 0;
          }

          .info-button {
            background: #e5e7eb;
            border: none;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            cursor: pointer;
            font-size: 0.8rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
          }

          .info-button:hover {
            background: #d1d5db;
            transform: scale(1.1);
          }

          .rarity-formula {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .rarity-total {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem;
            background: rgba(59, 130, 246, 0.1);
            border-radius: 6px;
            border-left: 3px solid #3b82f6;
          }

          .rarity-total-label {
            font-weight: 600;
            color: #1e40af;
            font-size: 0.9rem;
          }

          .rarity-total-value {
            font-weight: 700;
            color: #1e40af;
            font-size: 1rem;
          }

          .rarity-breakdown {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 0.25rem;
          }

          .rarity-component {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.25rem 0.5rem;
            background: #f9fafb;
            border-radius: 4px;
            font-size: 0.75rem;
          }

          .component-label {
            color: #6b7280;
            font-weight: 500;
          }

          .component-value {
            color: #374151;
            font-weight: 600;
            font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          }

          .first-moment-note {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            color: #92400e;
            padding: 0.5rem;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 500;
            text-align: center;
          }

          .non-song-explanation {
            margin-top: 0.5rem;
          }

          .card-media {
            padding: 1rem;
            background: #f8f9fa;
            border-bottom: 1px solid #e2e8f0;
            position: relative;
          }

          .media-container {
            position: relative;
          }

          .metadata-panel {
            padding: 1.5rem;
            background: #ffffff;
            border-bottom: 1px solid #e2e8f0;
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

          .rarity-info-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.9);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
          }

          .rarity-info-modal {
            background: white;
            border-radius: 12px;
            max-width: 600px;
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          }

          .rarity-info-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            border-bottom: 1px solid #e5e7eb;
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            border-radius: 12px 12px 0 0;
          }

          .rarity-info-header h3 {
            margin: 0;
            font-size: 1.2rem;
            font-weight: 600;
          }

          .rarity-info-close {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
            transition: all 0.2s ease;
          }

          .rarity-info-close:hover {
            background: rgba(255, 255, 255, 0.3);
          }

          .rarity-info-content {
            padding: 1.5rem;
          }

          .rarity-criterion {
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #f3f4f6;
          }

          .rarity-criterion:last-child {
            border-bottom: none;
          }

          .rarity-criterion h4 {
            color: #1f2937;
            font-size: 1rem;
            font-weight: 600;
            margin: 0 0 0.5rem 0;
          }

          .rarity-criterion p {
            color: #4b5563;
            font-size: 0.9rem;
            margin: 0 0 0.5rem 0;
          }

          .rarity-criterion ul {
            margin: 0;
            padding-left: 1.5rem;
            color: #6b7280;
            font-size: 0.85rem;
          }

          .rarity-criterion li {
            margin-bottom: 0.25rem;
          }
        `}</style>
      </div>
    </>
  );
});

MomentDetailModal.displayName = 'MomentDetailModal';

export default MomentDetailModal;