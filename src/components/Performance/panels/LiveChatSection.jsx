// src/components/Performance/panels/LiveChatSection.jsx
import React, { useState, useEffect, useRef, memo } from 'react';
import { Send, Wifi, WifiOff, User, Trash2 } from 'lucide-react';
import useLiveChat from '../../../hooks/useLiveChat';

const formatTime = (date) => {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatMessage = memo(({ message, isOwn, canDelete, onViewUserProfile, onDelete }) => {
  const displayName = message.user?.displayName || message.displayName || 'Anonymous';
  const canClickUser = message.user?._id && onViewUserProfile;

  const handleDelete = async () => {
    if (window.confirm('Delete this message?')) {
      const result = await onDelete(message._id);
      if (result && !result.success) {
        alert(result.error || 'Failed to delete message');
      }
    }
  };

  return (
    <div className={`group flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <div className={`
        max-w-[80%] px-3 py-2 rounded-sm relative
        ${isOwn
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-gray-700/50 text-gray-200 rounded-bl-sm'
        }
      `}>
        {!isOwn && (
          <div className="text-xs mb-1 font-medium">
            {canClickUser ? (
              <button
                onClick={() => onViewUserProfile(message.user._id)}
                className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
              >
                {displayName}
              </button>
            ) : (
              <span className="text-gray-400">{displayName}</span>
            )}
          </div>
        )}
        <p className="text-sm break-words">{message.text}</p>
        <div className={`flex items-center justify-between gap-2 mt-1`}>
          <span className={`text-xs ${isOwn ? 'text-blue-200' : 'text-gray-500'}`}>
            {formatTime(message.createdAt)}
          </span>
          {canDelete && (
            <button
              onClick={handleDelete}
              className={`opacity-0 group-hover:opacity-100 text-xs transition-all ${
                isOwn ? 'text-red-300 hover:text-red-400' : 'text-red-400 hover:text-red-300'
              }`}
              title={isOwn ? 'Delete message' : 'Delete message (mod)'}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

const LiveChatSection = memo(({ performanceId, user, token, onViewUserProfile }) => {
  const { messages, connected, loading, sendMessage, deleteMessage } = useLiveChat(performanceId, token);
  const [input, setInput] = useState('');
  const [anonName, setAnonName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Generate anonymous ID for non-logged-in users
  const [anonId] = useState(() => {
    const stored = localStorage.getItem('umo-anon-id');
    if (stored) return stored;
    const newId = `anon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('umo-anon-id', newId);
    return newId;
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // If not logged in and no name set, show name input
    if (!user && !anonName && !showNameInput) {
      setShowNameInput(true);
      return;
    }

    const result = await sendMessage(
      input.trim(),
      user ? null : (anonName || 'Anonymous'),
      user ? null : anonId
    );

    if (result.success) {
      setInput('');
      inputRef.current?.focus();
    } else {
      // Show error to user
      alert(result.error || 'Failed to send message');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSetName = () => {
    if (anonName.trim()) {
      setShowNameInput(false);
      handleSend();
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
    <div className="live-chat-section flex flex-col h-[400px]">
      {/* Connection status */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-800/50 mb-2">
        {connected ? (
          <>
            <Wifi size={14} className="text-green-400" />
            <span className="text-xs text-green-400">Live</span>
          </>
        ) : (
          <>
            <WifiOff size={14} className="text-yellow-400" />
            <span className="text-xs text-yellow-400">Connecting...</span>
          </>
        )}
        <span className="text-xs text-gray-500 ml-auto">
          {messages.length} messages
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message, idx) => {
            // Check ownership carefully - must match how message was posted
            // If user logged in: only own if message has matching user ID
            // If anonymous: only own if message has matching anonymousId (and no user)
            const messageUserId = message.user?._id?.toString?.() || message.user?._id || message.user;
            const isOwnMessage = user
              ? (messageUserId && String(messageUserId) === String(user.userId))
              : (!message.user && message.anonymousId === anonId);

            // Admins and mods can delete any message
            const isAdminOrMod = user?.role === 'admin' || user?.role === 'mod';
            const canDelete = isOwnMessage || isAdminOrMod;

            return (
              <ChatMessage
                key={message._id || idx}
                message={message}
                isOwn={isOwnMessage}
                canDelete={canDelete}
                onViewUserProfile={onViewUserProfile}
                onDelete={(msgId) => deleteMessage(msgId, user ? null : anonId)}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Anonymous name input */}
      {showNameInput && !user && (
        <div className="mt-2 p-3 bg-gray-800/50 rounded-sm border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <User size={14} className="text-gray-400" />
            <span className="text-sm text-gray-300">Enter a display name</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={anonName}
              onChange={(e) => setAnonName(e.target.value)}
              placeholder="Your name..."
              className="flex-1 bg-gray-900/50 border border-gray-700 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={50}
              autoFocus
            />
            <button
              onClick={handleSetName}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-sm transition-colors"
            >
              Join
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      {(!showNameInput || user) && (
        <div className="mt-3 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={user ? "Type a message..." : `Chat as ${anonName || 'Anonymous'}...`}
            className="flex-1 bg-gray-800/50 border border-gray-700 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={500}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-sm transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      )}
    </div>
  );
});

LiveChatSection.displayName = 'LiveChatSection';

export default LiveChatSection;
