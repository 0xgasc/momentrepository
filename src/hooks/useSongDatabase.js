// src/hooks/useSongDatabase.js - UPDATED to filter non-song moments from counts
import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchUMOSongDatabase } from '../utils';
import { useDebounce } from './useDebounce';
import { useMoments } from './useMoments';

export const useSongDatabase = (apiBaseUrl) => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('alphabetical');
  const [sortDirection, setSortDirection] = useState('asc');
  const [momentProgress, setMomentProgress] = useState({ current: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const { fetchMoments } = useMoments(apiBaseUrl);

  // ✅ NEW: Helper function to filter only song moments
  const filterSongMoments = useCallback((moments) => {
    return moments.filter(moment => 
      !moment.contentType || moment.contentType === 'song'
    );
  }, []);

  // Load song database with moment counts
  useEffect(() => {
    const loadSongDatabase = async () => {
      try {
        setLoading(true);
        console.log('🎵 Loading comprehensive song database from cache...');
        const songDatabase = await fetchUMOSongDatabase(apiBaseUrl, 'alphabetical');
        
        // Initialize songs with zero moments
        const songsWithMoments = songDatabase.map(song => ({ ...song, totalMoments: 0 }));
        setSongs(songsWithMoments);
        
        console.log('🔍 Loading song moment counts (excluding non-song content)...');
        setMomentProgress({ current: 0, total: songDatabase.length });
        
        const batchSize = 20;
        for (let i = 0; i < songDatabase.length; i += batchSize) {
          const batch = songDatabase.slice(i, i + batchSize);
          
          // Process batch and update moment counts
          const updatedBatch = await Promise.all(batch.map(async (song) => {
            try {
              const allMoments = await fetchMoments(`song/${encodeURIComponent(song.songName)}`, `song "${song.songName}"`);
              
              // ✅ UPDATED: Filter to only count actual song moments
              const songMoments = filterSongMoments(allMoments);
              
              console.log(`📊 "${song.songName}": ${allMoments.length} total moments, ${songMoments.length} song moments`);
              
              return { ...song, totalMoments: songMoments.length };
            } catch (err) {
              return { ...song, totalMoments: 0 };
            }
          }));
          
          // Update the songs state with the new moment counts
          setSongs(prevSongs => {
            const updatedSongs = [...prevSongs];
            updatedBatch.forEach((updatedSong, batchIndex) => {
              const globalIndex = i + batchIndex;
              if (globalIndex < updatedSongs.length) {
                updatedSongs[globalIndex] = updatedSong;
              }
            });
            return updatedSongs;
          });
          
          setMomentProgress({ 
            current: Math.min(i + batchSize, songDatabase.length), 
            total: songDatabase.length 
          });
          
          if (i + batchSize < songDatabase.length) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
        
        setMomentProgress({ current: 0, total: 0 });
        console.log(`✅ Song database loaded: ${songDatabase.length} songs with song-only moment counts`);
        
      } catch (err) {
        console.error('Error loading song database:', err);
        setError(`Failed to load song database: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadSongDatabase();
  }, [apiBaseUrl, fetchMoments, filterSongMoments]);

  // Computed displayed songs with search and sort
  const displayedSongs = useMemo(() => {
    let filtered = songs;
    
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = songs.filter(song => 
        song.songName.toLowerCase().includes(query) ||
        song.venues.some(venue => venue.toLowerCase().includes(query)) ||
        song.cities.some(city => city.toLowerCase().includes(query)) ||
        song.countries.some(country => country.toLowerCase().includes(query))
      );
    }
    
    const sorted = [...filtered];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'mostPerformed':
          comparison = b.totalPerformances - a.totalPerformances;
          break;
        case 'mostMoments':
          comparison = b.totalMoments - a.totalMoments;
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
          comparison = b.venues.length - a.venues.length;
          break;
        case 'alphabetical':
        default:
          comparison = a.songName.localeCompare(b.songName);
          break;
      }
      
      return sortDirection === 'desc' ? -comparison : comparison;
    });
    
    return sorted;
  }, [songs, debouncedSearchQuery, sortBy, sortDirection]);

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

  // ✅ UPDATED: Computed values now only count song moments
  const totalSongMoments = songs.reduce((total, song) => total + song.totalMoments, 0);
  const songsWithMoments = songs.filter(song => song.totalMoments > 0).length;

  return {
    // State
    songs,
    displayedSongs,
    loading,
    error,
    sortBy,
    sortDirection,
    momentProgress,
    searchQuery,
    
    // ✅ UPDATED: Computed values exclude non-song moments
    totalMoments: totalSongMoments,
    songsWithMoments: songsWithMoments,
    
    // Actions
    toggleSortDirection,
    clearSearch,
    handleSearchChange,
    handleSortChange
  };
};