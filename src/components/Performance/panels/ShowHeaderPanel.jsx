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
    <div className="show-header-panel bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-xl p-6 mb-6 border border-gray-700/50">
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-4 text-gray-400 hover:text-white flex items-center gap-2 transition-colors text-sm"
      >
        <ArrowLeft size={16} />
        <span>Back to shows</span>
      </button>

      {/* Main info */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {venue?.name || 'Unknown Venue'}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-gray-400">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} />
              {venue?.city?.name || 'Unknown City'}
              {venue?.city?.country?.name && `, ${venue.city.country.name}`}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              {formatDate(performance?.eventDate)}
            </span>
          </div>
        </div>

        {/* Stats badges */}
        <div className="flex flex-wrap gap-3">
          {songMoments.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/40 border border-blue-700/50 rounded-full">
              <Music size={14} className="text-blue-400" />
              <span className="text-blue-300 text-sm font-medium">
                {songMoments.length} song{songMoments.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {otherContent.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/40 border border-purple-700/50 rounded-full">
              <Film size={14} className="text-purple-400" />
              <span className="text-purple-300 text-sm font-medium">
                {otherContent.length} other
              </span>
            </div>
          )}
          {rsvpCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/40 border border-green-700/50 rounded-full">
              <Users size={14} className="text-green-400" />
              <span className="text-green-300 text-sm font-medium">
                {rsvpCount} going
              </span>
            </div>
          )}
          {totalMoments === 0 && (
            <div className="px-3 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded-full">
              <span className="text-gray-500 text-sm">No moments yet</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ShowHeaderPanel.displayName = 'ShowHeaderPanel';

export default ShowHeaderPanel;
