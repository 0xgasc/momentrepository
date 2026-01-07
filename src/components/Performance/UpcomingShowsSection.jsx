// src/components/Performance/UpcomingShowsSection.jsx
import React, { useState, useEffect, memo } from 'react';
import { Calendar, MapPin, Ticket, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
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

// Transform upcoming show to match setlist.fm performance format
const transformUpcomingShow = (show) => ({
  id: `upcoming-${show._id}`,
  eventDate: new Date(show.eventDate).toISOString().split('T')[0].split('-').reverse().join('-'), // DD-MM-YYYY
  venue: {
    name: show.venue.name,
    city: {
      name: show.venue.city,
      state: show.venue.state ? { name: show.venue.state } : undefined,
      country: { name: show.venue.country, code: show.venue.countryCode }
    }
  },
  sets: { set: [] }, // No setlist for upcoming shows
  isUpcomingShow: true, // Flag for special handling
  ticketUrl: show.ticketUrl,
  ticketStatus: show.ticketStatus,
  eventType: show.eventType,
  festivalName: show.festivalName,
  notes: show.notes
});

const UpcomingShowCard = memo(({ show, onSelect }) => {
  const status = ticketStatusConfig[show.ticketStatus] || ticketStatusConfig.tba;
  const days = daysUntil(show.eventDate);

  const handleClick = () => {
    if (onSelect) {
      onSelect(transformUpcomingShow(show));
    }
  };

  return (
    <div
      onClick={handleClick}
      className="p-3 bg-gray-800/60 border border-gray-700 rounded cursor-pointer hover:bg-gray-700/60 hover:border-gray-600 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-white truncate">{show.venue.name}</h3>
          <div className="flex items-center gap-1 text-sm text-gray-400 mt-0.5">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">
              {show.venue.city}
              {show.venue.state && `, ${show.venue.state}`}
              {show.venue.country && show.venue.country !== 'USA' && ` · ${show.venue.country}`}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {formatFullDate(show.eventDate)} · {days}
          </div>
        </div>

        {show.ticketUrl && (
          <a
            href={show.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:text-blue-300"
          >
            <Ticket size={12} />
            <ExternalLink size={10} />
          </a>
        )}
      </div>

      {show.eventType === 'festival' && show.festivalName && (
        <div className="mt-2 text-xs text-gray-500">{show.festivalName}</div>
      )}
    </div>
  );
});

UpcomingShowCard.displayName = 'UpcomingShowCard';

const UpcomingShowsSection = memo(({ onShowSelect, token }) => {
  const { upcoming, loading, error, fetchShows } = useUpcomingShows(token);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    fetchShows(false);
  }, [fetchShows]);

  if (loading) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 text-gray-400">
          <Calendar size={16} />
          <span className="text-sm">Loading upcoming shows...</span>
        </div>
      </div>
    );
  }

  if (error || upcoming.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      {/* Collapsible header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-800/40 border border-gray-700 rounded hover:bg-gray-800/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400" />
          <span className="text-sm font-medium text-white">Upcoming Shows</span>
          <span className="text-xs text-gray-500">({upcoming.length})</span>
        </div>
        {isExpanded ? (
          <ChevronUp size={16} className="text-gray-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {upcoming.map(show => (
            <UpcomingShowCard
              key={show._id}
              show={show}
              onSelect={onShowSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
});

UpcomingShowsSection.displayName = 'UpcomingShowsSection';

export default UpcomingShowsSection;
