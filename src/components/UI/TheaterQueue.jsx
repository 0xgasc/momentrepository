// src/components/UI/TheaterQueue.jsx - Theater queue playlist component
import React, { useState } from 'react';
import { ListMusic, Play, X, Trash2, GripVertical, ChevronUp, ChevronDown, Shuffle, Save, Check, Loader2 } from 'lucide-react';
import { useTheaterQueue } from '../../contexts/TheaterQueueContext';
import { useAuth } from '../Auth/AuthProvider';
import { useFavorites } from '../../hooks/useFavorites';

const TheaterQueue = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Save as collection state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const { token, user } = useAuth();
  const { createCollection, addToCollection } = useFavorites(token);

  const {
    theaterQueue,
    currentQueueIndex,
    isPlayingFromQueue,
    currentMoment,
    removeFromQueue,
    clearQueue,
    playQueue,
    reorderQueue,
    shuffleQueue,
    playNextInQueue,
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

    try {
      // Create collection
      const result = await createCollection(collectionName.trim(), '', isPublic);

      if (result.success && result.collection) {
        // Add all queue moments to collection
        let successCount = 0;
        for (const moment of theaterQueue) {
          const addResult = await addToCollection(result.collection._id, moment._id);
          if (addResult.success) successCount++;
        }

        setSaveSuccess(true);
        setCollectionName('');

        // Close modal after short delay
        setTimeout(() => {
          setShowSaveModal(false);
          setSaveSuccess(false);
        }, 1500);
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

  // If no queue, don't render anything
  if (theaterQueue.length === 0) {
    return null;
  }

  return (
    <>
      <div className="theater-queue fixed bottom-4 right-4 z-40 w-72 sm:w-80 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-sm shadow-2xl overflow-hidden">
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
                  onClick={() => setShowSaveModal(true)}
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

            {/* Save as Collection Modal */}
            {showSaveModal && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900 border border-gray-700 rounded-sm p-4 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-medium text-sm">Save Queue as Collection</h4>
                  <button
                    onClick={() => {
                      setShowSaveModal(false);
                      setSaveError('');
                      setSaveSuccess(false);
                    }}
                    className="text-gray-500 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                {saveSuccess ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-green-400">
                    <Check size={20} />
                    <span>Collection saved!</span>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={collectionName}
                      onChange={(e) => setCollectionName(e.target.value)}
                      placeholder="Collection name..."
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm mb-3 focus:border-yellow-500 focus:outline-none"
                      autoFocus
                    />

                    <label className="flex items-center gap-2 text-xs text-gray-300 mb-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="rounded border-gray-600 bg-gray-800"
                      />
                      Make public (shareable link)
                    </label>

                    {saveError && (
                      <div className="text-red-400 text-xs mb-3">{saveError}</div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowSaveModal(false);
                          setSaveError('');
                        }}
                        className="flex-1 px-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveAsCollection}
                        disabled={isSaving || !collectionName.trim()}
                        className="flex-1 px-3 py-2 text-sm bg-yellow-600 hover:bg-yellow-500 text-black font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save size={14} />
                            Save ({theaterQueue.length})
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
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

    </>
  );
};

export default TheaterQueue;
