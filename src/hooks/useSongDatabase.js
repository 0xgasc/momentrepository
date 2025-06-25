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
        
        console.log('🔍 Loading moment counts...');
        setMomentProgress({ current: 0, total: songDatabase.length });
        
        const batchSize = 20;
        for (let i = 0; i < songDatabase.length; i += batchSize) {
          const batch = songDatabase.slice(i, i + batchSize);
          
          // Process batch and update moment counts
          const updatedBatch = await Promise.all(batch.map(async (song) => {
            try {
              const moments = await fetchMoments(`song/${encodeURIComponent(song.songName)}`, `song "${song.songName}"`);
              return { ...song, totalMoments: moments.length };
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
        console.log(`✅ Song database loaded: ${songDatabase.length} songs`);
        
      } catch (err) {
        console.error('Error loading song database:', err);
        setError(`Failed to load song database: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadSongDatabase();
  }, [apiBaseUrl, fetchMoments]);

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
    
    // Computed
    totalMoments: songs.reduce((total, song) => total + song.totalMoments, 0),
    songsWithMoments: songs.filter(song => song.totalMoments > 0).length,
    
    // Actions
    toggleSortDirection,
    clearSearch,
    handleSearchChange,
    handleSortChange
  };
};