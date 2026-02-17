// src/components/UI/VideoHeroComments.jsx
// Slide-out comments panel for VideoHero
import React, { memo, useEffect } from 'react';
import { X, MessageSquare } from 'lucide-react';
import MomentCommentsSection from '../Moment/MomentCommentsSection';
import { useMomentComments } from '../../hooks/useCommunity';

const VideoHeroComments = memo(({ momentId, user, token, isOpen, onClose, momentName }) => {
  const { count, fetchCount } = useMomentComments(momentId, token);

  // Fetch count when panel opens or moment changes
  useEffect(() => {
    if (momentId) {
      fetchCount();
    }
  }, [momentId, fetchCount]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-96 max-w-full bg-gray-900/95 backdrop-blur-xl border-l border-gray-700/50 z-50 flex flex-col animate-slide-in-right" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-400" />
            <div>
              <h3 className="text-white font-medium text-sm">Comments</h3>
              {momentName && (
                <p className="text-gray-400 text-xs truncate max-w-[200px]">{momentName}</p>
              )}
            </div>
            {count > 0 && (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                {count}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Comments content */}
        <div className="flex-1 overflow-y-auto p-4">
          {momentId ? (
            <MomentCommentsSection
              momentId={momentId}
              user={user}
              token={token}
              compact={true}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No moment selected</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .animate-slide-in-right {
          animation: slideInRight 0.25s ease-out;
        }

        @media (max-width: 640px) {
          /* Mobile: slide from bottom */
          .fixed.top-0.right-0.bottom-0 {
            top: auto;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            max-height: 70vh;
            border-radius: 16px 16px 0 0;
            border-left: none;
            border-top: 1px solid rgba(107, 114, 128, 0.5);
            animation: slideInUp 0.25s ease-out;
          }

          @keyframes slideInUp {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }
        }
      `}</style>
    </>
  );
});

VideoHeroComments.displayName = 'VideoHeroComments';

export default VideoHeroComments;
