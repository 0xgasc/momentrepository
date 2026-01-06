// src/components/Performance/panels/UploadPanel.jsx
import React, { memo, useState } from 'react';
import { Upload, Music, Film, ChevronDown, Sparkles } from 'lucide-react';

const UploadPanel = memo(({
  performance,
  songs = [],
  user,
  onUploadSong,
  onUploadOther
}) => {
  const [selectedSong, setSelectedSong] = useState('');
  const [showSongPicker, setShowSongPicker] = useState(false);

  // If user is not logged in, show login prompt
  if (!user) {
    return (
      <div className="upload-panel bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-xl p-5 border border-blue-800/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
            <Upload size={20} className="text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Share Your Moments</h3>
            <p className="text-sm text-gray-400">Were you at this show?</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Log in to upload your videos, audio recordings, or photos from this performance.
        </p>
        <div className="text-center text-sm text-gray-600">
          Sign in to contribute
        </div>
      </div>
    );
  }

  const handleUploadSong = () => {
    if (selectedSong) {
      const song = songs.find(s => s.name === selectedSong);
      onUploadSong?.(song, null, 0);
    } else {
      // Open modal without pre-selected song
      onUploadSong?.(null, null, 0);
    }
    setSelectedSong('');
    setShowSongPicker(false);
  };

  return (
    <div className="upload-panel bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-xl p-5 border border-blue-800/30">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Sparkles size={20} className="text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Share Your Moments</h3>
          <p className="text-sm text-gray-400">Add to the archive</p>
        </div>
      </div>

      {/* Song selector */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">
          Quick upload for a specific song:
        </label>
        <div className="relative">
          <button
            onClick={() => setShowSongPicker(!showSongPicker)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg text-left hover:bg-gray-800 transition-colors"
          >
            <span className={selectedSong ? 'text-white' : 'text-gray-500'}>
              {selectedSong || 'Select a song (optional)'}
            </span>
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${showSongPicker ? 'rotate-180' : ''}`} />
          </button>

          {showSongPicker && songs.length > 0 && (
            <div className="absolute z-20 w-full mt-1 max-h-48 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-xl">
              <button
                onClick={() => {
                  setSelectedSong('');
                  setShowSongPicker(false);
                }}
                className="w-full px-3 py-2 text-left text-gray-400 hover:bg-gray-700/50 text-sm"
              >
                Any song / Other content
              </button>
              {songs.map((song, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedSong(song.name);
                    setShowSongPicker(false);
                  }}
                  className="w-full px-3 py-2 text-left text-white hover:bg-gray-700/50 text-sm truncate"
                >
                  {song.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleUploadSong}
          className="flex flex-col items-center gap-2 p-4 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg transition-all hover:scale-[1.02]"
        >
          <Music size={24} className="text-blue-400" />
          <span className="text-sm text-blue-300 font-medium">Song Moment</span>
          <span className="text-xs text-blue-400/60">Video or audio</span>
        </button>

        <button
          onClick={() => onUploadOther?.()}
          className="flex flex-col items-center gap-2 p-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg transition-all hover:scale-[1.02]"
        >
          <Film size={24} className="text-purple-400" />
          <span className="text-sm text-purple-300 font-medium">Other Content</span>
          <span className="text-xs text-purple-400/60">Intro, crowd, etc.</span>
        </button>
      </div>

      {/* Helper text */}
      <p className="mt-4 text-xs text-gray-500 text-center">
        All uploads are reviewed before appearing publicly
      </p>
    </div>
  );
});

UploadPanel.displayName = 'UploadPanel';

export default UploadPanel;
