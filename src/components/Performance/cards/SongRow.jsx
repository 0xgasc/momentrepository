// src/components/Performance/cards/SongRow.jsx
import React, { memo, useState } from 'react';
import { ChevronDown, ChevronRight, Music } from 'lucide-react';
import MomentThumbnailCard from './MomentThumbnailCard';

// Rarity dot colors
const rarityDotColors = {
  legendary: 'bg-yellow-400',
  mythic: 'bg-purple-400',
  epic: 'bg-violet-400',
  rare: 'bg-red-400',
  uncommon: 'bg-blue-400',
  common: 'bg-gray-400',
  basic: 'bg-gray-500'
};

const SongRow = memo(({
  song,
  index,
  moments = [],
  onSelectMoment
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMoments = moments.length > 0;

  return (
    <div className="song-row border-b border-gray-800/50 last:border-b-0">
      {/* Main row */}
      <div
        className={`
          flex items-center py-3 px-2
          ${hasMoments ? 'hover:bg-gray-800/30 cursor-pointer' : ''}
          transition-colors
        `}
        onClick={() => hasMoments && setIsExpanded(!isExpanded)}
      >
        {/* Track number */}
        <span className="w-8 text-gray-500 text-sm font-mono">
          {index + 1}
        </span>

        {/* Song name */}
        <span className="flex-1 font-medium text-gray-100 truncate">
          {song.name}
        </span>

        {/* Moment indicator */}
        {hasMoments ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-700/30 rounded-md transition-colors"
          >
            {/* Rarity dots preview */}
            <div className="flex -space-x-1">
              {moments.slice(0, 3).map((m, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${rarityDotColors[m.rarityTier] || rarityDotColors.basic} ring-1 ring-gray-900`}
                />
              ))}
              {moments.length > 3 && (
                <div className="w-2.5 h-2.5 rounded-full bg-gray-600 ring-1 ring-gray-900 flex items-center justify-center">
                  <span className="text-[6px] text-gray-300">+</span>
                </div>
              )}
            </div>

            <span className="text-blue-300 text-sm">
              {moments.length}
            </span>

            {isExpanded ? (
              <ChevronDown size={14} className="text-blue-400" />
            ) : (
              <ChevronRight size={14} className="text-blue-400" />
            )}
          </button>
        ) : (
          <div className="px-3 py-1.5 text-gray-600 text-sm">
            <Music size={14} />
          </div>
        )}
      </div>

      {/* Expanded moments */}
      {hasMoments && isExpanded && (
        <div className="pl-8 pr-2 pb-3">
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-800/30">
            {moments.map((moment) => (
              <MomentThumbnailCard
                key={moment._id}
                moment={moment}
                onClick={onSelectMoment}
                showSongName={false}
                compact
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

SongRow.displayName = 'SongRow';

export default SongRow;
