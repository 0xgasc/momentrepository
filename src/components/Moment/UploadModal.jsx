// src/components/Moment/UploadModal.jsx - CLEAN VERSION with content-type-first approach
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
    // ✅ FIRST: Content type determines everything else
    contentType: 'song', // song, intro, jam, crowd, other
    
    // Core fields (always needed)
    songName: uploadingMoment?.songName || '',
    venueName: uploadingMoment?.venueName || '',
    venueCity: uploadingMoment?.venueCity || '',
    venueCountry: uploadingMoment?.venueCountry || '',
    performanceDate: uploadingMoment?.performanceDate || '',
    
    // Song-specific fields
    setName: 'Main Set',
    songPosition: uploadingMoment?.songPosition || 1,
    
    // Metadata (adapted based on content type)
    momentDescription: '',
    emotionalTags: [],
    specialOccasion: '',
    instruments: [],
    crowdReaction: '',
    uniqueElements: '',
    personalNote: '',
    
    // Quality
    audioQuality: 'good',
    videoQuality: 'good',
    momentType: 'performance'
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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
      setError('Please fill in required fields: Content Name, Venue, and City');
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
        momentType: formData.momentType,
        
        // ✅ CRITICAL: Include content type
        contentType: formData.contentType
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
          <CleanUploadForm 
            formData={formData}
            file={file}
            error={error}
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

// ✅ CLEAN: Content-type-first upload form
const CleanUploadForm = memo(({ 
  formData, 
  file, 
  error,
  onInputChange, 
  onArrayToggle,
  onFileSelect, 
  onUpload, 
  onClose
}) => {
  
  // ✅ Content type definitions
  const contentTypes = {
    song: {
      label: '🎵 Song Performance',
      description: 'A complete or partial song performance',
      nameLabel: 'Song Name',
      namePlaceholder: 'Enter the song name...',
      showPerformanceStats: true,
      showFullMetadata: true,
      rarityNote: 'Songs get full rarity calculation based on performance frequency and metadata'
    },
    intro: {
      label: '🎭 Intro/Outro',
      description: 'Performance intro, outro, or transition',
      nameLabel: 'Content Name',
      namePlaceholder: 'e.g., "Intro", "Outro", "Set Break"',
      showPerformanceStats: false,
      showFullMetadata: false,
      rarityNote: 'Intro/outro content receives lower rarity scores (1-2.5/7)'
    },
    jam: {
      label: '🎸 Jam/Improv',
      description: 'Improvised or extended musical section',
      nameLabel: 'Jam Description',
      namePlaceholder: 'e.g., "Guitar Jam", "Extended Outro", "Free Improv"',
      showPerformanceStats: false,
      showFullMetadata: true,
      rarityNote: 'Jam content receives moderate rarity scores (1-3/7)'
    },
    crowd: {
      label: '👥 Crowd Moment',
      description: 'Audience reaction or interaction',
      nameLabel: 'Crowd Moment',
      namePlaceholder: 'e.g., "Crowd Singing", "Standing Ovation", "Audience Reaction"',
      showPerformanceStats: false,
      showFullMetadata: false,
      rarityNote: 'Crowd content receives lower rarity scores (1-2.5/7)'
    },
    other: {
      label: '🎪 Other Content',
      description: 'Soundcheck, banter, or other content',
      nameLabel: 'Content Description',
      namePlaceholder: 'e.g., "Soundcheck", "Band Banter", "Technical Issue"',
      showPerformanceStats: false,
      showFullMetadata: false,
      rarityNote: 'Other content receives the lowest rarity scores (0.5-2/7)'
    }
  };

  const currentType = contentTypes[formData.contentType];

  // Simplified options based on content type
  const getEmotionalOptions = () => {
    if (formData.contentType === 'song' || formData.contentType === 'jam') {
      return ['Energetic', 'Emotional', 'Epic', 'Chill', 'Intense', 'Groovy', 'Dreamy', 'Raw', 'Powerful', 'Intimate', 'Psychedelic', 'Melancholic'];
    } else if (formData.contentType === 'crowd') {
      return ['Explosive', 'Excited', 'Emotional', 'Enthusiastic', 'Quiet', 'Respectful', 'Wild', 'Engaged'];
    } else {
      return ['Casual', 'Funny', 'Interesting', 'Technical', 'Unexpected'];
    }
  };

  const getUniqueElementOptions = () => {
    if (formData.contentType === 'song') {
      return ['', 'First time played live', 'Rarely played song', 'Extended version', 'Acoustic version', 'Cover song', 'Song dedication', 'New arrangement'];
    } else if (formData.contentType === 'jam') {
      return ['', 'Extended improvisation', 'Unusual instruments', 'Crowd participation', 'Guest musician', 'Spontaneous creation'];
    } else {
      return ['', 'Spontaneous moment', 'Fan interaction', 'Technical issue', 'Unexpected event', 'Rare occurrence'];
    }
  };

  return (
    <div>
      <h2 style={styles.modal.title}>🎵 Upload UMO Moment</h2>
      <p style={styles.modal.subtitle}>What type of content are you uploading?</p>

      {error && <div style={styles.message.error}>{error}</div>}

      {/* ✅ FIRST: Content Type Selection */}
      <div style={styles.section.container}>
        <h3 style={styles.section.title}>1️⃣ Content Type</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '10px',
          marginBottom: '1rem'
        }}>
          {Object.entries(contentTypes).map(([key, type]) => (
            <button
              key={key}
              type="button"
              onClick={() => onInputChange('contentType', key)}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid',
                borderColor: formData.contentType === key ? '#3b82f6' : '#d1d5db',
                backgroundColor: formData.contentType === key ? '#eff6ff' : '#f9fafb',
                color: formData.contentType === key ? '#1e40af' : '#374151',
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{type.label}</div>
              <div style={{ fontSize: '11px', opacity: 0.8, lineHeight: '1.3' }}>{type.description}</div>
            </button>
          ))}
        </div>
        
        {/* Rarity Information */}
        <div style={{
          padding: '12px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#0c4a6e'
        }}>
          <strong>Rarity Impact:</strong> {currentType.rarityNote}
        </div>
      </div>

      {/* ✅ SECOND: Basic Information */}
      <div style={styles.section.container}>
        <h3 style={styles.section.title}>2️⃣ Basic Information</h3>
        
        <div style={styles.section.grid}>
          <div>
            <label style={styles.label}>{currentType.nameLabel}</label>
            <input
              type="text"
              value={formData.songName}
              onChange={(e) => onInputChange('songName', e.target.value)}
              style={styles.input}
              placeholder={currentType.namePlaceholder}
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

        {/* ✅ CONDITIONAL: Only show for songs */}
        {formData.contentType === 'song' && (
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
              <label style={styles.label}>Song Position (if known)</label>
              <input
                type="number"
                value={formData.songPosition}
                onChange={(e) => onInputChange('songPosition', parseInt(e.target.value) || 1)}
                style={styles.input}
                min="1"
                placeholder="1"
              />
            </div>
          </div>
        )}
      </div>

      {/* ✅ THIRD: Description */}
      <div style={styles.section.container}>
        <h3 style={styles.section.title}>3️⃣ Description</h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={styles.label}>
            {formData.contentType === 'song' ? 'What happens in this moment?' : 'Describe this content'}
          </label>
          <textarea
            value={formData.momentDescription}
            onChange={(e) => onInputChange('momentDescription', e.target.value)}
            style={styles.textarea}
            placeholder={
              formData.contentType === 'song' 
                ? 'Describe what happens during this song performance'
                : 'Describe what happens in this moment'
            }
          />
        </div>

        {/* Emotional Tags */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={styles.label}>Mood/Energy (Select Multiple)</label>
          <div style={{
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            padding: '8px',
            minHeight: '50px',
            backgroundColor: 'white',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px'
          }}>
            {getEmotionalOptions().map(option => (
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
        </div>

        {/* Crowd Reaction - More relevant for all types */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={styles.label}>Crowd Reaction</label>
          <select
            value={formData.crowdReaction}
            onChange={(e) => onInputChange('crowdReaction', e.target.value)}
            style={styles.input}
          >
            <option value="">Select reaction...</option>
            <option value="Explosive energy">Explosive energy</option>
            <option value="Wild dancing">Wild dancing</option>
            <option value="Massive sing-along">Massive sing-along</option>
            <option value="Standing ovation">Standing ovation</option>
            <option value="Dead silence in awe">Dead silence in awe</option>
            <option value="Everyone jumping">Everyone jumping</option>
            <option value="Swaying together">Swaying together</option>
            <option value="Phone lights up">Phone lights up</option>
            <option value="Emotional tears">Emotional tears</option>
            <option value="Moderate response">Moderate response</option>
            <option value="Quiet appreciation">Quiet appreciation</option>
          </select>
        </div>
      </div>

      {/* ✅ CONDITIONAL: Full metadata only for songs and jams */}
      {currentType.showFullMetadata && (
        <div style={styles.section.container}>
          <h3 style={styles.section.title}>4️⃣ Additional Details</h3>
          
          {/* Instruments - Only for songs and jams */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={styles.label}>Featured Instruments/Elements</label>
            <div style={{
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '8px',
              minHeight: '50px',
              backgroundColor: 'white',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px'
            }}>
              {['Guitar solo', 'Bass solo', 'Drum solo', 'Keyboard/synth', 'Saxophone', 'Trumpet', 'Harmonica', 'Violin', 'Extended jam', 'Backup vocals'].map(option => (
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
          </div>

          <div style={styles.section.grid}>
            <div>
              <label style={styles.label}>Special Occasion</label>
              <select
                value={formData.specialOccasion}
                onChange={(e) => onInputChange('specialOccasion', e.target.value)}
                style={styles.input}
              >
                <option value="">None</option>
                <option value="Birthday show">Birthday show</option>
                <option value="Festival debut">Festival debut</option>
                <option value="Last song">Last song</option>
                <option value="Encore">Encore</option>
                <option value="First show of tour">First show of tour</option>
                <option value="Last show of tour">Last show of tour</option>
                <option value="Album release party">Album release party</option>
                <option value="Hometown show">Hometown show</option>
                <option value="New Year's Eve">New Year's Eve</option>
                <option value="Holiday show">Holiday show</option>
              </select>
            </div>
            
            <div>
              <label style={styles.label}>Unique Elements</label>
              <select
                value={formData.uniqueElements}
                onChange={(e) => onInputChange('uniqueElements', e.target.value)}
                style={styles.input}
              >
                {getUniqueElementOptions().map(option => (
                  <option key={option} value={option}>
                    {option || 'Select if applicable...'}
                  </option>
                ))}
              </select>
            </div>
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
        </div>
      )}

      {/* ✅ FOURTH: File Upload */}
      <div style={styles.section.container}>
        <h3 style={styles.section.title}>
          {currentType.showFullMetadata ? '5️⃣' : '4️⃣'} Media File
        </h3>
        
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
          🚀 Upload {currentType.label}
        </button>
      </div>
    </div>
  );
});

CleanUploadForm.displayName = 'CleanUploadForm';

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
    <p style={{ color: '#6b7280' }}>Your moment has been uploaded and is ready for viewing.</p>
  </div>
));

UploadSuccess.displayName = 'UploadSuccess';

export default UploadModal;