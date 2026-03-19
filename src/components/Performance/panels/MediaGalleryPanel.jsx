// src/components/Performance/panels/MediaGalleryPanel.jsx
import React, { memo, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Film, Grid, LayoutGrid } from 'lucide-react';
import MomentThumbnailCard from '../cards/MomentThumbnailCard';

const MediaGalleryPanel = memo(({
  moments = [],
  onSelectMoment,
  title = 'Media Gallery',
  autoplayPreviews = true
}) => {
  const scrollRef = useRef(null);
  const [showAll, setShowAll] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'carousel'

  if (moments.length === 0) {
    return null;
  }

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const previewLimit = 6;
  const displayMoments = showAll ? moments : moments.slice(0, previewLimit);
  const hasMore = moments.length > previewLimit;

  return (
    <div className="media-gallery-panel bg-gray-900/30 rounded-sm px-3 py-3 sm:p-4 mb-6 border border-gray-800/40">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Film size={16} className="text-blue-400" />
          <h3 className="text-sm sm:text-lg font-semibold text-white">{title}</h3>
          <span className="text-xs text-gray-500">({moments.length})</span>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle - desktop only */}
          <div className="hidden sm:flex items-center border border-gray-700 rounded overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              title="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('carousel')}
              className={`p-1.5 ${viewMode === 'carousel' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              title="Carousel view"
            >
              <Grid size={14} />
            </button>
          </div>

          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="flex items-center gap-1.5 text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {showAll ? 'Show less' : `All ${moments.length}`}
            </button>
          )}
        </div>
      </div>

      {/* Grid view (default) - larger cards with video previews */}
      {viewMode === 'grid' || showAll ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {displayMoments.map((moment) => (
            <MomentThumbnailCard
              key={moment._id}
              moment={moment}
              onClick={onSelectMoment}
              autoplayPreviews={autoplayPreviews}
            />
          ))}
          {/* Show more card */}
          {hasMore && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="aspect-video bg-gray-800/50 border border-gray-700/50 rounded-sm flex flex-col items-center justify-center gap-1 hover:bg-gray-800 transition-colors"
            >
              <span className="text-2xl font-bold text-gray-400">+{moments.length - previewLimit}</span>
              <span className="text-xs text-gray-500">more moments</span>
            </button>
          )}
        </div>
      ) : (
        /* Carousel view - horizontal scroll with larger cards */
        <div className="relative group/carousel">
          <button
            onClick={() => scroll('left')}
            className="hidden sm:flex absolute left-0 top-1/2 z-10 w-8 h-8 bg-black/70 hover:bg-black/90 rounded-full items-center justify-center text-white transition-all opacity-0 group-hover/carousel:opacity-100 shadow-lg"
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            <ChevronLeft size={18} />
          </button>

          <div
            ref={scrollRef}
            className="flex gap-2 sm:gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1"
            style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
          >
            {displayMoments.map((moment) => (
              <div key={moment._id} className="flex-shrink-0 w-[200px] sm:w-[240px]" style={{ scrollSnapAlign: 'start' }}>
                <MomentThumbnailCard
                  moment={moment}
                  onClick={onSelectMoment}
                  autoplayPreviews={autoplayPreviews}
                />
              </div>
            ))}

            {hasMore && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="flex-shrink-0 w-[200px] sm:w-[240px] aspect-video bg-gray-800/50 border border-gray-700/50 rounded-sm flex flex-col items-center justify-center gap-1 hover:bg-gray-800 transition-colors"
              >
                <span className="text-2xl font-bold text-gray-400">+{moments.length - previewLimit}</span>
                <span className="text-xs text-gray-500">more moments</span>
              </button>
            )}
          </div>

          <button
            onClick={() => scroll('right')}
            className="hidden sm:flex absolute right-0 top-1/2 z-10 w-8 h-8 bg-black/70 hover:bg-black/90 rounded-full items-center justify-center text-white transition-all opacity-0 group-hover/carousel:opacity-100 shadow-lg"
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
