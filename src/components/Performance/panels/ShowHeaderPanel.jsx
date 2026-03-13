// src/components/Performance/panels/ShowHeaderPanel.jsx
import React, { memo } from 'react';
import { ArrowLeft, Calendar, MapPin, Music, Film, Users } from 'lucide-react';
import { formatDate } from '../../../utils';

const ShowHeaderPanel = memo(({
  performance,
  songMoments = [],
  otherContent = [],
  rsvpCount = 0,
  onBack
}) => {
  // eslint-disable-next-line no-unused-vars
  const totalMoments = songMoments.length + otherContent.length;
  const venue = performance?.venue;

  return (
    <div className="show-header-panel mb-4">
      {/* Back button - standalone, minimal */}
      <button
        onClick={onBack}
        className="text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors text-sm group mb-3"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
        <span>Back</span>
      </button>

      {/* Header card */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-sm px-4 py-3">
        {/* Title + Stats row */}
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <h1 className="text-base sm:text-xl font-semibold text-white leading-tight line-clamp-2">
            {venue?.name || 'Unknown Venue'}
          </h1>

          {/* Compact stats */}
          <div className="flex items-center gap-1.5 shrink-0">
            {songMoments.length > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/15 text-blue-300 rounded text-xs">
                <Music size={10} />
                {songMoments.length}
              </span>
            )}
            {otherContent.length > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/15 text-purple-300 rounded text-xs">
                <Film size={10} />
                {otherContent.length}
              </span>
            )}
            {rsvpCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/15 text-green-300 rounded text-xs">
                <Users size={10} />
                {rsvpCount}
              </span>
            )}
          </div>
        </div>

        {/* Location + Date */}
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <MapPin size={12} className="text-gray-500 shrink-0" />
            <span className="truncate max-w-[180px] sm:max-w-[250px]">
              {venue?.city?.name || 'Unknown'}
              {venue?.city?.country?.code && `, ${venue.city.country.code}`}
            </span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Calendar size={12} className="text-gray-500" />
            {formatDate(performance?.eventDate)}
          </span>
        </div>
      </div>
    </div>
  );
});

ShowHeaderPanel.displayName = 'ShowHeaderPanel';

export default ShowHeaderPanel;
