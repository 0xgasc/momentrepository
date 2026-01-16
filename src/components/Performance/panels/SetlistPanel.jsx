// src/components/Performance/panels/SetlistPanel.jsx
import React, { memo, useState, useMemo } from 'react';
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

// Split medley songs by " / " delimiter
const splitMedley = (songName) => {
  if (!songName) return [songName];
  const parts = songName.split(' / ').map(s => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [songName];
};

const SetlistPanel = memo(({
  performance,
  moments = [],
  onSelectMoment,
  onSongSelect
}) => {
  const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default

  // Extract sets from performance data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sets = performance?.sets?.set || [];

  // Group moments by song name AND medley components for quick lookup
  const momentsBySong = useMemo(() => {
    const map = {};
    moments.forEach(moment => {
      const songName = moment.songName || '';
      const key = songName.toLowerCase();

      // Add to exact match
      if (!map[key]) map[key] = [];
      map[key].push(moment);

      // Also add to each medley component (if this moment is for a medley)
      const parts = splitMedley(songName);
      if (parts.length > 1) {
        parts.forEach(part => {
          const partKey = part.toLowerCase();
          if (!map[partKey]) map[partKey] = [];
          // Avoid duplicates
          if (!map[partKey].includes(moment)) {
            map[partKey].push(moment);
          }
        });
      }
    });
    return map;
  }, [moments]);

  // Get all actual songs from all sets, splitting medleys
  const allSongs = useMemo(() => {
    return sets.flatMap((set, setIndex) => {
      const songs = set.song || [];
      return songs
        .filter(song => isActualSong(song.name))
        .flatMap((song) => {
          const parts = splitMedley(song.name);
          return parts.map((partName, partIdx) => ({
            ...song,
            name: partName,
            originalName: song.name,
            isPartOfMedley: parts.length > 1,
            medleyIndex: partIdx,
            setName: set.name || `Set ${setIndex + 1}`
          }));
        });
    });
  }, [sets]);

  const totalSongs = allSongs.length;

  if (totalSongs === 0) {
    return (
      <div className="setlist-panel bg-gray-900/50 rounded-sm p-4 border border-gray-800/50">
        <div className="flex items-center gap-2 text-gray-500">
          <ListMusic size={18} />
          <span>No setlist available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="setlist-panel bg-gray-900/50 rounded-sm border border-gray-800/50 overflow-hidden">
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
          {/* setlist.fm attribution - link to UMO page since direct links require full slug */}
          <a
            href="https://www.setlist.fm/setlists/unknown-mortal-orchestra-33d6a0ed.html"
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
          {(() => {
            let currentSet = null;
            let trackNumber = 0;

            return allSongs.map((song, idx) => {
              const showSetHeader = sets.length > 1 && song.setName !== currentSet;
              if (song.setName !== currentSet) {
                currentSet = song.setName;
              }
              trackNumber++;

              const songMoments = momentsBySong[song.name?.toLowerCase()] || [];

              return (
                <React.Fragment key={`${idx}-${song.name}`}>
                  {/* Set header when set changes */}
                  {showSetHeader && (
                    <div className="px-4 py-2 bg-gray-800/30 border-b border-gray-800/50">
                      <span className="text-sm font-medium text-gray-400">
                        {song.setName}
                      </span>
                    </div>
                  )}
                  <SongRow
                    song={song}
                    index={trackNumber - 1}
                    moments={songMoments}
                    onSelectMoment={onSelectMoment}
                    onSongSelect={onSongSelect}
                  />
                </React.Fragment>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
});

SetlistPanel.displayName = 'SetlistPanel';

export default SetlistPanel;
