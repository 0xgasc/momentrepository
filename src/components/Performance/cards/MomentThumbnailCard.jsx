// src/components/Performance/cards/MomentThumbnailCard.jsx
import React, { memo, useState } from 'react';
import { Clock, Play, Music, Film, Mic, Youtube, Loader2 } from 'lucide-react';
import { transformMediaUrl } from '../../../utils/mediaUrl';

// Format seconds to MM:SS or HH:MM:SS
const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return null;

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Rarity color configs
const rarityConfig = {
  legendary: {
    bg: 'from-yellow-500/30 to-orange-500/30',
    border: 'border-yellow-500/50',
    dot: 'bg-yellow-400'
  },
  mythic: {
    bg: 'from-purple-500/30 to-pink-500/30',
    border: 'border-purple-500/50',
    dot: 'bg-purple-400'
  },
  epic: {
    bg: 'from-violet-500/30 to-purple-500/30',
    border: 'border-violet-500/50',
    dot: 'bg-violet-400'
  },
  rare: {
    bg: 'from-red-500/30 to-pink-500/30',
    border: 'border-red-500/50',
    dot: 'bg-red-400'
  },
  uncommon: {
    bg: 'from-blue-500/30 to-cyan-500/30',
    border: 'border-blue-500/50',
    dot: 'bg-blue-400'
  },
  common: {
    bg: 'from-gray-500/20 to-gray-600/20',
    border: 'border-gray-600/50',
    dot: 'bg-gray-400'
  },
  basic: {
    bg: 'from-gray-600/20 to-gray-700/20',
    border: 'border-gray-700/50',
    dot: 'bg-gray-500'
  }
};

// Media type icons
const getMediaIcon = (mediaType) => {
  switch (mediaType) {
    case 'video': return Film;
    case 'audio': return Mic;
    default: return Music;
  }
};

// Check if this is an archive.org moment
// Archive identifiers start with "umo" followed by date (e.g., umo2013-03-18.skm140.flac24)
// Use case-insensitive match for UMO/umo
const isArchiveMoment = (moment) => {
  return moment.mediaSource === 'archive' ||
         moment.mediaUrl?.includes('archive.org') ||
         moment.externalVideoId?.match(/^umo\d{4}/i);
};

// Check if this is a YouTube moment
const isYouTubeMoment = (moment) => {
  // Exclude archive.org content first
  if (isArchiveMoment(moment)) return false;

  // Check mediaSource explicitly
  if (moment.mediaSource === 'youtube') return true;
  // Check for YouTube URLs in mediaUrl
  if (moment.mediaUrl?.includes('youtube.com') || moment.mediaUrl?.includes('youtu.be')) return true;
  // Check externalVideoId only if not archive pattern
  if (moment.externalVideoId &&
      !moment.externalVideoId.match(/^umo\d{4}/i) &&
      moment.mediaSource !== 'archive') return true;
  return false;
};

// Extract YouTube video ID from URL or externalVideoId
const getYouTubeId = (moment) => {
  if (moment.externalVideoId) return moment.externalVideoId;
  if (!moment.mediaUrl) return null;
  const match = moment.mediaUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

// Get YouTube thumbnail URL
// eslint-disable-next-line no-unused-vars
const getYouTubeThumbnail = (videoId) => {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
};

const MomentThumbnailCard = memo(({
  moment,
  onClick,
  showSongName = true,
  compact = false
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const rarity = rarityConfig[moment.rarityTier] || rarityConfig.basic;
  const duration = formatDuration(moment.duration);
  const MediaIcon = getMediaIcon(moment.mediaType);
  const hasMedia = isYouTubeMoment(moment) || (moment.mediaType === 'video' && moment.mediaUrl);

  if (compact) {
    // Compact version for inline song lists
    return (
      <button
        onClick={() => onClick?.(moment)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-sm
          bg-gradient-to-r ${rarity.bg} ${rarity.border} border
          hover:scale-105 transition-all duration-200
          text-sm
        `}
      >
        <div className={`w-2 h-2 rounded-full ${rarity.dot}`} />
        {isYouTubeMoment(moment) && (
          <Youtube size={12} className="text-red-500" />
        )}
        {duration ? (
          <span className="text-gray-300 flex items-center gap-1">
            <Clock size={12} />
            {duration}
          </span>
        ) : (
          <MediaIcon size={12} className="text-gray-400" />
        )}
      </button>
    );
  }

  // Full card version for gallery
  return (
    <button
      onClick={() => onClick?.(moment)}
      className={`
        relative group flex flex-col
        w-full min-w-[140px] max-w-[180px]
        bg-gradient-to-br ${rarity.bg} ${rarity.border} border
        rounded-sm overflow-hidden
        hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20
        transition-all duration-200
      `}
    >
      {/* Thumbnail / Preview area */}
      <div className="relative aspect-video bg-gray-900/50 flex items-center justify-center overflow-hidden">
        {isYouTubeMoment(moment) ? (
          /* YouTube embed preview - autoplay muted */
          (() => {
            const ytId = getYouTubeId(moment);
            return ytId ? (
              <iframe
                src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytId}&start=${moment.startTime || 0}&playsinline=1&modestbranding=1&rel=0`}
                className="absolute inset-0 w-full h-full pointer-events-none"
                title={moment.songName}
                frameBorder="0"
                allow="autoplay; encrypted-media"
                loading="lazy"
                onLoad={() => setIsLoading(false)}
              />
            ) : null;
          })()
        ) : moment.mediaType === 'video' && moment.mediaUrl && !isYouTubeMoment(moment) ? (
          <video
            src={transformMediaUrl(moment.mediaUrl)}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            onLoadedData={() => setIsLoading(false)}
            onError={(e) => {
              setIsLoading(false);
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        {/* Fallback play icon */}
        <div
          className="absolute inset-0 bg-gray-800 items-center justify-center"
          style={{ display: (isYouTubeMoment(moment) || (moment.mediaType === 'video' && moment.mediaUrl)) ? 'none' : 'flex' }}
        >
          <MediaIcon size={24} className="text-gray-500" />
        </div>

        {/* Loading spinner */}
        {hasMedia && isLoading && (
          <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-10">
            <Loader2 size={20} className="text-white animate-spin" />
          </div>
        )}

        {/* Duration badge */}
        {duration && (
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-xs text-white font-mono">
            {duration}
          </div>
        )}

        {/* Rarity dot */}
        <div className={`absolute top-2 left-2 w-2.5 h-2.5 rounded-full ${rarity.dot} shadow-lg`} />

        {/* YouTube badge */}
        {isYouTubeMoment(moment) && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-red-600 text-white text-[8px] font-bold rounded">
            YT
          </div>
        )}

        {/* Play button overlay for YouTube */}
        {isYouTubeMoment(moment) && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-10 h-10 bg-red-600/90 rounded-full flex items-center justify-center">
              <Play size={18} className="text-white ml-0.5" fill="white" />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 flex-1 flex flex-col justify-center">
        {showSongName && (
          <span className="text-white text-sm font-medium truncate">
            {moment.songName}
          </span>
        )}
      </div>
    </button>
  );
});

MomentThumbnailCard.displayName = 'MomentThumbnailCard';

export default MomentThumbnailCard;
