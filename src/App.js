import React, { useEffect, useState, createContext, useContext, useCallback, useMemo } from 'react';
import { styles } from './styles';
import { formatDate, formatShortDate, formatFileSize, UMO_MBID, UMO_ARTIST, fetchUMOSetlists, extractUMOSongs, createTimeoutSignal } from './utils';

// API Base URL - automatically detects if running on mobile
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5050'  // Local development
  : `http://${window.location.hostname}:5050`;  // Use same hostname as frontend

console.log('🌐 UMO Repository - API Base URL:', API_BASE_URL);

// Authentication Context
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (email, password, displayName) => {
    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for debouncing
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Shared moment fetching utility
const fetchMoments = async (endpoint, errorContext = 'moments') => {
  try {
    const response = await fetch(`${API_BASE_URL}/moments/${endpoint}`, {
      signal: createTimeoutSignal(8000),
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return data.moments || [];
    } else {
      console.warn(`Failed to load ${errorContext}: ${response.status}`);
      return [];
    }
  } catch (err) {
    console.error(`Error loading ${errorContext}:`, err);
    return [];
  }
};

// UMO Song Search Component
const UMOSongSearch = ({ onSongSelect, currentSong }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [allSongs, setAllSongs] = useState([]);
  const [filteredSongs, setFilteredSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState('');

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Load all UMO songs from setlists
  useEffect(() => {
    const loadUMOSongs = async () => {
      try {
        setLoading(true);
        const allSongs = new Set();
        let page = 1;
        let hasMore = true;
        
        while (hasMore && page <= 10) {
          try {
            const data = await fetchUMOSetlists(page, API_BASE_URL);
            
            if (data && data.setlist && data.setlist.length > 0) {
              const songsFromPage = extractUMOSongs(data.setlist);
              songsFromPage.forEach(song => allSongs.add(song));
              page++;
            } else {
              hasMore = false;
            }
          } catch (err) {
            console.error(`Error fetching page ${page}:`, err);
            hasMore = false;
          }
        }

        const songList = Array.from(allSongs).sort();
        setAllSongs(songList);
        setFilteredSongs(songList);
        
        if (songList.length === 0) {
          setError('No UMO songs found. Check if the server is running.');
        }
        
      } catch (err) {
        console.error('Error loading UMO songs:', err);
        setError(`Failed to load UMO songs: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadUMOSongs();
  }, []);

  // Filter songs based on search query
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setFilteredSongs(allSongs);
      setShowResults(false);
    } else {
      const query = debouncedSearchQuery.toLowerCase();
      const filtered = allSongs.filter(song => 
        song.toLowerCase().includes(query)
      ).slice(0, 20);
      
      setFilteredSongs(filtered);
      setShowResults(true);
    }
  }, [debouncedSearchQuery, allSongs]);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const selectSong = (songName) => {
    onSongSelect(songName);
    setSearchQuery('');
    setShowResults(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setFilteredSongs(allSongs);
    setShowResults(false);
  };

  if (loading) {
    return (
      <div className="relative max-w-md mx-auto">
        <div className="text-center py-4">
          <div className="inline-flex items-center text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            Loading UMO songs...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative max-w-md mx-auto">
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Search UMO songs..."
          className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
        />
        
        <div className="absolute right-3 top-3 flex items-center gap-2">
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-2 text-red-600 text-center text-sm">
          {error}
        </div>
      )}

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {filteredSongs.length === 0 ? (
            <div className="px-4 py-3 text-gray-500 text-center">
              No songs found matching "{searchQuery}"
            </div>
          ) : (
            filteredSongs.map((songName, index) => (
              <button
                key={index}
                onClick={() => selectSong(songName)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium">{songName}</div>
              </button>
            ))
          )}
        </div>
      )}

      {currentSong && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full">
            <span className="font-medium">Viewing: {currentSong}</span>
            <button
              onClick={() => onSongSelect(null)}
              className="ml-2 text-blue-600 hover:text-blue-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {!showResults && !currentSong && (
        <div className="mt-4 text-center text-gray-500 text-sm">
          Comprehensive song catalog from live performances
        </div>
      )}
    </div>
  );
};

// Moment Detail Modal
const MomentDetailModal = ({ moment, onClose }) => {
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
};

// Enhanced Upload Modal
const EnhancedUploadModal = ({ uploadingMoment, onClose }) => {
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
                    onChange={(e) => handleInputChange('songName', e.target.value)}
                    style={styles.input}
                    placeholder="Enter song name"
                  />
                </div>
                
                <div>
                  <label style={styles.label}>Set Name</label>
                  <input
                    type="text"
                    value={formData.setName}
                    onChange={(e) => handleInputChange('setName', e.target.value)}
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
                    onChange={(e) => handleInputChange('venueName', e.target.value)}
                    style={styles.input}
                  />
                </div>
                
                <div>
                  <label style={styles.label}>City *</label>
                  <input
                    type="text"
                    value={formData.venueCity}
                    onChange={(e) => handleInputChange('venueCity', e.target.value)}
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
                  onChange={(e) => handleInputChange('momentDescription', e.target.value)}
                  style={styles.textarea}
                  placeholder="Describe what happens in this moment"
                />
              </div>

              <div style={styles.section.grid}>
                <div>
                  <label style={styles.label}>Moment Type</label>
                  <select
                    value={formData.momentType}
                    onChange={(e) => handleInputChange('momentType', e.target.value)}
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
                    onChange={(e) => handleInputChange('emotionalTags', e.target.value)}
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
                  onChange={handleFileSelect}
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
                onClick={handleUpload}
                disabled={!file || !formData.songName || !formData.venueName || !formData.venueCity}
                style={(!file || !formData.songName || !formData.venueName || !formData.venueCity) 
                  ? styles.button.disabled 
                  : styles.button.primary}
              >
                🚀 Create NFT-Ready Moment
              </button>
            </div>
          </div>
        )}

        {step === 'uploading' && (
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
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ ...styles.modal.title, color: '#059669' }}>
              NFT-Ready UMO Moment Created!
            </h2>
            <p style={{ color: '#6b7280' }}>Your UMO moment is ready for NFT minting.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('login');
  const [message, setMessage] = useState('');
  const { login, register } = useAuth();

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await login(email, password);
      setMessage('Login successful! Refreshing page...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      if (err.message.includes('User not found') || err.message.includes('not found')) {
        setMode('userNotFound');
        setError('');
        setMessage('');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    if (!displayName.trim()) {
      setError('Display name is required');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      await register(email, password, displayName);
      setMessage('Account created successfully! Refreshing page...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'login') {
      handleLogin();
    } else if (mode === 'register' || mode === 'userNotFound') {
      handleRegister();
    }
  };

  const switchToRegister = () => {
    setMode('register');
    setError('');
    setMessage('');
    if (!displayName) {
      const emailName = email.split('@')[0];
      setDisplayName(emailName);
    }
  };

  const switchToLogin = () => {
    setMode('login');
    setError('');
    setMessage('');
    setDisplayName('');
  };

  const startOver = () => {
    setMode('login');
    setError('');
    setMessage('');
    setEmail('');
    setPassword('');
    setDisplayName('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {mode === 'login' ? 'Welcome Back' : 
             mode === 'userNotFound' ? 'Create Account' : 
             'Create Account'}
          </h2>
          <p className="text-gray-600 mt-2">
            {mode === 'login' ? 'Sign in to upload and manage your UMO moments' :
             mode === 'userNotFound' ? 'Set up your new account to get started' :
             'Join the UMO community and start collecting moments'}
          </p>
        </div>
        
        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 text-center">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
              {message}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {mode === 'userNotFound' && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4 text-center">
            <p className="font-medium">No account found for {email}</p>
            <p className="text-sm mt-1">Would you like to create a new account with this email?</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {(mode === 'register' || mode === 'userNotFound') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name *
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="How others will see you"
                required
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your@email.com"
              required
              disabled={mode === 'userNotFound' && loading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={mode === 'login' ? 'Enter your password' : 'Create a password (min 6 characters)'}
              required
              minLength={mode !== 'login' ? 6 : undefined}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading || !email || !password || ((mode === 'register' || mode === 'userNotFound') && !displayName)}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {mode === 'login' ? 'Signing In...' : 'Creating Account...'}
              </div>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>
        
        <div className="text-center mt-6">
          {mode === 'login' ? (
            <button
              onClick={switchToRegister}
              className="text-blue-600 hover:text-blue-800 underline"
              disabled={loading}
            >
              Don't have an account? Create one
            </button>
          ) : mode === 'userNotFound' ? (
            <button
              onClick={startOver}
              className="text-gray-600 hover:text-gray-800 underline"
              disabled={loading}
            >
              Try different email address
            </button>
          ) : (
            <button
              onClick={switchToLogin}
              className="text-blue-600 hover:text-blue-800 underline"
              disabled={loading}
            >
              Already have an account? Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Enhanced UMOLatestPerformances Component
const UMOLatestPerformances = ({ onPerformanceSelect }) => {
  const [allPerformances, setAllPerformances] = useState([]);
  const [displayedPerformances, setDisplayedPerformances] = useState([]);
  const [momentCounts, setMomentCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingMoments, setLoadingMoments] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [citySearch, setCitySearch] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);

  const debouncedCitySearch = useDebounce(citySearch, 600);

  // Load moment counts for displayed performances
  const loadMomentCounts = async (performances) => {
    if (performances.length === 0) return;
    
    setLoadingMoments(true);
    const newMomentCounts = {};
    
    // Process in batches to avoid overwhelming the server
    const batchSize = 10;
    for (let i = 0; i < performances.length; i += batchSize) {
      const batch = performances.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (performance) => {
        try {
          const moments = await fetchMoments(`performance/${performance.id}`, `performance ${performance.id}`);
          newMomentCounts[performance.id] = moments.length;
        } catch (err) {
          newMomentCounts[performance.id] = 0;
        }
      }));
      
      // Small delay between batches
      if (i + batchSize < performances.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    setMomentCounts(prev => ({ ...prev, ...newMomentCounts }));
    setLoadingMoments(false);
  };

  // Load moment counts whenever displayed performances change
  useEffect(() => {
    if (displayedPerformances.length > 0 && !loading && !searching) {
      const performancesToLoad = displayedPerformances.filter(p => !(p.id in momentCounts));
      if (performancesToLoad.length > 0) {
        loadMomentCounts(performancesToLoad);
      }
    }
  }, [displayedPerformances, loading, searching]);

  // Initial load
  useEffect(() => {
    loadInitialPerformances();
  }, []);

  // Search effect with immediate local filtering + comprehensive search
  useEffect(() => {
    if (!debouncedCitySearch.trim()) {
      setIsSearchMode(false);
      setDisplayedPerformances(allPerformances);
    } else {
      const immediateResults = allPerformances.filter(setlist => 
        setlist.venue.city.name.toLowerCase().includes(debouncedCitySearch.toLowerCase()) ||
        setlist.venue.name.toLowerCase().includes(debouncedCitySearch.toLowerCase()) ||
        (setlist.venue.city.country?.name || '').toLowerCase().includes(debouncedCitySearch.toLowerCase())
      );
      
      setIsSearchMode(true);
      setDisplayedPerformances(immediateResults);
      performSearch(debouncedCitySearch);
    }
  }, [debouncedCitySearch, allPerformances]);

  const loadInitialPerformances = async () => {
    try {
      setLoading(true);
      setError('');
      
      const data = await fetchUMOSetlists(1, API_BASE_URL);
      
      if (data?.setlist?.length > 0) {
        const performances = data.setlist;
        setAllPerformances(performances);
        setDisplayedPerformances(performances);
        setCurrentPage(1);
        setHasMore(performances.length >= 20);
      } else {
        setError('No UMO performances found');
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading performances:', err);
      setError(`Failed to load performances: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (searchTerm) => {
    if (searching) return;
    
    setSearching(true);
    setIsSearchMode(true);
    
    try {
      const searchResults = [];
      let page = 1;
      let hasMorePages = true;
      let consecutiveEmptyPages = 0;
      
      while (hasMorePages && page <= 200 && searchResults.length < 500) {
        try {
          const data = await fetchUMOSetlists(page, API_BASE_URL);
          
          if (data?.setlist?.length > 0) {
            const matches = data.setlist.filter(setlist => 
              setlist.venue.city.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              setlist.venue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (setlist.venue.city.country?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
            
            if (matches.length > 0) {
              searchResults.push(...matches);
              consecutiveEmptyPages = 0;
            } else {
              consecutiveEmptyPages++;
            }
            
            page++;
            
            if (consecutiveEmptyPages >= 20) {
              hasMorePages = false;
            }
            
            if (data.setlist.length < 20) {
              hasMorePages = false;
            }
          } else {
            hasMorePages = false;
          }
        } catch (err) {
          console.error(`Error on page ${page}:`, err);
          page++;
          if (page > 200) hasMorePages = false;
        }
      }
      
      searchResults.sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));
      setDisplayedPerformances(searchResults);
      
    } catch (err) {
      console.error('Search error:', err);
      setError(`Search failed: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  const loadMorePerformances = async () => {
    if (loadingMore || !hasMore || isSearchMode) return;
    
    const nextPage = currentPage + 1;
    
    try {
      setLoadingMore(true);
      
      const data = await fetchUMOSetlists(nextPage, API_BASE_URL);
      
      if (data?.setlist?.length > 0) {
        const newPerformances = data.setlist;
        const updatedPerformances = [...allPerformances, ...newPerformances];
        
        setAllPerformances(updatedPerformances);
        setDisplayedPerformances(updatedPerformances);
        setCurrentPage(nextPage);
        setHasMore(newPerformances.length >= 20);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error(`Error loading page ${nextPage}:`, err);
      setError(`Failed to load more: ${err.message}`);
    } finally {
      setLoadingMore(false);
    }
  };

  const clearSearch = () => {
    setCitySearch('');
    setIsSearchMode(false);
    setDisplayedPerformances(allPerformances);
  };

  if (loading) {
    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4">🎸 UMO Performances</h3>
        <div className="text-center py-8">
          <div className="inline-flex items-center text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            Loading performances...
          </div>
        </div>
      </div>
    );
  }

  if (error && !displayedPerformances.length) {
    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4">🎸 UMO Performances</h3>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="mb-2">⚠️ {error}</p>
          <button
            onClick={loadInitialPerformances}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h3 className="text-xl font-bold">🎸 UMO Performances</h3>
        
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)}
            placeholder="Search all UMO shows (2010-2025) by city or venue..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="absolute right-3 top-2 flex items-center gap-1">
            {searching && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
            {citySearch && (
              <button
                onClick={clearSearch}
                className="text-gray-400 hover:text-gray-600 ml-1"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading moments indicator */}
      {loadingMoments && (
        <div className="mb-4 text-sm text-blue-600 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          Loading moment counts for performances...
        </div>
      )}

      {/* Search results info */}
      {isSearchMode && (
        <div className="mb-4 text-sm">
          {searching ? (
            <div className="flex items-center text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <span>Searching entire UMO history for "{citySearch}"...</span>
            </div>
          ) : (
            <div className="text-green-600">
              ✅ Found {displayedPerformances.length} performances matching "{citySearch}"
              {displayedPerformances.length > 0 && (
                <span className="text-gray-500 ml-2">
                  ({displayedPerformances[displayedPerformances.length - 1]?.eventDate} - {displayedPerformances[0]?.eventDate})
                </span>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Performance grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayedPerformances.map((setlist) => {
          const songCount = setlist.sets?.set?.reduce((total, set) => total + (set.song?.length || 0), 0) || 0;
          const momentCount = momentCounts[setlist.id] || 0;
          
          return (
            <button
              key={setlist.id}
              onClick={() => onPerformanceSelect(setlist)}
              className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 hover:border-blue-300 text-left group"
            >
              <div className="font-medium text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                {setlist.venue.name}
              </div>
              <div className="text-sm text-gray-600 mb-1">
                {setlist.venue.city.name}
                {setlist.venue.city.country && (
                  <span className="text-gray-500">, {setlist.venue.city.country.name}</span>
                )}
              </div>
              <div className="text-sm text-blue-600 font-medium mb-2">
                {formatShortDate(setlist.eventDate)}
              </div>
              
              <div className="space-y-1">
                <div className="text-xs text-gray-500">
                  {songCount} song{songCount !== 1 ? 's' : ''}
                </div>
                {momentCount > 0 ? (
                  <div className="text-xs text-green-600 font-medium">
                    {momentCount} moment{momentCount !== 1 ? 's' : ''} uploaded
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">
                    No moments yet
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      
      {/* No results */}
      {displayedPerformances.length === 0 && !loading && !searching && (
        <div className="text-center py-12 text-gray-500">
          {isSearchMode ? (
            <>
              No performances found matching "{citySearch}"
              <br />
              <button
                onClick={clearSearch}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Show all performances
              </button>
            </>
          ) : (
            'No performances available'
          )}
        </div>
      )}
      
      {/* Load more button */}
      {hasMore && !isSearchMode && !searching && (
        <div className="text-center mt-8">
          <button
            onClick={loadMorePerformances}
            disabled={loadingMore}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Loading more...
              </div>
            ) : (
              'Load More Performances'
            )}
          </button>
        </div>
      )}

      {/* Setlist.fm contribution note */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <h4 className="text-lg font-semibold text-blue-900 mb-3">
            🎵 Missing a Performance or Setlist?
          </h4>
          <p className="text-blue-800 mb-4 leading-relaxed">
            Our data comes from the amazing community at setlist.fm. If you notice a missing UMO show or setlist, 
            you can help by adding it to their database — it's free and easy!
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://www.setlist.fm/add"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Add Missing Setlist Here
            </a>
            <a
              href="https://www.setlist.fm/artist/unknown-mortal-orchestra-6bd8b335.html"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
            >
              View UMO on setlist.fm
            </a>
          </div>
          <p className="text-xs text-blue-600 mt-4">
            Changes on setlist.fm will appear here automatically within 24 hours
          </p>
        </div>
      </div>
    </div>
  );
};

// Enhanced UMOBrowseBySong Component
const UMOBrowseBySong = ({ onSongSelect }) => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('alphabetical');
  const [sortDirection, setSortDirection] = useState('asc');
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, status: '' });

  // Date parsing helper
  const parseSetlistDate = (dateString) => {
    if (!dateString) return null;
    
    try {
      if (dateString.includes('-')) {
        const parts = dateString.split('-');
        if (parts.length === 3) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          const year = parseInt(parts[2]);
          return new Date(year, month, day);
        }
      }
      return new Date(dateString);
    } catch (err) {
      console.error('Error parsing date:', dateString, err);
      return null;
    }
  };

  // Date formatter that always shows year
  const formatShortDateWithYear = (dateString) => {
    if (!dateString) return 'Unknown date';
    
    try {
      if (dateString.includes('-')) {
        const parts = dateString.split('-');
        if (parts.length === 3) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          const year = parseInt(parts[2]);
          const date = new Date(year, month, day);
          
          return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
        }
      }
      
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    } catch (err) {
      // Return original if parsing fails
    }
    
    return dateString;
  };

  useEffect(() => {
    const loadComprehensiveSongData = async () => {
      try {
        setLoading(true);
        setLoadingProgress({ current: 0, total: 0, status: 'Initializing...' });
        
        const allSongs = new Map();
        let page = 1;
        let hasMore = true;
        let consecutiveEmptyPages = 0;
        let totalProcessed = 0;
        
        // Comprehensive search through UMO's performance history
        while (hasMore && page <= 200 && consecutiveEmptyPages < 10) {
          try {
            setLoadingProgress({ 
              current: page, 
              total: '200+', 
              status: `Loading page ${page}... (${totalProcessed} songs found)` 
            });
            
            const data = await fetchUMOSetlists(page, API_BASE_URL);
            
            if (data && data.setlist && data.setlist.length > 0) {
              let songsFoundOnPage = 0;
              
              for (const setlist of data.setlist) {
                if (setlist.sets && setlist.sets.set) {
                  setlist.sets.set.forEach(set => {
                    if (set.song) {
                      set.song.forEach((song, songIndex) => {
                        if (song.name) {
                          songsFoundOnPage++;
                          
                          if (!allSongs.has(song.name)) {
                            allSongs.set(song.name, {
                              songName: song.name,
                              performances: [],
                              totalMoments: 0,
                              lastPerformed: null,
                              firstPerformed: null,
                              venues: new Set(),
                              cities: new Set(),
                              countries: new Set()
                            });
                          }
                          
                          const performance = {
                            id: setlist.id,
                            venue: setlist.venue.name,
                            city: setlist.venue.city.name,
                            country: setlist.venue.city.country?.name,
                            date: setlist.eventDate,
                            setName: set.name,
                            songPosition: songIndex + 1,
                            venueFull: setlist.venue,
                            totalSongsInSet: set.song.length
                          };
                          
                          const songData = allSongs.get(song.name);
                          songData.performances.push(performance);
                          
                          songData.venues.add(setlist.venue.name);
                          songData.cities.add(setlist.venue.city.name);
                          if (setlist.venue.city.country?.name) {
                            songData.countries.add(setlist.venue.city.country.name);
                          }
                          
                          // Proper date comparison using Date objects
                          const performanceDate = parseSetlistDate(performance.date);
                          if (performanceDate) {
                            const lastPerformedDate = songData.lastPerformed ? parseSetlistDate(songData.lastPerformed) : null;
                            const firstPerformedDate = songData.firstPerformed ? parseSetlistDate(songData.firstPerformed) : null;
                            
                            if (!lastPerformedDate || performanceDate > lastPerformedDate) {
                              songData.lastPerformed = performance.date;
                            }
                            
                            if (!firstPerformedDate || performanceDate < firstPerformedDate) {
                              songData.firstPerformed = performance.date;
                            }
                          }
                        }
                      });
                    }
                  });
                }
              }
              
              totalProcessed = allSongs.size;
              
              if (songsFoundOnPage > 0) {
                consecutiveEmptyPages = 0;
              } else {
                consecutiveEmptyPages++;
              }
              
              page++;
              
              if (data.setlist.length < 20) {
                hasMore = false;
              }
            } else {
              consecutiveEmptyPages++;
              
              if (consecutiveEmptyPages >= 10) {
                hasMore = false;
              } else {
                page++;
              }
            }
          } catch (err) {
            console.error(`Error fetching page ${page}:`, err);
            consecutiveEmptyPages++;
            
            if (consecutiveEmptyPages >= 5) {
              hasMore = false;
            } else {
              page++;
            }
          }
        }

        // Convert to array and process data
        const songArray = Array.from(allSongs.values()).map(song => ({
          ...song,
          venues: Array.from(song.venues),
          cities: Array.from(song.cities),
          countries: Array.from(song.countries),
          performances: song.performances.sort((a, b) => {
            const dateA = parseSetlistDate(a.date);
            const dateB = parseSetlistDate(b.date);
            if (!dateA || !dateB) return 0;
            return dateB - dateA;
          })
        }));
        
        // Load moment counts
        setLoadingProgress({ 
          current: 0, 
          total: songArray.length, 
          status: 'Loading moment counts...' 
        });
        
        const batchSize = 10;
        let totalMomentsFound = 0;
        
        for (let i = 0; i < songArray.length; i += batchSize) {
          const batch = songArray.slice(i, i + batchSize);
          
          setLoadingProgress({ 
            current: i + batch.length, 
            total: songArray.length, 
            status: `Loading moments... (${i + batch.length}/${songArray.length}) - Found ${totalMomentsFound} total` 
          });
          
          await Promise.all(batch.map(async (song) => {
            try {
              const moments = await fetchMoments(`song/${encodeURIComponent(song.songName)}`, `song "${song.songName}"`);
              song.totalMoments = moments.length;
              totalMomentsFound += moments.length;
            } catch (err) {
              song.totalMoments = 0;
            }
          }));
          
          if (i + batchSize < songArray.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        setSongs(songArray);
        console.log(`✅ Complete song analysis finished: ${songArray.length} songs, ${totalMomentsFound} total moments`);
        
      } catch (err) {
        console.error('Error loading comprehensive song data:', err);
        setError(`Failed to load song data: ${err.message}`);
      } finally {
        setLoading(false);
        setLoadingProgress({ current: 0, total: 0, status: '' });
      }
    };

    loadComprehensiveSongData();
  }, []);

  // Enhanced sorting
  const sortedSongs = useMemo(() => {
    const sorted = [...songs];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'mostPerformed':
          comparison = b.performances.length - a.performances.length;
          break;
        case 'mostMoments':
          comparison = b.totalMoments - a.totalMoments;
          break;
        case 'lastPerformed':
          const dateA = parseSetlistDate(a.lastPerformed);
          const dateB = parseSetlistDate(b.lastPerformed);
          comparison = (dateB || 0) - (dateA || 0);
          break;
        case 'firstPerformed':
          const firstA = parseSetlistDate(a.firstPerformed);
          const firstB = parseSetlistDate(b.firstPerformed);
          comparison = (firstA || 0) - (firstB || 0);
          break;
        case 'mostVenues':
          comparison = b.venues.length - a.venues.length;
          break;
        case 'alphabetical':
        default:
          comparison = a.songName.localeCompare(b.songName);
          break;
      }
      
      return sortDirection === 'desc' ? -comparison : comparison;
    });
    
    return sorted;
  }, [songs, sortBy, sortDirection]);

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  if (loading) {
    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4">🎵 Browse UMO Songs</h3>
        <div className="text-center py-8">
          <div className="inline-flex flex-col items-center text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-3"></div>
            <div className="text-lg font-medium mb-2">Building comprehensive song database...</div>
            {loadingProgress.status && (
              <div className="text-sm">
                {loadingProgress.status}
                {loadingProgress.total > 0 && (
                  <div className="w-64 bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                    ></div>
                  </div>
                )}
              </div>
            )}
            <div className="text-xs text-gray-400 mt-2">
              Scanning UMO's entire performance history (2010-2025)
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4">🎵 Browse UMO Songs</h3>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          ⚠️ {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h3 className="text-xl font-bold">🎵 UMO Complete Songbook ({songs.length} songs)</h3>
        
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="alphabetical">Alphabetical</option>
            <option value="mostPerformed">Most Performed</option>
            <option value="mostMoments">Most Moments</option>
            <option value="lastPerformed">Last Performed</option>
            <option value="firstPerformed">First Performed</option>
            <option value="mostVenues">Most Venues</option>
          </select>
          
          <button
            onClick={toggleSortDirection}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
            title={`Sort ${sortDirection === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>
      
      {/* Summary info */}
      {songs.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <div className="text-sm text-blue-800">
            <strong>📊 Moment Summary:</strong> 
            {` Total moments found: ${songs.reduce((total, song) => total + song.totalMoments, 0)}`}
            {` • Songs with moments: ${songs.filter(song => song.totalMoments > 0).length}`}
          </div>
        </div>
      )}
      
      {/* Song grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedSongs.map((song) => (
          <button
            key={song.songName}
            onClick={() => onSongSelect(song)}
            className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 hover:border-blue-300 text-left group"
          >
            <div className="font-medium text-gray-900 mb-3 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
              {song.songName}
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-blue-600 font-medium">
                  {song.performances.length} show{song.performances.length !== 1 ? 's' : ''}
                </span>
                {song.totalMoments > 0 ? (
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                    {song.totalMoments} moment{song.totalMoments !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded-full">
                    No moments yet
                  </span>
                )}
              </div>
              
              <div className="text-gray-500 text-xs">
                {song.venues.length} venue{song.venues.length !== 1 ? 's' : ''} • {song.cities.length} cit{song.cities.length !== 1 ? 'ies' : 'y'}
              </div>
              
              <div className="text-gray-500 text-xs">
                {song.firstPerformed === song.lastPerformed ? (
                  <span>Only: {formatShortDateWithYear(song.lastPerformed)}</span>
                ) : (
                  <span>{formatShortDateWithYear(song.firstPerformed)} - {formatShortDateWithYear(song.lastPerformed)}</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
      
      {sortedSongs.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          No songs found
        </div>
      )}
    </div>
  );
};

// Enhanced SongDetail component
const SongDetail = ({ songData, onBack }) => {
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMoment, setSelectedMoment] = useState(null);
  const [uploadingMoment, setUploadingMoment] = useState(null);
  const [viewMode, setViewMode] = useState('chronological');
  const [showPositions, setShowPositions] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const loadSongMoments = async () => {
      try {
        const momentList = await fetchMoments(`song/${encodeURIComponent(songData.songName)}`, `song "${songData.songName}"`);
        setMoments(momentList);
      } catch (err) {
        console.error('Error loading song moments:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSongMoments();
  }, [songData.songName]);

  const handleUploadMoment = (performance) => {
    if (!user) {
      alert('Please log in to upload moments');
      return;
    }
    
    setUploadingMoment({ 
      performanceId: performance.id,
      performanceDate: performance.date,
      venueName: performance.venue,
      venueCity: performance.city,
      venueCountry: performance.country || '',
      songName: songData.songName,
      setName: performance.setName || '',
      songPosition: performance.songPosition || 1
    });
  };

  const groupedPerformances = useMemo(() => {
    switch (viewMode) {
      case 'byVenue':
        const byVenue = {};
        songData.performances.forEach(perf => {
          const key = `${perf.venue} (${perf.city})`;
          if (!byVenue[key]) byVenue[key] = [];
          byVenue[key].push(perf);
        });
        return Object.entries(byVenue).sort(([a], [b]) => a.localeCompare(b));
        
      case 'byYear':
        const byYear = {};
        songData.performances.forEach(perf => {
          const year = perf.date.split('-')[2] || 'Unknown';
          if (!byYear[year]) byYear[year] = [];
          byYear[year].push(perf);
        });
        return Object.entries(byYear).sort(([a], [b]) => b.localeCompare(a));
        
      case 'chronological':
      default:
        return [['All Performances', songData.performances]];
    }
  }, [songData.performances, viewMode]);

  const getPerformanceMoments = (performanceId) => {
    return moments.filter(moment => moment.performanceId === performanceId);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center text-gray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
          Loading "{songData.songName}" details...
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
        >
          ← Back to song search
        </button>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">{songData.songName}</h2>
          
          {/* Song Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">{songData.performances.length}</div>
              <div className="text-sm text-gray-600">Performances</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{songData.venues.length}</div>
              <div className="text-sm text-gray-600">Venues</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-purple-600">{songData.cities.length}</div>
              <div className="text-sm text-gray-600">Cities</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-orange-600">{moments.length}</div>
              <div className="text-sm text-gray-600">Moments</div>
            </div>
          </div>
          
          {/* Date Range */}
          <div className="mt-4 text-center text-gray-600 space-y-2">
            <div className="text-sm">
              First performed: <strong>{formatDate(songData.firstPerformed)}</strong>
              {songData.firstPerformed !== songData.lastPerformed && (
                <> • Last performed: <strong>{formatDate(songData.lastPerformed)}</strong></>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 space-y-4">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">View:</span>
          <div className="bg-white rounded-lg border border-gray-200 p-1 inline-flex">
            {[
              { key: 'chronological', label: '📅 Chronological' },
              { key: 'byVenue', label: '🏟️ By Venue' },
              { key: 'byYear', label: '📆 By Year' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  viewMode === key 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Show Positions Toggle */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showPositions}
              onChange={(e) => setShowPositions(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show song positions in setlist
          </label>
        </div>
      </div>

      {/* Performances List */}
      <div className="space-y-6">
        {groupedPerformances.map(([groupName, performances]) => (
          <div key={groupName} className="border border-gray-200 rounded-lg bg-white shadow-sm">
            {viewMode !== 'chronological' && (
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h4 className="font-semibold text-gray-900">
                  {groupName} <span className="text-sm text-gray-500">({performances.length} performance{performances.length !== 1 ? 's' : ''})</span>
                </h4>
              </div>
            )}
            
            <div className="p-4">
              <div className="space-y-3">
                {performances.map((performance, index) => {
                  const performanceMoments = getPerformanceMoments(performance.id);
                  
                  return (
                    <div key={`${performance.id}-${index}`} className="border-b border-gray-100 pb-3 last:border-b-0">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h5 className="font-medium text-gray-900">
                              {performance.venue}
                            </h5>
                            <span className="text-sm text-gray-500">
                              {performance.city}{performance.country ? `, ${performance.country}` : ''}
                            </span>
                            <span className="text-sm font-medium text-blue-600">
                              {formatShortDate(performance.date)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                            {performance.setName && (
                              <span>Set: {performance.setName}</span>
                            )}
                            {showPositions && performance.songPosition && (
                              <span>Position: #{performance.songPosition}</span>
                            )}
                            {performanceMoments.length > 0 && (
                              <span className="text-green-600 font-medium">
                                {performanceMoments.length} moment{performanceMoments.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {user && (
                          <button
                            onClick={() => handleUploadMoment(performance)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors ml-4 flex-shrink-0"
                          >
                            Upload Moment
                          </button>
                        )}
                      </div>

                      {/* Show moments for this performance */}
                      {performanceMoments.length > 0 && (
                        <div className="mt-3">
                          <div className="flex flex-wrap gap-2">
                            {performanceMoments.map((moment) => (
                              <button
                                key={moment._id}
                                onClick={() => setSelectedMoment(moment)}
                                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded border transition-colors"
                              >
                                by {moment.user?.displayName || 'Anonymous'}
                                {moment.momentType && (
                                  <span className="ml-2 text-xs text-gray-500">
                                    ({moment.momentType})
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {songData.performances.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">🎵</div>
          <h3 className="text-lg font-medium mb-2">No performances found</h3>
          <p>This song hasn't been performed yet or data isn't available.</p>
        </div>
      )}

      {/* Upload Modal */}
      {uploadingMoment && user && (
        <EnhancedUploadModal
          uploadingMoment={uploadingMoment}
          onClose={() => setUploadingMoment(null)}
        />
      )}

      {/* Moment Detail Modal */}
      {selectedMoment && (
        <MomentDetailModal moment={selectedMoment} onClose={() => setSelectedMoment(null)} />
      )}
    </div>
  );
};

const PerformanceDetail = ({ performance, onBack }) => {
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingMoment, setUploadingMoment] = useState(null);
  const [selectedMoment, setSelectedMoment] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    const loadPerformanceMoments = async () => {
      try {
        const momentList = await fetchMoments(`performance/${performance.id}`, `performance ${performance.id}`);
        setMoments(momentList);
      } catch (err) {
        console.error('Error loading performance moments:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPerformanceMoments();
  }, [performance.id]);

  const handleUploadMoment = (song, setInfo, songIndex) => {
    if (!user) {
      alert('Please log in to upload moments');
      return;
    }
    
    setUploadingMoment({ 
      performanceId: performance.id,
      performanceDate: performance.eventDate,
      venueName: performance.venue.name,
      venueCity: performance.venue.city.name,
      venueCountry: performance.venue.city.country?.name || '',
      songName: song.name,
      setName: setInfo?.name || '',
      songPosition: songIndex + 1
    });
  };

  const getSongMoments = (songName) => {
    return moments.filter(moment => moment.songName === songName);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center text-gray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
          Loading performance details...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={onBack}
          className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
        >
          ← Back to latest performances
        </button>
        <h2 className="text-2xl sm:text-3xl font-bold">{performance.venue.name}</h2>
        <p className="text-gray-600">
          {performance.venue.city.name}{performance.venue.city.country ? `, ${performance.venue.city.country.name}` : ''} • {formatDate(performance.eventDate)}
        </p>
        {moments.length > 0 && (
          <p className="text-sm text-blue-600 mt-2">
            {moments.length} moment{moments.length !== 1 ? 's' : ''} uploaded for this show
          </p>
        )}
      </div>

      {/* Setlist */}
      {performance.sets?.set ? (
        <div className="space-y-6">
          {performance.sets.set.map((set, index) => (
            <div key={index} className="border border-gray-200 rounded-lg bg-white shadow-sm p-4">
              {set.name && (
                <h4 className="text-lg font-semibold mb-3 text-blue-600">{set.name}</h4>
              )}
              
              <ol className="space-y-3">
                {set.song?.map((song, i) => {
                  const songMoments = getSongMoments(song.name);
                  
                  return (
                    <li key={`${song.name}-${i}`} className="border-b border-gray-100 pb-3 last:border-b-0">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-sm text-gray-500 w-8">{i + 1}.</span>
                          
                          <div className="flex items-center gap-3 flex-1">
                            <span className="font-medium text-gray-900">{song.name}</span>
                            
                            {songMoments.length > 0 && (
                              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                {songMoments.length} moment{songMoments.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>

                          {user && (
                            <button
                              onClick={() => handleUploadMoment(song, set, i)}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                            >
                              Upload Moment
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Show moments for this song */}
                      {songMoments.length > 0 && (
                        <div className="mt-3 ml-11">
                          <div className="flex flex-wrap gap-2">
                            {songMoments.map((moment) => (
                              <button
                                key={moment._id}
                                onClick={() => setSelectedMoment(moment)}
                                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded border transition-colors"
                              >
                                by {moment.user?.displayName || 'Anonymous'}
                                {moment.momentType && (
                                  <span className="ml-2 text-xs text-gray-500">
                                    ({moment.momentType})
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No setlist available for this performance
        </div>
      )}

      {/* Upload Modal */}
      {uploadingMoment && user && (
        <EnhancedUploadModal
          uploadingMoment={uploadingMoment}
          onClose={() => setUploadingMoment(null)}
        />
      )}

      {/* Moment Detail Modal */}
      {selectedMoment && (
        <MomentDetailModal moment={selectedMoment} onClose={() => setSelectedMoment(null)} />
      )}
    </div>
  );
};

// Main App Component
function MainApp() {
  const [currentView, setCurrentView] = useState('home'); // 'home', 'song', 'performance'
  const [browseMode, setBrowseMode] = useState('performances'); // 'performances', 'songs'
  const [selectedSong, setSelectedSong] = useState(null); // Song object from browse with full performance data
  const [selectedPerformance, setSelectedPerformance] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const { user, logout, loading } = useAuth();

  // Handle song selection from browse view (object with complete performance data)
  const handleSongBrowseSelect = (songData) => {
    console.log('Selected song data:', songData);
    setSelectedSong(songData);
    setCurrentView('song');
  };

  const handlePerformanceSelect = (performance) => {
    console.log('Selected performance:', performance);
    setSelectedPerformance(performance);
    setCurrentView('performance');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedSong(null);
    setSelectedPerformance(null);
  };

  const switchBrowseMode = (mode) => {
    setBrowseMode(mode);
    // Reset any selections when switching modes
    setSelectedSong(null);
    setSelectedPerformance(null);
    setCurrentView('home');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl flex items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
          Loading UMO Repository...
        </div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg">
          <Login />
          <div className="p-4 border-t">
            <button
              onClick={() => setShowLogin(false)}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Continue Browsing Without Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <button onClick={handleBackToHome} className="flex items-center">
            <h1 className="text-2xl sm:text-4xl font-bold text-blue-600 hover:text-blue-800 transition-colors">
              UMO Repository
            </h1>
          </button>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-gray-600">Welcome, {user.displayName}!</span>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="text-gray-600">
                <span className="mr-3">Browse read-only</span>
                <button
                  onClick={() => setShowLogin(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Login to Upload
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content based on current view */}
        {currentView === 'home' && (
          <>
            {/* View Toggle */}
            <div className="mb-6">
              <div className="flex items-center justify-center">
                <div className="bg-white rounded-lg border border-gray-200 p-1 inline-flex">
                  <button
                    onClick={() => switchBrowseMode('performances')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      browseMode === 'performances' 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🎸 Browse by Performance
                  </button>
                  <button
                    onClick={() => switchBrowseMode('songs')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      browseMode === 'songs' 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🎵 Browse by Song
                  </button>
                </div>
              </div>
            </div>

            {/* Content based on browse mode */}
            {browseMode === 'performances' ? (
              <UMOLatestPerformances onPerformanceSelect={handlePerformanceSelect} />
            ) : (
              <UMOBrowseBySong onSongSelect={handleSongBrowseSelect} />
            )}

            {/* Simplified Info Section */}
            <div className="text-center py-12 mt-8 border-t border-gray-200">
              <p className="text-gray-500 max-w-2xl mx-auto">
                {browseMode === 'performances' 
                  ? 'Explore UMO\'s entire performance history, search by city or venue, and upload your own moments from concerts.'
                  : 'Browse every UMO song with complete performance history and fan-uploaded moments.'
                }
              </p>
              
              {/* Add some stats if we're in song mode */}
              {browseMode === 'songs' && (
                <div className="mt-6 bg-blue-50 rounded-lg p-4 max-w-md mx-auto">
                  <div className="text-sm text-blue-800 font-medium mb-2">
                    📊 Comprehensive Database
                  </div>
                  <div className="text-xs text-blue-600">
                    Complete performance history from 2010-2025 • Deep historical analysis • Real-time moment uploads
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Song Detail View */}
        {currentView === 'song' && selectedSong && (
          <SongDetail songData={selectedSong} onBack={handleBackToHome} />
        )}

        {/* Performance Detail View */}
        {currentView === 'performance' && selectedPerformance && (
          <PerformanceDetail performance={selectedPerformance} onBack={handleBackToHome} />
        )}
      </div>
    </div>
  );
}

// App Component
export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}