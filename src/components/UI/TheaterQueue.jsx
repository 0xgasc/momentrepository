// src/components/UI/TheaterQueue.jsx - Sleek theater queue playlist component
import { useState } from 'react';
import { ListMusic, Play, X, Trash2, GripVertical, ChevronUp, ChevronDown, Shuffle, Save, Check, Loader2, Link2, Copy, FolderOpen, Plus, MoreVertical, Pause } from 'lucide-react';
import { useTheaterQueue } from '../../contexts/TheaterQueueContext';
import { useAuth } from '../Auth/AuthProvider';
import { useFavorites } from '../../hooks/useFavorites';

const TheaterQueue = ({ sidebarPosition = 'left' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [activeTab, setActiveTab] = useState('queue');

  // Save modals
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedCollection, setSavedCollection] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const [showLocalSaveModal, setShowLocalSaveModal] = useState(false);
  const [localPlaylistName, setLocalPlaylistName] = useState('');
  const [playlistMenuOpen, setPlaylistMenuOpen] = useState(null);

  const { token, user } = useAuth();
  const { createCollection, addToCollection } = useFavorites(token);

  const {
    theaterQueue,
    currentQueueIndex,
    isPlayingFromQueue,
    removeFromQueue,
    clearQueue,
    playQueue,
    reorderQueue,
    shuffleQueue,
    localPlaylists,
    saveQueueAsLocalPlaylist,
    loadLocalPlaylist,
    deleteLocalPlaylist,
    exportPlaylistAsLink,
    playerState,
    togglePlayPause
  } = useTheaterQueue();

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    reorderQueue(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => setDraggedIndex(null);

  const handlePlayFromIndex = (index) => playQueue(index);

  const handleSaveAsCollection = async () => {
    if (!collectionName.trim() || theaterQueue.length === 0) return;
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    setSavedCollection(null);

    try {
      const result = await createCollection(collectionName.trim(), '', isPublic);
      if (result.success && result.collection) {
        for (const moment of theaterQueue) {
          await addToCollection(result.collection._id, moment._id);
        }
        setSaveSuccess(true);
        setSavedCollection(result.collection);
        setCollectionName('');
        if (!isPlayingFromQueue) playQueue(0);
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

  const copyShareableLink = () => {
    if (savedCollection) {
      navigator.clipboard.writeText(`${window.location.origin}/collection/${savedCollection._id}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const closeSaveModal = () => {
    setShowSaveModal(false);
    setSaveError('');
    setSaveSuccess(false);
    setSavedCollection(null);
    setLinkCopied(false);
  };

  const handleSaveLocalPlaylist = () => {
    if (!localPlaylistName.trim() || theaterQueue.length === 0) return;
    const result = saveQueueAsLocalPlaylist(localPlaylistName.trim());
    if (result) {
      setLocalPlaylistName('');
      setShowLocalSaveModal(false);
    }
  };

  const handleLoadPlaylist = (playlistId) => {
    loadLocalPlaylist(playlistId, true);
    setActiveTab('queue');
    setPlaylistMenuOpen(null);
  };

  const handleAppendPlaylist = (playlistId) => {
    loadLocalPlaylist(playlistId, false);
    setActiveTab('queue');
    setPlaylistMenuOpen(null);
  };

  const handleCopyPlaylistLink = (playlistId) => {
    const link = exportPlaylistAsLink(playlistId);
    if (link) {
      navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
    setPlaylistMenuOpen(null);
  };

  const handleDeletePlaylist = (playlistId) => {
    if (window.confirm('Delete this playlist?')) {
      deleteLocalPlaylist(playlistId);
    }
    setPlaylistMenuOpen(null);
  };

  if (theaterQueue.length === 0 && localPlaylists.length === 0) return null;

  const getPositionClasses = () => {
    if (sidebarPosition === 'right') return 'bottom-4 right-4 lg:left-4 lg:right-auto';
    if (sidebarPosition === 'bottom') return 'bottom-4 right-4 lg:bottom-20';
    return 'bottom-4 right-4';
  };

  return (
    <>
      <div className={`theater-queue fixed z-40 w-80 bg-gray-900 border border-gray-700 shadow-2xl overflow-hidden hidden lg:block ${getPositionClasses()}`}>
        {/* Compact Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between hover:bg-gray-750 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ListMusic size={18} className="text-accent" style={{ color: 'var(--accent-color, #eab308)' }} />
              {theaterQueue.length > 0 && (
                <span
                  className="absolute -top-1 -right-1.5 w-4 h-4 text-[9px] font-bold flex items-center justify-center text-gray-900"
                  style={{ background: 'var(--accent-color, #eab308)' }}
                >
                  {theaterQueue.length}
                </span>
              )}
            </div>

            {isPlayingFromQueue ? (
              <div className="flex items-center gap-2">
                <div className="flex items-end gap-0.5 h-3">
                  {[40, 70, 50].map((h, i) => (
                    <div
                      key={i}
                      className="w-0.5 animate-pulse"
                      style={{
                        height: `${h}%`,
                        background: 'var(--accent-color, #eab308)',
                        animationDelay: `${i * 150}ms`
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs font-mono" style={{ color: 'var(--accent-color, #eab308)' }}>
                  {currentQueueIndex + 1}/{theaterQueue.length}
                </span>
              </div>
            ) : theaterQueue.length > 0 ? (
              <span className="text-gray-400 text-xs">{theaterQueue.length} in queue</span>
            ) : (
              <span className="text-gray-500 text-xs">{localPlaylists.length} saved</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {theaterQueue.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isPlayingFromQueue && playerState.isPlaying) {
                    togglePlayPause();
                  } else {
                    playQueue(isPlayingFromQueue ? currentQueueIndex : 0);
                  }
                }}
                className="w-7 h-7 flex items-center justify-center transition-colors text-gray-900"
                style={{ background: 'var(--accent-color, #eab308)' }}
              >
                {isPlayingFromQueue && playerState.isPlaying ? (
                  <Pause size={14} />
                ) : (
                  <Play size={14} className="ml-0.5" />
                )}
              </button>
            )}
            {isExpanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronUp size={16} className="text-gray-500" />}
          </div>
        </button>

        {/* Tabs */}
        {isExpanded && (localPlaylists.length > 0 || theaterQueue.length > 0) && (
          <div className="flex border-b border-gray-800">
            {['queue', 'playlists'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-3 py-2 text-xs font-medium uppercase tracking-wide transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 bg-gray-800/50'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                style={activeTab === tab ? {
                  color: 'var(--accent-color, #eab308)',
                  borderColor: 'var(--accent-color, #eab308)'
                } : {}}
              >
                {tab} {tab === 'queue' && theaterQueue.length > 0 && `(${theaterQueue.length})`}
                {tab === 'playlists' && localPlaylists.length > 0 && `(${localPlaylists.length})`}
              </button>
            ))}
          </div>
        )}

        {/* Queue Tab */}
        {isExpanded && activeTab === 'queue' && (
          <div className="max-h-72 overflow-y-auto">
            {theaterQueue.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <ListMusic size={28} className="mx-auto mb-2 text-gray-700" />
                <p className="text-gray-500 text-sm">Queue empty</p>
                <p className="text-gray-600 text-xs mt-1">Add moments to start</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-800">
                  {theaterQueue.map((moment, index) => (
                    <div
                      key={moment._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing transition-colors ${
                        currentQueueIndex === index && isPlayingFromQueue
                          ? 'bg-gray-800 border-l-2'
                          : 'hover:bg-gray-800/50'
                      } ${draggedIndex === index ? 'opacity-50' : ''}`}
                      style={currentQueueIndex === index && isPlayingFromQueue ? { borderColor: 'var(--accent-color, #eab308)' } : {}}
                    >
                      <GripVertical size={12} className="text-gray-700 hidden sm:block flex-shrink-0" />

                      <div className="w-5 text-center flex-shrink-0">
                        {currentQueueIndex === index && isPlayingFromQueue ? (
                          <div className="flex items-end justify-center gap-0.5 h-3">
                            {[40, 70, 50].map((h, i) => (
                              <div
                                key={i}
                                className="w-0.5 animate-pulse"
                                style={{ height: `${h}%`, background: 'var(--accent-color, #eab308)' }}
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-600 text-xs font-mono">{index + 1}</span>
                        )}
                      </div>

                      <button
                        onClick={() => handlePlayFromIndex(index)}
                        className="flex-1 min-w-0 text-left group"
                      >
                        <div className="text-gray-200 text-sm truncate group-hover:text-white transition-colors">
                          {moment.songName}
                        </div>
                        <div className="text-gray-500 text-xs truncate">
                          {moment.venueName}
                        </div>
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); removeFromQueue(moment._id); }}
                        className="p-1.5 text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="px-3 py-2.5 bg-gray-800/50 border-t border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <ActionButton icon={Shuffle} onClick={shuffleQueue} disabled={theaterQueue.length < 2} title="Shuffle" />
                    <ActionButton icon={Save} onClick={() => setShowLocalSaveModal(true)} title="Save" color="green" />
                    {user && <ActionButton icon={Link2} onClick={() => setShowSaveModal(true)} title="Cloud" color="blue" />}
                  </div>
                  <ActionButton icon={Trash2} onClick={clearQueue} title="Clear" color="red" />
                </div>
              </>
            )}
          </div>
        )}

        {/* Playlists Tab */}
        {isExpanded && activeTab === 'playlists' && (
          <div className="max-h-72 overflow-y-auto">
            {localPlaylists.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <FolderOpen size={28} className="mx-auto mb-2 text-gray-700" />
                <p className="text-gray-500 text-sm">No playlists</p>
                <p className="text-gray-600 text-xs mt-1">Save your queue</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {localPlaylists.map((playlist) => (
                  <div key={playlist.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-800/50 transition-colors">
                    <div
                      className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(234, 179, 8, 0.15)' }}
                    >
                      <ListMusic size={14} style={{ color: 'var(--accent-color, #eab308)' }} />
                    </div>

                    <button onClick={() => handleLoadPlaylist(playlist.id)} className="flex-1 min-w-0 text-left group">
                      <div className="text-gray-200 text-sm truncate group-hover:text-white">{playlist.name}</div>
                      <div className="text-gray-500 text-xs">{playlist.moments.length} tracks</div>
                    </button>

                    <button
                      onClick={() => { handleLoadPlaylist(playlist.id); setTimeout(() => playQueue(0), 100); }}
                      className="p-1.5 text-gray-500 hover:text-white transition-colors"
                    >
                      <Play size={14} />
                    </button>

                    <div className="relative">
                      <button
                        onClick={() => setPlaylistMenuOpen(playlistMenuOpen === playlist.id ? null : playlist.id)}
                        className="p-1.5 text-gray-600 hover:text-white transition-colors"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {playlistMenuOpen === playlist.id && (
                        <div className="absolute right-0 top-full mt-1 w-36 bg-gray-800 border border-gray-700 shadow-xl z-10">
                          <MenuButton icon={Plus} onClick={() => handleAppendPlaylist(playlist.id)}>Add to queue</MenuButton>
                          <MenuButton icon={Copy} onClick={() => handleCopyPlaylistLink(playlist.id)}>
                            {linkCopied ? 'Copied!' : 'Copy link'}
                          </MenuButton>
                          <MenuButton icon={Trash2} onClick={() => handleDeletePlaylist(playlist.id)} danger>Delete</MenuButton>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {theaterQueue.length > 0 && (
              <div className="px-3 py-2.5 bg-gray-800/50 border-t border-gray-800">
                <button
                  onClick={() => setShowLocalSaveModal(true)}
                  className="w-full px-3 py-2 text-xs border transition-colors flex items-center justify-center gap-2"
                  style={{
                    color: 'var(--accent-color, #eab308)',
                    borderColor: 'rgba(234, 179, 8, 0.3)'
                  }}
                >
                  <Plus size={12} />
                  Save queue as playlist
                </button>
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        {isPlayingFromQueue && (
          <div className="h-0.5 bg-gray-800">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${((currentQueueIndex + 1) / theaterQueue.length) * 100}%`,
                background: 'var(--accent-color, #eab308)'
              }}
            />
          </div>
        )}
      </div>

      {/* Save Collection Modal */}
      {showSaveModal && (
        <Modal onClose={closeSaveModal} title="Save to Cloud">
          {saveSuccess ? (
            <div className="py-4">
              <div className="flex items-center justify-center gap-2 text-green-400 mb-4">
                <Check size={20} />
                <span>Saved!</span>
              </div>
              {savedCollection?.isPublic && (
                <div className="bg-gray-800 p-3 mb-4">
                  <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                    <Link2 size={10} /> Shareable link
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/collection/${savedCollection._id}`}
                      className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-700 text-white text-xs font-mono"
                      onClick={(e) => e.target.select()}
                    />
                    <button onClick={copyShareableLink} className="px-3 py-1.5 text-xs text-gray-900" style={{ background: 'var(--accent-color, #eab308)' }}>
                      {linkCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
              <button onClick={closeSaveModal} className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm">Done</button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="Collection name..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white text-sm mb-3 focus:border-gray-500 focus:outline-none"
                autoFocus
              />
              <label className="flex items-center gap-2 text-xs text-gray-400 mb-4 cursor-pointer">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="border-gray-600 bg-gray-800" />
                Public (shareable)
              </label>
              {saveError && <div className="text-red-400 text-xs mb-3 p-2 bg-red-900/20">{saveError}</div>}
              <div className="flex gap-2">
                <button onClick={closeSaveModal} className="flex-1 px-3 py-2 text-gray-400 border border-gray-700 text-sm hover:text-white">Cancel</button>
                <button
                  onClick={handleSaveAsCollection}
                  disabled={isSaving || !collectionName.trim()}
                  className="flex-1 px-3 py-2 text-gray-900 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'var(--accent-color, #eab308)' }}
                >
                  {isSaving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <>Save ({theaterQueue.length})</>}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Save Local Playlist Modal */}
      {showLocalSaveModal && (
        <Modal onClose={() => { setShowLocalSaveModal(false); setLocalPlaylistName(''); }} title="Save Playlist">
          <p className="text-xs text-gray-400 mb-3">Saved to your device. No account needed.</p>
          <input
            type="text"
            value={localPlaylistName}
            onChange={(e) => setLocalPlaylistName(e.target.value)}
            placeholder="Playlist name..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white text-sm mb-4 focus:border-gray-500 focus:outline-none"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLocalPlaylist(); }}
          />
          <div className="flex gap-2">
            <button onClick={() => { setShowLocalSaveModal(false); setLocalPlaylistName(''); }} className="flex-1 px-3 py-2 text-gray-400 border border-gray-700 text-sm hover:text-white">Cancel</button>
            <button
              onClick={handleSaveLocalPlaylist}
              disabled={!localPlaylistName.trim()}
              className="flex-1 px-3 py-2 text-gray-900 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'var(--accent-color, #eab308)' }}
            >
              <Save size={14} /> Save ({theaterQueue.length})
            </button>
          </div>
        </Modal>
      )}
    </>
  );
};

// Helper components
const ActionButton = ({ icon: Icon, onClick, disabled, title, color }) => {
  const colorClasses = {
    green: 'hover:text-green-400',
    blue: 'hover:text-blue-400',
    red: 'hover:text-red-400',
    default: 'hover:text-white'
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 text-gray-500 ${colorClasses[color] || colorClasses.default} transition-colors disabled:opacity-30`}
    >
      <Icon size={14} />
    </button>
  );
};

const MenuButton = ({ icon: Icon, onClick, children, danger }) => (
  <button
    onClick={onClick}
    className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-700 flex items-center gap-2 ${danger ? 'text-red-400' : 'text-gray-300'}`}
  >
    <Icon size={12} /> {children}
  </button>
);

const Modal = ({ onClose, title, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div className="bg-gray-900 border border-gray-700 p-5 shadow-2xl w-80 max-w-[90vw]">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-white text-sm font-medium">{title}</h4>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
      </div>
      {children}
    </div>
  </div>
);

export default TheaterQueue;
