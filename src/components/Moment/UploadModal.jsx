// src/components/Moment/UploadModal.jsx - SIMPLIFIED with removed fields
import React, { useState, memo, useEffect } from 'react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import { styles } from '../../styles';

const UploadModal = memo(({ uploadingMoment, onClose }) => {
  const [step, setStep] = useState('form');
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [uploadStage, setUploadStage] = useState('');
  
  // ✅ SMART: Determine if this is a song upload or other content upload
  const isSongUpload = uploadingMoment?.type === 'song';
  const isOtherContentUpload = uploadingMoment?.type === 'other';
  
  const [formData, setFormData] = useState({
    // ✅ SMART: Set content type based on upload context
    contentType: isSongUpload ? 'song' : '',
    
    // Core fields (always needed)
    songName: uploadingMoment?.songName || '',
    venueName: uploadingMoment?.venueName || '',
    venueCity: uploadingMoment?.venueCity || '',
    venueCountry: uploadingMoment?.venueCountry || '',
    performanceDate: uploadingMoment?.performanceDate || '',
    
    // Song-specific fields (only for songs)
    setName: uploadingMoment?.setName || 'Main Set',
    // ✅ REMOVED: songPosition
    
    // ✅ SIMPLIFIED: Only the 6 metadata fields used in rarity calculation
    momentDescription: '',
    emotionalTags: [],
    specialOccasion: '',
    instruments: [],
    crowdReaction: '',
    uniqueElements: '',
    // ✅ REMOVED: guestAppearances, personalNote
    
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

  // Cleanup preview URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    const maxSize = 6 * 1024 * 1024 * 1024; // 6GB
    if (selectedFile.size > maxSize) {
      setError('File too large. Maximum size is 6GB.');
      return;
    }

    // Cleanup previous preview URL
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }

    setFile(selectedFile);
    setError('');
    
    // Create preview URL for video/image files
    if (selectedFile.type.startsWith('video/') || selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setFilePreviewUrl(url);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    // ✅ SMART: Different validation for different upload types
    if (isSongUpload) {
      if (!formData.songName || !formData.venueName || !formData.venueCity) {
        setError('Please fill in required fields: Song Name, Venue, and City');
        return;
      }
    } else {
      // For other content, must select a content type
      if (!formData.contentType) {
        setError('Please select a content type');
        return;
      }
      // songName is only required if contentType is "other"
      const requiresCustomTitle = formData.contentType === 'other';
      if (requiresCustomTitle && !formData.songName) {
        setError('Please enter a custom title for this content');
        return;
      }
      if (!formData.venueName || !formData.venueCity) {
        setError('Please fill in required fields: Venue and City');
        return;
      }
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

      // Estimate upload progress based on file size
      const fileSizeMB = file.size / (1024 * 1024);
      const estimatedUploadTime = Math.min(Math.max(fileSizeMB * 100, 2000), 10000); // 2-10 seconds
      
      setUploadProgress(15);
      setUploadStage('Uploading to decentralized storage...');

      // Simulate progressive upload based on file size
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev < 60) return prev + Math.random() * 5 + 3;
          return prev;
        });
      }, estimatedUploadTime / 20);

      const fileResponse = await fetch(`${API_BASE_URL}/upload-file`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formDataUpload
      });

      clearInterval(progressInterval);

      if (!fileResponse.ok) {
        const errorData = await fileResponse.json();
        throw new Error(errorData.error || 'File upload failed');
      }

      const fileData = await fileResponse.json();
      setUploadProgress(75);
      setUploadStage('Saving moment metadata...');

      const momentPayload = {
        performanceId: uploadingMoment.performanceId,
        performanceDate: formData.performanceDate,
        venueName: formData.venueName,
        venueCity: formData.venueCity,
        venueCountry: formData.venueCountry,
        songName: formData.songName,
        setName: formData.setName,
        // ✅ REMOVED: songPosition
        mediaUrl: fileData.fileUri,
        mediaType: file.type.startsWith('video/') ? 'video' : 
                   file.type.startsWith('audio/') ? 'audio' : 
                   file.type.startsWith('image/') ? 'image' : 'unknown',
        fileName: file.name,
        fileSize: file.size,
        
        // ✅ SIMPLIFIED: Only the 6 metadata fields
        momentDescription: formData.momentDescription,
        emotionalTags: formData.emotionalTags.join(', '),
        specialOccasion: formData.specialOccasion,
        instruments: formData.instruments.join(', '),
        crowdReaction: formData.crowdReaction,
        uniqueElements: formData.uniqueElements,
        // ✅ REMOVED: guestAppearances, personalNote
        
        audioQuality: formData.audioQuality,
        videoQuality: formData.videoQuality,
        momentType: formData.momentType,
        
        // ✅ CRITICAL: Include content type
        contentType: formData.contentType
      };

      console.log('🚀 Uploading moment with contentType:', formData.contentType);

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

      const momentData = await momentResponse.json();
      console.log('✅ Moment uploaded successfully:', momentData);

      setUploadProgress(100);
      setUploadStage('Complete!');
      setStep('success');

      // Auto-close modal after success
      setTimeout(() => {
        console.log('✅ Upload completed successfully');
        onClose();
      }, 2000);

    } catch (err) {
      console.error('❌ Upload error:', err);
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
          <SimplifiedUploadForm 
            formData={formData}
            file={file}
            filePreviewUrl={filePreviewUrl}
            error={error}
            uploadingMoment={uploadingMoment}
            isSongUpload={isSongUpload}
            isOtherContentUpload={isOtherContentUpload}
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
          <UploadSuccess 
            isSongUpload={isSongUpload} 
            contentType={formData.contentType}
          />
        )}
      </div>
    </div>
  );
});

UploadModal.displayName = 'UploadModal';

// ✅ SIMPLIFIED: Context-aware upload form with removed fields
const SimplifiedUploadForm = memo(({ 
  formData, 
  file, 
  filePreviewUrl,
  error,
  uploadingMoment,
  isSongUpload,
  isOtherContentUpload,
  onInputChange, 
  onArrayToggle,
  onFileSelect, 
  onUpload, 
  onClose
}) => {
  const [showDetails, setShowDetails] = useState(false);
  
  // ✅ Content type definitions (no song option for other content)
  const otherContentTypes = {
    intro: {
      label: 'Intro',
      description: 'Performance intro or opening',
      nameLabel: 'Content Name',
      namePlaceholder: 'e.g., "Intro", "Set Break"',
      bgColor: 'bg-purple-50 border-purple-200',
      textColor: 'text-purple-800'
    },
    outro: {
      label: 'Outro',
      description: 'Performance outro or closing',
      nameLabel: 'Content Name',
      namePlaceholder: 'e.g., "Outro", "Final Bow"',
      bgColor: 'bg-purple-50 border-purple-200',
      textColor: 'text-purple-800'
    },
    jam: {
      label: 'Jam',
      description: 'Extended jam session',
      nameLabel: 'Jam Description',
      namePlaceholder: 'e.g., "Guitar Jam", "Extended Outro"',
      bgColor: 'bg-orange-50 border-orange-200',
      textColor: 'text-orange-800'
    },
    improv: {
      label: 'Improv',
      description: 'Improvised musical section',
      nameLabel: 'Improv Description',
      namePlaceholder: 'e.g., "Free Improv", "Spontaneous Creation"',
      bgColor: 'bg-orange-50 border-orange-200',
      textColor: 'text-orange-800'
    },
    crowd: {
      label: 'Crowd Moment',
      description: 'Audience reaction or interaction',
      nameLabel: 'Crowd Moment',
      namePlaceholder: 'e.g., "Crowd Singing", "Standing Ovation", "Audience Reaction"',
      bgColor: 'bg-green-50 border-green-200',
      textColor: 'text-green-800'
    },
    other: {
      label: 'Other Content',
      description: 'Soundcheck, banter, or other content',
      nameLabel: 'Content Description',
      namePlaceholder: 'e.g., "Soundcheck", "Band Banter", "Technical Issue"',
      bgColor: 'bg-gray-50 border-gray-200',
      textColor: 'text-gray-800'
    }
  };

  // ✅ SMART: Get current type info
  const getCurrentTypeInfo = () => {
    if (isSongUpload) {
      return {
        label: 'Song Performance',
        description: 'A complete or partial song performance',
        nameLabel: 'Song Name',
        namePlaceholder: 'Enter the song name...',
        bgColor: 'bg-blue-50 border-blue-200',
        textColor: 'text-blue-800',
        rarityNote: 'Songs get rarity based on file size, performance frequency, and metadata completeness'
      };
    }
    return otherContentTypes[formData.contentType] || {
      label: 'Content',
      description: 'Select a content type',
      nameLabel: 'Content Name',
      namePlaceholder: 'Select content type first...',
      bgColor: 'bg-gray-50 border-gray-200',
      textColor: 'text-gray-800'
    };
  };

  const currentTypeInfo = getCurrentTypeInfo();

  // ✅ SMART: Enhanced options based on content type
  const getEmotionalOptions = () => {
    if (isSongUpload || formData.contentType === 'jam' || formData.contentType === 'improv') {
      return ['Energetic', 'Emotional', 'Epic', 'Chill', 'Intense', 'Groovy', 'Dreamy', 'Raw', 'Powerful', 'Intimate', 'Psychedelic', 'Melancholic'];
    } else if (formData.contentType === 'crowd') {
      return ['Explosive', 'Excited', 'Emotional', 'Enthusiastic', 'Quiet', 'Respectful', 'Wild', 'Engaged'];
    } else if (formData.contentType === 'intro' || formData.contentType === 'outro') {
      return ['Energetic', 'Emotional', 'Buildup', 'Anticipation', 'Climactic', 'Gentle', 'Powerful'];
    } else {
      return ['Casual', 'Funny', 'Interesting', 'Technical', 'Unexpected'];
    }
  };

  const getUniqueElementOptions = () => {
    if (isSongUpload) {
      return ['', 'First time played live', 'Rarely played song', 'Extended version', 'Acoustic version', 'Cover song', 'Song dedication', 'New arrangement'];
    } else if (formData.contentType === 'jam' || formData.contentType === 'improv') {
      return ['', 'Extended improvisation', 'Unusual instruments', 'Crowd participation', 'Spontaneous creation'];
    } else if (formData.contentType === 'intro' || formData.contentType === 'outro') {
      return ['', 'Extended intro/outro', 'Unusual opening/closing', 'Crowd participation', 'Special announcement'];
    } else {
      return ['', 'Spontaneous moment', 'Fan interaction', 'Technical issue', 'Unexpected event', 'Rare occurrence'];
    }
  };

  return (
    <div>
      {/* ✅ SMART: Different titles based on upload type */}
      <h2 style={styles.modal.title}>
        {isSongUpload ? '🎵 Upload Song Moment' : '📀 Upload Other Content'}
      </h2>
      
      {/* ✅ SMART: Upload Context */}
      <div className={`p-3 rounded-lg mb-4 ${currentTypeInfo.bgColor}`}>
        <p className={`text-sm ${currentTypeInfo.textColor}`}>
          {isSongUpload ? (
            <>📍 <strong>Song Upload:</strong> Adding moment for "{uploadingMoment.songName}"</>
          ) : (
            <>📍 <strong>Other Content:</strong> Adding non-setlist content to this performance</>
          )}
        </p>
      </div>

      {error && <div style={styles.message.error}>{error}</div>}


      {/* ✅ SMART: Basic Information */}
      <div style={styles.section.container}>
        <h3 style={styles.section.title}>
          Basic Information
        </h3>
        
        <div style={styles.section.grid}>
          <div>
            <label style={styles.label}>{currentTypeInfo.nameLabel}</label>
            {isSongUpload ? (
              <input
                type="text"
                value={formData.songName}
                onChange={(e) => onInputChange('songName', e.target.value)}
                style={{...styles.input, backgroundColor: '#f9fafb', cursor: 'not-allowed'}}
                placeholder={currentTypeInfo.namePlaceholder}
                readOnly
              />
            ) : (
              <select
                value={formData.contentType}
                onChange={(e) => {
                  onInputChange('contentType', e.target.value);
                  // Auto-populate songName based on content type, except for "other"
                  if (e.target.value !== 'other') {
                    const contentTypeLabels = {
                      intro: 'Intro',
                      outro: 'Outro',
                      jam: 'Jam',
                      improv: 'Improv',
                      crowd: 'Crowd Moment'
                    };
                    onInputChange('songName', contentTypeLabels[e.target.value] || '');
                  } else {
                    onInputChange('songName', '');
                  }
                }}
                style={styles.input}
              >
                <option value="">Select content type...</option>
                <option value="intro">Intro</option>
                <option value="outro">Outro</option>
                <option value="jam">Jam</option>
                <option value="improv">Improv</option>
                <option value="crowd">Crowd Moment</option>
                <option value="other">Other Content</option>
              </select>
            )}
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

        {/* Custom title field for "Other Content" */}
        {isOtherContentUpload && formData.contentType === 'other' && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={styles.label}>Custom Title</label>
            <input
              type="text"
              value={formData.songName}
              onChange={(e) => onInputChange('songName', e.target.value)}
              style={styles.input}
              placeholder="Enter custom title for this content..."
            />
          </div>
        )}

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

        {/* ✅ SIMPLIFIED: Only show set for songs, removed song position */}
        {isSongUpload && (
          <div style={{ marginBottom: '1rem' }}>
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
        )}
      </div>

      {/* ✅ SIMPLIFIED: Description Section (6 fields total) */}
      <div style={styles.section.container}>
        <h3 
          style={{...styles.section.title, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}
          onClick={() => setShowDetails(!showDetails)}
        >
          Description & Details 
          <span style={{fontSize: '12px', opacity: 0.7}}>
            (Optional) {showDetails ? '▼' : '▶'}
          </span>
        </h3>
        
        {showDetails && (
        <div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={styles.label}>
            {isSongUpload ? 'What happens in this moment?' : `Describe this ${currentTypeInfo.label.toLowerCase()}`}
          </label>
          <textarea
            value={formData.momentDescription}
            onChange={(e) => onInputChange('momentDescription', e.target.value)}
            style={styles.textarea}
            placeholder={
              isSongUpload 
                ? 'Describe what happens during this song performance'
                : `Describe what happens in this ${currentTypeInfo.label.toLowerCase()}`
            }
          />
        </div>

        {/* Emotional Tags */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={styles.label}>
            Mood/Energy (Select Multiple)
          </label>
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

        {/* Grid layout for remaining 4 fields */}
        <div style={styles.section.grid}>
          <div>
            <label style={styles.label}>
              Special Occasion
            </label>
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
            <label style={styles.label}>
              Unique Elements
            </label>
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

        {/* Instruments - Only for songs, jams, and improv */}
        {(isSongUpload || formData.contentType === 'jam' || formData.contentType === 'improv') && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={styles.label}>
              Featured Instruments/Elements
            </label>
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
        )}

        {/* Crowd Reaction - Always shown */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={styles.label}>
            Crowd Reaction
          </label>
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
        )}
      </div>

      {/* ✅ SMART: File Upload */}
      <div style={styles.section.container}>
        <h3 style={styles.section.title}>
          Media File
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
                <p style={styles.fileUpload.text}>Click here to select media file</p>
                <p style={styles.fileUpload.subtext}>Video, Audio, or Image files up to 6GB</p>
              </div>
            ) : (
              <div>
                <p style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#F5F5DC' }}>{file.name}</p>
                <p style={{ color: '#B8860B' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                
                {/* Media Preview */}
                {filePreviewUrl && (
                  <div style={{ marginTop: '1rem' }}>
                    {file.type.startsWith('video/') ? (
                      <video 
                        src={filePreviewUrl} 
                        controls 
                        style={{ 
                          width: '100%', 
                          maxHeight: '200px', 
                          backgroundColor: '#000',
                          borderRadius: '8px'
                        }}
                        preload="metadata"
                      />
                    ) : file.type.startsWith('image/') ? (
                      <img 
                        src={filePreviewUrl} 
                        alt="Preview" 
                        style={{ 
                          width: '100%', 
                          maxHeight: '200px', 
                          objectFit: 'contain',
                          borderRadius: '8px'
                        }}
                      />
                    ) : null}
                  </div>
                )}
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
          disabled={!file || !formData.venueName || !formData.venueCity || 
                   (isSongUpload && !formData.songName) || 
                   (!isSongUpload && !formData.contentType) ||
                   (!isSongUpload && formData.contentType === 'other' && !formData.songName)}
          style={(!file || !formData.venueName || !formData.venueCity || 
                 (isSongUpload && !formData.songName) || 
                 (!isSongUpload && !formData.contentType) ||
                 (!isSongUpload && formData.contentType === 'other' && !formData.songName)) 
            ? styles.button.disabled 
            : styles.button.primary}
        >
          🚀 Upload {isSongUpload ? 'Song Moment' : currentTypeInfo.label}
        </button>
      </div>
    </div>
  );
});

SimplifiedUploadForm.displayName = 'SimplifiedUploadForm';

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
      {Math.round(uploadProgress)}% Complete
    </p>
    <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
      {uploadStage}
    </p>
    
    <div style={{
      marginTop: '1rem',
      padding: '1rem',
      backgroundColor: '#1A1A1A',
      borderRadius: '8px',
      border: '1px solid #4A0E0E'
    }}>
      <p style={{ 
        fontSize: '0.75rem', 
        textAlign: 'center', 
        margin: 0,
        color: '#F5F5DC',
        lineHeight: '1.4'
      }}>
        <strong style={{ color: '#B8860B' }}>⚠️ Please wait - do not close this window</strong><br/>
        Your file is being secured by millions of computers worldwide through decentralized storage. This ensures permanent, censorship-resistant preservation of your moment.
      </p>
    </div>
  </div>
));

UploadProgress.displayName = 'UploadProgress';

// ✅ UPDATED: Success message for simplified system
const UploadSuccess = memo(({ isSongUpload, contentType }) => {
  const getContentTypeLabel = () => {
    const types = {
      song: 'song moment',
      intro: 'intro/outro content',
      jam: 'jam/improv content', 
      crowd: 'crowd moment',
      other: 'other content'
    };
    return types[contentType] || 'content';
  };

  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
      <h2 style={{ ...styles.modal.title, color: '#059669' }}>
        {isSongUpload ? 'Song Moment Created!' : 'Other Content Created!'}
      </h2>
      <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
        Your {getContentTypeLabel()} has been uploaded with simple 3-factor rarity scoring.
      </p>
      <div style={{
        padding: '12px',
        backgroundColor: '#1A1A1A',
        border: '1px solid #4A0E0E',
        borderRadius: '8px',
        fontSize: '14px',
        color: '#F5F5DC'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#B8860B' }}>⚡ Simple Scoring Applied</div>
        <div>File size + content rarity + metadata completeness = your rarity score</div>
      </div>
    </div>
  );
});

UploadSuccess.displayName = 'UploadSuccess';

export default UploadModal;