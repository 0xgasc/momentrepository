// src/components/Moment/UploadModal.jsx - SIMPLIFIED with removed fields
import React, { useState, memo, useEffect } from 'react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import * as tus from 'tus-js-client';
// Removed styles import - now using UMO design system

const UploadModal = memo(({ uploadingMoment, onClose, refreshNotifications }) => {
  const [step, setStep] = useState(uploadingMoment?.performanceId ? 'form' : 'selectPerformance');
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [uploadStage, setUploadStage] = useState('');

  // Performance search state
  const [performanceSearch, setPerformanceSearch] = useState('');
  const [performanceResults, setPerformanceResults] = useState([]);
  const [selectedPerformance, setSelectedPerformance] = useState(uploadingMoment?.performanceId ? uploadingMoment : null);
  const [loadingPerformances, setLoadingPerformances] = useState(false);

  // ✅ SMART: Determine if this is a song upload or other content upload
  const isSongUpload = uploadingMoment?.type === 'song';
  const isOtherContentUpload = uploadingMoment?.type === 'other';

  // ESC key to close modal
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !uploading) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, uploading]);

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
    momentType: 'performance',

    // Audio-specific metadata
    sourceType: 'unknown',
    taperNotes: '',
    recordingDevice: '',

    // Enhanced taper metadata
    taperName: '',
    equipment: {
      microphones: '',
      preamp: '',
      recorder: '',
      micPosition: 'unknown',
      signalChain: ''
    },
    lineage: {
      source: '',
      generation: 'unknown',
      transferNotes: '',
      originalFormat: ''
    },

    // Coverage type: full song or clip
    coverageType: 'full'
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

  // Search performances
  const searchPerformances = async (query) => {
    if (!query || query.length < 2) {
      setPerformanceResults([]);
      return;
    }

    setLoadingPerformances(true);
    try {
      const response = await fetch(`${API_BASE_URL}/cached/performances?search=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setPerformanceResults(data.performances || []);
      }
    } catch (error) {
      console.error('Error searching performances:', error);
    } finally {
      setLoadingPerformances(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchPerformances(performanceSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [performanceSearch]);

  const selectPerformance = (performance) => {
    setSelectedPerformance(performance);
    setFormData(prev => ({
      ...prev,
      venueName: performance.venue?.name || '',
      venueCity: performance.venue?.city?.name || '',
      venueCountry: performance.venue?.city?.country?.name || '',
      performanceDate: performance.eventDate || ''
    }));
    setStep('form');
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

    // Warn about large files on mobile
    const fileSizeMB = selectedFile.size / (1024 * 1024);
    if (fileSizeMB > 100) {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        setError(`Warning: ${Math.round(fileSizeMB)}MB file may take several minutes to upload on mobile. Consider using a smaller file or uploading from a computer.`);
      }
    }

    // Cleanup previous preview URL
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }

    setFile(selectedFile);
    setError('');

    // Create preview URL for video/image/audio files
    if (selectedFile.type.startsWith('video/') || selectedFile.type.startsWith('image/') || selectedFile.type.startsWith('audio/')) {
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
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Please log in to upload moments');
      }

      const fileSizeMB = file.size / (1024 * 1024);
      console.log(`📤 Starting upload for ${fileSizeMB.toFixed(2)}MB file using resumable tus protocol`);

      setUploadProgress(5);
      setUploadStage('Initializing resumable upload...');

      // Use tus for resumable uploads - this handles network interruptions gracefully
      const fileData = await new Promise((resolve, reject) => {
        let uploadId = null;
        let progressInterval = null;

        const upload = new tus.Upload(file, {
          endpoint: `${API_BASE_URL}/tus-upload`,
          retryDelays: [0, 1000, 3000, 5000, 10000, 30000],
          chunkSize: 5 * 1024 * 1024, // 5MB chunks for reliable uploads
          metadata: {
            filename: file.name,
            filetype: file.type,
            filesize: file.size.toString()
          },
          onError: (error) => {
            console.error('❌ Tus upload error:', error);
            clearInterval(progressInterval);
            reject(new Error(`Upload failed: ${error.message}. Your upload can be resumed if you try again.`));
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
            // Map 0-100% upload to 5-70% progress (leaving room for Irys processing)
            const adjustedProgress = 5 + (percentage * 0.65);
            setUploadProgress(adjustedProgress);
            setUploadStage(`Uploading to server... ${percentage}% (${(bytesUploaded / 1024 / 1024).toFixed(1)}MB / ${(bytesTotal / 1024 / 1024).toFixed(1)}MB)`);
            console.log(`📤 Upload progress: ${percentage}%`);
          },
          onSuccess: async () => {
            console.log('✅ Tus upload complete, processing on server...');
            clearInterval(progressInterval);

            // Extract upload ID from the URL
            const uploadUrl = upload.url;
            uploadId = uploadUrl.split('/').pop();
            console.log(`📋 Upload ID: ${uploadId}`);

            setUploadProgress(72);
            setUploadStage('Processing on decentralized network...');

            // Start simulated progress for Irys phase (72% to 95%)
            progressInterval = setInterval(() => {
              setUploadProgress(prev => {
                if (prev < 95) return prev + Math.random() * 1.5 + 0.3;
                return prev;
              });
            }, 1500);

            try {
              // Tell server to process the completed upload (upload to Irys)
              const response = await fetch(`${API_BASE_URL}/tus-upload/complete`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  uploadId,
                  originalFilename: file.name
                })
              });

              clearInterval(progressInterval);

              if (!response.ok) {
                const errorData = await response.json();
                reject(new Error(errorData.error || 'Failed to process upload'));
                return;
              }

              const data = await response.json();
              console.log('✅ File processed successfully:', data.fileUri);
              resolve(data);
            } catch (err) {
              clearInterval(progressInterval);
              reject(err);
            }
          }
        });

        // Check for previous uploads that can be resumed
        upload.findPreviousUploads().then((previousUploads) => {
          // Filter out invalid cached uploads (may have 'undefined' in URL from old bugs)
          const validUploads = previousUploads.filter(prev =>
            prev.uploadUrl && !prev.uploadUrl.includes('undefined')
          );
          if (validUploads.length > 0) {
            console.log('🔄 Found valid previous upload, attempting to resume...');
            console.log(`   - URL: ${validUploads[0].uploadUrl}`);
            setUploadStage('Resuming previous upload...');
            upload.resumeFromPreviousUpload(validUploads[0]);
          } else if (previousUploads.length > 0) {
            console.log('⚠️ Found cached uploads with invalid URLs, starting fresh');
          }
          upload.start();
        });
      });
      setUploadProgress(75);
      setUploadStage('Saving moment metadata...');

      const momentPayload = {
        performanceId: selectedPerformance?.id || uploadingMoment?.performanceId || `custom-${Date.now()}`,
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
        contentType: formData.contentType,

        // Coverage type: full song vs clip
        coverageType: formData.coverageType,

        // Audio-specific metadata
        sourceType: formData.sourceType,
        taperNotes: formData.taperNotes,
        recordingDevice: formData.recordingDevice,

        // Enhanced taper metadata
        taperName: formData.taperName || null,
        equipment: formData.equipment.signalChain || formData.equipment.microphones
          ? formData.equipment : undefined,
        lineage: formData.lineage.source || formData.lineage.transferNotes
          ? formData.lineage : undefined
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

      // Don't auto-close - let user read the success message
      // They can close manually with the button

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
    <div className="umo-modal-overlay" onClick={() => (step === 'form' || step === 'selectPerformance') && onClose()}>
      <div className="umo-modal max-w-2xl w-full max-h-90vh overflow-auto" onClick={(e) => e.stopPropagation()}>
        {step === 'selectPerformance' && (
          <PerformanceSearchStep
            performanceSearch={performanceSearch}
            setPerformanceSearch={setPerformanceSearch}
            performanceResults={performanceResults}
            loadingPerformances={loadingPerformances}
            selectPerformance={selectPerformance}
            onClose={onClose}
          />
        )}

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
            onClose={() => {
              // Refresh notifications when closing after upload
              if (refreshNotifications) {
                refreshNotifications();
              }
              onClose();
            }}
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
    <div className="p-6">
      {/* ✅ SMART: Different titles based on upload type */}
      <h2 className="umo-heading umo-heading--xl mb-6">
        {isSongUpload ? 'Upload Song Moment' : 'Upload Other Content'}
      </h2>
      
      {/* ✅ SMART: Upload Context */}
      <div className="bg-gray-800 border border-gray-600 p-4 mb-6" style={{ borderRadius: '4px' }}>
        <p className="text-sm umo-text-primary">
          {isSongUpload ? (
            <><strong>Song Upload:</strong> Adding moment for "{uploadingMoment.songName}"</>
          ) : (
            <><strong>Other Content:</strong> Adding non-setlist content to this performance</>
          )}
        </p>
      </div>

      {error && <div className="umo-card p-4 mb-4 bg-red-900/20 border-red-500/30"><p className="umo-text-primary">{error}</p></div>}


      {/* ✅ SMART: Basic Information */}
      <div className="umo-card p-6 mb-6">
        <h3 className="umo-heading umo-heading--md mb-4">
          Basic Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium umo-text-primary mb-2">{currentTypeInfo.nameLabel}</label>
            {isSongUpload ? (
              <input
                type="text"
                value={formData.songName}
                onChange={(e) => onInputChange('songName', e.target.value)}
                className="umo-input opacity-60 cursor-not-allowed"
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
                className="umo-select"
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
            <label className="block text-sm font-medium umo-text-primary mb-2">Performance Date</label>
            <input
              type="text"
              value={formData.performanceDate}
              className="umo-input opacity-60 cursor-not-allowed"
              readOnly
            />
          </div>
        </div>

        {/* Custom title field for "Other Content" */}
        {isOtherContentUpload && formData.contentType === 'other' && (
          <div className="mb-4">
            <label className="block text-sm font-medium umo-text-primary mb-2">Custom Title</label>
            <input
              type="text"
              value={formData.songName}
              onChange={(e) => onInputChange('songName', e.target.value)}
              className="umo-input"
              placeholder="Enter custom title for this content..."
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium umo-text-primary mb-2">Venue</label>
            <input
              type="text"
              value={formData.venueName}
              className="umo-input opacity-60 cursor-not-allowed"
              readOnly
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium umo-text-primary mb-2">City</label>
            <input
              type="text"
              value={formData.venueCity}
              className="umo-input opacity-60 cursor-not-allowed"
              readOnly
            />
          </div>
        </div>

        {/* ✅ SIMPLIFIED: Only show set for songs, removed song position */}
        {isSongUpload && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium umo-text-primary mb-2">Set Name</label>
              <select
                value={formData.setName}
                onChange={(e) => onInputChange('setName', e.target.value)}
                className="umo-select"
              >
                <option value="Main Set">Main Set</option>
                <option value="Encore">Encore</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium umo-text-primary mb-2">Recording Coverage</label>
              <select
                value={formData.coverageType}
                onChange={(e) => onInputChange('coverageType', e.target.value)}
                className="umo-select"
              >
                <option value="full">Full Song (90%+)</option>
                <option value="clip">Clip (Partial)</option>
              </select>
              <p className="text-xs umo-text-muted mt-1">
                {formData.coverageType === 'full'
                  ? 'Complete or nearly complete recording'
                  : 'Short clip or partial recording'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ✅ SIMPLIFIED: Description Section (6 fields total) */}
      <div className="umo-card p-6 mb-6">
        <h3 
          className="umo-heading umo-heading--md mb-4 cursor-pointer flex items-center gap-2"
          onClick={() => setShowDetails(!showDetails)}
        >
          Description & Details 
          <span className="text-xs umo-text-muted">
            (Optional) {showDetails ? '▼' : '▶'}
          </span>
        </h3>
        
        {showDetails && (
        <div>
        <div className="mb-4">
          <label className="block text-sm font-medium umo-text-primary mb-2">
            {isSongUpload ? 'What happens in this moment?' : `Describe this ${currentTypeInfo.label.toLowerCase()}`}
          </label>
          <textarea
            value={formData.momentDescription}
            onChange={(e) => onInputChange('momentDescription', e.target.value)}
            className="umo-input umo-textarea"
            placeholder={
              isSongUpload 
                ? 'Describe what happens during this song performance'
                : `Describe what happens in this ${currentTypeInfo.label.toLowerCase()}`
            }
          />
        </div>

        {/* Emotional Tags */}
        <div className="mb-4">
          <label className="block text-sm font-medium umo-text-primary mb-2">
            Mood/Energy (Select Multiple)
          </label>
          <div className="bg-gray-800 border border-gray-600 p-3 min-h-16 flex flex-wrap gap-2" style={{ borderRadius: '4px' }}>
            {getEmotionalOptions().map(option => (
              <button
                key={option}
                type="button"
                onClick={() => onArrayToggle('emotionalTags', option)}
                className={`px-2 py-1 text-xs rounded-full border transition-colors cursor-pointer ${
                  formData.emotionalTags.includes(option) 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'umo-btn--ghost'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Grid layout for remaining 4 fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium umo-text-primary mb-2">
              Special Occasion
            </label>
            <select
              value={formData.specialOccasion}
              onChange={(e) => onInputChange('specialOccasion', e.target.value)}
              className="umo-select"
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
            <label className="block text-sm font-medium umo-text-primary mb-2">
              Unique Elements
            </label>
            <select
              value={formData.uniqueElements}
              onChange={(e) => onInputChange('uniqueElements', e.target.value)}
              className="umo-select"
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
          <div className="mb-4">
            <label className="block text-sm font-medium umo-text-primary mb-2">
              Featured Instruments/Elements
            </label>
            <div className="bg-gray-800 border border-gray-600 p-3 min-h-16 flex flex-wrap gap-2" style={{ borderRadius: '4px' }}>
              {['Guitar solo', 'Bass solo', 'Drum solo', 'Keyboard/synth', 'Saxophone', 'Trumpet', 'Harmonica', 'Violin', 'Extended jam', 'Backup vocals'].map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onArrayToggle('instruments', option)}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors cursor-pointer ${
                    formData.instruments.includes(option) 
                      ? 'bg-green-600 text-white border-green-600' 
                      : 'umo-btn--ghost'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Crowd Reaction - Always shown */}
        <div className="mb-4">
          <label className="block text-sm font-medium umo-text-primary mb-2">
            Crowd Reaction
          </label>
          <select
            value={formData.crowdReaction}
            onChange={(e) => onInputChange('crowdReaction', e.target.value)}
            className="umo-select"
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
      <div className="umo-card p-6 mb-6">
        <h3 className="umo-heading umo-heading--md mb-4">
          Media File
        </h3>
        
        <div className="bg-gray-800 border-2 border-dashed border-gray-500 p-8 text-center hover:border-gray-400 transition-colors" style={{ borderRadius: '4px' }}>
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept="video/*,audio/*,image/*"
            onChange={onFileSelect}
          />
          <label htmlFor="file-upload" className="cursor-pointer block">
            {!file ? (
              <div>
                <p className="umo-text-primary text-lg mb-2">Click here to select media file</p>
                <p className="umo-text-secondary text-sm">Video, Audio, or Image files up to 6GB</p>
              </div>
            ) : (
              <div>
                <p className="font-bold mb-2 umo-text-primary">{file.name}</p>
                <p className="text-yellow-600">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                
                {/* Media Preview */}
                {filePreviewUrl && (
                  <div className="mt-4">
                    {file.type.startsWith('video/') ? (
                      <video
                        src={filePreviewUrl}
                        controls
                        className="w-full max-h-48 bg-black rounded"
                        style={{ borderRadius: '4px' }}
                        preload="metadata"
                      />
                    ) : file.type.startsWith('audio/') ? (
                      <audio
                        src={filePreviewUrl}
                        controls
                        className="w-full"
                        preload="metadata"
                      />
                    ) : file.type.startsWith('image/') ? (
                      <img
                        src={filePreviewUrl}
                        alt="Preview"
                        className="w-full max-h-48 object-contain rounded"
                        style={{ borderRadius: '4px' }}
                      />
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </label>
        </div>
      </div>

      {/* Audio-Specific Metadata - Only show for audio files */}
      {file?.type?.startsWith('audio/') && (
        <div className="umo-card p-4 mb-6 border border-blue-600/30 bg-blue-900/10 rounded-sm">
          <h3 className="text-lg font-semibold umo-text-primary mb-4 flex items-center gap-2">
            <span>🎙️</span> Recording Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium umo-text-primary mb-2">
                Recording Source
              </label>
              <select
                value={formData.sourceType}
                onChange={(e) => onInputChange('sourceType', e.target.value)}
                className="umo-select"
              >
                <option value="unknown">Unknown</option>
                <option value="soundboard">Soundboard (SBD)</option>
                <option value="audience">Audience Recording (AUD)</option>
                <option value="matrix">Matrix (SBD+AUD Mix)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium umo-text-primary mb-2">
                Recording Equipment
              </label>
              <input
                type="text"
                value={formData.recordingDevice}
                onChange={(e) => onInputChange('recordingDevice', e.target.value)}
                className="umo-input"
                placeholder="e.g., Zoom H6, DPA 4061, Sony PCM-D100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium umo-text-primary mb-2">
              Taper Notes
            </label>
            <textarea
              value={formData.taperNotes}
              onChange={(e) => onInputChange('taperNotes', e.target.value)}
              className="umo-input umo-textarea"
              placeholder="Notes about the recording (mic placement, transfer notes, lineage, etc.)"
              rows={3}
            />
          </div>

          {/* Advanced Recording Details (Collapsible) */}
          <details className="mt-4 border-t border-blue-600/20 pt-4">
            <summary className="cursor-pointer text-sm font-medium umo-text-secondary hover:umo-text-primary flex items-center gap-2">
              <span>🎚️</span> Advanced Recording Details (Optional)
            </summary>

            <div className="mt-4 space-y-4">
              {/* Taper Name */}
              <div>
                <label className="block text-sm font-medium umo-text-primary mb-2">
                  Taper / Source Name
                </label>
                <input
                  type="text"
                  value={formData.taperName}
                  onChange={(e) => onInputChange('taperName', e.target.value)}
                  className="umo-input"
                  placeholder="e.g., Charlie Miller, SBD from band"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mic Position */}
                <div>
                  <label className="block text-sm font-medium umo-text-primary mb-2">
                    Mic Position
                  </label>
                  <select
                    value={formData.equipment.micPosition}
                    onChange={(e) => onInputChange('equipment', {
                      ...formData.equipment,
                      micPosition: e.target.value
                    })}
                    className="umo-select"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="FOB">FOB (Front of Board)</option>
                    <option value="DFC">DFC (Dead Front Center)</option>
                    <option value="ROC">ROC (Right of Center)</option>
                    <option value="LOC">LOC (Left of Center)</option>
                    <option value="SBD">SBD (Soundboard)</option>
                    <option value="MATRIX">Matrix (AUD+SBD)</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Generation */}
                <div>
                  <label className="block text-sm font-medium umo-text-primary mb-2">
                    Recording Generation
                  </label>
                  <select
                    value={formData.lineage.generation}
                    onChange={(e) => onInputChange('lineage', {
                      ...formData.lineage,
                      generation: e.target.value
                    })}
                    className="umo-select"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="master">Master (Original)</option>
                    <option value="1st-gen">1st Generation</option>
                    <option value="2nd-gen">2nd Generation+</option>
                  </select>
                </div>
              </div>

              {/* Signal Chain */}
              <div>
                <label className="block text-sm font-medium umo-text-primary mb-2">
                  Signal Chain / Equipment
                </label>
                <input
                  type="text"
                  value={formData.equipment.signalChain}
                  onChange={(e) => onInputChange('equipment', {
                    ...formData.equipment,
                    signalChain: e.target.value
                  })}
                  className="umo-input"
                  placeholder="e.g., Schoeps MK4V > SD 302 > SD 744T @ 24/96"
                />
              </div>

              {/* Lineage / Transfer Notes */}
              <div>
                <label className="block text-sm font-medium umo-text-primary mb-2">
                  Lineage / Transfer Notes
                </label>
                <textarea
                  value={formData.lineage.transferNotes}
                  onChange={(e) => onInputChange('lineage', {
                    ...formData.lineage,
                    transferNotes: e.target.value
                  })}
                  className="umo-input umo-textarea"
                  placeholder="e.g., DAT master > WAV > FLAC (traded on etree)"
                  rows={2}
                />
              </div>

              {/* Original Format */}
              <div>
                <label className="block text-sm font-medium umo-text-primary mb-2">
                  Original Format
                </label>
                <input
                  type="text"
                  value={formData.lineage.originalFormat}
                  onChange={(e) => onInputChange('lineage', {
                    ...formData.lineage,
                    originalFormat: e.target.value
                  })}
                  className="umo-input"
                  placeholder="e.g., DAT 48kHz, FLAC 24/96, MP3 320kbps"
                />
              </div>
            </div>
          </details>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-600">
        <button onClick={onClose} className="umo-btn umo-btn--secondary">Cancel</button>

        <button
          onClick={onUpload}
          disabled={!file || !formData.venueName || !formData.venueCity ||
                   (isSongUpload && !formData.songName) ||
                   (!isSongUpload && !formData.contentType) ||
                   (!isSongUpload && formData.contentType === 'other' && !formData.songName)}
          className={`umo-btn ${
            (!file || !formData.venueName || !formData.venueCity ||
             (isSongUpload && !formData.songName) ||
             (!isSongUpload && !formData.contentType) ||
             (!isSongUpload && formData.contentType === 'other' && !formData.songName))
            ? 'opacity-50 cursor-not-allowed'
            : 'umo-btn--primary'
          }`}
        >
          Upload {isSongUpload ? 'Song Moment' : currentTypeInfo.label}
        </button>
      </div>
    </div>
  );
});

SimplifiedUploadForm.displayName = 'SimplifiedUploadForm';

const UploadProgress = memo(({ uploadProgress, uploadStage }) => (
  <div className="text-center p-8">
    <h2 className="umo-heading umo-heading--xl mb-6">Creating Your UMO Moment</h2>
    
    <div className="bg-gray-600 rounded h-2 mb-4 overflow-hidden" style={{ borderRadius: '4px' }}>
      <div
        className="bg-blue-600 h-full transition-all duration-300 ease-out"
        style={{ width: `${uploadProgress}%` }}
      />
    </div>
    
    <p className="umo-text-primary text-lg mb-2">
      {Math.round(uploadProgress)}% Complete
    </p>
    <p className="umo-text-secondary text-sm mb-6">
      {uploadStage}
    </p>
    
    <div className="umo-card p-4">
      <p className="text-xs text-center m-0 umo-text-primary leading-relaxed">
        <strong className="text-yellow-600">⚠️ Please wait - do not close this window</strong><br/>
        Your file is being secured by millions of computers worldwide through decentralized storage. This ensures permanent, censorship-resistant preservation of your moment.
      </p>
    </div>
  </div>
));

UploadProgress.displayName = 'UploadProgress';

// ✅ UPDATED: Success message for simplified system
const UploadSuccess = memo(({ isSongUpload, contentType, onClose }) => {
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
    <div className="text-center p-8">
      <div className="text-6xl mb-6 text-green-600">✓</div>
      <h2 className="umo-heading umo-heading--xl mb-6 text-green-600">
        {isSongUpload ? 'Moment Uploaded Successfully!' : 'Content Uploaded Successfully!'}
      </h2>
      
      <div className="bg-gray-800 border-2 border-gray-600 p-6 mb-6" style={{ borderRadius: '4px' }}>
        <h3 className="umo-heading umo-heading--md mb-4 text-blue-400">Awaiting Approval</h3>
        <p className="umo-text-primary mb-4 leading-relaxed text-left">
          Your {getContentTypeLabel()} has been safely uploaded to the UMO Archive and is now 
          waiting for review by our moderation team.
        </p>
        
        <div className="bg-gray-700 border border-gray-500 p-4 mb-6" style={{ borderRadius: '4px' }}>
          <p className="umo-text-secondary text-sm leading-relaxed text-left">
            <strong className="umo-text-primary">What happens next:</strong><br/><br/>
            • Our moderators will review your upload for quality and accuracy<br/>
            • This process typically takes 1-3 days<br/>
            • You'll be notified in "My Account" when it's approved (look for the blue dot!)<br/>
            • Once approved, your moment will be visible to all UMO fans!
          </p>
        </div>
        
        <p className="text-sm umo-text-muted mb-6">
          Thank you for contributing to the UMO Archive community!
        </p>
        
        <button 
          onClick={onClose}
          className="umo-btn umo-btn--primary px-6 py-3"
        >
          Close & Check My Account
        </button>
      </div>
    </div>
  );
});

UploadSuccess.displayName = 'UploadSuccess';

// Performance Search Step
const PerformanceSearchStep = memo(({ performanceSearch, setPerformanceSearch, performanceResults, loadingPerformances, selectPerformance, onClose }) => (
  <div className="p-6">
    <h2 className="umo-heading umo-heading--xl mb-4">Select Performance</h2>
    <p className="umo-text-muted mb-6">Search for the UMO performance where this moment is from</p>

    <div className="mb-6">
      <input
        type="text"
        value={performanceSearch}
        onChange={(e) => setPerformanceSearch(e.target.value)}
        placeholder="Search by venue, city, or date (e.g., 'Bowery Ballroom' or 'New York')"
        className="umo-input w-full"
        autoFocus
      />
    </div>

    {loadingPerformances && (
      <div className="text-center py-8">
        <div className="umo-text-muted">Searching performances...</div>
      </div>
    )}

    {!loadingPerformances && performanceResults.length === 0 && performanceSearch.length >= 2 && (
      <div className="text-center py-8">
        <div className="umo-text-muted">No performances found. Try a different search.</div>
      </div>
    )}

    {!loadingPerformances && performanceResults.length > 0 && (
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {performanceResults.map((perf) => (
          <button
            key={perf.id}
            onClick={() => selectPerformance(perf)}
            className="w-full text-left p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors"
          >
            <div className="font-medium umo-text-primary">{perf.venue?.name || 'Unknown Venue'}</div>
            <div className="text-sm umo-text-muted">
              {perf.venue?.city?.name}, {perf.venue?.city?.country?.name} • {perf.eventDate}
            </div>
            {perf.sets?.set?.[0]?.song && (
              <div className="text-xs text-gray-500 mt-1">
                {perf.sets.set[0].song.length} songs
              </div>
            )}
          </button>
        ))}
      </div>
    )}

    <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-600">
      <button onClick={onClose} className="umo-btn umo-btn--secondary">Cancel</button>
    </div>
  </div>
));

PerformanceSearchStep.displayName = 'PerformanceSearchStep';

export default UploadModal;