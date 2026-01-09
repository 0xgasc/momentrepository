// src/components/UMOTube/PerformancePicker.jsx
// Performance picker for linking YouTube videos to setlist.fm shows
import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Calendar, MapPin, Search, X, Link2 } from 'lucide-react';

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

  // Filter performances based on search query
  const filteredPerformances = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) {
      // Show most recent performances when no query
      return performances.slice(0, 20);
    }

    return performances
      .filter(perf => {
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
      })
      .slice(0, 20);
  }, [searchQuery, performances]);

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
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onChange('');
    setSearchQuery('');
    if (onSelect) onSelect(null);
    inputRef.current?.focus();
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
          className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-72 overflow-y-auto"
        >
          {filteredPerformances.length > 0 ? (
            <>
              <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-900/50 border-b border-gray-700">
                {searchQuery ? 'Matching shows' : 'Recent shows'}
              </div>
              {filteredPerformances.map((perf, index) => (
                <button
                  key={perf.id || index}
                  type="button"
                  onClick={() => handleSelectPerformance(perf)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full px-3 py-2 text-left transition-colors ${
                    index === highlightedIndex
                      ? 'bg-blue-600/30 text-white'
                      : 'text-gray-300 hover:bg-gray-700/50'
                  }`}
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
                  </div>
                </button>
              ))}
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
