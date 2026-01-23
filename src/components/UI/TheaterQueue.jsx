// src/components/UI/TheaterQueue.jsx - Theater queue playlist component with local playlists
import React, { useState } from 'react';
import { ListMusic, Play, X, Trash2, GripVertical, ChevronUp, ChevronDown, Shuffle, Save, Check, Loader2, Link2, Copy, FolderOpen, Plus, MoreVertical } from 'lucide-react';
import { useTheaterQueue } from '../../contexts/TheaterQueueContext';
import { useAuth } from '../Auth/AuthProvider';
import { useFavorites } from '../../hooks/useFavorites';

const TheaterQueue = ({ sidebarPosition = 'left', sidebarCollapsed = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'playlists'

  // Save as collection state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedCollection, setSavedCollection] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Local playlist save modal
  const [showLocalSaveModal, setShowLocalSaveModal] = useState(false);
  const [localPlaylistName, setLocalPlaylistName] = useState('');
  const [playlistMenuOpen, setPlaylistMenuOpen] = useState(null); // playlist id

  const { token, user } = useAuth();
  const { createCollection, addToCollection } = useFavorites(token);

  const {
    theaterQueue,
    currentQueueIndex,
    isPlayingFromQueue,
    // eslint-disable-next-line no-unused-vars
    currentMoment,
    removeFromQueue,
    clearQueue,
    playQueue,
    reorderQueue,
    shuffleQueue,
    playNextInQueue,
    // eslint-disable-next-line no-unused-vars
    stopQueue,
    // Local playlists
    localPlaylists,
    saveQueueAsLocalPlaylist,
    loadLocalPlaylist,
    deleteLocalPlaylist,
    exportPlaylistAsLink
  } = useTheaterQueue();

  // Handle drag start
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over
  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    reorderQueue(draggedIndex, index);
    setDraggedIndex(index);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Play from specific index
  const handlePlayFromIndex = (index) => {
    playQueue(index);
  };

  // Handle closing the modal (auto-advance)
  // eslint-disable-next-line no-unused-vars
  const handleCloseModal = () => {
    // Auto-advance to next in queue
    playNextInQueue();
  };

  // Handle save as collection
  const handleSaveAsCollection = async () => {
    if (!collectionName.trim() || theaterQueue.length === 0) return;

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    setSavedCollection(null);

    try {
      // Create collection
      const result = await createCollection(collectionName.trim(), '', isPublic);

      if (result.success && result.collection) {
        // Add all queue moments to collection
        for (const moment of theaterQueue) {
          await addToCollection(result.collection._id, moment._id);
        }

        setSaveSuccess(true);
        setSavedCollection(result.collection);
        setCollectionName('');

        // Auto-play if not already playing
        if (!isPlayingFromQueue) {
          playQueue(0);
        }
      } else {
        setSaveError(result.error || 'Failed to create collection');
      }
    } catch (err) {
      console.error('Save collection error:', err);
      setSaveError('Something went wrong');
    } finally {
      setIsSaving(false);
    }
  };

  // Copy shareable link
  const copyShareableLink = () => {
    if (savedCollection) {
      const link = `${window.location.origin}/collection/${savedCollection._id}`;
      navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  // Close save modal and reset state
  const closeSaveModal = () => {
    setShowSaveModal(false);
    setSaveError('');
    setSaveSuccess(false);
    setSavedCollection(null);
    setLinkCopied(false);
  };

  // Handle save as local playlist
  const handleSaveLocalPlaylist = () => {
    if (!localPlaylistName.trim() || theaterQueue.length === 0) return;
    const result = saveQueueAsLocalPlaylist(localPlaylistName.trim());
    if (result) {
      setLocalPlaylistName('');
      setShowLocalSaveModal(false);
    }
  };

  // Handle load playlist into queue
  const handleLoadPlaylist = (playlistId) => {
    loadLocalPlaylist(playlistId, true);
    setActiveTab('queue');
    setPlaylistMenuOpen(null);
  };

  // Handle append playlist to queue
  const handleAppendPlaylist = (playlistId) => {
    loadLocalPlaylist(playlistId, false);
    setActiveTab('queue');
    setPlaylistMenuOpen(null);
  };

  // Handle copy playlist link
  const handleCopyPlaylistLink = (playlistId) => {
    const link = exportPlaylistAsLink(playlistId);
    if (link) {
      navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
    setPlaylistMenuOpen(null);
  };

  // Handle delete playlist
  const handleDeletePlaylist = (playlistId) => {
    if (window.confirm('Delete this playlist?')) {
      deleteLocalPlaylist(playlistId);
    }
    setPlaylistMenuOpen(null);
  };

  // If no queue AND no playlists, don't render anything
  if (theaterQueue.length === 0 && localPlaylists.length === 0) {
    return null;
  }

  // Calculate position based on sidebar - avoid overlap
  // Sidebar only shows on lg+ screens, so adjustments should be lg: prefixed
  const getPositionClasses = () => {
    if (sidebarPosition === 'right') {
      // Move to bottom-left on desktop when sidebar is on right
      return 'bottom-4 right-4 lg:left-4 lg:right-auto';
    }
    if (sidebarPosition === 'bottom') {
      // Move higher on desktop when sidebar is at bottom
      return 'bottom-4 right-4 lg:bottom-20';
    }
    // Default: bottom-right (works for left and top sidebar)
    return 'bottom-4 right-4';
  };

  return (
    <>
      <div className={`theater-queue fixed z-40 w-72 sm:w-80 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-sm shadow-2xl overflow-hidden ${getPositionClasses()}`}>
        {/* Header - mobile-friendly touch targets */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-3 py-3 bg-gradient-to-r from-yellow-900/40 to-gray-900/80 border-b border-gray-700/50 flex items-center justify-between hover:from-yellow-900/60 transition-colors"
          style={{ minHeight: '52px' }}
        >
          <div className="flex items-center gap-3">
            {/* Queue icon with count badge */}
            <div className="relative">
              <ListMusic size={20} className="text-yellow-400" />
              {theaterQueue.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-yellow-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                  {theaterQueue.length}
                </span>
              )}
            </div>

            {/* Status text */}
            <div className="text-left">
              {isPlayingFromQueue ? (
                <div className="flex items-center gap-2">
                  {/* Playing animation */}
                  <div className="flex items-end gap-0.5 h-4">
                    <div className="w-1 bg-yellow-400 animate-pulse rounded-full" style={{ height: '40%', animationDelay: '0ms' }} />
                    <div className="w-1 bg-yellow-400 animate-pulse rounded-full" style={{ height: '70%', animationDelay: '150ms' }} />
                    <div className="w-1 bg-yellow-400 animate-pulse rounded-full" style={{ height: '50%', animationDelay: '300ms' }} />
                  </div>
                  <span className="text-yellow-400 text-sm font-mono font-medium">
                    {currentQueueIndex + 1}/{theaterQueue.length}
                  </span>
                </div>
              ) : theaterQueue.length > 0 ? (
                <span className="text-gray-400 text-sm">
                  {theaterQueue.length} queued
                </span>
              ) : (
                <span className="text-gray-400 text-sm">
                  {localPlaylists.length} playlist{localPlaylists.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Play button when not playing and has queue */}
            {!isPlayingFromQueue && theaterQueue.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playQueue(0);
                }}
                className="bg-yellow-600 hover:bg-yellow-500 rounded-full p-2 transition-colors"
                title="Play queue"
                style={{ minWidth: '36px', minHeight: '36px' }}
              >
                <Play size={16} className="text-black" />
              </button>
            )}
            {isExpanded ? (
              <ChevronDown size={20} className="text-gray-500" />
            ) : (
              <ChevronUp size={20} className="text-gray-500" />
            )}
          </div>
        </button>

        {/* Tabs - Queue / Playlists */}
        {isExpanded && (localPlaylists.length > 0 || theaterQueue.length > 0) && (
          <div className="flex border-b border-gray-700/50">
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'queue'
                  ? 'text-yellow-400 border-b-2 border-yellow-400 bg-yellow-500/10'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Queue {theaterQueue.length > 0 && `(${theaterQueue.length})`}
            </button>
            <button
              onClick={() => setActiveTab('playlists')}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'playlists'
                  ? 'text-yellow-400 border-b-2 border-yellow-400 bg-yellow-500/10'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Playlists {localPlaylists.length > 0 && `(${localPlaylists.length})`}
            </button>
          </div>
        )}

        {/* Expanded content */}
        {isExpanded && activeTab === 'queue' && (
          <div className="max-h-64 sm:max-h-80 overflow-y-auto">
            {theaterQueue.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                <ListMusic size={32} className="mx-auto mb-2 opacity-50" />
                <p>Queue is empty</p>
                <p className="text-xs mt-1">Add moments to build your queue</p>
              </div>
            ) : (
            <>
            {/* Queue items */}
            <div className="divide-y divide-gray-800/50">
              {theaterQueue.map((moment, index) => (
                <div
                  key={moment._id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={() => setDraggedIndex(index)}
                  onTouchEnd={handleDragEnd}
                  className={`flex items-center gap-2 px-3 py-3 cursor-grab active:cursor-grabbing transition-colors ${
                    currentQueueIndex === index && isPlayingFromQueue
                      ? 'bg-yellow-900/30 border-l-2 border-yellow-500'
                      : 'hover:bg-gray-800/50'
                  } ${draggedIndex === index ? 'opacity-50' : ''}`}
                  style={{ minHeight: '56px' }}
                >
                  {/* Drag handle - hidden on mobile, use touch to drag */}
                  <div className="text-gray-600 hover:text-gray-400 hidden sm:block">
                    <GripVertical size={14} />
                  </div>

                  {/* Index / Now playing indicator */}
                  <div className="w-6 text-center flex-shrink-0">
                    {currentQueueIndex === index && isPlayingFromQueue ? (
                      <div className="flex items-end justify-center gap-0.5 h-4">
                        <div className="w-1 bg-yellow-400 animate-pulse rounded-full" style={{ height: '40%' }} />
                        <div className="w-1 bg-yellow-400 animate-pulse rounded-full" style={{ height: '70%', animationDelay: '100ms' }} />
                        <div className="w-1 bg-yellow-400 animate-pulse rounded-full" style={{ height: '50%', animationDelay: '200ms' }} />
                      </div>
                    ) : (
                      <span className="text-gray-600 text-sm font-mono">{index + 1}</span>
                    )}
                  </div>

                  {/* Moment info */}
                  <button
                    onClick={() => handlePlayFromIndex(index)}
                    className="flex-1 min-w-0 text-left hover:text-yellow-400 transition-colors py-1"
                  >
                    <div className="text-white text-sm truncate">
                      {moment.songName}
                    </div>
                    <div className="text-gray-500 text-xs truncate">
                      {moment.venueName}
                    </div>
                  </button>

                  {/* Remove button - larger touch target */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(moment._id);
                    }}
                    className="text-gray-600 hover:text-red-400 transition-colors p-2"
                    title="Remove"
                    style={{ minWidth: '36px', minHeight: '36px' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Footer with shuffle, save, and clear buttons */}
            <div className="px-3 py-3 bg-gray-800/30 border-t border-gray-700/50 flex items-center justify-between gap-2">
              {/* Shuffle button */}
              <button
                onClick={shuffleQueue}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-yellow-400 transition-colors px-2 py-2"
                style={{ minHeight: '36px' }}
                title="Shuffle queue"
                disabled={theaterQueue.length < 2}
              >
                <Shuffle size={12} />
                <span className="hidden sm:inline">Shuffle</span>
              </button>

              {/* Save as Local Playlist button (no account needed) */}
              <button
                onClick={() => setShowLocalSaveModal(true)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-400 transition-colors px-2 py-2"
                style={{ minHeight: '36px' }}
                title="Save as playlist"
              >
                <Save size={12} />
                <span className="hidden sm:inline">Save</span>
              </button>

              {/* Save as Collection button - only show if logged in */}
              {user && (
                <button
                  onClick={() => {
                    console.log('Save button clicked, showing modal');
                    setShowSaveModal(true);
                  }}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 transition-colors px-2 py-2"
                  style={{ minHeight: '36px' }}
                  title="Save to cloud"
                >
                  <Link2 size={12} />
                  <span className="hidden sm:inline">Cloud</span>
                </button>
              )}

              {/* Clear button */}
              <button
                onClick={clearQueue}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-2"
                style={{ minHeight: '36px' }}
              >
                <Trash2 size={12} />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
            </>
            )}
          </div>
        )}

        {/* Playlists Tab */}
        {isExpanded && activeTab === 'playlists' && (
          <div className="max-h-64 sm:max-h-80 overflow-y-auto">
            {localPlaylists.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                <FolderOpen size={32} className="mx-auto mb-2 opacity-50" />
                <p>No saved playlists</p>
                <p className="text-xs mt-1">Save your queue to create a playlist</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {localPlaylists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="flex items-center gap-2 px-3 py-3 hover:bg-gray-800/50 transition-colors"
                    style={{ minHeight: '56px' }}
                  >
                    {/* Playlist icon */}
                    <div className="w-8 h-8 bg-yellow-500/20 rounded flex items-center justify-center flex-shrink-0">
                      <ListMusic size={14} className="text-yellow-400" />
                    </div>

                    {/* Playlist info */}
                    <button
                      onClick={() => handleLoadPlaylist(playlist.id)}
                      className="flex-1 min-w-0 text-left hover:text-yellow-400 transition-colors"
                    >
                      <div className="text-white text-sm truncate">{playlist.name}</div>
                      <div className="text-gray-500 text-xs">
                        {playlist.moments.length} track{playlist.moments.length !== 1 ? 's' : ''}
                      </div>
                    </button>

                    {/* Quick play button */}
                    <button
                      onClick={() => {
                        handleLoadPlaylist(playlist.id);
                        setTimeout(() => playQueue(0), 100);
                      }}
                      className="p-2 text-gray-500 hover:text-yellow-400 transition-colors"
                      title="Play playlist"
                    >
                      <Play size={16} />
                    </button>

                    {/* More options */}
                    <div className="relative">
                      <button
                        onClick={() => setPlaylistMenuOpen(playlistMenuOpen === playlist.id ? null : playlist.id)}
                        className="p-2 text-gray-500 hover:text-white transition-colors"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Dropdown menu */}
                      {playlistMenuOpen === playlist.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-gray-700 rounded shadow-xl z-10">
                          <button
                            onClick={() => handleAppendPlaylist(playlist.id)}
                            className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Plus size={14} />
                            Add to queue
                          </button>
                          <button
                            onClick={() => handleCopyPlaylistLink(playlist.id)}
                            className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Copy size={14} />
                            {linkCopied ? 'Copied!' : 'Copy link'}
                          </button>
                          <button
                            onClick={() => handleDeletePlaylist(playlist.id)}
                            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create new playlist button */}
            {theaterQueue.length > 0 && (
              <div className="px-3 py-3 bg-gray-800/30 border-t border-gray-700/50">
                <button
                  onClick={() => setShowLocalSaveModal(true)}
                  className="w-full px-3 py-2 text-sm text-yellow-400 border border-yellow-500/30 rounded hover:bg-yellow-500/10 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={14} />
                  Save current queue as playlist
                </button>
              </div>
            )}
          </div>
        )}

        {/* Progress bar at bottom */}
        {isPlayingFromQueue && (
          <div className="h-0.5 bg-gray-800">
            <div
              className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-300"
              style={{ width: `${((currentQueueIndex + 1) / theaterQueue.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Save as Collection Modal - positioned as fixed overlay */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-sm p-6 shadow-2xl w-80 max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium">Save Queue as Collection</h4>
              <button
                onClick={closeSaveModal}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {saveSuccess ? (
              <div className="py-4">
                <div className="flex items-center justify-center gap-2 text-green-400 mb-4">
                  <Check size={24} />
                  <span className="text-lg">Collection saved!</span>
                </div>

                {/* Shareable link section for public collections */}
                {savedCollection?.isPublic && (
                  <div className="bg-gray-800 rounded p-3 mb-4">
                    <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                      <Link2 size={12} />
                      Shareable link:
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/collection/${savedCollection._id}`}
                        className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm font-mono"
                        onClick={(e) => e.target.select()}
                      />
                      <button
                        onClick={copyShareableLink}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-black rounded transition-colors flex items-center gap-2"
                        style={{ minHeight: '44px' }}
                      >
                        {linkCopied ? <Check size={16} /> : <Copy size={16} />}
                        {linkCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={closeSaveModal}
                  className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                >
                  {isPlayingFromQueue ? 'Continue Playing' : 'Done'}
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  placeholder="Collection name..."
                  className="w-full px-3 py-3 bg-gray-800 border border-gray-700 rounded text-white mb-4 focus:border-yellow-500 focus:outline-none"
                  autoFocus
                />

                <label className="flex items-center gap-2 text-sm text-gray-300 mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="rounded border-gray-600 bg-gray-800"
                  />
                  Make public (shareable link)
                </label>

                {saveError && (
                  <div className="text-red-400 text-sm mb-4 p-2 bg-red-900/30 rounded">{saveError}</div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={closeSaveModal}
                    className="flex-1 px-4 py-3 text-gray-400 hover:text-white border border-gray-700 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAsCollection}
                    disabled={isSaving || !collectionName.trim()}
                    className="flex-1 px-4 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save ({theaterQueue.length})
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Save as Local Playlist Modal */}
      {showLocalSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-sm p-6 shadow-2xl w-80 max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium">Save as Playlist</h4>
              <button
                onClick={() => {
                  setShowLocalSaveModal(false);
                  setLocalPlaylistName('');
                }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              Save to your device (no account needed). Your playlist will persist across sessions.
            </p>

            <input
              type="text"
              value={localPlaylistName}
              onChange={(e) => setLocalPlaylistName(e.target.value)}
              placeholder="Playlist name..."
              className="w-full px-3 py-3 bg-gray-800 border border-gray-700 rounded text-white mb-4 focus:border-yellow-500 focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveLocalPlaylist();
              }}
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowLocalSaveModal(false);
                  setLocalPlaylistName('');
                }}
                className="flex-1 px-4 py-3 text-gray-400 hover:text-white border border-gray-700 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLocalPlaylist}
                disabled={!localPlaylistName.trim()}
                className="flex-1 px-4 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save size={16} />
                Save ({theaterQueue.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TheaterQueue;
