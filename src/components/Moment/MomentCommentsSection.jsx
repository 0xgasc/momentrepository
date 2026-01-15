// src/components/Moment/MomentCommentsSection.jsx
// Compact comments section for moment detail modal
import React, { useState, useEffect, memo } from 'react';
import { Heart, MessageSquare, Reply, Trash2 } from 'lucide-react';
import { useMomentComments } from '../../hooks/useCommunity';

const formatTimeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const CommentItem = memo(({ comment, onVote, onReply, onDelete, user, depth = 0, onViewUserProfile }) => {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');

  const handleVote = (vote) => {
    if (!user) {
      alert('Please log in to vote');
      return;
    }
    onVote(comment._id, vote);
  };

  const handleReply = () => {
    if (!user) {
      alert('Please log in to reply');
      return;
    }
    if (replyText.trim()) {
      onReply(replyText, comment._id);
      setReplyText('');
      setShowReplyBox(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Delete this comment?')) {
      onDelete(comment._id);
    }
  };

  const maxDepth = 3;
  const isNested = depth > 0;
  const isOwner = user?.userId === comment.user?._id;

  return (
    <div className={`comment-item ${isNested ? 'ml-3 pl-3 border-l border-gray-700/50' : ''}`}>
      <div className="flex gap-2 py-2">
        {/* Like button */}
        <div className="flex flex-col items-center pt-1">
          <button
            onClick={() => handleVote('up')}
            className={`p-1 hover:bg-gray-700/50 rounded transition-colors ${
              (comment.upvotes?.length || 0) > 0 ? 'text-red-400' : 'text-gray-500 hover:text-red-400'
            }`}
            title="Like this comment"
          >
            <Heart size={14} fill={(comment.upvotes?.length || 0) > 0 ? 'currentColor' : 'none'} />
          </button>
          {(comment.upvotes?.length || 0) > 0 && (
            <span className="text-xs font-medium text-red-400">
              {comment.upvotes?.length || 0}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-0.5">
            {comment.user?._id ? (
              <button
                onClick={() => onViewUserProfile?.(comment.user._id)}
                className="font-medium text-blue-400 hover:text-blue-300 hover:underline transition-colors"
              >
                {comment.user.displayName}
              </button>
            ) : (
              <span className="font-medium text-gray-300">
                {comment.user?.displayName || 'Anonymous'}
              </span>
            )}
            <span>·</span>
            <span>{formatTimeAgo(comment.createdAt)}</span>
            {comment.isEdited && <span className="italic">(edited)</span>}
          </div>

          <p className="text-gray-200 text-sm whitespace-pre-wrap break-words">
            {comment.text}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-1">
            {depth < maxDepth && (
              <button
                onClick={() => setShowReplyBox(!showReplyBox)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <Reply size={10} />
                Reply
              </button>
            )}
            {isOwner && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={10} />
                Delete
              </button>
            )}
          </div>

          {/* Reply box */}
          {showReplyBox && (
            <div className="mt-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="w-full bg-gray-800/50 border border-gray-700 rounded-sm p-2 text-xs text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={2}
              />
              <div className="flex gap-2 mt-1">
                <button
                  onClick={handleReply}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-sm transition-colors"
                >
                  Reply
                </button>
                <button
                  onClick={() => setShowReplyBox(false)}
                  className="px-2 py-1 text-gray-400 hover:text-white text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {comment.replies?.length > 0 && (
        <div className="replies">
          {comment.replies.map(reply => (
            <CommentItem
              key={reply._id}
              comment={reply}
              onVote={onVote}
              onReply={onReply}
              onDelete={onDelete}
              user={user}
              depth={depth + 1}
              onViewUserProfile={onViewUserProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
});

CommentItem.displayName = 'CommentItem';

const MomentCommentsSection = memo(({ momentId, user, token, compact = false, onViewUserProfile }) => {
  const { comments, count, loading, fetchComments, addComment, voteComment, deleteComment } = useMomentComments(momentId, token);
  const [newComment, setNewComment] = useState('');
  const [sort, setSort] = useState('top');

  useEffect(() => {
    if (momentId) {
      fetchComments(sort);
    }
  }, [fetchComments, sort, momentId]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    if (!user) {
      alert('Please log in to comment');
      return;
    }

    const result = await addComment(newComment.trim());
    if (result.success) {
      setNewComment('');
    } else {
      alert(result.error);
    }
  };

  const handleReply = async (text, parentId) => {
    const result = await addComment(text, parentId);
    if (!result.success) {
      alert(result.error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="moment-comments-section">
      {/* New comment box */}
      <div className="mb-3">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={user ? "Share your thoughts..." : "Log in to comment..."}
          className="w-full bg-gray-800/50 border border-gray-700 rounded-sm p-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={compact ? 2 : 3}
          disabled={!user}
        />
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-white"
            >
              <option value="top">Top</option>
              <option value="new">New</option>
            </select>
          </div>
          <button
            onClick={handleAddComment}
            disabled={!user || !newComment.trim()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs rounded-sm transition-colors"
          >
            Post
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="divide-y divide-gray-800/30 max-h-80 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <MessageSquare size={20} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No comments yet. Be the first!</p>
          </div>
        ) : (
          comments.map(comment => (
            <CommentItem
              key={comment._id}
              comment={comment}
              onVote={voteComment}
              onReply={handleReply}
              onDelete={deleteComment}
              user={user}
              onViewUserProfile={onViewUserProfile}
            />
          ))
        )}
      </div>

      {/* Comment count */}
      {count > 0 && (
        <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-800/30">
          {count} comment{count !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
});

MomentCommentsSection.displayName = 'MomentCommentsSection';

export default MomentCommentsSection;
