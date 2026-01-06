// src/components/Performance/UpcomingShowsSection.jsx
import React, { useEffect, memo } from 'react';
import { Calendar, MapPin, Ticket, Users, ExternalLink, Clock } from 'lucide-react';
import { useUpcomingShows } from '../../hooks/useUpcomingShows';

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

const formatFullDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

const daysUntil = (dateStr) => {
  const now = new Date();
  const showDate = new Date(dateStr);
  const diff = Math.ceil((showDate - now) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today!';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return 'Past';
  return `${diff} days`;
};

const ticketStatusConfig = {
  available: { label: 'Tickets Available', color: 'green' },
  sold_out: { label: 'Sold Out', color: 'red' },
  limited: { label: 'Limited Tickets', color: 'yellow' },
  presale: { label: 'Presale', color: 'blue' },
  tba: { label: 'TBA', color: 'gray' }
};

const UpcomingShowCard = memo(({ show, onSelect }) => {
  const status = ticketStatusConfig[show.ticketStatus] || ticketStatusConfig.tba;
  const days = daysUntil(show.eventDate);
  const isUpcoming = days !== 'Past';

  return (
    <div
      onClick={() => onSelect?.(show)}
      className={`
        group relative overflow-hidden rounded-xl border cursor-pointer
        transition-all duration-300 hover:scale-[1.02]
        ${isUpcoming
          ? 'bg-gradient-to-br from-blue-900/30 via-purple-900/20 to-pink-900/30 border-blue-500/30 hover:border-blue-400/50'
          : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600/50'
        }
      `}
    >
      {/* Glow effect for upcoming */}
      {isUpcoming && (
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}

      <div className="relative p-4">
        {/* Date badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`
              px-2.5 py-1 rounded-lg text-xs font-bold
              ${isUpcoming
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-gray-700/50 text-gray-400'
              }
            `}>
              {formatDate(show.eventDate)}
            </div>
            {isUpcoming && (
              <span className="flex items-center gap-1 text-xs text-purple-300">
                <Clock size={10} />
                {days}
              </span>
            )}
          </div>

          {/* Ticket status */}
          {show.ticketUrl && (
            <a
              href={show.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`
                flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
                transition-colors
                ${status.color === 'green' ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30' : ''}
                ${status.color === 'red' ? 'bg-red-500/20 text-red-300' : ''}
                ${status.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30' : ''}
                ${status.color === 'blue' ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : ''}
                ${status.color === 'gray' ? 'bg-gray-500/20 text-gray-400' : ''}
              `}
            >
              <Ticket size={10} />
              {status.label}
              <ExternalLink size={8} />
            </a>
          )}
        </div>

        {/* Venue */}
        <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-blue-300 transition-colors truncate">
          {show.venue.name}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1 text-sm text-gray-400">
          <MapPin size={12} />
          <span>
            {show.venue.city}
            {show.venue.state && `, ${show.venue.state}`}
            {show.venue.country && show.venue.country !== 'USA' && `, ${show.venue.country}`}
          </span>
        </div>

        {/* Festival badge */}
        {show.eventType === 'festival' && show.festivalName && (
          <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">
            {show.festivalName}
          </div>
        )}

        {/* Notes */}
        {show.notes && (
          <p className="mt-2 text-xs text-gray-500 line-clamp-2">{show.notes}</p>
        )}
      </div>
    </div>
  );
});

UpcomingShowCard.displayName = 'UpcomingShowCard';

const UpcomingShowsSection = memo(({ onShowSelect, token }) => {
  const { upcoming, loading, error, fetchShows } = useUpcomingShows(token);

  useEffect(() => {
    fetchShows(false);
  }, [fetchShows]);

  if (loading) {
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Upcoming Shows</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return null; // Silently fail if no upcoming shows configured
  }

  if (upcoming.length === 0) {
    return null; // Don't show section if no upcoming shows
  }

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Upcoming Shows</h3>
          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs font-medium">
            {upcoming.length}
          </span>
        </div>
      </div>

      {/* Shows grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {upcoming.map(show => (
          <UpcomingShowCard
            key={show._id}
            show={show}
            onSelect={onShowSelect}
          />
        ))}
      </div>
    </div>
  );
});

UpcomingShowsSection.displayName = 'UpcomingShowsSection';

export default UpcomingShowsSection;
