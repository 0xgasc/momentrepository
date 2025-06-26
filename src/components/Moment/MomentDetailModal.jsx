// src/components/Moment/MomentDetailModal.jsx
import React, { useState, memo } from 'react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';
import { formatFileSize } from '../../utils';

const MomentDetailModal = memo(({ moment, onClose }) => {
  const { user } = useAuth();
  const isOwner = user && moment.user && user.id === moment.user._id;
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
    const percentage = Math.round((score / 7) * 100); // Changed from 200 to 7
    
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

        {/* Card Content */}
        <div className="card-content">
          {/* Empty Fields Toggle */}
          {!isEditing && (
            <div className="empty-fields-toggle">
              <button
                onClick={() => setShowEmptyFields(!showEmptyFields)}
                className="toggle-button"
              >
                <span className="toggle-text">
                  {showEmptyFields ? 'Hide' : 'Show'} empty fields
                </span>
                <span className="toggle-icon">{showEmptyFields ? '👁️‍🗨️' : '👁️'}</span>
              </button>
            </div>
          )}

          {/* Basic Info */}
          <div className="info-section">
            <div className="info-row">
              <span className="info-label">Set:</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editedData.setName}
                  onChange={(e) => setEditedData({...editedData, setName: e.target.value})}
                  className="edit-input"
                  placeholder="e.g., Encore, Set 1"
                />
              ) : (
                <span className="info-value">{moment.setName || 'Main Set'}</span>
              )}
            </div>

            {moment.songPosition && (
              <div className="info-row">
                <span className="info-label">Song Position:</span>
                <span className="info-value">#{moment.songPosition}</span>
              </div>
            )}

            <div className="info-row">
              <span className="info-label">Type:</span>
              {isEditing ? (
                <select
                  value={editedData.momentType}
                  onChange={(e) => setEditedData({...editedData, momentType: e.target.value})}
                  className="edit-select"
                >
                  <option value="performance">Performance</option>
                  <option value="crowd">Crowd Reaction</option>
                  <option value="backstage">Backstage</option>
                  <option value="arrival">Band Arrival</option>
                  <option value="interaction">Artist-Fan Interaction</option>
                </select>
              ) : (
                <span className="info-value capitalize">{moment.momentType}</span>
              )}
            </div>

            <div className="info-row">
              <span className="info-label">Quality:</span>
              <span className="info-value">
                Audio: {moment.audioQuality || 'N/A'} • Video: {moment.videoQuality || 'N/A'}
              </span>
            </div>

            {(moment.specialOccasion || isEditing || showEmptyFields) && (
              <div className="info-row">
                <span className="info-label">Special Occasion:</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.specialOccasion}
                    onChange={(e) => setEditedData({...editedData, specialOccasion: e.target.value})}
                    className="edit-input"
                    placeholder="Birthday show, last song, encore"
                  />
                ) : (
                  <span className="info-value">
                    {moment.specialOccasion || <em className="text-gray-400">Not specified</em>}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          {(moment.momentDescription || isEditing || showEmptyFields) && (
            <div className="description-section">
              <span className="section-label">Description</span>
              {isEditing ? (
                <textarea
                  value={editedData.momentDescription}
                  onChange={(e) => setEditedData({...editedData, momentDescription: e.target.value})}
                  className="edit-textarea"
                  placeholder="Describe what happens in this moment"
                />
              ) : (
                <p className="description-text">
                  {moment.momentDescription || <em className="text-gray-400">No description provided</em>}
                </p>
              )}
            </div>
          )}

          {/* Tags */}
          {(moment.emotionalTags || isEditing || showEmptyFields) && (
            <div className="tags-section">
              <span className="section-label">Tags</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editedData.emotionalTags}
                  onChange={(e) => setEditedData({...editedData, emotionalTags: e.target.value})}
                  className="edit-input"
                  placeholder="energetic, emotional, epic"
                />
              ) : moment.emotionalTags ? (
                <div className="tags-display">
                  {moment.emotionalTags.split(',').map((tag, index) => (
                    <span key={index} className="tag">{tag.trim()}</span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm italic">No tags added</p>
              )}
            </div>
          )}

          {/* Musical Details */}
          {((moment.instruments || moment.guestAppearances) || isEditing || showEmptyFields) && (
            <div className="description-section">
              <span className="section-label">Musical Details</span>
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editedData.instruments}
                    onChange={(e) => setEditedData({...editedData, instruments: e.target.value})}
                    className="edit-input"
                    placeholder="Instruments: guitar solo, drum break, piano"
                  />
                  <input
                    type="text"
                    value={editedData.guestAppearances}
                    onChange={(e) => setEditedData({...editedData, guestAppearances: e.target.value})}
                    className="edit-input"
                    placeholder="Guest appearances"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  {(moment.instruments || showEmptyFields) && (
                    <p className="description-text">
                      <span className="font-medium">Instruments:</span> {moment.instruments || <em className="text-gray-400">None specified</em>}
                    </p>
                  )}
                  {(moment.guestAppearances || showEmptyFields) && (
                    <p className="description-text">
                      <span className="font-medium">Guests:</span> {moment.guestAppearances || <em className="text-gray-400">None specified</em>}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Crowd & Atmosphere */}
          {((moment.crowdReaction || moment.uniqueElements) || isEditing || showEmptyFields) && (
            <div className="description-section">
              <span className="section-label">Crowd & Atmosphere</span>
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editedData.crowdReaction}
                    onChange={(e) => setEditedData({...editedData, crowdReaction: e.target.value})}
                    className="edit-input"
                    placeholder="Crowd reaction description"
                  />
                  <input
                    type="text"
                    value={editedData.uniqueElements}
                    onChange={(e) => setEditedData({...editedData, uniqueElements: e.target.value})}
                    className="edit-input"
                    placeholder="Unique elements of this moment"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  {(moment.crowdReaction || showEmptyFields) && (
                    <p className="description-text">
                      <span className="font-medium">Crowd:</span> {moment.crowdReaction || <em className="text-gray-400">No reaction noted</em>}
                    </p>
                  )}
                  {(moment.uniqueElements || showEmptyFields) && (
                    <p className="description-text">
                      <span className="font-medium">Special:</span> {moment.uniqueElements || <em className="text-gray-400">Nothing unique noted</em>}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Personal Note */}
          {(moment.personalNote || isEditing || showEmptyFields) && (
            <div className="description-section">
              <span className="section-label">Personal Note</span>
              {isEditing ? (
                <textarea
                  value={editedData.personalNote}
                  onChange={(e) => setEditedData({...editedData, personalNote: e.target.value})}
                  className="edit-textarea"
                  placeholder="Your personal thoughts about this moment"
                />
              ) : (
                <p className="description-text italic">
                  {moment.personalNote || <em className="text-gray-400">No personal note added</em>}
                </p>
              )}
            </div>
          )}

          {/* File Details - Collapsible */}
          <div className="description-section">
            <button 
              onClick={() => setShowFileDetails(!showFileDetails)}
              className="file-details-toggle"
            >
              <span className="section-label">File Details</span>
              <span className="toggle-icon">{showFileDetails ? '▼' : '▶'}</span>
            </button>
            
            {showFileDetails && (
              <div className="file-metadata">
                <div className="metadata-row">
                  <span className="metadata-label">Quality:</span>
                  <span className="metadata-value">
                    Audio: {moment.audioQuality || 'N/A'} • Video: {moment.videoQuality || 'N/A'}
                  </span>
                </div>
                <div className="metadata-row">
                  <span className="metadata-label">Filename:</span>
                  <span className="metadata-value">{moment.fileName || 'Unknown'}</span>
                </div>
                <div className="metadata-row">
                  <span className="metadata-label">Size:</span>
                  <span className="metadata-value">
                    {moment.fileSize ? formatFileSize(moment.fileSize) : 'Unknown'}
                  </span>
                </div>
                <div className="metadata-row">
                  <span className="metadata-label">Type:</span>
                  <span className="metadata-value">{moment.mediaType || 'Unknown'}</span>
                </div>
                <div className="metadata-row">
                  <span className="metadata-label">Uploaded:</span>
                  <span className="metadata-value">
                    {moment.createdAt ? new Date(moment.createdAt).toLocaleDateString() : 'Unknown'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

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

          {isOwner && isEditing && (
            <button
              onClick={handleSave}
              disabled={saving}
              className={`save-button ${saving ? 'saving' : ''}`}
            >
              {saving ? (
                <div className="saving-indicator">
                  <div className="spinner"></div>
                  Saving...
                </div>
              ) : (
                'Save Changes'
              )}
            </button>
          )}
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

        .rarity-emoji {
          font-size: 0.875rem;
        }

        .rarity-text {
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .rarity-score {
          opacity: 0.8;
          font-size: 0.7rem;
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

        .edit-button.editing {
          background: rgba(239, 68, 68, 0.3);
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

        .media-loading, .media-error {
          text-align: center;
          padding: 2rem;
        }

        .media-element {
          transition: opacity 0.3s ease;
        }

        .media-element.loading {
          opacity: 0;
          position: absolute;
          top: 0;
          left: 0;
        }

        .media-element.loaded {
          opacity: 1;
          position: relative;
        }

        .audio-placeholder {
          background: #f1f5f9;
          border: 2px dashed #cbd5e1;
          border-radius: 8px;
        }

        .card-content {
          padding: 1.5rem;
        }

        .empty-fields-toggle {
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e2e8f0;
        }

        .toggle-button {
          background: none;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 0.5rem 0.75rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #6b7280;
          font-size: 0.8rem;
          transition: all 0.2s ease;
        }

        .toggle-button:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .toggle-text {
          font-weight: 500;
        }

        .info-section {
          margin-bottom: 1.5rem;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .info-label {
          font-weight: 600;
          color: #4b5563;
          font-size: 0.85rem;
        }

        .info-value {
          color: #1f2937;
          font-size: 0.85rem;
          text-align: right;
        }

        .info-value.capitalize {
          text-transform: capitalize;
        }

        .description-section, .tags-section {
          margin-bottom: 1.5rem;
        }

        .section-label {
          display: block;
          font-weight: 600;
          color: #4b5563;
          font-size: 0.85rem;
          margin-bottom: 0.5rem;
        }

        .description-text {
          color: #1f2937;
          font-size: 0.9rem;
          line-height: 1.5;
          margin: 0;
        }

        .description-text.italic {
          font-style: italic;
          color: #6b7280;
        }

        .space-y-1 > * + * {
          margin-top: 0.25rem;
        }

        .space-y-2 > * + * {
          margin-top: 0.5rem;
        }

        .font-medium {
          font-weight: 500;
        }

        .text-gray-400 {
          color: #9ca3af;
        }

        .text-sm {
          font-size: 0.875rem;
        }

        .tags-display {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .tag {
          background: #e0e7ff;
          color: #3730a3;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .edit-input, .edit-select, .edit-textarea {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.85rem;
          background: white;
        }

        .edit-input:focus, .edit-select:focus, .edit-textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .edit-textarea {
          min-height: 60px;
          resize: vertical;
        }

        .file-details-toggle {
          background: none;
          border: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          cursor: pointer;
          padding: 0;
          margin-bottom: 0.5rem;
        }

        .file-details-toggle:hover {
          opacity: 0.8;
        }

        .toggle-icon {
          color: #6b7280;
          font-size: 0.75rem;
          transition: transform 0.2s ease;
        }

        .file-metadata {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 1rem;
          margin-top: 0.5rem;
        }

        .metadata-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .metadata-row:last-child {
          margin-bottom: 0;
        }

        .metadata-label {
          font-weight: 500;
          color: #6b7280;
          font-size: 0.8rem;
        }

        .metadata-value {
          color: #1f2937;
          font-size: 0.8rem;
          text-align: right;
          word-break: break-word;
          max-width: 60%;
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

        .save-button {
          background: #10b981;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 600;
          width: 100%;
          margin-top: 1rem;
          transition: background-color 0.2s ease;
        }

        .save-button:hover:not(.saving) {
          background: #059669;
        }

        .save-button.saving {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .saving-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Mobile responsive */
        @media (max-width: 640px) {
          .modal-overlay {
            padding: 0;
            align-items: flex-start;
          }

          .trading-card-modal {
            max-width: 100%;
            max-height: 100vh;
            border-radius: 0;
            margin: 0;
          }

          .card-header {
            border-radius: 0;
            padding: 1rem;
          }

          .card-title {
            font-size: 1.25rem;
          }

          .card-controls {
            margin-left: 0.5rem;
          }

          .card-content {
            padding: 1rem;
          }

          .card-footer {
            border-radius: 0;
            flex-direction: column;
            align-items: stretch;
            text-align: center;
          }

          .download-section {
            text-align: center;
          }

          .rarity-section {
            padding: 1rem;
          }

          .rarity-details {
            gap: 0.5rem;
          }

          .rarity-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.25rem;
          }

          .rarity-progress {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
});

MomentDetailModal.displayName = 'MomentDetailModal';

export default MomentDetailModal;