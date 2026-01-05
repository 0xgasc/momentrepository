// src/components/UMOTube/UMOTube.jsx - YouTube linked clips feature
import React, { useState, useEffect } from 'react';
import { Plus, Youtube, Calendar, MapPin, Play } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import MomentDetailModal from '../Moment/MomentDetailModal';

const UMOTube = ({ user }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    showInMoments: false
  });

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/umotube/videos`);
      const data = await response.json();
      setVideos(data.videos || []);
    } catch (err) {
      console.error('Failed to fetch videos:', err);
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
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
          showInMoments: false
        });
        setTimeout(() => {
          setShowAddForm(false);
          setSuccess('');
        }, 2000);
      } else {
        setError(data.error || 'Failed to add video');
      }
    } catch (err) {
      setError(`Failed to add video: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Check if user is admin/mod
  const isAdmin = user && (user.role === 'admin' || user.role === 'mod');

  // Get YouTube thumbnail from video ID
  const getYouTubeThumbnail = (videoId) => {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  };

  return (
    <div className="umo-container py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Youtube className="w-8 h-8 text-red-500" />
              <h1 className="umo-heading umo-heading--xl">UMOTube</h1>
            </div>
            <p className="umo-text-secondary">YouTube performance clips from Unknown Mortal Orchestra</p>
          </div>
          {user && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="umo-btn umo-btn--primary flex items-center gap-2"
            >
              <Plus size={18} />
              Submit YouTube Clip
            </button>
          )}
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="umo-card mb-8 p-6">
            <h2 className="umo-heading umo-heading--lg mb-4">Submit YouTube Clip</h2>
            <p className="umo-text-secondary text-sm mb-4">
              Link a YouTube video to the UMO Archive. Submissions require moderator approval.
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
                  className="umo-input w-full"
                  required
                />
              </div>

              {/* Performance Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium umo-text-primary mb-2">Performance ID *</label>
                  <input
                    type="text"
                    value={formData.performanceId}
                    onChange={(e) => setFormData({ ...formData, performanceId: e.target.value })}
                    placeholder="e.g., 73b69823 (from setlist.fm URL)"
                    className="umo-input w-full"
                    required
                  />
                  <p className="text-xs umo-text-muted mt-1">Find this in the setlist.fm URL for this show</p>
                </div>

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
                  {loading ? 'Submitting...' : 'Submit for Approval'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="umo-btn umo-btn--secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
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
            {videos.map(video => (
              <div
                key={video._id}
                className="umo-card overflow-hidden cursor-pointer hover:border-yellow-500/50 transition-all group"
                onClick={() => setSelectedVideo(video)}
              >
                {/* Thumbnail with play overlay */}
                <div className="relative aspect-video bg-black">
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
                <div className="p-4">
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
                  <div className="mt-3 flex items-center gap-2">
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
