// src/hooks/useFavorites.js
import { useState, useCallback, useEffect } from 'react';
import { API_BASE_URL } from '../components/Auth/AuthProvider';

export const useFavorites = (token) => {
  const [favorites, setFavorites] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [favoritesSet, setFavoritesSet] = useState(new Set());

  // Fetch favorites
  const fetchFavorites = useCallback(async (collectionId = null) => {
    if (!token) return;

    try {
      setLoading(true);
      const url = collectionId
        ? `${API_BASE_URL}/api/community/favorites?collection=${collectionId}`
        : `${API_BASE_URL}/api/community/favorites`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setFavorites(data.favorites || []);
        setFavoritesSet(new Set(data.favorites?.map(f => f.moment?._id) || []));
      }
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch collections
  const fetchCollections = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/community/collections`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCollections(data.collections || []);
      }
    } catch (err) {
      console.error('Failed to fetch collections:', err);
    }
  }, [token]);

  // Check if a moment is favorited
  const isFavorite = useCallback((momentId) => {
    return favoritesSet.has(momentId);
  }, [favoritesSet]);

  // Check favorite status from API
  const checkFavorite = useCallback(async (momentId) => {
    if (!token) return false;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/community/favorites/check/${momentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        return data.isFavorited;
      }
    } catch (err) {
      console.error('Failed to check favorite:', err);
    }
    return false;
  }, [token]);

  // Toggle favorite
  const toggleFavorite = useCallback(async (momentId) => {
    if (!token) return { error: 'Login required' };

    try {
      const isCurrentlyFavorite = favoritesSet.has(momentId);

      if (isCurrentlyFavorite) {
        // Remove favorite
        const response = await fetch(
          `${API_BASE_URL}/api/community/favorites/${momentId}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (response.ok) {
          setFavoritesSet(prev => {
            const next = new Set(prev);
            next.delete(momentId);
            return next;
          });
          setFavorites(prev => prev.filter(f => f.moment?._id !== momentId));
          return { success: true, isFavorited: false };
        }
      } else {
        // Add favorite
        const response = await fetch(
          `${API_BASE_URL}/api/community/favorites/${momentId}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          setFavoritesSet(prev => new Set([...prev, momentId]));
          // Refetch to get full moment data
          await fetchFavorites();
          return { success: true, isFavorited: true };
        }
      }

      return { error: 'Failed to update favorite' };
    } catch (err) {
      console.error('Toggle favorite error:', err);
      return { error: 'Network error' };
    }
  }, [token, favoritesSet, fetchFavorites]);

  // Create collection
  const createCollection = useCallback(async (name, description = '', isPublic = false) => {
    if (!token) return { error: 'Login required' };

    try {
      const response = await fetch(`${API_BASE_URL}/api/community/collections`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, description, isPublic })
      });

      if (response.ok) {
        const data = await response.json();
        setCollections(prev => [data.collection, ...prev]);
        return { success: true, collection: data.collection };
      }

      return { error: 'Failed to create collection' };
    } catch (err) {
      return { error: 'Network error' };
    }
  }, [token]);

  // Update collection
  const updateCollection = useCallback(async (collectionId, updates) => {
    if (!token) return { error: 'Login required' };

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/community/collections/${collectionId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updates)
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCollections(prev => prev.map(c =>
          c._id === collectionId ? { ...c, ...data.collection } : c
        ));
        return { success: true, collection: data.collection };
      }

      return { error: 'Failed to update collection' };
    } catch (err) {
      return { error: 'Network error' };
    }
  }, [token]);

  // Delete collection
  const deleteCollection = useCallback(async (collectionId) => {
    if (!token) return { error: 'Login required' };

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/community/collections/${collectionId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        setCollections(prev => prev.filter(c => c._id !== collectionId));
        return { success: true };
      }

      return { error: 'Failed to delete collection' };
    } catch (err) {
      return { error: 'Network error' };
    }
  }, [token]);

  // Add moment to collection
  const addToCollection = useCallback(async (collectionId, momentId) => {
    if (!token) return { error: 'Login required' };

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/community/collections/${collectionId}/moments/${momentId}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        // Refresh collections to update counts
        await fetchCollections();
        return { success: true };
      }

      return { error: 'Failed to add to collection' };
    } catch (err) {
      return { error: 'Network error' };
    }
  }, [token, fetchCollections]);

  // Remove moment from collection
  const removeFromCollection = useCallback(async (collectionId, momentId) => {
    if (!token) return { error: 'Login required' };

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/community/collections/${collectionId}/moments/${momentId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        await fetchCollections();
        return { success: true };
      }

      return { error: 'Failed to remove from collection' };
    } catch (err) {
      return { error: 'Network error' };
    }
  }, [token, fetchCollections]);

  // Initial fetch
  useEffect(() => {
    if (token) {
      fetchFavorites();
      fetchCollections();
    }
  }, [token, fetchFavorites, fetchCollections]);

  return {
    favorites,
    collections,
    loading,
    isFavorite,
    checkFavorite,
    toggleFavorite,
    fetchFavorites,
    fetchCollections,
    createCollection,
    updateCollection,
    deleteCollection,
    addToCollection,
    removeFromCollection
  };
};

export default useFavorites;
