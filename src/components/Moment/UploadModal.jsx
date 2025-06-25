// src/components/Moment/UploadModal.jsx
import React, { useState, memo } from 'react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import { styles } from '../../styles';

const UploadModal = memo(({ uploadingMoment, onClose }) => {
  const [step, setStep] = useState('form');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [uploadStage, setUploadStage] = useState('');
  
  const [formData, setFormData] = useState({
    songName: uploadingMoment?.songName || '',
    venueName: uploadingMoment?.venueName || '',
    venueCity: uploadingMoment?.venueCity || '',
    venueCountry: uploadingMoment?.venueCountry || '',
    performanceDate: uploadingMoment?.performanceDate || '',
    setName: uploadingMoment?.setName || '',
    songPosition: uploadingMoment?.songPosition || 1,
    personalNote: '',
    momentDescription: '',
    emotionalTags: '',
    specialOccasion: '',
    audioQuality: 'good',
    videoQuality: 'good',
    momentType: 'performance',
    instruments: '',
    guestAppearances: '',
    crowdReaction: '',
    uniqueElements: ''
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    const maxSize = 6 * 1024 * 1024 * 1024; // 6GB
    if (selectedFile.size > maxSize) {
      setError('File too large. Maximum size is 6GB.');
      return;
    }

    setFile(selectedFile);
    setError('');
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    if (!formData.songName || !formData.venueName || !formData.venueCity) {
      setError('Please fill in required fields: Song Name, Venue, and City');
      return;
    }

    setStep('uploading');
    setUploading(true);
    setError('');
    setUploadProgress(0);
    setUploadStage('Preparing upload...');

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Please log in to upload moments');
      }

      setUploadProgress(10);
      setUploadStage('Uploading to decentralized storage...');

      const fileResponse = await fetch(`${API_BASE_URL}/upload-file`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formDataUpload
      });

      if (!fileResponse.ok) {
        const errorData = await fileResponse.json();
        throw new Error(errorData.error || 'File upload failed');
      }

      const fileData = await fileResponse.json();
      setUploadProgress(70);
      setUploadStage('Saving moment metadata...');

      const momentPayload = {
        performanceId: uploadingMoment.performanceId,
        performanceDate: formData.performanceDate,
        venueName: formData.venueName,
        venueCity: formData.venueCity,
        venueCountry: formData.venueCountry,
        songName: formData.songName,
        setName: formData.setName,
        songPosition: formData.songPosition,
        mediaUrl: fileData.fileUri,
        mediaType: file.type.startsWith('video/') ? 'video' : 
                   file.type.startsWith('audio/') ? 'audio' : 
                   file.type.startsWith('image/') ? 'image' : 'unknown',
        fileName: file.name,
        fileSize: file.size,
        personalNote: formData.personalNote,
        momentDescription: formData.momentDescription,
        emotionalTags: formData.emotionalTags,
        specialOccasion: formData.specialOccasion,
        audioQuality: formData.audioQuality,
        videoQuality: formData.videoQuality,
        momentType: formData.momentType,
        instruments: formData.instruments,
        guestAppearances: formData.guestAppearances,
        crowdReaction: formData.crowdReaction,
        uniqueElements: formData.uniqueElements
      };

      const momentResponse = await fetch(`${API_BASE_URL}/upload-moment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(momentPayload)
      });

      if (!momentResponse.ok) {
        const errorData = await momentResponse.json();
        throw new Error(errorData.error || 'Failed to save moment');
      }

      setUploadProgress(100);
      setUploadStage('Complete!');
      setStep('success');

      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 3000);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
      setStep('form');
      setUploadStage('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.modal.overlay} onClick={() => step === 'form' && onClose()}>
      <div style={styles.modal.content} onClick={(e) => e.stopPropagation()}>
        {step === 'form' && (
          <UploadForm 
            formData={formData}
            file={file}
            error={error}
            onInputChange={handleInputChange}
            onFileSelect={handleFileSelect}
            onUpload={handleUpload}
            onClose={onClose}
          />
        )}

        {step === 'uploading' && (
          <UploadProgress 
            uploadProgress={uploadProgress}
            uploadStage={uploadStage}
          />
        )}

        {step === 'success' && (
          <UploadSuccess />
        )}
      </div>
    </div>
  );
});

UploadModal.displayName = 'UploadModal';

// Sub-components
const UploadForm = memo(({ 
  formData, 
  file, 
  error, 
  onInputChange, 
  onFileSelect, 
  onUpload, 
  onClose 
}) => (
  <div>
    <h2 style={styles.modal.title}>🎵 Upload a UMO Moment</h2>
    <p style={styles.modal.subtitle}>Create a detailed record of this musical moment for NFT metadata</p>

    {error && <div style={styles.message.error}>{error}</div>}

    {/* Core Information */}
    <div style={styles.section.container}>
      <h3 style={styles.section.title}>📝 Core Information</h3>
      
      <div style={styles.section.grid}>
        <div>
          <label style={styles.label}>Song Name *</label>
          <input
            type="text"
            value={formData.songName}
            onChange={(e) => onInputChange('songName', e.target.value)}
            style={styles.input}
            placeholder="Enter song name"
          />
        </div>
        
        <div>
          <label style={styles.label}>Set Name</label>
          <input
            type="text"
            value={formData.setName}
            onChange={(e) => onInputChange('setName', e.target.value)}
            style={styles.input}
            placeholder="e.g., Encore, Set 1"
          />
        </div>
      </div>

      <div style={styles.section.grid}>
        <div>
          <label style={styles.label}>Venue Name *</label>
          <input
            type="text"
            value={formData.venueName}
            onChange={(e) => onInputChange('venueName', e.target.value)}
            style={styles.input}
          />
        </div>
        
        <div>
          <label style={styles.label}>City *</label>
          <input
            type="text"
            value={formData.venueCity}
            onChange={(e) => onInputChange('venueCity', e.target.value)}
            style={styles.input}
          />
        </div>
      </div>
    </div>

    {/* Moment Details */}
    <div style={styles.section.container}>
      <h3 style={styles.section.title}>🎭 Moment Details</h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <label style={styles.label}>Moment Description</label>
        <textarea
          value={formData.momentDescription}
          onChange={(e) => onInputChange('momentDescription', e.target.value)}
          style={styles.textarea}
          placeholder="Describe what happens in this moment"
        />
      </div>

      <div style={styles.section.grid}>
        <div>
          <label style={styles.label}>Moment Type</label>
          <select
            value={formData.momentType}
            onChange={(e) => onInputChange('momentType', e.target.value)}
            style={styles.input}
          >
            <option value="performance">Performance</option>
            <option value="crowd">Crowd Reaction</option>
            <option value="backstage">Backstage</option>
            <option value="arrival">Band Arrival</option>
            <option value="interaction">Artist-Fan Interaction</option>
          </select>
        </div>
        
        <div>
          <label style={styles.label}>Emotional Tags</label>
          <input
            type="text"
            value={formData.emotionalTags}
            onChange={(e) => onInputChange('emotionalTags', e.target.value)}
            style={styles.input}
            placeholder="energetic, emotional, epic"
          />
        </div>
      </div>
    </div>

    {/* File Upload */}
    <div style={styles.section.container}>
      <h3 style={styles.section.title}>📁 Media File</h3>
      
      <div style={styles.fileUpload.container}>
        <input
          type="file"
          id="enhanced-file-upload"
          style={{ display: 'none' }}
          accept="video/*,audio/*,image/*"
          onChange={onFileSelect}
        />
        <label htmlFor="enhanced-file-upload" style={{ cursor: 'pointer' }}>
          {!file ? (
            <div>
              <div style={styles.fileUpload.icon}>📁</div>
              <p style={styles.fileUpload.text}>Click to select media file</p>
              <p style={styles.fileUpload.subtext}>Video, Audio, or Image files up to 6GB</p>
            </div>
          ) : (
            <div>
              <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{file.name}</p>
              <p style={{ color: '#6b7280' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          )}
        </label>
      </div>
    </div>

    {/* Actions */}
    <div style={styles.footerActions.container}>
      <button onClick={onClose} style={styles.button.secondary}>Cancel</button>
      
      <button
        onClick={onUpload}
        disabled={!file || !formData.songName || !formData.venueName || !formData.venueCity}
        style={(!file || !formData.songName || !formData.venueName || !formData.venueCity) 
          ? styles.button.disabled 
          : styles.button.primary}
      >
        🚀 Create NFT-Ready Moment
      </button>
    </div>
  </div>
));

UploadForm.displayName = 'UploadForm';

const UploadProgress = memo(({ uploadProgress, uploadStage }) => (
  <div style={{ textAlign: 'center', padding: '2rem' }}>
    <h2 style={styles.modal.title}>🚀 Creating Your NFT-Ready UMO Moment</h2>
    
    <div style={{
      backgroundColor: '#f3f4f6',
      borderRadius: '8px',
      height: '8px',
      marginBottom: '1rem',
      overflow: 'hidden'
    }}>
      <div
        style={{
          backgroundColor: '#3b82f6',
          height: '100%',
          width: `${uploadProgress}%`,
          transition: 'width 0.3s ease'
        }}
      />
    </div>
    
    <p style={{ color: '#6b7280', fontSize: '1rem', marginBottom: '0.5rem' }}>
      {uploadProgress}% Complete
    </p>
    <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
      {uploadStage}
    </p>
  </div>
));

UploadProgress.displayName = 'UploadProgress';

const UploadSuccess = memo(() => (
  <div style={{ textAlign: 'center', padding: '2rem' }}>
    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
    <h2 style={{ ...styles.modal.title, color: '#059669' }}>
      NFT-Ready UMO Moment Created!
    </h2>
    <p style={{ color: '#6b7280' }}>Your UMO moment is ready for NFT minting.</p>
  </div>
));

UploadSuccess.displayName = 'UploadSuccess';

export default UploadModal;