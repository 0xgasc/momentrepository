// src/hooks/useLiveChat.js
import { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '../components/Auth/AuthProvider';

export const useLiveChat = (performanceId, token) => {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/community/performances/${performanceId}/chat`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to fetch chat messages:', err);
    } finally {
      setLoading(false);
    }
  }, [performanceId, token]);

  // Connect to socket
  useEffect(() => {
    if (!performanceId) return;

    // Determine socket URL (same host as API)
    // eslint-disable-next-line no-unused-vars
    const socketUrl = API_BASE_URL.replace('/api', '').replace('http://', 'ws://').replace('https://', 'wss://');

    socketRef.current = io(API_BASE_URL.replace('/api', ''), {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : {}
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('🔌 Chat socket connected');
      setConnected(true);
      socket.emit('join-chat', performanceId);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Chat socket disconnected');
      setConnected(false);
    });

    socket.on('chat-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('chat-delete', ({ messageId }) => {
      setMessages(prev => prev.filter(m => m._id !== messageId));
    });

    // Fetch initial messages
    fetchMessages();

    return () => {
      if (socket) {
        socket.emit('leave-chat', performanceId);
        socket.disconnect();
      }
    };
  }, [performanceId, token, fetchMessages]);

  // Send message
  const sendMessage = useCallback(async (text, displayName, anonymousId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/community/performances/${performanceId}/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ text, displayName, anonymousId })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Message will be added via socket event
      return { success: true };
    } catch (err) {
      console.error('Failed to send message:', err);
      // Check if it's a content filter error
      if (err.response) {
        const data = await err.response.json?.();
        return { success: false, error: data?.error || 'Failed to send message' };
      }
      return { success: false, error: 'Failed to send message' };
    }
  }, [performanceId, token]);

  // Delete message
  const deleteMessage = useCallback(async (messageId, anonymousId) => {
    try {
      const url = new URL(`${API_BASE_URL}/api/community/performances/${performanceId}/chat/${messageId}`);
      if (anonymousId) {
        url.searchParams.set('anonymousId', anonymousId);
      }

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete');
      }

      // Message will be removed via socket event
      return { success: true };
    } catch (err) {
      console.error('Failed to delete message:', err);
      return { success: false, error: err.message };
    }
  }, [performanceId, token]);

  return {
    messages,
    connected,
    loading,
    sendMessage,
    deleteMessage,
    refetch: fetchMessages
  };
};

export default useLiveChat;
