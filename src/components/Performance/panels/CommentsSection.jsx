// src/components/Performance/panels/CommentsSection.jsx
import React, { useState, useEffect, memo } from 'react';
import { ChevronUp, ChevronDown, MessageSquare, Reply, Clock, User, Trash2 } from 'lucide-react';
import { useComments } from '../../../hooks/useCommunity';

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
    if (window.confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
      onDelete(comment._id);
    }
  };

  const isAdminOrMod = user && (user.role === 'admin' || user.role === 'mod');
  const isOwner = user && comment.user?._id && comment.user._id.toString() === user._id?.toString();

  const maxDepth = 3;
  const isNested = depth > 0;

  return (
    <div className={`comment-item ${isNested ? 'ml-4 pl-4 border-l border-gray-700/50' : ''}`}>
      <div className="flex gap-3 py-3">
        {/* Vote buttons */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => handleVote('up')}
            className="p-1 hover:bg-gray-700/50 rounded transition-colors text-gray-500 hover:text-orange-400"
          >
            <ChevronUp size={16} />
          </button>
          <span className={`text-sm font-medium ${
            comment.score > 0 ? 'text-orange-400' :
            comment.score < 0 ? 'text-blue-400' : 'text-gray-500'
          }`}>
            {comment.score || 0}
          </span>
          <button
            onClick={() => handleVote('down')}
            className="p-1 hover:bg-gray-700/50 rounded transition-colors text-gray-500 hover:text-blue-400"
          >
            <ChevronDown size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <User size={12} />
            {comment.user?._id && onViewUserProfile ? (
              <button
                onClick={() => onViewUserProfile(comment.user._id)}
                className="font-medium text-blue-400 hover:text-blue-300 hover:underline transition-colors"
              >
                {comment.user.displayName || 'Anonymous'}
              </button>
            ) : (
              <span className="font-medium text-gray-300">
                {comment.user?.displayName || 'Anonymous'}
              </span>
            )}
            <span>·</span>
            <Clock size={12} />
            <span>{formatTimeAgo(comment.createdAt)}</span>
            {comment.isEdited && <span className="italic">(edited)</span>}
          </div>

          <p className="text-gray-200 text-sm whitespace-pre-wrap break-words">
            {comment.text}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-2">
            {depth < maxDepth && (
              <button
                onClick={() => setShowReplyBox(!showReplyBox)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <Reply size={12} />
                Reply
              </button>
            )}
            {(isOwner || isAdminOrMod) && (
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
                className="w-full bg-gray-800/50 border border-gray-700 rounded-sm p-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleReply}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-sm transition-colors"
                >
                  Reply
                </button>
                <button
                  onClick={() => setShowReplyBox(false)}
                  className="px-3 py-1 text-gray-400 hover:text-white text-xs transition-colors"
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

const CommentsSection = memo(({ performanceId, user, token, onViewUserProfile }) => {
  const { comments, loading, fetchComments, addComment, voteComment, deleteComment } = useComments(performanceId, token);
  const [newComment, setNewComment] = useState('');
  const [sort, setSort] = useState('top');

  useEffect(() => {
    fetchComments(sort);
  }, [fetchComments, sort]);

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

  const handleDelete = async (commentId) => {
    const result = await deleteComment(commentId);
    if (!result.success) {
      alert(result.error || 'Failed to delete comment');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="comments-section">
      {/* New comment box */}
      <div className="mb-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={user ? "Share your thoughts about this show..." : "Log in to comment..."}
          className="w-full bg-gray-800/50 border border-gray-700 rounded-sm p-3 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          disabled={!user}
        />
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort by:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
            >
              <option value="top">Top</option>
              <option value="new">New</option>
            </select>
          </div>
          <button
            onClick={handleAddComment}
            disabled={!user || !newComment.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-sm transition-colors"
          >
            Post Comment
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="divide-y divide-gray-800/50">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
            <p>No comments yet. Be the first!</p>
          </div>
        ) : (
          comments.map(comment => (
            <CommentItem
              key={comment._id}
              comment={comment}
              onVote={voteComment}
              onReply={handleReply}
              onDelete={handleDelete}
              user={user}
              onViewUserProfile={onViewUserProfile}
            />
          ))
        )}
      </div>
    </div>
  );
});

CommentsSection.displayName = 'CommentsSection';

export default CommentsSection;
