// src/components/Performance/panels/MediaGalleryPanel.jsx
import React, { memo, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Film, Grid } from 'lucide-react';
import MomentThumbnailCard from '../cards/MomentThumbnailCard';

const MediaGalleryPanel = memo(({
  moments = [],
  onSelectMoment,
  title = 'Media Gallery'
}) => {
  const scrollRef = useRef(null);
  const [showAll, setShowAll] = useState(false);

  if (moments.length === 0) {
    return null;
  }

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Show first 8 in horizontal scroll, or all in grid if expanded
  const displayMoments = showAll ? moments : moments.slice(0, 12);
  const hasMore = moments.length > 12;

  return (
    <div className="media-gallery-panel bg-gray-900/50 rounded-sm p-4 mb-6 border border-gray-800/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Film size={18} className="text-blue-400" />
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <span className="text-sm text-gray-500">({moments.length})</span>
        </div>

        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Grid size={14} />
            {showAll ? 'Show less' : `View all ${moments.length}`}
          </button>
        )}
      </div>

      {showAll ? (
        // Grid view when expanded
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {displayMoments.map((moment) => (
            <MomentThumbnailCard
              key={moment._id}
              moment={moment}
              onClick={onSelectMoment}
            />
          ))}
        </div>
      ) : (
        // Horizontal scroll view
        <div className="relative">
          {/* Left scroll button */}
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center text-white transition-colors shadow-lg"
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            <ChevronLeft size={18} />
          </button>

          {/* Scrollable container */}
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {displayMoments.map((moment) => (
              <div key={moment._id} style={{ scrollSnapAlign: 'start' }}>
                <MomentThumbnailCard
                  moment={moment}
                  onClick={onSelectMoment}
                />
              </div>
            ))}

            {/* "View more" card */}
            {hasMore && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="flex-shrink-0 w-[140px] aspect-video bg-gray-800/50 border border-gray-700/50 rounded-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
              >
                <span className="text-2xl font-bold text-gray-400">+{moments.length - 12}</span>
                <span className="text-xs text-gray-500">more</span>
              </button>
            )}
          </div>

          {/* Right scroll button */}
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center text-white transition-colors shadow-lg"
            style={{ transform: 'translate(50%, -50%)' }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
});

MediaGalleryPanel.displayName = 'MediaGalleryPanel';

export default MediaGalleryPanel;
