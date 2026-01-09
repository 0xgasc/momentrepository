// src/components/UMOTube/PerformancePicker.jsx
// Performance picker for linking YouTube videos to setlist.fm shows
import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Calendar, MapPin, Search, X, Link2, ChevronDown, ChevronUp, Music, List } from 'lucide-react';

const PerformancePicker = memo(({
  value,
  onChange,
  onSelect,
  performances = [],
  placeholder = 'Search shows by venue, city, or date...',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [displayCount, setDisplayCount] = useState(20);
  const [expandedId, setExpandedId] = useState(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Format date from DD-MM-YYYY to readable format
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`;
    }
    return dateStr;
  };

  // Get songs from a performance setlist
  const getSetlistSongs = (perf) => {
    if (!perf?.sets?.set) return [];
    return perf.sets.set.flatMap(set =>
      set.song?.map(s => s.name) || []
    );
  };

  // Reset displayCount when search query changes
  useEffect(() => {
    setDisplayCount(20);
    setExpandedId(null);
  }, [searchQuery]);

  // Filter performances based on search query
  const { filteredPerformances, totalMatches } = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    let matches;
    if (!query) {
      matches = performances;
    } else {
      matches = performances.filter(perf => {
        const venue = perf.venue?.name?.toLowerCase() || '';
        const city = perf.venue?.city?.name?.toLowerCase() || '';
        const country = perf.venue?.city?.country?.name?.toLowerCase() || '';
        const date = perf.eventDate || '';
        const year = date.split('-')[2] || '';

        return (
          venue.includes(query) ||
          city.includes(query) ||
          country.includes(query) ||
          date.includes(query) ||
          year.includes(query)
        );
      });
    }

    return {
      filteredPerformances: matches.slice(0, displayCount),
      totalMatches: matches.length
    };
  }, [searchQuery, performances, displayCount]);

  // Reset highlight when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredPerformances.length]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
    setIsOpen(true);
  };

  const handleSelectPerformance = (perf) => {
    const displayValue = `${perf.venue?.name || 'Unknown Venue'}, ${perf.venue?.city?.name || ''} - ${formatDate(perf.eventDate)}`;
    onChange(displayValue);
    if (onSelect) onSelect(perf);
    setIsOpen(false);
    setSearchQuery('');
    setExpandedId(null);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onChange('');
    setSearchQuery('');
    if (onSelect) onSelect(null);
    inputRef.current?.focus();
  };

  const handleLoadMore = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDisplayCount(prev => prev + 20);
  };

  const toggleExpand = (e, perfId) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedId(expandedId === perfId ? null : perfId);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredPerformances.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredPerformances[highlightedIndex]) {
          handleSelectPerformance(filteredPerformances[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const handleFocus = () => {
    if (performances.length > 0) {
      setIsOpen(true);
    }
  };

  const remainingCount = totalMatches - displayCount;

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchQuery : value || ''}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={value ? '' : placeholder}
          disabled={disabled}
          className="umo-input w-full pr-16"
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-500 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <Search size={14} className="text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Selected performance indicator */}
      {value && !isOpen && (
        <div className="mt-1 flex items-center gap-1 text-xs text-green-400">
          <Link2 size={12} />
          <span>Linked to setlist.fm</span>
        </div>
      )}

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-96 overflow-y-auto"
        >
          {filteredPerformances.length > 0 ? (
            <>
              {/* Header with count */}
              <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-900/50 border-b border-gray-700 flex justify-between items-center sticky top-0">
                <span>{searchQuery ? 'Matching shows' : 'Recent shows'}</span>
                <span className="text-gray-600">
                  Showing {Math.min(displayCount, totalMatches)} of {totalMatches}
                </span>
              </div>

              {/* Performance list */}
              {filteredPerformances.map((perf, index) => {
                const songs = getSetlistSongs(perf);
                const isExpanded = expandedId === perf.id;

                return (
                  <div key={perf.id || index} className="border-b border-gray-700/50 last:border-b-0">
                    <div
                      className={`w-full px-3 py-2 text-left transition-colors cursor-pointer ${
                        index === highlightedIndex
                          ? 'bg-blue-600/30 text-white'
                          : 'text-gray-300 hover:bg-gray-700/50'
                      }`}
                      onClick={() => handleSelectPerformance(perf)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div className="flex items-start gap-2">
                        <Calendar size={14} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {perf.venue?.name || 'Unknown Venue'}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <MapPin size={10} />
                              {perf.venue?.city?.name || 'Unknown'}
                              {perf.venue?.city?.country?.name && `, ${perf.venue.city.country.name}`}
                            </span>
                            <span>|</span>
                            <span>{formatDate(perf.eventDate)}</span>
                          </div>
                        </div>

                        {/* Expand/collapse setlist button */}
                        {songs.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => toggleExpand(e, perf.id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700/50 hover:bg-gray-600/50 rounded transition-colors"
                            title={isExpanded ? 'Hide setlist' : 'Show setlist'}
                          >
                            <List size={12} />
                            <span>{songs.length}</span>
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded setlist preview */}
                    {isExpanded && songs.length > 0 && (
                      <div className="px-3 py-2 bg-gray-900/70 border-t border-gray-700/50">
                        <div className="text-xs text-gray-500 mb-1 font-medium">Setlist ({songs.length} songs):</div>
                        <div className="flex flex-wrap gap-1">
                          {songs.map((song, i) => (
                            <span
                              key={`${song}-${i}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-700/70 text-gray-300 rounded"
                            >
                              <Music size={10} className="text-green-400" />
                              {song}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Load More button */}
              {remainingCount > 0 && (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  className="w-full px-3 py-2 text-center text-sm text-yellow-400 hover:bg-gray-700/50 transition-colors border-t border-gray-700"
                >
                  Load More ({remainingCount} remaining)
                </button>
              )}
            </>
          ) : (
            <div className="p-3 text-center text-gray-500 text-sm">
              {searchQuery ? 'No matching shows found' : 'No performances loaded'}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

PerformancePicker.displayName = 'PerformancePicker';

export default PerformancePicker;
