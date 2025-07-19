// hooks/useNotifications.js - Hook for fetching notification counts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/Auth/AuthProvider';

export const useNotifications = (API_BASE_URL) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState({
    pendingApproval: 0,  // Blue dot for users
    needsRevision: 0,    // Red dot for users  
    pendingReview: 0     // Red dot for admins
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications({
        pendingApproval: 0,
        needsRevision: 0,
        pendingReview: 0
      });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/notifications/counts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔔 Notifications data:', data);
        setNotifications(data);
      } else {
        console.error('Failed to fetch notifications:', response.status);
        setError('Failed to load notifications');
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Error loading notifications');
    } finally {
      setLoading(false);
    }
  }, [user, API_BASE_URL]);

  // Fetch notifications when user changes or on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Auto-refresh notifications every 30 seconds when user is logged in
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Get badge info based on user type
  const getBadgeInfo = useCallback(() => {
    const isModOrAdmin = user?.role === 'admin' || user?.role === 'mod' || user?.email === 'solo@solo.solo' || user?.email === 'solo2@solo.solo';
    
    console.log('🔔 Badge calculation:', { 
      user: user?.email, 
      role: user?.role,
      isModOrAdmin, 
      notifications 
    });
    
    if (isModOrAdmin) {
      // Admin/Mod: red dot for pending review
      if (notifications.pendingReview > 0) {
        // console.log('🔔 Admin/Mod badge: RED (pending review)');
        return { color: 'red', show: true, isModOrAdmin };
      }
    } else {
      // Regular user: blue for pending approval, red for needs revision
      if (notifications.needsRevision > 0) {
        console.log('🔔 User badge: RED (needs revision)');
        return { color: 'red', show: true, isModOrAdmin };
      }
      if (notifications.pendingApproval > 0) {
        // console.log('🔔 User badge: BLUE (pending approval)');
        return { color: 'blue', show: true, isModOrAdmin };
      }
    }
    
    // console.log('🔔 No badge shown');
    return { color: null, show: false, isModOrAdmin };
  }, [user, notifications]);

  return {
    notifications,
    loading,
    error,
    getBadgeInfo,
    refreshNotifications: fetchNotifications
  };
};