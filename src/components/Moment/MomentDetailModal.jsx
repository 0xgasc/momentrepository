// src/components/Moment/MomentDetailModal.jsx - OPTIMIZED & FIXED
import React, { useState, useEffect, memo } from 'react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';
import { usePlatformSettings } from '../../contexts/PlatformSettingsContext';
import { formatFileSize } from '../../utils';
import LazyMomentMint from '../Web3/LazyMomentMint';
import LazyMedia from '../UI/LazyMedia';

const MomentDetailModal = memo(({ moment: initialMoment, onClose }) => {
  const { user } = useAuth();
  const { isWeb3Enabled } = usePlatformSettings();
  const [moment, setMoment] = useState(initialMoment);
  
  // Update moment state when initialMoment prop changes
  useEffect(() => {
    setMoment(initialMoment);
  }, [initialMoment]);
  
  const contentType = moment.contentType || 'song';
  const isSongContent = contentType === 'song';
  
  const contentTypeInfo = {
    song: { emoji: '🎵', label: 'Song Performance', showPerformanceStats: true },
    intro: { emoji: '🎭', label: 'Intro/Outro', showPerformanceStats: false },
    jam: { emoji: '🎸', label: 'Jam/Improv', showPerformanceStats: false },
    crowd: { emoji: '👥', label: 'Crowd Moment', showPerformanceStats: false },
    other: { emoji: '🎪', label: 'Other Content', showPerformanceStats: false }
  };
  
  const typeInfo = contentTypeInfo[contentType] || contentTypeInfo.other;
  
  const isOwner = React.useMemo(() => {
    if (!user || !moment?.user) return false;
    const userLoggedInId = user.id || user._id;
    const momentUploaderId = moment.user._id || moment.user.id;
    return userLoggedInId === momentUploaderId;
  }, [user, moment]);

  // States
  const [nftStatus, setNftStatus] = useState(null);
  const [fetchingNftStatus, setFetchingNftStatus] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [showRarityBreakdown, setShowRarityBreakdown] = useState(false);
  const [showRarityInfo, setShowRarityInfo] = useState(false);
  const [showRaritySection, setShowRaritySection] = useState(false);
  const [showBasicInfo, setShowBasicInfo] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showFileDetails, setShowFileDetails] = useState(false);
  const [showEmptyFields, setShowEmptyFields] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [imageLoaded, setImageLoaded] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [showNftPanel, setShowNftPanel] = useState(false);
  
  useEffect(() => {
    const fetchNftStatus = async () => {
      if (!moment?._id || !isWeb3Enabled()) {
        // If Web3 is disabled, set default NFT status and skip API call
        setNftStatus({
          hasNFTEdition: false,
          isMintingActive: false,
          nftData: null
        });
        setFetchingNftStatus(false);
        return;
      }
      
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
  }, [moment._id, moment.nftContractAddress, moment.nftTokenId, isWeb3Enabled]);

  const hasNFTEdition = nftStatus?.hasNFTEdition || false;

  const handleDownload = () => {
    try {
      window.open(moment.mediaUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to open file. Please try again.');
    }
  };

  // Refresh moment data after NFT operations
  const handleRefreshMoment = async () => {
    console.log('🔄 Refreshing moment data...');
    try {
      const response = await fetch(`${API_BASE_URL}/moments/${moment._id}`);
      if (response.ok) {
        const updatedMoment = await response.json();
        console.log('✅ Moment data refreshed:', updatedMoment);
        console.log('📊 Updated mint count:', updatedMoment.nftMintedCount);
        console.log('🏷️ NFT Token ID:', updatedMoment.nftTokenId);
        console.log('🏠 NFT Contract Address:', updatedMoment.nftContractAddress);
        console.log('💰 NFT Mint Price:', updatedMoment.nftMintPrice);
        setMoment(updatedMoment);
      }
    } catch (error) {
      console.error('❌ Failed to refresh moment data:', error);
    }
  };

  // Optimized rarity calculations
  const getRarityInfo = () => {
    const tierInfo = {
      legendary: { emoji: '🌟', color: '#FFD700', bgColor: '#FFFBEE', name: 'Legendary' },
      mythic: { emoji: '🔮', color: '#8B5CF6', bgColor: '#F3F0FF', name: 'Mythic' },
      epic: { emoji: '💎', color: '#9B59B6', bgColor: '#F4F1FF', name: 'Epic' },
      rare: { emoji: '🔥', color: '#E74C3C', bgColor: '#FFEBEE', name: 'Rare' },
      uncommon: { emoji: '⭐', color: '#3498DB', bgColor: '#E3F2FD', name: 'Uncommon' },
      common: { emoji: '📀', color: '#95A5A6', bgColor: '#F5F5F5', name: 'Common' },
      basic: { emoji: '⚪', color: '#BDC3C7', bgColor: '#F8F9FA', name: 'Basic' }
    };
    
    const tier = moment.rarityTier || 'basic';
    const score = moment.rarityScore || 0;
    
    return { ...tierInfo[tier], score, tier, percentage: Math.round((score / 6.0) * 100) };
  };

  const getRarityBreakdown = () => {
    const totalScore = moment.rarityScore || 0;
    const fileSizeMB = (moment.fileSize || 0) / (1024 * 1024);
    
    let fileSizeScore = 0;
    if (fileSizeMB >= 500) fileSizeScore = 2.0;
    else if (fileSizeMB >= 100) fileSizeScore = 1.5;
    else if (fileSizeMB >= 50) fileSizeScore = 1.0;
    else if (fileSizeMB >= 10) fileSizeScore = 0.5;
    else fileSizeScore = 0.2;
    
    let rarityScore = 0;
    if (isSongContent) {
      const performances = moment.songTotalPerformances || 0;
      if (performances <= 10) rarityScore = 2.0;
      else if (performances <= 50) rarityScore = 1.5;
      else if (performances <= 100) rarityScore = 1.0;
      else if (performances <= 200) rarityScore = 0.7;
      else rarityScore = 0.4;
    } else {
      const contentRarity = { 'jam': 1.8, 'intro': 1.2, 'outro': 1.2, 'crowd': 1.0, 'other': 0.8 };
      rarityScore = contentRarity[contentType] || 1.0;
    }
    
    const metadataFields = [moment.momentDescription, moment.emotionalTags, moment.specialOccasion, moment.instruments, moment.crowdReaction, moment.uniqueElements];
    const filledFields = metadataFields.filter(field => field && field.trim().length > 0).length;
    const metadataScore = (filledFields / metadataFields.length) * 2.0;
    
    return {
      factors: {
        fileSize: { score: fileSizeScore.toFixed(1), label: 'File Size', description: `${Math.round(fileSizeMB)}MB file quality` },
        rarity: { 
          score: rarityScore.toFixed(1), 
          label: isSongContent ? 'Song Rarity' : 'Content Rarity',
          description: isSongContent ? `${moment.songTotalPerformances || 0} live performances` : `${contentType} content type`
        },
        metadata: { score: metadataScore.toFixed(1), label: 'Metadata Quality', description: `${filledFields}/6 fields completed (${Math.round((filledFields/6)*100)}%)` }
      },
      totalScore: totalScore.toFixed(1),
      maxPossible: '6.0'
    };
  };

  // Optimized media component
  const getMediaComponent = () => {
    const isVideo = moment.mediaType === 'video' || moment.fileName?.toLowerCase().match(/\.(mov|mp4|webm)$/);
    const isImage = moment.mediaType === 'image' || moment.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);

    // Always show the original media (video/image), NFT card is just for preview in the minting section

    if (isVideo) {
      return (
        <div className="media-container relative">
          <LazyMedia
            type="video"
            src={moment.mediaUrl}
            className="media-element w-full"
            style={{ maxHeight: '300px', borderRadius: '8px', backgroundColor: '#000', objectFit: 'contain' }}
            controls={true}
            autoPlay={true}
            preload="metadata"
            playsInline={true}
            onLoad={() => { setVideoLoaded(true); setMediaError(false); }}
            onError={() => { setMediaError(true); setVideoLoaded(false); }}
            placeholder={
              <div className="media-loading flex items-center justify-center" style={{ height: '300px' }}>
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Loading video...</p>
                </div>
              </div>
            }
          />
          {mediaError && (
            <div className="media-error mt-2 text-center">
              <p className="text-sm text-red-600 mb-2">Unable to load video preview</p>
              <button onClick={handleDownload} className="text-blue-600 hover:text-blue-800 underline text-sm">
                Click here to download and view externally
              </button>
            </div>
          )}
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="media-container relative">
          <LazyMedia
            type="image"
            src={moment.mediaUrl}
            alt={moment.fileName || 'Moment media'}
            className="media-element w-full"
            style={{ maxHeight: '300px', objectFit: 'contain', borderRadius: '8px' }}
            onLoad={() => { setImageLoaded(true); setMediaError(false); }}
            onError={() => { setMediaError(true); setImageLoaded(false); }}
            placeholder={
              <div className="media-loading flex items-center justify-center" style={{ height: '300px' }}>
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Loading image...</p>
                </div>
              </div>
            }
          />
          {mediaError && (
            <div className="media-error mt-2 text-center">
              <p className="text-sm text-red-600 mb-2">Unable to load image preview</p>
              <button onClick={handleDownload} className="text-blue-600 hover:text-blue-800 underline text-sm">
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
          <button onClick={handleDownload} className="text-blue-600 hover:text-blue-800 underline">
            Click here to download and play
          </button>
        </div>
      </div>
    );
  };

  const rarityInfo = getRarityInfo();
  const rarityBreakdown = getRarityBreakdown();

  // Mobile detection
  const isMobile = window.innerWidth <= 768;

  return (
    <>
      <div className={`modal-overlay ${isMobile ? 'mobile' : ''}`} onClick={onClose}>
        <div className={`trading-card-modal ${showNftPanel ? 'with-side-panel' : ''} ${isMobile ? 'mobile-modal' : ''}`} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="card-header" style={{ background: `linear-gradient(135deg, ${rarityInfo.color} 0%, #1d4ed8 100%)` }}>
            <div className="card-title-section">
              
              <h2 className="card-title">{moment.songName}</h2>
              <p className="card-subtitle">
                {moment.venueName} • {moment.venueCity}
                {moment.venueCountry && `, ${moment.venueCountry}`}
              </p>
              <p className="card-date">{moment.performanceDate}</p>
              
            </div>
            
            <div className="card-controls">
              {/* NFT Panel Toggle Button - Only show if Web3 is enabled */}
              {isWeb3Enabled() && (hasNFTEdition || isOwner) && (
                <button 
                  onClick={() => setShowNftPanel(!showNftPanel)}
                  className={`nft-toggle-button ${showNftPanel ? 'active' : ''}`}
                  title={showNftPanel ? 'Close Controls' : 'Open Controls'}
                >
                  {showNftPanel ? 'Close' : (hasNFTEdition ? 'Controls' : 'Launch Token')}
                </button>
              )}
              <button onClick={onClose} className="close-button">✕</button>
            </div>
          </div>

          {/* Main Content Container with Side Panel Support */}
          <div className="modal-content-container">
            <div className="main-content">


          {/* Media */}
          <div className="card-media">{getMediaComponent()}</div>

          {/* ✅ OPTIMIZED: Metadata Panel */}
          <div className="metadata-panel">
            <div className="metadata-header">
              <h3>Content Details</h3>
              
              <div className="metadata-toggles">
                <button onClick={() => setShowRaritySection(!showRaritySection)} className="toggle-button">
                  {rarityInfo.name} {rarityInfo.emoji} {showRaritySection ? '▼' : '▶'}
                </button>
                <button onClick={() => setShowBasicInfo(!showBasicInfo)} className="toggle-button">
                  Basic Info {showBasicInfo ? '▼' : '▶'}
                </button>
                <button onClick={() => setShowDetails(!showDetails)} className="toggle-button">
                  Details {showDetails ? '▼' : '▶'}
                </button>
                <button onClick={() => setShowFileDetails(!showFileDetails)} className="toggle-button">
                  File Details {showFileDetails ? '▼' : '▶'}
                </button>
                <button onClick={() => setShowEmptyFields(!showEmptyFields)} className="toggle-button">
                  Empty Fields {showEmptyFields ? '▼' : '▶'}
                </button>
              </div>
            </div>

            <div className="metadata-content">
              {/* Rarity Section */}
              {showRaritySection && (
                <div className="metadata-group">
                  <div className="rarity-section-header">
                    <h4>Rarity Details</h4>
                    <button
                      onClick={() => setShowRarityInfo(true)}
                      className="info-button-inline"
                      title="Learn about the rarity system"
                    >
                      ℹ️
                    </button>
                  </div>
                  
                  <div className="rarity-breakdown-detailed">
                    <div className="rarity-total">
                      <span className="rarity-total-label">Score:</span>
                      <span className="rarity-total-value">{rarityBreakdown.totalScore}/{rarityBreakdown.maxPossible}</span>
                    </div>
                    
                    <div className="rarity-explanations">
                      {Object.entries(rarityBreakdown.factors).map(([key, factor]) => (
                        <div key={key} className="factor-explanation">
                          <strong>{factor.label}:</strong> {factor.score} pts - {factor.description}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Basic Info */}
              {showBasicInfo && (
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
                    <div className="metadata-item">
                      <span className="metadata-label">Type:</span>
                      <span className="metadata-value">{moment.momentType || 'Performance'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ✅ MOVED: Details Section (includes description + metadata) */}
              {showDetails && (
                <div className="metadata-group">
                  <h4>Details</h4>
                  
                  {/* Description */}
                  {moment.momentDescription && (
                    <p className="metadata-description">{moment.momentDescription}</p>
                  )}
                  
                  {/* Metadata fields */}
                  {(() => {
                    // ✅ FIXED: Only show fields that were available during upload
                    const availableFields = [
                      { key: 'emotionalTags', label: 'Mood', value: moment.emotionalTags },
                      { key: 'specialOccasion', label: 'Special Occasion', value: moment.specialOccasion },
                      { key: 'crowdReaction', label: 'Crowd Reaction', value: moment.crowdReaction },
                      { key: 'uniqueElements', label: 'Unique Elements', value: moment.uniqueElements }
                    ];
                    
                    // Add instruments field only for songs and jams (matches upload form)
                    if (isSongContent || contentType === 'jam') {
                      availableFields.splice(2, 0, { key: 'instruments', label: 'Instruments', value: moment.instruments });
                    }
                    
                    const fieldsWithContent = availableFields.filter(field => field.value && field.value.trim().length > 0);
                    
                    const emptyFields = availableFields.filter(field => {
                      const value = moment[field.key];
                      return !value || value.trim().length === 0;
                    });
                    
                    if (fieldsWithContent.length > 0 || (showEmptyFields && emptyFields.length > 0)) {
                      return (
                        <div className="metadata-grid" style={{ marginTop: moment.momentDescription ? '1rem' : '0' }}>
                          {fieldsWithContent.map(field => (
                            <div key={field.key} className="metadata-item">
                              <span className="metadata-label">{field.label}:</span>
                              <span className="metadata-value">{field.value}</span>
                            </div>
                          ))}
                          
                          {showEmptyFields && emptyFields.map(field => (
                            <div key={field.key} className="metadata-item">
                              <span className="metadata-label">{field.label}:</span>
                              <span className="metadata-value"><em className="text-gray-400">Not specified</em></span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {/* File Details */}
              {showFileDetails && (
                <div className="metadata-group">
                  <h4>File Information</h4>
                  <div className="metadata-grid">
                    <div className="metadata-item">
                      <span className="metadata-label">File Size:</span>
                      <span className="metadata-value">{moment.fileSize ? formatFileSize(moment.fileSize) : 'Unknown'}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Media Type:</span>
                      <span className="metadata-value">{moment.mediaType || 'Unknown'}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Filename:</span>
                      <span className="metadata-value">{moment.fileName || 'Unknown'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* NFT Section - UNTOUCHED */}

          {/* Footer */}
          <div className="card-footer">
            <div className="uploader-info">
              <span className="uploader-text">Captured by {moment.user?.displayName || 'Anonymous'}</span>
            </div>
            <div className="download-section">
              <button onClick={handleDownload} className="download-link">Click here to download</button>
            </div>
          </div>

            </div> {/* End main-content */}

            {/* NFT Side Panel - Only show if Web3 is enabled */}
            {isWeb3Enabled() && showNftPanel && (
              <div className="nft-side-panel">
                <div className="nft-panel-header">
                  <h3>Controls</h3>
                  <button 
                    onClick={() => setShowNftPanel(false)}
                    className="panel-close-button"
                  >
                    ✕
                  </button>
                </div>
                <div className="nft-panel-content">
                  {!fetchingNftStatus && (
                    <LazyMomentMint 
                      moment={moment} 
                      user={user} 
                      isOwner={isOwner}
                      hasNFTEdition={hasNFTEdition}
                      isExpanded={true}
                      onRefresh={handleRefreshMoment}
                    />
                  )}
                </div>
              </div>
            )}

          </div> {/* End modal-content-container */}
        </div>

        {/* Rarity Info Modal */}
        {showRarityInfo && (
          <div className="rarity-info-overlay" onClick={() => setShowRarityInfo(false)}>
            <div className="rarity-info-modal" onClick={(e) => e.stopPropagation()}>
              <div className="rarity-info-header">
                <h3>⚡ Super Simple 3-Factor Rarity</h3>
                <button onClick={() => setShowRarityInfo(false)} className="rarity-info-close">✕</button>
              </div>
              
              <div className="rarity-info-content">
                <div className="rarity-intro">
                  <p style={{ backgroundColor: '#1A1A1A', padding: '12px', borderRadius: '8px', border: '1px solid #4A0E0E', color: '#F5F5DC', fontSize: '14px', marginBottom: '20px', fontWeight: '500' }}>
                    ⚡ <strong>Ultra Simple:</strong> Just 3 factors, 6 metadata fields, 0-6 points total. Clean and fair for everyone!
                  </p>
                </div>
                
                <div className="rarity-criterion">
                  <h4>📁 Factor 1: File Size Quality (0-2 points)</h4>
                  <p>Larger files typically mean better quality recordings</p>
                  <ul>
                    <li><strong>2.0 points:</strong> 500MB+ (excellent quality)</li>
                    <li><strong>1.5 points:</strong> 100-500MB (great quality)</li>
                    <li><strong>1.0 points:</strong> 50-100MB (good quality)</li>
                    <li><strong>0.5 points:</strong> 10-50MB (decent quality)</li>
                    <li><strong>0.2 points:</strong> Under 10MB (basic quality)</li>
                  </ul>
                </div>

                <div className="rarity-criterion">
                  <h4>🎵 Factor 2: Song/Content Rarity (0-2 points)</h4>
                  <p><strong>For Songs:</strong> Based on how often performed live</p>
                  <ul>
                    <li><strong>2.0 points:</strong> 1-10 performances (ultra rare)</li>
                    <li><strong>1.5 points:</strong> 11-50 performances (rare)</li>
                    <li><strong>1.0 points:</strong> 51-100 performances (uncommon)</li>
                    <li><strong>0.7 points:</strong> 101-200 performances (common)</li>
                    <li><strong>0.4 points:</strong> 200+ performances (very common)</li>
                  </ul>
                  <p><strong>For Other Content:</strong> Based on content type rarity</p>
                  <ul>
                    <li><strong>1.8 points:</strong> Jams/Improvisations</li>
                    <li><strong>1.2 points:</strong> Intros/Outros</li>
                    <li><strong>1.0 points:</strong> Crowd Moments</li>
                    <li><strong>0.8 points:</strong> Other Content</li>
                  </ul>
                </div>

                <div className="rarity-criterion">
                  <h4>📝 Factor 3: Metadata Completeness (0-2 points)</h4>
                  <p>Based on how much detail you provided (6 total fields)</p>
                  <ul>
                    <li><strong>Description:</strong> What happens in this moment</li>
                    <li><strong>Emotional Tags:</strong> Mood and energy</li>
                    <li><strong>Special Occasion:</strong> Birthday, encore, etc.</li>
                    <li><strong>Instruments:</strong> Featured instruments</li>
                    <li><strong>Crowd Reaction:</strong> How the audience responded</li>
                    <li><strong>Unique Elements:</strong> Special circumstances</li>
                  </ul>
                  <p><em>Score = (filled fields ÷ 6) × 2 points</em></p>
                </div>

                <div className="rarity-criterion">
                  <h4>🏅 7-Tier Rarity System (0-6 points total)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', margin: '12px 0' }}>
                    {[
                      { name: 'Legendary', emoji: '🌟', range: '5.5-6.0', color: '#FFD700' },
                      { name: 'Mythic', emoji: '🔮', range: '4.8-5.4', color: '#8B5CF6' },
                      { name: 'Epic', emoji: '💎', range: '4.0-4.7', color: '#9B59B6' },
                      { name: 'Rare', emoji: '🔥', range: '3.2-3.9', color: '#E74C3C' },
                      { name: 'Uncommon', emoji: '⭐', range: '2.4-3.1', color: '#3498DB' },
                      { name: 'Common', emoji: '📀', range: '1.6-2.3', color: '#95A5A6' },
                      { name: 'Basic', emoji: '⚪', range: '0-1.5', color: '#BDC3C7' }
                    ].map(tier => (
                      <div key={tier.name} style={{ padding: '8px', border: `2px solid ${tier.color}`, borderRadius: '6px', textAlign: 'center', fontSize: '12px', backgroundColor: '#1A1A1A' }}>
                        <div style={{ fontSize: '16px', marginBottom: '4px' }}>{tier.emoji}</div>
                        <div style={{ fontWeight: 'bold', color: tier.color }}>{tier.name}</div>
                        <div style={{ color: '#F5F5DC' }}>{tier.range} pts</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rarity-criterion">
                  <h4>✨ What's Different</h4>
                  <div style={{ backgroundColor: '#1A1A1A', border: '1px solid #4A0E0E', borderRadius: '8px', padding: '12px', color: '#F5F5DC' }}>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#B8860B' }}>⚡ Ultra Simplified:</p>
                    <ul style={{ margin: 0, paddingLeft: '16px' }}>
                      <li>✅ Only 3 factors (was 4)</li>
                      <li>✅ Only 6 metadata fields (was 8)</li>
                      <li>✅ 0-6 points scale (was 0-7)</li>
                      <li>❌ Removed "first at event" bonus</li>
                      <li>❌ Removed guest appearances field</li>
                      <li>❌ Removed personal note field</li>
                      <li>❌ Removed song position field</li>
                      <li>🎯 Focus on quality + completeness only</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
            backgroundColor: rgba(255,255,255,0.2);
            color: white;
            padding: 4px 8px;
            borderRadius: 12px;
            fontSize: 12px;
            marginBottom: 8px;
            display: inline-block;
            font-weight: 500;
          }

          .rarity-badge-container {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.75rem;
          }

          .rarity-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            border: 1px solid rgba(255,255,255,0.3);
            transition: all 0.2s ease;
          }

          .rarity-badge.clickable:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            border-color: rgba(255,255,255,0.5);
          }

          .rarity-arrow {
            font-size: 0.7rem;
            opacity: 0.8;
          }

          .rarity-controls {
            display: flex;
            gap: 0.25rem;
            align-items: center;
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

          .song-performances-detail {
            font-size: 0.85rem;
            color: #4b5563;
            margin: 0.5rem 0;
            font-weight: 500;
            padding: 0.5rem;
            background: #f9fafb;
            border-radius: 6px;
            border-left: 3px solid #3b82f6;
          }

          .card-controls {
            display: flex;
            gap: 0.5rem;
            margin-left: 1rem;
          }

          .close-button {
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

          .close-button:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: scale(1.05);
          }

          .nft-toggle-button {
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 0.5rem 0.75rem;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.8rem;
            font-weight: 500;
            transition: all 0.2s ease;
            backdrop-filter: blur(4px);
          }

          .nft-toggle-button:hover {
            background: rgba(255, 255, 255, 0.3);
            border-color: rgba(255, 255, 255, 0.5);
            transform: translateY(-1px);
          }

          .nft-toggle-button.active {
            background: rgba(255, 255, 255, 0.4);
            border-color: rgba(255, 255, 255, 0.6);
          }

          .modal-content-container {
            display: flex;
            min-height: 0;
            flex: 1;
          }

          .trading-card-modal.with-side-panel {
            max-width: 900px;
          }

          .main-content {
            flex: 1;
            min-width: 0;
          }

          .nft-side-panel {
            width: 360px;
            background: #f8f9fa;
            border-left: 1px solid #e2e8f0;
            display: flex;
            flex-direction: column;
            max-height: calc(90vh - 120px);
            overflow-y: auto;
          }

          .nft-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            border-bottom: 1px solid #e2e8f0;
            background: white;
          }

          .nft-panel-header h3 {
            margin: 0;
            font-size: 1rem;
            font-weight: 600;
            color: #1f2937;
          }

          .panel-close-button {
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            color: #6b7280;
            width: 28px;
            height: 28px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.9rem;
            transition: all 0.2s ease;
          }

          .panel-close-button:hover {
            background: #e5e7eb;
            color: #374151;
          }

          .nft-panel-content {
            flex: 1;
            padding: 1rem;
            overflow-y: auto;
          }

          @media (max-width: 768px) {
            .trading-card-modal.with-side-panel {
              max-width: 95vw;
              flex-direction: column;
            }

            .nft-side-panel {
              width: 100%;
              max-height: 50vh;
              border-left: none;
              border-top: 1px solid #e2e8f0;
            }
          }

          .rarity-section {
            padding: 1rem 1.5rem;
            background: linear-gradient(90deg, #f8f9fa 0%, #ffffff 100%);
            border-bottom: 1px solid #e2e8f0;
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

          .rarity-controls {
            display: flex;
            gap: 0.5rem;
            align-items: center;
          }

          .toggle-button {
            background: #e5e7eb;
            border: 1px solid #d1d5db;
            color: #374151;
            padding: 0.25rem 0.5rem;
            border-radius: 6px;
            font-size: 0.75rem;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .toggle-button:hover {
            background: #d1d5db;
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
          
          .info-button-inline {
            background: #e5e7eb;
            border: none;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            cursor: pointer;
            font-size: 0.7rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            margin-left: 0.5rem;
          }
          
          .info-button-inline:hover {
            background: #d1d5db;
            transform: scale(1.1);
          }
          
          .rarity-section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .rarity-breakdown-detailed {
            padding-top: 0.75rem;
            border-top: 1px solid #e5e7eb;
            margin-top: 0.75rem;
          }

          .rarity-total {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem;
            background: rgba(59, 130, 246, 0.1);
            border-radius: 6px;
            border-left: 3px solid #3b82f6;
            margin-bottom: 0.75rem;
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

          .rarity-explanations {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
          }

          .factor-explanation {
            font-size: 0.75rem;
            color: #6b7280;
            padding: 0.2rem 0;
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
            flex-wrap: wrap;
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
            margin: 0 0 0.5rem 0;
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
            background: var(--void-black, #0A0A0A);
            border: 1px solid var(--crimson-wine, #4A0E0E);
            border-radius: 12px;
            max-width: 600px;
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);
            color: var(--bone-white, #F5F5DC);
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
            background: var(--void-black, #0A0A0A);
            color: var(--bone-white, #F5F5DC);
          }

          .rarity-criterion {
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--shadow-gray, #1A1A1A);
          }
          
          .rarity-criterion h4 {
            color: var(--doom-orange, #B8860B);
            text-shadow: 0 0 5px rgba(184, 134, 11, 0.5);
          }
          
          .rarity-criterion p {
            color: var(--bone-white, #F5F5DC);
          }
          
          .rarity-criterion ul {
            color: var(--bone-white, #F5F5DC);
          }
          
          .rarity-criterion ul li {
            margin-bottom: 4px;
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

          /* Mobile-specific styles */
          .modal-overlay.mobile {
            padding: 0;
            align-items: flex-end;
          }

          .trading-card-modal.mobile-modal {
            width: 100%;
            max-width: 100%;
            max-height: 95vh;
            margin: 0;
            border-radius: 16px 16px 0 0;
            transform: translateY(0);
            animation: slideUpMobile 0.3s ease-out;
          }

          @keyframes slideUpMobile {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }

          @media (max-width: 768px) {
            .card-header {
              padding: 1rem;
              position: sticky;
              top: 0;
              z-index: 10;
            }
            
            .card-title {
              font-size: 1.1rem;
              line-height: 1.3;
            }
            
            .card-subtitle {
              font-size: 0.8rem;
              line-height: 1.2;
            }
            
            .card-controls {
              gap: 0.5rem;
            }
            
            .close-button {
              min-width: 44px;
              min-height: 44px;
              padding: 8px;
              font-size: 18px;
            }
            
            .nft-toggle-button {
              min-height: 44px;
              padding: 8px 12px;
              font-size: 0.8rem;
            }
            
            .card-media {
              padding: 1rem;
            }
            
            .media-element {
              max-height: 250px;
            }
            
            .metadata-panel {
              padding: 1rem;
            }
            
            .metadata-toggles {
              flex-direction: column;
              gap: 0.5rem;
              align-items: stretch;
            }
            
            .toggle-button {
              min-height: 44px;
              padding: 12px;
              font-size: 0.9rem;
              text-align: left;
            }
            
            .metadata-grid {
              grid-template-columns: 1fr;
              gap: 1rem;
            }
            
            .metadata-item {
              flex-direction: column;
              align-items: flex-start;
              gap: 0.25rem;
            }
            
            .card-footer {
              padding: 1rem;
              position: sticky;
              bottom: 0;
              background: white;
              border-top: 1px solid #e2e8f0;
            }
            
            .uploader-info {
              flex-direction: column;
              align-items: stretch;
              gap: 0.75rem;
            }
            
            .action-buttons {
              flex-direction: column;
              gap: 0.5rem;
            }
            
            .action-buttons button {
              min-height: 44px;
              font-size: 0.9rem;
            }

            /* Mobile NFT Panel */
            .nft-panel {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              width: 100%;
              height: 100%;
              border-radius: 0;
              transform: translateX(0);
              border-left: none;
              border-top: 1px solid #e2e8f0;
            }

            .nft-panel-header {
              padding: 1rem;
              min-height: 60px;
            }

            .nft-panel-close {
              min-width: 44px;
              min-height: 44px;
            }
          }

          /* Touch targets for mobile */
          @media (max-width: 768px) {
            button, .clickable {
              min-height: 44px;
              min-width: 44px;
            }
          }
        `}</style>
      </div>
    </>
  );
});

MomentDetailModal.displayName = 'MomentDetailModal';

export default MomentDetailModal;