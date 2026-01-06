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
  const totalMoments = songMoments.length + otherContent.length;
  const venue = performance?.venue;

  return (
    <div className="show-header-panel relative mb-4">
      {/* Glass background */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/10 to-white/5 backdrop-blur-xl rounded-xl border border-white/10 shadow-lg shadow-black/20" />

      {/* Content */}
      <div className="relative px-4 py-3">
        {/* Top row: Back button + Stats */}
        <div className="flex items-center justify-between gap-4 mb-2">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors text-sm group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back</span>
          </button>

          {/* Compact stats */}
          <div className="flex items-center gap-2 text-xs">
            {songMoments.length > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                <Music size={10} />
                {songMoments.length}
              </span>
            )}
            {otherContent.length > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                <Film size={10} />
                {otherContent.length}
              </span>
            )}
            {rsvpCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-300 rounded">
                <Users size={10} />
                {rsvpCount}
              </span>
            )}
          </div>
        </div>

        {/* Main info row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <h1 className="text-lg sm:text-xl font-semibold text-white truncate">
            {venue?.name || 'Unknown Venue'}
          </h1>

          <div className="flex items-center gap-3 text-sm text-gray-400 shrink-0">
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-gray-500" />
              <span className="truncate max-w-[150px]">
                {venue?.city?.name || 'Unknown'}
                {venue?.city?.country?.code && `, ${venue.city.country.code}`}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={12} className="text-gray-500" />
              {formatDate(performance?.eventDate)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

ShowHeaderPanel.displayName = 'ShowHeaderPanel';

export default ShowHeaderPanel;
