// src/components/UMOTube/UMOTube.jsx - Linked Media (YouTube clips linked to performances)
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Youtube, Calendar, MapPin, Play, ListMusic, Trash2, Clock, Edit, X, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Eye, Music } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import MomentDetailModal from '../Moment/MomentDetailModal';
import SongAutocomplete from './SongAutocomplete';
import PerformancePicker from './PerformancePicker';

// Helper to parse MM:SS to seconds
const parseTimeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parseInt(timeStr) || 0;
};

// Helper to format seconds to MM:SS
const formatSecondsToTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const UMOTube = ({ user }) => {
  // Admin-only access
  const isAdmin = user && (user.role === 'admin' || user.role === 'mod' || user.email === 'solo@solo.solo' || user.email === 'solo2@solo.solo');

  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dataError, setDataError] = useState('');

  // Edit mode state
  const [myMoments, setMyMoments] = useState([]);
  const [loadingMyMoments, setLoadingMyMoments] = useState(false);
  const [showMyMoments, setShowMyMoments] = useState(false);
  const [editingMoment, setEditingMoment] = useState(null);

  // Expanded video / child moments state
  const [expandedVideoId, setExpandedVideoId] = useState(null);
  const [childMoments, setChildMoments] = useState({});
  const [loadingChildMoments, setLoadingChildMoments] = useState(null);
  const [deletingMomentId, setDeletingMomentId] = useState(null);

  // Setlist generator state
  const [showSetlistGenerator, setShowSetlistGenerator] = useState(false);
  const [selectedVideoForSetlist, setSelectedVideoForSetlist] = useState(null);
  const [setlistRows, setSetlistRows] = useState([
    { songName: '', startTime: '0:00', contentType: 'song' }
  ]);
  const [generatingSetlist, setGeneratingSetlist] = useState(false);
  const [setlistError, setSetlistError] = useState('');
  const [setlistSuccess, setSetlistSuccess] = useState('');
  const [showLinkedSetlist, setShowLinkedSetlist] = useState(false);
  const [setlistPerformanceDisplay, setSetlistPerformanceDisplay] = useState('');

  // Song autocomplete & performance picker data
  const [allSongs, setAllSongs] = useState([]);
  const [allPerformances, setAllPerformances] = useState([]);
  const [linkedPerformance, setLinkedPerformance] = useState(null);
  const [selectedPerformanceDisplay, setSelectedPerformanceDisplay] = useState('');

  const [formData, setFormData] = useState({
    youtubeUrl: '',
    performanceId: '',
    performanceDate: '',
    venueName: '',
    venueCity: '',
    venueCountry: '',
    songName: '',
    setName: 'Main Set',
    contentType: 'song',
    momentDescription: '',
    showInMoments: false,
    startTime: '',
    endTime: ''
  });

  useEffect(() => {
    if (isAdmin) {
      fetchVideos();
      fetchSongsAndPerformances();
    }
  }, [isAdmin]);

  // Fetch songs and performances for autocomplete
  const fetchSongsAndPerformances = async () => {
    try {
      const [songsRes, performancesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/cached/songs`),
        fetch(`${API_BASE_URL}/cached/performances?limit=1000`)
      ]);

      if (songsRes.ok) {
        const songsData = await songsRes.json();
        setAllSongs(songsData.songs || []);
      }

      if (performancesRes.ok) {
        const performancesData = await performancesRes.json();
        // Sort by date descending (most recent first)
        const sorted = (performancesData.performances || []).sort((a, b) => {
          const dateA = a.eventDate?.split('-').reverse().join('-') || '';
          const dateB = b.eventDate?.split('-').reverse().join('-') || '';
          return dateB.localeCompare(dateA);
        });
        setAllPerformances(sorted);
      }
    } catch (err) {
      console.error('Failed to fetch songs/performances:', err);
      setDataError('Failed to load performance data. Try refreshing the page.');
    }
  };

  // Split medley songs by " / " delimiter
  const splitMedley = (songName) => {
    if (!songName) return [songName];
    const parts = songName.split(' / ').map(s => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [songName];
  };

  // Extract songs from linked performance setlist, splitting medleys
  const getPerformanceSongs = useCallback(() => {
    if (!linkedPerformance?.sets?.set) return [];
    return linkedPerformance.sets.set
      .flatMap(set => set.song?.map(s => s.name) || [])
      .flatMap(name => splitMedley(name)); // Split medleys into individual songs
  }, [linkedPerformance]);

  // Guard: only admins can access
  if (!isAdmin) {
    return (
      <div className="umo-container py-12 text-center">
        <div className="max-w-md mx-auto">
          <Youtube className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="umo-heading umo-heading--lg mb-4">Admin Only</h2>
          <p className="umo-text-secondary">
            Linked Media is currently available to administrators only.
          </p>
        </div>
      </div>
    );
  }

  const fetchVideos = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/umotube/videos`);
      const data = await response.json();
      setVideos(data.videos || []);
    } catch (err) {
      console.error('Failed to fetch videos:', err);
      setDataError('Failed to load videos. Try refreshing the page.');
    } finally {
      setLoadingVideos(false);
    }
  };

  // Fetch user's own YouTube moments for editing
  const fetchMyMoments = async () => {
    if (!user) return;
    setLoadingMyMoments(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/my-youtube-moments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setMyMoments(data.moments || []);
    } catch (err) {
      console.error('Failed to fetch my moments:', err);
    } finally {
      setLoadingMyMoments(false);
    }
  };

  // Start editing a moment
  const startEditing = (moment) => {
    setEditingMoment(moment);
    setFormData({
      youtubeUrl: `https://youtube.com/watch?v=${moment.externalVideoId}`,
      performanceId: moment.performanceId || '',
      performanceDate: moment.performanceDate || '',
      venueName: moment.venueName || '',
      venueCity: moment.venueCity || '',
      venueCountry: moment.venueCountry || '',
      songName: moment.songName || '',
      setName: moment.setName || 'Main Set',
      contentType: moment.contentType || 'song',
      momentDescription: moment.momentDescription || '',
      showInMoments: moment.showInMoments !== false,
      startTime: moment.startTime ? formatSecondsToTime(moment.startTime) : '',
      endTime: moment.endTime ? formatSecondsToTime(moment.endTime) : ''
    });
    // Set the performance picker display to show current linked performance
    if (moment.performanceId && allPerformances.length > 0) {
      const linkedPerf = allPerformances.find(p => p.id === moment.performanceId);
      if (linkedPerf) {
        const venue = linkedPerf.venue?.name || '';
        const city = linkedPerf.venue?.city?.name || '';
        const date = linkedPerf.eventDate || '';
        setSelectedPerformanceDisplay(`${venue} - ${city} (${date})`);
      } else {
        // Performance not in cache, show ID
        setSelectedPerformanceDisplay(`Performance ID: ${moment.performanceId}`);
      }
    } else {
      setSelectedPerformanceDisplay('');
    }
    setShowAddForm(true);
    setError('');
    setSuccess('');
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingMoment(null);
    setFormData({
      youtubeUrl: '',
      performanceId: '',
      performanceDate: '',
      venueName: '',
      venueCity: '',
      venueCountry: '',
      songName: '',
      setName: 'Main Set',
      contentType: 'song',
      momentDescription: '',
      showInMoments: false,
      startTime: '',
      endTime: ''
    });
    setShowAddForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');

      // If editing, use PUT endpoint
      if (editingMoment) {
        const response = await fetch(`${API_BASE_URL}/youtube-moment/${editingMoment._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            performanceId: formData.performanceId,
            performanceDate: formData.performanceDate,
            venueName: formData.venueName,
            venueCity: formData.venueCity,
            venueCountry: formData.venueCountry,
            songName: formData.songName,
            setName: formData.setName,
            contentType: formData.contentType,
            momentDescription: formData.momentDescription,
            showInMoments: formData.showInMoments,
            startTime: formData.startTime ? parseTimeToSeconds(formData.startTime) : undefined,
            endTime: formData.endTime ? parseTimeToSeconds(formData.endTime) : undefined
          })
        });

        const data = await response.json();

        if (data.success) {
          setSuccess('YouTube moment updated!');
          fetchVideos();
          fetchMyMoments();
          // Refresh child moments if this was from expanded view
          if (editingMoment.externalVideoId) {
            setChildMoments(prev => ({ ...prev, [editingMoment.externalVideoId]: undefined }));
          }
          setTimeout(() => {
            cancelEditing();
            setSuccess('');
          }, 1500);
        } else {
          setError(data.error || 'Failed to update moment');
        }
      } else {
        // Creating new moment
        const response = await fetch(`${API_BASE_URL}/add-youtube-moment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
          setSuccess('YouTube video submitted for approval!');
          fetchVideos();
          fetchMyMoments();
          setFormData({
            youtubeUrl: '',
            performanceId: '',
            performanceDate: '',
            venueName: '',
            venueCity: '',
            venueCountry: '',
            songName: '',
            setName: 'Main Set',
            contentType: 'song',
            momentDescription: '',
            showInMoments: false,
            startTime: '',
            endTime: ''
          });
          setTimeout(() => {
            setShowAddForm(false);
            setSuccess('');
          }, 2000);
        } else {
          setError(data.error || 'Failed to add video');
        }
      }
    } catch (err) {
      setError(`Failed to ${editingMoment ? 'update' : 'add'} video: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Setlist generator functions
  const addSetlistRow = () => {
    setSetlistRows([...setlistRows, { songName: '', startTime: '', contentType: 'song' }]);
  };

  const removeSetlistRow = (index) => {
    if (setlistRows.length > 1) {
      setSetlistRows(setlistRows.filter((_, i) => i !== index));
    }
  };

  const updateSetlistRow = (index, field, value) => {
    const updated = [...setlistRows];
    updated[index][field] = value;
    setSetlistRows(updated);
  };

  const openSetlistGenerator = async (video) => {
    setSelectedVideoForSetlist(video);
    setSetlistRows([{ songName: '', startTime: '0:00', contentType: 'song' }]);
    setShowSetlistGenerator(true);
    setSetlistError('');
    setSetlistSuccess('');
    setLinkedPerformance(null);
    setShowLinkedSetlist(false);

    // If video has a performanceId, fetch the linked performance for song suggestions
    if (video.performanceId) {
      // Set display from video data initially
      setSetlistPerformanceDisplay(`${video.venueName || ''} - ${video.venueCity || ''} (${video.performanceDate || ''})`);

      try {
        const res = await fetch(`${API_BASE_URL}/cached/performance/${video.performanceId}`);
        if (res.ok) {
          const data = await res.json();
          setLinkedPerformance(data.performance);
          // Update display with better data from performance
          if (data.performance) {
            const venue = data.performance.venue?.name || video.venueName || '';
            const city = data.performance.venue?.city?.name || video.venueCity || '';
            const date = data.performance.eventDate || video.performanceDate || '';
            setSetlistPerformanceDisplay(`${venue} - ${city} (${date})`);
          }
        }
      } catch (err) {
        console.error('Failed to fetch linked performance:', err);
      }
    } else {
      setSetlistPerformanceDisplay('');
    }
  };

  // Handler for when a performance is selected from PerformancePicker
  const handlePerformanceSelect = (performance) => {
    if (performance) {
      // Convert DD-MM-YYYY to YYYY-MM-DD for the date input
      const dateParts = performance.eventDate?.split('-');
      const isoDate = dateParts?.length === 3
        ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`
        : '';

      setFormData(prev => ({
        ...prev,
        performanceId: performance.id,
        performanceDate: isoDate,
        venueName: performance.venue?.name || '',
        venueCity: performance.venue?.city?.name || '',
        venueCountry: performance.venue?.city?.country?.name || ''
      }));
    } else {
      // Clear performance fields
      setFormData(prev => ({
        ...prev,
        performanceId: '',
        performanceDate: '',
        venueName: '',
        venueCity: '',
        venueCountry: ''
      }));
    }
  };

  // Handler for changing performance in setlist generator modal
  const handleSetlistPerformanceSelect = async (performance) => {
    if (performance) {
      // Update display
      const venue = performance.venue?.name || '';
      const city = performance.venue?.city?.name || '';
      const date = performance.eventDate || '';
      setSetlistPerformanceDisplay(`${venue} - ${city} (${date})`);

      // Update the selectedVideoForSetlist with new performance data
      setSelectedVideoForSetlist(prev => ({
        ...prev,
        performanceId: performance.id,
        venueName: venue,
        venueCity: city,
        performanceDate: date
      }));

      // Fetch full performance data for setlist
      setLinkedPerformance(performance);

      // Clear existing rows when changing performance
      setSetlistRows([{ songName: '', startTime: '0:00', contentType: 'song' }]);
      setShowLinkedSetlist(false);
    }
  };

  // Pre-fill setlist from linked performance
  const populateFromSetlist = () => {
    const songs = getPerformanceSongs();
    if (songs.length === 0) return;

    // Create rows for each song (without times - user fills those in)
    const newRows = songs.map((name, index) => ({
      songName: name,
      startTime: '',
      contentType: 'song'
    }));

    setSetlistRows(newRows);
  };

  const generateSetlist = async () => {
    if (!selectedVideoForSetlist) return;

    // Validate rows
    const validRows = setlistRows.filter(row => row.songName.trim() && row.startTime);
    if (validRows.length === 0) {
      setSetlistError('Please add at least one song with a name and start time');
      return;
    }

    setGeneratingSetlist(true);
    setSetlistError('');
    setSetlistSuccess('');

    try {
      const token = localStorage.getItem('token');

      // Sort rows by start time
      const sortedRows = [...validRows].sort((a, b) =>
        parseTimeToSeconds(a.startTime) - parseTimeToSeconds(b.startTime)
      );

      // Calculate end times (each song ends when next begins)
      const momentsToCreate = sortedRows.map((row, index) => {
        const startTime = parseTimeToSeconds(row.startTime);
        const endTime = index < sortedRows.length - 1
          ? parseTimeToSeconds(sortedRows[index + 1].startTime)
          : null; // Last song has no end time

        return {
          songName: row.songName.trim(),
          startTime,
          endTime,
          contentType: row.contentType,
          // Copy info from parent video
          performanceId: selectedVideoForSetlist.performanceId,
          performanceDate: selectedVideoForSetlist.performanceDate,
          venueName: selectedVideoForSetlist.venueName,
          venueCity: selectedVideoForSetlist.venueCity,
          venueCountry: selectedVideoForSetlist.venueCountry,
          externalVideoId: selectedVideoForSetlist.externalVideoId,
          mediaSource: 'youtube',
          setName: selectedVideoForSetlist.setName || 'Main Set'
        };
      });

      // Create moments via API
      const response = await fetch(`${API_BASE_URL}/admin/moments/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ moments: momentsToCreate })
      });

      const data = await response.json();

      if (data.success) {
        setSetlistSuccess(`Created ${data.created} song moments!`);
        fetchVideos();
        setTimeout(() => {
          setShowSetlistGenerator(false);
          setSetlistSuccess('');
        }, 2000);
      } else {
        setSetlistError(data.error || 'Failed to generate setlist');
      }
    } catch (err) {
      setSetlistError(`Failed to generate setlist: ${err.message}`);
    } finally {
      setGeneratingSetlist(false);
    }
  };

  // Get YouTube thumbnail from video ID
  const getYouTubeThumbnail = (videoId) => {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  };

  // Fetch child moments for a video
  const fetchChildMoments = async (videoId) => {
    if (childMoments[videoId]) return; // Already loaded

    setLoadingChildMoments(videoId);
    try {
      const response = await fetch(`${API_BASE_URL}/umotube/video/${videoId}/moments`);
      const data = await response.json();
      setChildMoments(prev => ({
        ...prev,
        [videoId]: data.moments || []
      }));
    } catch (err) {
      console.error('Failed to fetch child moments:', err);
    } finally {
      setLoadingChildMoments(null);
    }
  };

  // Toggle video expansion
  const toggleVideoExpand = (video) => {
    const videoId = video.externalVideoId;
    if (expandedVideoId === videoId) {
      setExpandedVideoId(null);
    } else {
      setExpandedVideoId(videoId);
      fetchChildMoments(videoId);
    }
  };

  // Delete a child moment
  const deleteChildMoment = async (momentId, videoId) => {
    if (!window.confirm('Delete this moment? This cannot be undone.')) return;

    setDeletingMomentId(momentId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/moments/${momentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        // Remove from local state
        setChildMoments(prev => ({
          ...prev,
          [videoId]: prev[videoId].filter(m => m._id !== momentId)
        }));
        setSuccess('Moment deleted');
        setTimeout(() => setSuccess(''), 2000);
      } else {
        setError(data.error || 'Failed to delete moment');
      }
    } catch (err) {
      setError(`Failed to delete moment: ${err.message}`);
    } finally {
      setDeletingMomentId(null);
    }
  };

  // Edit a child moment
  const editChildMoment = (moment) => {
    startEditing(moment);
    setExpandedVideoId(null);
  };

  // Format start time
  const formatStartTime = (seconds) => {
    if (!seconds && seconds !== 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="umo-container py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Youtube className="w-8 h-8 text-red-500" />
              <h1 className="umo-heading umo-heading--xl">Linked Media</h1>
            </div>
            <p className="umo-text-secondary">YouTube and external media linked to performances</p>
          </div>
          {user && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowMyMoments(!showMyMoments);
                  if (!showMyMoments) fetchMyMoments();
                }}
                className="umo-btn umo-btn--secondary flex items-center gap-2"
              >
                <Edit size={18} />
                My Moments
              </button>
              <button
                onClick={() => {
                  cancelEditing();
                  setShowAddForm(!showAddForm);
                }}
                className="umo-btn umo-btn--primary flex items-center gap-2"
              >
                <Plus size={18} />
                Submit YouTube Clip
              </button>
            </div>
          )}
        </div>

        {/* Data Error Display */}
        {dataError && (
          <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg mb-6">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-400" />
              <p className="text-red-400">{dataError}</p>
            </div>
          </div>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="umo-card mb-8 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="umo-heading umo-heading--lg">
                {editingMoment ? 'Edit YouTube Moment' : 'Submit YouTube Clip'}
              </h2>
              {editingMoment && (
                <button
                  onClick={cancelEditing}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              )}
            </div>
            <p className="umo-text-secondary text-sm mb-4">
              {editingMoment
                ? 'Update the details for this YouTube moment.'
                : 'Link a YouTube video to the UMO Archive. Submissions require moderator approval.'}
            </p>

            {error && (
              <div className="bg-red-900/20 border border-red-500/30 p-4 rounded mb-4">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-900/20 border border-green-500/30 p-4 rounded mb-4">
                <p className="text-green-400">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* YouTube URL */}
              <div>
                <label className="block text-sm font-medium umo-text-primary mb-2">YouTube URL *</label>
                <input
                  type="url"
                  value={formData.youtubeUrl}
                  onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                  placeholder="https://youtu.be/... or https://youtube.com/watch?v=..."
                  className={`umo-input w-full ${editingMoment ? 'opacity-50 cursor-not-allowed' : ''}`}
                  required={!editingMoment}
                  disabled={!!editingMoment}
                />
                {editingMoment && (
                  <p className="text-xs umo-text-muted mt-1">YouTube URL cannot be changed when editing</p>
                )}
              </div>

              {/* Performance Picker - links to setlist.fm */}
              <div className="mb-2">
                <label className="block text-sm font-medium umo-text-primary mb-2">Link to Performance *</label>
                <PerformancePicker
                  value={selectedPerformanceDisplay}
                  onChange={setSelectedPerformanceDisplay}
                  onSelect={handlePerformanceSelect}
                  performances={allPerformances}
                  placeholder="Search shows by venue, city, or date..."
                />
                {editingMoment && formData.performanceId && (
                  <p className="text-xs umo-text-muted mt-1">
                    Currently linked to: {formData.performanceId} (select a different show above to change)
                  </p>
                )}
              </div>

              {/* Auto-filled Performance Details (read-only when picker used) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium umo-text-primary mb-2">Performance Date *</label>
                  <input
                    type="date"
                    value={formData.performanceDate}
                    onChange={(e) => setFormData({ ...formData, performanceDate: e.target.value })}
                    className="umo-input w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium umo-text-primary mb-2">Venue Name *</label>
                  <input
                    type="text"
                    value={formData.venueName}
                    onChange={(e) => setFormData({ ...formData, venueName: e.target.value })}
                    placeholder="e.g., The Wiltern"
                    className="umo-input w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium umo-text-primary mb-2">City *</label>
                  <input
                    type="text"
                    value={formData.venueCity}
                    onChange={(e) => setFormData({ ...formData, venueCity: e.target.value })}
                    placeholder="e.g., Los Angeles"
                    className="umo-input w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium umo-text-primary mb-2">Country</label>
                  <input
                    type="text"
                    value={formData.venueCountry}
                    onChange={(e) => setFormData({ ...formData, venueCountry: e.target.value })}
                    placeholder="e.g., United States"
                    className="umo-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium umo-text-primary mb-2">Song/Content Name *</label>
                  <input
                    type="text"
                    value={formData.songName}
                    onChange={(e) => setFormData({ ...formData, songName: e.target.value })}
                    placeholder="e.g., Multi-Love or Full Performance"
                    className="umo-input w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium umo-text-primary mb-2">Content Type</label>
                  <select
                    value={formData.contentType}
                    onChange={(e) => setFormData({ ...formData, contentType: e.target.value })}
                    className="umo-select w-full"
                  >
                    <option value="song">Single Song</option>
                    <option value="jam">Jam/Improv</option>
                    <option value="other">Full Performance / Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium umo-text-primary mb-2">Set</label>
                  <select
                    value={formData.setName}
                    onChange={(e) => setFormData({ ...formData, setName: e.target.value })}
                    className="umo-select w-full"
                  >
                    <option value="Main Set">Main Set</option>
                    <option value="Encore">Encore</option>
                  </select>
                </div>

                {/* Start/End Time - shown when editing */}
                {editingMoment && (
                  <>
                    <div>
                      <label className="block text-sm font-medium umo-text-primary mb-2">Start Time (MM:SS)</label>
                      <input
                        type="text"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        placeholder="0:00"
                        className="umo-input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium umo-text-primary mb-2">End Time (MM:SS)</label>
                      <input
                        type="text"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        placeholder="Optional"
                        className="umo-input w-full"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium umo-text-primary mb-2">Description</label>
                <textarea
                  value={formData.momentDescription}
                  onChange={(e) => setFormData({ ...formData, momentDescription: e.target.value })}
                  placeholder="Describe this performance..."
                  className="umo-input umo-textarea w-full"
                  rows={3}
                />
              </div>

              {/* Show in Moments Toggle */}
              <div className="flex items-center gap-3 p-4 bg-gray-800 rounded">
                <input
                  type="checkbox"
                  id="showInMoments"
                  checked={formData.showInMoments}
                  onChange={(e) => setFormData({ ...formData, showInMoments: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="showInMoments" className="umo-text-primary cursor-pointer text-sm">
                  Also show this in the main Moments feed
                </label>
              </div>

              {/* Submit */}
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="umo-btn umo-btn--primary"
                >
                  {loading
                    ? (editingMoment ? 'Saving...' : 'Submitting...')
                    : (editingMoment ? 'Save Changes' : 'Submit for Approval')}
                </button>
                <button
                  type="button"
                  onClick={editingMoment ? cancelEditing : () => setShowAddForm(false)}
                  className="umo-btn umo-btn--secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* My YouTube Moments Section */}
        {showMyMoments && (
          <div className="umo-card mb-8 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="umo-heading umo-heading--lg flex items-center gap-2">
                <Edit size={20} />
                My YouTube Moments
              </h2>
              <button
                onClick={() => setShowMyMoments(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {loadingMyMoments ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-2"></div>
                <p className="umo-text-secondary text-sm">Loading your moments...</p>
              </div>
            ) : myMoments.length === 0 ? (
              <div className="text-center py-8">
                <Youtube className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                <p className="umo-text-secondary">You haven't submitted any YouTube moments yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myMoments.map(moment => (
                  <div
                    key={moment._id}
                    className="flex items-center gap-4 p-3 bg-gray-800/50 rounded hover:bg-gray-800 transition-colors"
                  >
                    {/* Thumbnail */}
                    <img
                      src={`https://img.youtube.com/vi/${moment.externalVideoId}/default.jpg`}
                      alt={moment.songName}
                      className="w-20 h-14 object-cover rounded"
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="umo-text-primary font-medium truncate">{moment.songName}</h3>
                      <p className="umo-text-secondary text-sm truncate">
                        {moment.venueName} - {moment.venueCity}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs umo-text-muted">{moment.performanceDate}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          moment.approvalStatus === 'approved'
                            ? 'bg-green-600/20 text-green-400'
                            : moment.approvalStatus === 'pending'
                            ? 'bg-yellow-600/20 text-yellow-400'
                            : 'bg-red-600/20 text-red-400'
                        }`}>
                          {moment.approvalStatus}
                        </span>
                      </div>
                    </div>

                    {/* Edit button */}
                    <button
                      onClick={() => {
                        startEditing(moment);
                        setShowMyMoments(false);
                      }}
                      className="umo-btn umo-btn--secondary flex items-center gap-1 text-sm"
                    >
                      <Edit size={14} />
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Video Grid */}
        {loadingVideos ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
            <p className="umo-text-secondary">Loading videos...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12">
            <Youtube className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="umo-heading umo-heading--lg mb-4">No videos yet</h2>
            <p className="umo-text-secondary">
              {user ? 'Submit YouTube clips above to get started.' : 'Check back soon for videos!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map(video => {
              const isExpanded = expandedVideoId === video.externalVideoId;
              const moments = childMoments[video.externalVideoId] || [];
              const isLoading = loadingChildMoments === video.externalVideoId;

              return (
                <div
                  key={video._id}
                  className={`umo-card overflow-hidden transition-all ${isExpanded ? 'col-span-1 md:col-span-2 lg:col-span-3' : ''}`}
                >
                  {/* Main card content */}
                  <div className={`${isExpanded ? 'flex flex-col md:flex-row' : ''}`}>
                    {/* Thumbnail with play overlay */}
                    <div className={`relative ${isExpanded ? 'md:w-1/3' : ''} aspect-video bg-black group cursor-pointer`}
                      onClick={() => setSelectedVideo(video)}
                    >
                      <img
                        src={getYouTubeThumbnail(video.externalVideoId)}
                        alt={video.songName}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center">
                          <Play size={32} className="text-black ml-1" />
                        </div>
                      </div>
                      <div className="absolute top-2 right-2">
                        <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-medium">
                          YouTube
                        </span>
                      </div>
                    </div>

                    {/* Video Info */}
                    <div className={`p-4 ${isExpanded ? 'md:w-2/3' : ''}`}>
                      <h3 className="umo-heading umo-heading--sm mb-2 line-clamp-1">{video.songName}</h3>
                      <div className="flex items-center gap-2 text-sm umo-text-secondary mb-1">
                        <MapPin size={14} />
                        <span className="line-clamp-1">{video.venueName} • {video.venueCity}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs umo-text-muted">
                        <Calendar size={12} />
                        <span>{video.performanceDate}</span>
                      </div>
                      {video.momentDescription && (
                        <p className="umo-text-secondary text-sm mt-2 line-clamp-2">
                          {video.momentDescription}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 bg-gray-700 rounded">
                            {video.contentType === 'song' ? 'Song' :
                             video.contentType === 'jam' ? 'Jam' : 'Full Performance'}
                          </span>
                          {video.user?.displayName && (
                            <span className="text-xs umo-text-muted">
                              by {video.user.displayName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleVideoExpand(video);
                            }}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                              isExpanded
                                ? 'bg-blue-600/30 text-blue-300 hover:bg-blue-600/50'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                            title="Manage child moments"
                          >
                            <Music size={12} />
                            Moments
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openSetlistGenerator(video);
                            }}
                            className="flex items-center gap-1 text-xs px-2 py-1 bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/40 rounded transition-colors"
                            title="Generate song moments from this video"
                          >
                            <ListMusic size={12} />
                            Setlist
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded child moments section */}
                  {isExpanded && (
                    <div className="border-t border-gray-700 p-4 bg-gray-800/30">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                          <Music size={16} />
                          Child Moments ({moments.length})
                        </h4>
                        <button
                          onClick={() => setChildMoments(prev => ({ ...prev, [video.externalVideoId]: undefined }))}
                          className="text-xs text-gray-500 hover:text-gray-300"
                          title="Refresh"
                          onMouseUp={() => fetchChildMoments(video.externalVideoId)}
                        >
                          Refresh
                        </button>
                      </div>

                      {isLoading ? (
                        <div className="text-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500 mx-auto"></div>
                        </div>
                      ) : moments.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          No child moments yet. Use "Setlist" to generate them.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {moments.map((moment) => (
                            <div
                              key={moment._id}
                              className="flex items-center gap-3 p-3 bg-gray-900/50 rounded hover:bg-gray-900 transition-colors"
                            >
                              {/* Song info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-200 truncate">{moment.songName}</span>
                                  {moment.contentType !== 'song' && (
                                    <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">
                                      {moment.contentType}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Clock size={10} />
                                    {formatStartTime(moment.startTime)}
                                    {moment.endTime && ` - ${formatStartTime(moment.endTime)}`}
                                  </span>
                                  {moment.showInMoments !== false && (
                                    <span className="text-green-500">In Moments</span>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setSelectedVideo(moment)}
                                  className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-900/30 rounded transition-colors"
                                  title="Watch"
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  onClick={() => editChildMoment(moment)}
                                  className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-yellow-900/30 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => deleteChildMoment(moment._id, video.externalVideoId)}
                                  disabled={deletingMomentId === moment._id}
                                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                                  title="Delete"
                                >
                                  {deletingMomentId === moment._id ? (
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-red-500"></div>
                                  ) : (
                                    <Trash2 size={14} />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Setlist Generator Modal */}
      {showSetlistGenerator && selectedVideoForSetlist && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="umo-card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <ListMusic className="w-6 h-6 text-yellow-500" />
                  <h2 className="umo-heading umo-heading--lg">Generate Setlist</h2>
                </div>
                <button
                  onClick={() => setShowSetlistGenerator(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  &times;
                </button>
              </div>

              {/* Video info */}
              <div className="bg-gray-800 p-4 rounded mb-4">
                <div className="flex items-center gap-4">
                  <img
                    src={getYouTubeThumbnail(selectedVideoForSetlist.externalVideoId)}
                    alt={selectedVideoForSetlist.songName}
                    className="w-32 h-20 object-cover rounded"
                  />
                  <div>
                    <h3 className="umo-heading umo-heading--sm">{selectedVideoForSetlist.songName}</h3>
                    <p className="umo-text-muted text-xs">Video ID: {selectedVideoForSetlist.externalVideoId}</p>
                  </div>
                </div>
              </div>

              {/* Performance Picker - change which show this is linked to */}
              <div className="mb-4">
                <label className="block text-sm font-medium umo-text-primary mb-2">
                  Link to Performance (setlist.fm)
                </label>
                <PerformancePicker
                  value={setlistPerformanceDisplay}
                  onChange={setSetlistPerformanceDisplay}
                  onSelect={handleSetlistPerformanceSelect}
                  performances={allPerformances}
                  placeholder="Search shows by venue, city, or date..."
                />
                <p className="text-xs umo-text-muted mt-1">
                  Select a different show if the current one is incorrect
                </p>
              </div>

              {/* Warning if no performance linked */}
              {!selectedVideoForSetlist?.performanceId && (
                <div className="flex items-center gap-2 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded mb-4">
                  <AlertTriangle size={18} className="text-yellow-500 flex-shrink-0" />
                  <p className="text-yellow-400 text-sm">
                    No performance linked - moments may not appear in show pages. Link a performance first.
                  </p>
                </div>
              )}

              {/* Performance linked indicator with expandable setlist */}
              {linkedPerformance && (
                <div className="bg-green-900/20 border border-green-500/30 rounded mb-4">
                  <div className="flex items-center justify-between p-3">
                    <button
                      onClick={() => setShowLinkedSetlist(!showLinkedSetlist)}
                      className="flex items-center gap-2 hover:text-green-300 transition-colors"
                    >
                      <CheckCircle size={18} className="text-green-500" />
                      <p className="text-green-400 text-sm">
                        Linked to setlist.fm - {getPerformanceSongs().length} songs
                      </p>
                      {showLinkedSetlist ? (
                        <ChevronUp size={16} className="text-green-500" />
                      ) : (
                        <ChevronDown size={16} className="text-green-500" />
                      )}
                    </button>
                    <button
                      onClick={populateFromSetlist}
                      className="text-xs px-3 py-1 bg-green-600/30 hover:bg-green-600/50 text-green-300 rounded transition-colors"
                    >
                      Pre-fill songs
                    </button>
                  </div>

                  {/* Expandable setlist preview */}
                  {showLinkedSetlist && (
                    <div className="px-3 pb-3 border-t border-green-500/20 pt-2">
                      <p className="text-xs text-gray-400 mb-2">
                        Setlist from setlist.fm (click "Pre-fill" to use, or enter manually if incorrect):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {getPerformanceSongs().map((song, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 bg-gray-800/50 text-gray-300 rounded"
                          >
                            {idx + 1}. {song}
                          </span>
                        ))}
                      </div>
                      {getPerformanceSongs().length === 0 && (
                        <p className="text-xs text-yellow-400">
                          No songs found in setlist - enter them manually below.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <p className="umo-text-secondary text-sm mb-4">
                Add songs with their start times (MM:SS). End times will be calculated automatically.
              </p>

              {setlistError && (
                <div className="bg-red-900/20 border border-red-500/30 p-3 rounded mb-4">
                  <p className="text-red-400 text-sm">{setlistError}</p>
                </div>
              )}

              {setlistSuccess && (
                <div className="bg-green-900/20 border border-green-500/30 p-3 rounded mb-4">
                  <p className="text-green-400 text-sm">{setlistSuccess}</p>
                </div>
              )}

              {/* Song rows */}
              <div className="space-y-3 mb-6">
                {setlistRows.map((row, index) => (
                  <div key={index} className="flex items-center gap-3 bg-gray-800/50 p-3 rounded">
                    <span className="text-gray-500 text-sm w-6">{index + 1}.</span>

                    <SongAutocomplete
                      value={row.songName}
                      onChange={(value) => updateSetlistRow(index, 'songName', value)}
                      allSongs={allSongs}
                      performanceSongs={getPerformanceSongs()}
                      placeholder="Song name"
                    />

                    <div className="flex items-center gap-1">
                      <Clock size={14} className="text-gray-500" />
                      <input
                        type="text"
                        value={row.startTime}
                        onChange={(e) => updateSetlistRow(index, 'startTime', e.target.value)}
                        placeholder="0:00"
                        className="umo-input w-20 text-center"
                      />
                    </div>

                    <select
                      value={row.contentType}
                      onChange={(e) => updateSetlistRow(index, 'contentType', e.target.value)}
                      className="umo-select w-24"
                    >
                      <option value="song">Song</option>
                      <option value="jam">Jam</option>
                    </select>

                    <button
                      onClick={() => removeSetlistRow(index)}
                      className="text-gray-500 hover:text-red-400 transition-colors p-1"
                      disabled={setlistRows.length <= 1}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addSetlistRow}
                className="umo-btn umo-btn--secondary w-full mb-6"
              >
                <Plus size={16} className="mr-2" />
                Add Song
              </button>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={generateSetlist}
                  disabled={generatingSetlist}
                  className="umo-btn umo-btn--primary flex-1"
                >
                  {generatingSetlist ? 'Generating...' : 'Generate Moments'}
                </button>
                <button
                  onClick={() => setShowSetlistGenerator(false)}
                  className="umo-btn umo-btn--secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Detail Modal */}
      {selectedVideo && (
        <MomentDetailModal
          moment={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
};

export default UMOTube;
