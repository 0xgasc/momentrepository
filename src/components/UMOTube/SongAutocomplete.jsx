// src/components/UMOTube/SongAutocomplete.jsx
// Autocomplete component for song selection in setlist generator
import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Check, Music, Search } from 'lucide-react';

const SongAutocomplete = memo(({
  value,
  onChange,
  onSelect,
  allSongs = [],
  performanceSongs = [],
  placeholder = 'Search songs...',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter and prioritize songs based on input
  const filteredSongs = useMemo(() => {
    const query = value?.toLowerCase().trim() || '';

    // Get performance songs that match (prioritized)
    const matchingPerformanceSongs = performanceSongs
      .filter(name => name.toLowerCase().includes(query))
      .map(name => ({ name, isFromPerformance: true }));

    // Get all other songs that match (excluding ones already in performance)
    const performanceSongSet = new Set(performanceSongs.map(s => s.toLowerCase()));
    const matchingOtherSongs = allSongs
      .filter(song => {
        const songName = song.songName || song.name || song;
        const lowerName = (typeof songName === 'string' ? songName : '').toLowerCase();
        return lowerName.includes(query) && !performanceSongSet.has(lowerName);
      })
      .map(song => ({
        name: song.songName || song.name || song,
        isFromPerformance: false,
        performanceCount: song.totalPerformances || song.performances?.length || 0
      }))
      .sort((a, b) => b.performanceCount - a.performanceCount);

    // Combine: performance songs first, then others
    const combined = [...matchingPerformanceSongs, ...matchingOtherSongs];

    // Limit to 15 results for performance
    return combined.slice(0, 15);
  }, [value, allSongs, performanceSongs]);

  // Reset highlight when filtered songs change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredSongs.length]);

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
    onChange(e.target.value);
    setIsOpen(true);
  };

  const handleSelectSong = (song) => {
    onChange(song.name);
    if (onSelect) onSelect(song);
    setIsOpen(false);
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
          prev < filteredSongs.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredSongs[highlightedIndex]) {
          handleSelectSong(filteredSongs[highlightedIndex]);
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
    if (value || allSongs.length > 0 || performanceSongs.length > 0) {
      setIsOpen(true);
    }
  };

  return (
    <div className="relative flex-1">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className="umo-input w-full pr-8"
          autoComplete="off"
        />
        <Search
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
        />
      </div>

      {isOpen && filteredSongs.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto"
        >
          {/* Show section header if we have performance songs */}
          {filteredSongs.some(s => s.isFromPerformance) && (
            <div className="px-3 py-1.5 text-xs font-medium text-yellow-500 bg-gray-900/50 border-b border-gray-700">
              From this setlist
            </div>
          )}

          {filteredSongs.map((song, index) => {
            // Add divider before "other songs" section
            const isFirstOtherSong =
              !song.isFromPerformance &&
              index > 0 &&
              filteredSongs[index - 1]?.isFromPerformance;

            return (
              <React.Fragment key={`${song.name}-${index}`}>
                {isFirstOtherSong && (
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-900/50 border-t border-gray-700">
                    All songs
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleSelectSong(song)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full px-3 py-2 text-left flex items-center gap-2 transition-colors ${
                    index === highlightedIndex
                      ? 'bg-blue-600/30 text-white'
                      : 'text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  {song.isFromPerformance ? (
                    <Check size={14} className="text-green-400 flex-shrink-0" />
                  ) : (
                    <Music size={14} className="text-gray-500 flex-shrink-0" />
                  )}
                  <span className="truncate">{song.name}</span>
                  {song.performanceCount > 0 && (
                    <span className="ml-auto text-xs text-gray-500">
                      {song.performanceCount} plays
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Show "no matches" hint if input but no results */}
      {isOpen && value && filteredSongs.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3">
          <p className="text-gray-500 text-sm text-center">
            No matching songs. You can use this custom name.
          </p>
        </div>
      )}
    </div>
  );
});

SongAutocomplete.displayName = 'SongAutocomplete';

export default SongAutocomplete;
