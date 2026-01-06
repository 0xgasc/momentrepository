// src/hooks/useCommunity.js
import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../components/Auth/AuthProvider';

// Comments hook
export const useComments = (performanceId, token) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async (sort = 'top') => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/community/performances/${performanceId}/comments?sort=${sort}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  }, [performanceId, token]);

  const addComment = useCallback(async (text, parentId = null) => {
    if (!token) return { error: 'Login required' };

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/community/performances/${performanceId}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ text, parentId })
        }
      );

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || 'Failed to add comment' };
      }

      await fetchComments();
      return { success: true };
    } catch (err) {
      return { error: 'Network error' };
    }
  }, [performanceId, token, fetchComments]);

  const voteComment = useCallback(async (commentId, vote) => {
    if (!token) return { error: 'Login required' };

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/community/comments/${commentId}/vote`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ vote })
        }
      );

      if (response.ok) {
        await fetchComments();
        return { success: true };
      }
      return { error: 'Failed to vote' };
    } catch (err) {
      return { error: 'Network error' };
    }
  }, [token, fetchComments]);

  return { comments, loading, fetchComments, addComment, voteComment };
};

// RSVP hook
export const useRSVP = (performanceId, token) => {
  const [rsvps, setRsvps] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasRsvpd, setHasRsvpd] = useState(false);

  const fetchRSVPs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/community/performances/${performanceId}/rsvp`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
      if (response.ok) {
        const data = await response.json();
        setRsvps(data.rsvps || []);
        setCount(data.count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch RSVPs:', err);
    } finally {
      setLoading(false);
    }
  }, [performanceId, token]);

  const addRSVP = useCallback(async (displayName, message, anonymousId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/community/performances/${performanceId}/rsvp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ displayName, message, anonymousId })
        }
      );

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || 'Failed to RSVP' };
      }

      setHasRsvpd(true);
      await fetchRSVPs();
      return { success: true };
    } catch (err) {
      return { error: 'Network error' };
    }
  }, [performanceId, token, fetchRSVPs]);

  const removeRSVP = useCallback(async (anonymousId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/community/performances/${performanceId}/rsvp`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ anonymousId })
        }
      );

      if (response.ok) {
        setHasRsvpd(false);
        await fetchRSVPs();
        return { success: true };
      }
      return { error: 'Failed to remove RSVP' };
    } catch (err) {
      return { error: 'Network error' };
    }
  }, [performanceId, token, fetchRSVPs]);

  return { rsvps, count, loading, hasRsvpd, fetchRSVPs, addRSVP, removeRSVP };
};

// Meetups hook
export const useMeetups = (performanceId, token) => {
  const [meetups, setMeetups] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMeetups = useCallback(async (type = null) => {
    try {
      setLoading(true);
      const url = type
        ? `${API_BASE_URL}/api/community/performances/${performanceId}/meetups?type=${type}`
        : `${API_BASE_URL}/api/community/performances/${performanceId}/meetups`;

      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (response.ok) {
        const data = await response.json();
        setMeetups(data.meetups || []);
      }
    } catch (err) {
      console.error('Failed to fetch meetups:', err);
    } finally {
      setLoading(false);
    }
  }, [performanceId, token]);

  const createMeetup = useCallback(async (meetupData) => {
    if (!token) return { error: 'Login required' };

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/community/performances/${performanceId}/meetups`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(meetupData)
        }
      );

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || 'Failed to create meetup' };
      }

      await fetchMeetups();
      return { success: true };
    } catch (err) {
      return { error: 'Network error' };
    }
  }, [performanceId, token, fetchMeetups]);

  const joinMeetup = useCallback(async (meetupId) => {
    if (!token) return { error: 'Login required' };

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/community/meetups/${meetupId}/join`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || 'Failed to join meetup' };
      }

      await fetchMeetups();
      return { success: true };
    } catch (err) {
      return { error: 'Network error' };
    }
  }, [token, fetchMeetups]);

  const leaveMeetup = useCallback(async (meetupId) => {
    if (!token) return { error: 'Login required' };

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/community/meetups/${meetupId}/leave`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        await fetchMeetups();
        return { success: true };
      }
      return { error: 'Failed to leave meetup' };
    } catch (err) {
      return { error: 'Network error' };
    }
  }, [token, fetchMeetups]);

  return { meetups, loading, fetchMeetups, createMeetup, joinMeetup, leaveMeetup };
};
