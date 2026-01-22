// src/hooks/useSongDatabase.js - OPTIMIZED: moment counts included in cached songs
import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchUMOSongDatabase } from '../utils';
import { useDebounce } from './useDebounce';

export const useSongDatabase = (apiBaseUrl) => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('mostPerformed');
  const [sortDirection, setSortDirection] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyWithMoments, setShowOnlyWithMoments] = useState(false);
  const [stats, setStats] = useState({ totalMoments: 0, songsWithMoments: 0 });

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Load song database with moment counts - SINGLE API CALL
  useEffect(() => {
    const loadSongDatabase = async () => {
      try {
        setLoading(true);
        console.log('🎵 Loading song database with moment counts (single request)...');

        const response = await fetchUMOSongDatabase(apiBaseUrl, sortBy);

        // Songs now include totalMoments from the backend
        setSongs(response.songs || response);
        setStats({
          totalMoments: response.totalMoments || 0,
          songsWithMoments: response.songsWithMoments || 0
        });

        console.log(`✅ Song database loaded: ${response.songs?.length || response.length} songs`);

      } catch (err) {
        console.error('Error loading song database:', err);
        setError(`Failed to load song database: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadSongDatabase();
  }, [apiBaseUrl, sortBy]);

  // Computed displayed songs with search and sort
  const displayedSongs = useMemo(() => {
    let filtered = songs;

    // Filter by search query
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(song =>
        song.songName?.toLowerCase().includes(query) ||
        song.venues?.some(venue => venue.toLowerCase().includes(query)) ||
        song.cities?.some(city => city.toLowerCase().includes(query)) ||
        song.countries?.some(country => country.toLowerCase().includes(query))
      );
    }

    // Filter by songs with moments only
    if (showOnlyWithMoments) {
      filtered = filtered.filter(song => song.totalMoments && song.totalMoments > 0);
    }

    const sorted = [...filtered];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'mostPerformed':
          comparison = b.totalPerformances - a.totalPerformances;
          break;
        case 'mostMoments':
          comparison = (b.totalMoments || 0) - (a.totalMoments || 0);
          break;
        case 'lastPerformed':
          const dateA = new Date(a.lastPerformed);
          const dateB = new Date(b.lastPerformed);
          comparison = dateB - dateA;
          break;
        case 'firstPerformed':
          const firstA = new Date(a.firstPerformed);
          const firstB = new Date(b.firstPerformed);
          comparison = firstA - firstB;
          break;
        case 'mostVenues':
          comparison = (b.venues?.length || 0) - (a.venues?.length || 0);
          break;
        case 'alphabetical':
        default:
          comparison = (a.songName || '').localeCompare(b.songName || '');
          break;
      }

      return sortDirection === 'asc' ? -comparison : comparison;
    });

    return sorted;
  }, [songs, debouncedSearchQuery, sortBy, sortDirection, showOnlyWithMoments]);

  // Actions
  const toggleSortDirection = useCallback(() => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleSortChange = useCallback((newSortBy) => {
    setSortBy(newSortBy);
  }, []);

  const toggleShowOnlyWithMoments = useCallback((value) => {
    setShowOnlyWithMoments(value);
  }, []);

  return {
    // State
    songs,
    displayedSongs,
    loading,
    error,
    sortBy,
    sortDirection,
    searchQuery,
    showOnlyWithMoments,

    // Stats from backend
    totalMoments: stats.totalMoments,
    songsWithMoments: stats.songsWithMoments,

    // No more progress indicator needed - single request!
    momentProgress: { current: 0, total: 0 },

    // Actions
    toggleSortDirection,
    clearSearch,
    handleSearchChange,
    handleSortChange,
    toggleShowOnlyWithMoments
  };
};
