// src/components/Collection/PublicCollectionView.jsx
// Public collection view for shared collection links
import React, { useState, useEffect, memo } from 'react';
import { Play, ListMusic, ArrowLeft, Globe, User, Loader2, Share2, Check } from 'lucide-react';
import { API_BASE_URL } from '../Auth/AuthProvider';
import { useTheaterQueue } from '../../contexts/TheaterQueueContext';
import { transformMediaUrl } from '../../utils/mediaUrl';
import MomentDetailModal from '../Moment/MomentDetailModal';
import VideoHero from '../UI/VideoHero';

// Helper functions for YouTube detection
const isYouTubeMoment = (m) => {
  // Exclude archive.org content
  if (m.mediaSource === 'archive' || m.mediaUrl?.includes('archive.org') ||
      m.externalVideoId?.match(/^umo\d{4}/i)) return false;

  return m.mediaSource === 'youtube' ||
    m.mediaUrl?.includes('youtube.com') ||
    m.mediaUrl?.includes('youtu.be') ||
    (m.externalVideoId && m.mediaSource !== 'archive');
};

const getYouTubeId = (moment) => {
  // Check externalVideoId first (11 char YouTube ID)
  if (moment.externalVideoId && moment.externalVideoId.match(/^[a-zA-Z0-9_-]{11}$/)) {
    return moment.externalVideoId;
  }
  // Extract from URL
  const url = moment.mediaUrl;
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

const PublicCollectionView = memo(({ collectionId, onBack }) => {
  const [collection, setCollection] = useState(null);
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMoment, setSelectedMoment] = useState(null);
  const [copied, setCopied] = useState(false);

  const { isInQueue, addToQueue } = useTheaterQueue();

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API_BASE_URL}/api/community/collections/${collectionId}/public`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Collection not found or is private');
          } else {
            setError('Failed to load collection');
          }
          return;
        }

        const data = await response.json();
        setCollection(data.collection);
        setMoments(data.moments || []);
      } catch (err) {
        console.error('Error fetching collection:', err);
        setError('Failed to load collection');
      } finally {
        setLoading(false);
      }
    };

    if (collectionId) {
      fetchCollection();
    }
  }, [collectionId]);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}?collection=${collectionId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="animate-spin" size={24} />
          <span>Loading collection...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <div className="text-red-500 text-lg mb-4">{error}</div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Archive
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
      >
        <ArrowLeft size={18} />
        Back to Archive
      </button>

      {/* Video Hero Player - plays collection moments */}
      {moments.length > 0 && (
        <VideoHero
          customMoments={moments}
          onMomentClick={(m) => setSelectedMoment(m)}
        />
      )}

      {/* Collection Header */}
      <div className="bg-white/80 backdrop-blur-sm rounded-sm border border-gray-200/50 p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe size={18} className="text-green-600" />
              <span className="text-sm text-green-600 font-medium">Public Collection</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{collection?.name}</h1>
            {collection?.description && (
              <p className="text-gray-600 mb-3">{collection.description}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <User size={14} />
              <span>by {collection?.user?.displayName || 'Unknown'}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              {copied ? <Check size={16} className="text-green-600" /> : <Share2 size={16} />}
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 text-gray-600">
            <ListMusic size={18} />
            <span className="font-medium">{moments.length} moments</span>
          </div>
        </div>
      </div>

      {/* Moments Grid */}
      {moments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ListMusic size={48} className="mx-auto mb-4 opacity-50" />
          <p>This collection is empty</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {moments.map((moment) => {
            const inQueue = isInQueue(moment._id);
            return (
              <div
                key={moment._id}
                className="bg-white/80 backdrop-blur-sm rounded-sm border border-gray-200/50 overflow-hidden hover:shadow-lg transition-all duration-200 group"
              >
                {/* Thumbnail */}
                <div
                  className="relative aspect-video cursor-pointer bg-gray-900"
                  onClick={() => setSelectedMoment(moment)}
                >
                  {moment.mediaUrl && (
                    <>
                      {isYouTubeMoment(moment) ? (
                        // YouTube iframe preview with autoplay
                        (() => {
                          const ytId = getYouTubeId(moment);
                          return ytId ? (
                            <div className="absolute inset-0">
                              <iframe
                                src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytId}&start=${Math.floor(moment.startTime || 0)}&playsinline=1&modestbranding=1&rel=0`}
                                className="absolute inset-0 w-full h-full"
                                title={moment.songName}
                                frameBorder="0"
                                allow="autoplay; encrypted-media"
                                loading="lazy"
                              />
                              {/* Transparent click overlay */}
                              <div className="absolute inset-0 z-10 cursor-pointer" />
                              {/* YouTube badge */}
                              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded z-20">
                                YT
                              </div>
                            </div>
                          ) : (
                            <img
                              src={moment.thumbnailUrl || `https://img.youtube.com/vi/${moment.externalVideoId}/hqdefault.jpg`}
                              alt={moment.songName}
                              className="w-full h-full object-cover"
                            />
                          );
                        })()
                      ) : moment.mediaType === 'video' ? (
                        <video
                          src={transformMediaUrl(moment.thumbnailUrl || moment.mediaUrl)}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                          onMouseEnter={(e) => e.target.play()}
                          onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0; }}
                        />
                      ) : (
                        <img
                          src={transformMediaUrl(moment.thumbnailUrl || moment.mediaUrl)}
                          alt={moment.songName}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
                          <Play size={18} className="text-gray-800 ml-0.5" fill="currentColor" />
                        </div>
                      </div>
                    </>
                  )}
                  {!moment.mediaUrl && (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                      <span className="text-3xl">🎵</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <h3 className="font-medium text-gray-900 truncate text-sm mb-1">
                    {moment.songName}
                  </h3>
                  <p className="text-xs text-gray-500 truncate mb-2">
                    {moment.venueName}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!inQueue) addToQueue(moment);
                    }}
                    disabled={inQueue}
                    className={`w-full px-2 py-1 text-xs rounded flex items-center justify-center gap-1 transition-colors ${
                      inQueue
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {inQueue ? (
                      <>
                        <Check size={12} />
                        In Queue
                      </>
                    ) : (
                      <>
                        <Play size={12} />
                        Add to Queue
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Moment Detail Modal */}
      {selectedMoment && (
        <MomentDetailModal
          moment={selectedMoment}
          onClose={() => setSelectedMoment(null)}
        />
      )}
    </div>
  );
});

PublicCollectionView.displayName = 'PublicCollectionView';

export default PublicCollectionView;
