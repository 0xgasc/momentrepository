// src/components/UI/TheaterQueue.jsx - Theater queue playlist component
import React, { useState } from 'react';
import { ListMusic, Play, X, Trash2, GripVertical, ChevronUp, ChevronDown, Shuffle, Save, Check, Loader2, Link2, Copy } from 'lucide-react';
import { useTheaterQueue } from '../../contexts/TheaterQueueContext';
import { useAuth } from '../Auth/AuthProvider';
import { useFavorites } from '../../hooks/useFavorites';

const TheaterQueue = ({ sidebarPosition = 'left', sidebarCollapsed = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Save as collection state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedCollection, setSavedCollection] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

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
    stopQueue
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

  // If no queue, don't render anything
  if (theaterQueue.length === 0) {
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
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-yellow-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                {theaterQueue.length}
              </span>
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
              ) : (
                <span className="text-gray-400 text-sm">
                  {theaterQueue.length} queued
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Play button when not playing */}
            {!isPlayingFromQueue && (
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

        {/* Expanded queue list */}
        {isExpanded && (
          <div className="max-h-64 sm:max-h-80 overflow-y-auto">
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

              {/* Save as Collection button - only show if logged in */}
              {user && (
                <button
                  onClick={() => {
                    console.log('Save button clicked, showing modal');
                    setShowSaveModal(true);
                  }}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-400 transition-colors px-2 py-2"
                  style={{ minHeight: '36px' }}
                  title="Save as collection"
                >
                  <Save size={12} />
                  <span className="hidden sm:inline">Save</span>
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
    </>
  );
};

export default TheaterQueue;
