// src/components/Moment/MomentDetailModal.jsx
import React, { useState, memo } from 'react';
import { useAuth, API_BASE_URL } from '../Auth/AuthProvider';
import { styles } from '../../styles';
import { formatFileSize } from '../../utils';

const MomentDetailModal = memo(({ moment, onClose }) => {
  const { user } = useAuth();
  const isOwner = user && moment.user && user.id === moment.user._id;
  const [isEditing, setIsEditing] = useState(false);
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
    personalNote: moment.personalNote || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleDownload = () => {
    try {
      const link = document.createElement('a');
      link.href = moment.mediaUrl;
      link.download = moment.fileName || 'moment-file';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download file. Please try opening the link directly.');
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

  const inputStyle = isOwner && isEditing ? styles.input : styles.inputReadonly;

  return (
    <div style={styles.modal.overlay} onClick={onClose}>
      <div style={styles.modal.content} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modal.header}>
          <div>
            <h2 style={styles.modal.title}>Moment Details</h2>
            <p style={styles.modal.subtitle}>
              {isOwner ? 'Your moment details' : `Moment by ${moment.user?.displayName || 'Anonymous'}`}
            </p>
          </div>
          {isOwner && (
            <button
              onClick={() => {
                setIsEditing(!isEditing);
                setError('');
              }}
              style={isEditing ? styles.button.secondary : styles.button.primary}
            >
              {isEditing ? 'Cancel Edit' : 'Edit'}
            </button>
          )}
        </div>

        {error && (
          <div style={styles.message.error}>
            {error}
          </div>
        )}

        {/* Core Information */}
        <div style={styles.section.container}>
          <h3 style={styles.section.title}>📝 Core Information</h3>
          
          <div style={styles.section.grid}>
            <div>
              <label style={styles.label}>Song Name</label>
              <input type="text" value={moment.songName || ''} readOnly style={styles.inputReadonly} />
            </div>
            
            <div>
              <label style={styles.label}>Set Name</label>
              <input
                type="text"
                value={isEditing ? editedData.setName : (moment.setName || '')}
                readOnly={!isEditing}
                onChange={(e) => isEditing && setEditedData({...editedData, setName: e.target.value})}
                style={inputStyle}
                placeholder="e.g., Encore, Set 1"
              />
            </div>
          </div>

          <div style={styles.section.grid}>
            <div>
              <label style={styles.label}>Venue</label>
              <input type="text" value={moment.venueName || ''} readOnly style={styles.inputReadonly} />
            </div>
            
            <div>
              <label style={styles.label}>Location</label>
              <input 
                type="text" 
                value={`${moment.venueCity}${moment.venueCountry ? ', ' + moment.venueCountry : ''}`} 
                readOnly 
                style={styles.inputReadonly} 
              />
            </div>
          </div>
        </div>

        {/* Moment Details */}
        <div style={styles.section.container}>
          <h3 style={styles.section.title}>🎭 Moment Details</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={styles.label}>Description</label>
            <textarea
              value={isEditing ? editedData.momentDescription : (moment.momentDescription || '')}
              readOnly={!isEditing}
              onChange={(e) => isEditing && setEditedData({...editedData, momentDescription: e.target.value})}
              style={isOwner && isEditing ? styles.textarea : {...styles.textarea, backgroundColor: '#f5f5f5'}}
              placeholder="Describe what happens in this moment"
            />
          </div>

          <div style={styles.section.grid}>
            <div>
              <label style={styles.label}>Type</label>
              {isEditing ? (
                <select
                  value={editedData.momentType}
                  onChange={(e) => setEditedData({...editedData, momentType: e.target.value})}
                  style={styles.input}
                >
                  <option value="performance">Performance</option>
                  <option value="crowd">Crowd Reaction</option>
                  <option value="backstage">Backstage</option>
                  <option value="arrival">Band Arrival</option>
                  <option value="interaction">Artist-Fan Interaction</option>
                </select>
              ) : (
                <input type="text" value={moment.momentType || ''} readOnly style={styles.inputReadonly} />
              )}
            </div>
            
            <div>
              <label style={styles.label}>Quality</label>
              <input 
                type="text" 
                value={`Audio: ${moment.audioQuality || 'N/A'}, Video: ${moment.videoQuality || 'N/A'}`} 
                readOnly 
                style={styles.inputReadonly} 
              />
            </div>
          </div>
        </div>

        {/* Media File */}
        <div style={styles.section.container}>
          <h3 style={styles.section.title}>📁 Media File</h3>
          
          <div style={styles.mediaDisplay.container}>
            <p style={styles.mediaDisplay.fileName}>{moment.fileName}</p>
            <p style={styles.mediaDisplay.fileInfo}>
              {moment.fileSize ? formatFileSize(moment.fileSize) : 'Unknown size'} • {moment.mediaType}
            </p>
            <button onClick={handleDownload} style={styles.button.success}>
              Open Decentralized Storage Link
            </button>
            <p style={styles.mediaDisplay.warning}>
              ⚠️ This will open/download the file from permanent storage
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={styles.footerActions.container}>
          <button onClick={onClose} style={styles.button.secondary}>
            Close
          </button>
          
          {isOwner && isEditing && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={saving ? styles.button.disabled : styles.button.success}
            >
              {saving ? (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ 
                    width: '16px', 
                    height: '16px', 
                    border: '2px solid #fff',
                    borderTop: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginRight: '8px'
                  }}></div>
                  Saving...
                </div>
              ) : (
                'Save Changes'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

MomentDetailModal.displayName = 'MomentDetailModal';

export default MomentDetailModal;