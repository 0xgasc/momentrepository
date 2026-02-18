// src/components/UI/NotificationBell.jsx
// In-app notification inbox for comments and moderation updates
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../Auth/AuthProvider';
import { API_BASE_URL } from '../Auth/AuthProvider';

const formatTimeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const typeIcon = (type) => {
  switch (type) {
    case 'comment': return '💬';
    case 'approval': return '✅';
    case 'rejection': return '❌';
    case 'needs_revision': return '✏️';
    default: return '🔔';
  }
};

const NotificationBell = memo(({ onMomentSelect }) => {
  const { user, token } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const pollRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!user || !token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // silent fail
    }
  }, [user, token]);

  // Poll every 60s
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 60000);
    return () => clearInterval(pollRef.current);
  }, [user, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = async () => {
    setOpen((prev) => !prev);
    if (!open) {
      setLoading(true);
      await fetchNotifications();
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/notifications/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silent fail
    }
  };

  const handleNotificationClick = (notif) => {
    if (notif.relatedMoment && onMomentSelect) {
      onMomentSelect(notif.relatedMoment._id || notif.relatedMoment);
    }
    setOpen(false);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 text-gray-400 hover:text-gray-200 transition-colors"
        title="Notifications"
        style={{ minHeight: '44px', minWidth: '44px' }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border border-gray-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-gray-900 border border-gray-700 rounded-sm shadow-xl z-50 flex flex-col max-h-[420px]">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
            <span className="text-sm font-semibold text-gray-200">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif._id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-800 hover:bg-gray-800/60 transition-colors flex gap-2.5 items-start ${!notif.read ? 'bg-gray-800/40' : ''}`}
                >
                  <span className="text-base shrink-0 mt-0.5">{typeIcon(notif.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug ${notif.read ? 'text-gray-400' : 'text-gray-200'}`}>
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {formatTimeAgo(notif.createdAt)}
                    </p>
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});

NotificationBell.displayName = 'NotificationBell';
export default NotificationBell;
