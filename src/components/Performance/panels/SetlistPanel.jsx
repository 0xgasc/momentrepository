// src/components/Performance/panels/SetlistPanel.jsx
import React, { memo, useState } from 'react';
import { ListMusic, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import SongRow from '../cards/SongRow';

// Filter out non-songs like "intro tape", "outro", etc.
const isActualSong = (songName) => {
  if (!songName) return false;
  const name = songName.toLowerCase();
  const nonSongPatterns = [
    'intro', 'outro', 'tape', 'tuning', 'soundcheck',
    'intermission', 'break', 'interlude', 'crowd',
    'banter', 'talking', 'jam session'
  ];
  return !nonSongPatterns.some(pattern => name.includes(pattern));
};

const SetlistPanel = memo(({
  performance,
  moments = [],
  onSelectMoment
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Extract sets from performance data
  const sets = performance?.sets?.set || [];

  // Group moments by song name for quick lookup
  const momentsBySong = moments.reduce((acc, moment) => {
    const key = moment.songName?.toLowerCase() || '';
    if (!acc[key]) acc[key] = [];
    acc[key].push(moment);
    return acc;
  }, {});

  // Get all actual songs from all sets
  const allSongs = sets.flatMap((set, setIndex) => {
    const songs = set.song || [];
    return songs
      .filter(song => isActualSong(song.name))
      .map((song, songIndex) => ({
        ...song,
        setName: set.name || `Set ${setIndex + 1}`,
        globalIndex: songIndex
      }));
  });

  const totalSongs = allSongs.length;

  if (totalSongs === 0) {
    return (
      <div className="setlist-panel bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
        <div className="flex items-center gap-2 text-gray-500">
          <ListMusic size={18} />
          <span>No setlist available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="setlist-panel bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <ListMusic size={18} className="text-green-400" />
          <h3 className="text-lg font-semibold text-white">Setlist</h3>
          <span className="text-sm text-gray-500">
            ({totalSongs} song{totalSongs !== 1 ? 's' : ''})
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* setlist.fm attribution */}
          <a
            href={`https://www.setlist.fm/setlist/${performance?.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-gray-500 hover:text-gray-400 flex items-center gap-1"
          >
            via setlist.fm
            <ExternalLink size={10} />
          </a>

          {isExpanded ? (
            <ChevronUp size={18} className="text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-400" />
          )}
        </div>
      </button>

      {/* Song list */}
      {isExpanded && (
        <div className="border-t border-gray-800/50">
          {sets.map((set, setIndex) => {
            const songs = (set.song || []).filter(song => isActualSong(song.name));
            if (songs.length === 0) return null;

            return (
              <div key={setIndex}>
                {/* Set header */}
                {sets.length > 1 && (
                  <div className="px-4 py-2 bg-gray-800/30 border-b border-gray-800/50">
                    <span className="text-sm font-medium text-gray-400">
                      {set.name || `Set ${setIndex + 1}`}
                    </span>
                  </div>
                )}

                {/* Songs */}
                <div>
                  {songs.map((song, songIndex) => {
                    const songMoments = momentsBySong[song.name?.toLowerCase()] || [];
                    return (
                      <SongRow
                        key={`${setIndex}-${songIndex}`}
                        song={song}
                        index={songIndex}
                        moments={songMoments}
                        onSelectMoment={onSelectMoment}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

SetlistPanel.displayName = 'SetlistPanel';

export default SetlistPanel;
