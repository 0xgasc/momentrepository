// src/components/Moment/UploadModal.jsx - SIMPLE VERSION with your requested field changes
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
  const [showPerformanceDetails, setShowPerformanceDetails] = useState(false);
  const [showQualityAssessment, setShowQualityAssessment] = useState(false);
  
  const [formData, setFormData] = useState({
    songName: uploadingMoment?.songName || '',
    venueName: uploadingMoment?.venueName || '',
    venueCity: uploadingMoment?.venueCity || '',
    venueCountry: uploadingMoment?.venueCountry || '',
    performanceDate: uploadingMoment?.performanceDate || '',
    setName: 'Main Set', // Default to Main Set
    songPosition: uploadingMoment?.songPosition || 1,
    
    // Metadata fields
    momentDescription: '',
    emotionalTags: [], // Array for multi-select
    specialOccasion: '',
    instruments: [], // Array for multi-select
    crowdReaction: '',
    uniqueElements: '',
    personalNote: '',
    
    // Quality and type
    audioQuality: 'good',
    videoQuality: 'good',
    momentType: 'performance'
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle multi-select for arrays
  const handleArrayToggle = (field, option) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(option) 
        ? prev[field].filter(item => item !== option)
        : [...prev[field], option]
    }));
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

      // Convert arrays to strings for backend
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
        
        // Convert arrays to strings for backend
        momentDescription: formData.momentDescription,
        emotionalTags: formData.emotionalTags.join(', '),
        specialOccasion: formData.specialOccasion,
        instruments: formData.instruments.join(', '),
        crowdReaction: formData.crowdReaction,
        uniqueElements: formData.uniqueElements,
        personalNote: formData.personalNote,
        
        audioQuality: formData.audioQuality,
        videoQuality: formData.videoQuality,
        momentType: formData.momentType
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
      <div style={{...styles.modal.content, maxWidth: '600px', maxHeight: '90vh', overflow: 'auto'}} onClick={(e) => e.stopPropagation()}>
        {step === 'form' && (
          <SimpleUploadForm 
            formData={formData}
            file={file}
            error={error}
            showPerformanceDetails={showPerformanceDetails}
            setShowPerformanceDetails={setShowPerformanceDetails}
            showQualityAssessment={showQualityAssessment}
            setShowQualityAssessment={setShowQualityAssessment}
            onInputChange={handleInputChange}
            onArrayToggle={handleArrayToggle}
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

const SimpleUploadForm = memo(({ 
  formData, 
  file, 
  error,
  showPerformanceDetails,
  setShowPerformanceDetails,
  showQualityAssessment,
  setShowQualityAssessment,
  onInputChange, 
  onArrayToggle,
  onFileSelect, 
  onUpload, 
  onClose
}) => {
  // Predefined options
  const emotionalOptions = [
    'Energetic', 'Emotional', 'Epic', 'Chill', 'Intense', 'Groovy', 
    'Dreamy', 'Raw', 'Powerful', 'Intimate', 'Psychedelic', 'Melancholic'
  ];

  const specialOccasionOptions = [
    '', 'Birthday show', 'Festival debut', 'Last song', 'Encore', 'First show of tour',
    'Last show of tour', 'Album release party', 'Special guest appearance', 'Acoustic set',
    'Hometown show', 'New Year\'s Eve', 'Holiday show', 'Tribute performance'
  ];

  const instrumentOptions = [
    'Guitar solo', 'Bass solo', 'Drum solo', 'Keyboard/synth', 'Saxophone', 'Trumpet',
    'Harmonica', 'Violin', 'Flute', 'Percussion', 'Backup vocals', 'Extended jam'
  ];

  const crowdReactionOptions = [
    '', 'Explosive energy', 'Wild dancing', 'Massive sing-along', 'Standing ovation',
    'Dead silence in awe', 'Everyone jumping', 'Swaying together', 'Phone lights up',
    'Crowd went crazy', 'Emotional tears', 'Moderate response', 'Quiet appreciation'
  ];

  const uniqueElementOptions = [
    '', 'First time played live', 'Rarely played song', 'Extended jam session',
    'Acoustic version', 'Cover song', 'Song dedication', 'Improvised section',
    'Technical difficulties', 'Unexpected guest', 'Fan interaction', 'Band banter',
    'Sound experiment', 'New arrangement'
  ];

  return (
    <div>
      <h2 style={styles.modal.title}>🎵 Upload UMO Moment</h2>
      <p style={styles.modal.subtitle}>Create a detailed record of this musical moment</p>

      {error && <div style={styles.message.error}>{error}</div>}

      {/* Performance Information (Non-editable) */}
      <div style={styles.section.container}>
        <h3 style={styles.section.title}>📝 Performance Information</h3>
        
        <div style={styles.section.grid}>
          <div>
            <label style={styles.label}>Song Name</label>
            <input
              type="text"
              value={formData.songName}
              style={{...styles.input, backgroundColor: '#f9fafb', cursor: 'not-allowed'}}
              readOnly
            />
          </div>
          
          <div>
            <label style={styles.label}>Performance Date</label>
            <input
              type="text"
              value={formData.performanceDate}
              style={{...styles.input, backgroundColor: '#f9fafb', cursor: 'not-allowed'}}
              readOnly
            />
          </div>
        </div>

        <div style={styles.section.grid}>
          <div>
            <label style={styles.label}>Venue</label>
            <input
              type="text"
              value={formData.venueName}
              style={{...styles.input, backgroundColor: '#f9fafb', cursor: 'not-allowed'}}
              readOnly
            />
          </div>
          
          <div>
            <label style={styles.label}>City</label>
            <input
              type="text"
              value={formData.venueCity}
              style={{...styles.input, backgroundColor: '#f9fafb', cursor: 'not-allowed'}}
              readOnly
            />
          </div>
        </div>

        <div style={styles.section.grid}>
          <div>
            <label style={styles.label}>Set Name</label>
            <select
              value={formData.setName}
              onChange={(e) => onInputChange('setName', e.target.value)}
              style={styles.input}
            >
              <option value="Main Set">Main Set</option>
              <option value="Encore">Encore</option>
            </select>
          </div>
          
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

        {/* Multi-select Emotional Tags */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={styles.label}>Emotional Tags (Select Multiple)</label>
          <div style={{
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            padding: '8px',
            minHeight: '60px',
            backgroundColor: 'white',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px'
          }}>
            {emotionalOptions.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => onArrayToggle('emotionalTags', option)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  border: '1px solid #d1d5db',
                  backgroundColor: formData.emotionalTags.includes(option) ? '#3b82f6' : '#f9fafb',
                  color: formData.emotionalTags.includes(option) ? 'white' : '#374151',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {option}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
            Selected: {formData.emotionalTags.join(', ') || 'None'}
          </div>
        </div>

        <div style={styles.section.grid}>
          <div>
            <label style={styles.label}>Special Occasion</label>
            <select
              value={formData.specialOccasion}
              onChange={(e) => onInputChange('specialOccasion', e.target.value)}
              style={styles.input}
            >
              {specialOccasionOptions.map(option => (
                <option key={option} value={option}>
                  {option || 'None'}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={styles.label}>Crowd Reaction</label>
            <select
              value={formData.crowdReaction}
              onChange={(e) => onInputChange('crowdReaction', e.target.value)}
              style={styles.input}
            >
              {crowdReactionOptions.map(option => (
                <option key={option} value={option}>
                  {option || 'Select reaction...'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Performance Details - Collapsible */}
      <div style={styles.section.container}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={styles.section.title}>🎪 Performance Details</h3>
          <button
            type="button"
            onClick={() => setShowPerformanceDetails(!showPerformanceDetails)}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: '#f9fafb',
              color: '#374151',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {showPerformanceDetails ? 'Hide Details' : 'Add Details'}
          </button>
        </div>
        
        {showPerformanceDetails && (
          <>
            {/* Multi-select Instruments */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={styles.label}>Featured Instruments (Select Multiple)</label>
              <div style={{
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '8px',
                minHeight: '60px',
                backgroundColor: 'white',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px'
              }}>
                {instrumentOptions.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onArrayToggle('instruments', option)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      border: '1px solid #d1d5db',
                      backgroundColor: formData.instruments.includes(option) ? '#10b981' : '#f9fafb',
                      color: formData.instruments.includes(option) ? 'white' : '#374151',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                Selected: {formData.instruments.join(', ') || 'None'}
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={styles.label}>Unique Elements</label>
              <select
                value={formData.uniqueElements}
                onChange={(e) => onInputChange('uniqueElements', e.target.value)}
                style={styles.input}
              >
                {uniqueElementOptions.map(option => (
                  <option key={option} value={option}>
                    {option || 'Select if applicable...'}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={styles.label}>Personal Note</label>
              <textarea
                value={formData.personalNote}
                onChange={(e) => onInputChange('personalNote', e.target.value)}
                style={styles.textarea}
                placeholder="Your personal memory or thoughts about this moment"
              />
            </div>
          </>
        )}
      </div>

      {/* Quality Assessment - Collapsible */}
      <div style={styles.section.container}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={styles.section.title}>🎥 Quality Assessment</h3>
          <button
            type="button"
            onClick={() => setShowQualityAssessment(!showQualityAssessment)}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: '#f9fafb',
              color: '#374151',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {showQualityAssessment ? 'Hide Assessment' : 'Add Assessment'}
          </button>
        </div>
        
        {showQualityAssessment && (
          <div style={styles.section.grid}>
            <div>
              <label style={styles.label}>Audio Quality</label>
              <select
                value={formData.audioQuality}
                onChange={(e) => onInputChange('audioQuality', e.target.value)}
                style={styles.input}
              >
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
            
            <div>
              <label style={styles.label}>Video Quality</label>
              <select
                value={formData.videoQuality}
                onChange={(e) => onInputChange('videoQuality', e.target.value)}
                style={styles.input}
              >
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* File Upload */}
      <div style={styles.section.container}>
        <h3 style={styles.section.title}>📁 Media File</h3>
        
        <div style={styles.fileUpload.container}>
          <input
            type="file"
            id="file-upload"
            style={{ display: 'none' }}
            accept="video/*,audio/*,image/*"
            onChange={onFileSelect}
          />
          <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
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
          🚀 Create Moment
        </button>
      </div>
    </div>
  );
});

SimpleUploadForm.displayName = 'SimpleUploadForm';

const UploadProgress = memo(({ uploadProgress, uploadStage }) => (
  <div style={{ textAlign: 'center', padding: '2rem' }}>
    <h2 style={styles.modal.title}>🚀 Creating Your UMO Moment</h2>
    
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
      UMO Moment Created!
    </h2>
    <p style={{ color: '#6b7280' }}>Your moment with metadata is ready for NFT minting.</p>
  </div>
));

UploadSuccess.displayName = 'UploadSuccess';

export default UploadModal;