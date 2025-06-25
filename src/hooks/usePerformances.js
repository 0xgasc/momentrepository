// ===================================================================
// src/hooks/usePerformances.js
// ===================================================================
import { useState, useCallback, useEffect } from 'react';
import { fetchUMOSetlists, searchUMOPerformances } from '../utils';
import { useDebounce } from './useDebounce';

export const usePerformances = (apiBaseUrl) => {
  const [displayedPerformances, setDisplayedPerformances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [citySearch, setCitySearch] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);

  const debouncedCitySearch = useDebounce(citySearch, 600);

  // Load initial performances
  const loadInitialPerformances = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const data = await fetchUMOSetlists(1, apiBaseUrl);
      
      if (data?.setlist?.length > 0) {
        setDisplayedPerformances(data.setlist);
        setCurrentPage(1);
        setHasMore(data.hasMore !== false);
      } else {
        setError('No UMO performances found');
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading performances:', err);
      setError(`Failed to load performances: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  // Perform search
  const performSearch = useCallback(async (searchTerm) => {
    if (searching) return;
    
    setSearching(true);
    setIsSearchMode(true);
    
    try {
      const data = await searchUMOPerformances(searchTerm, apiBaseUrl);
      setDisplayedPerformances(data.setlist);
    } catch (err) {
      console.error('Search error:', err);
      setError(`Search failed: ${err.message}`);
    } finally {
      setSearching(false);
    }
  }, [searching, apiBaseUrl]);

  // Load more performances (pagination)
  const loadMorePerformances = useCallback(async () => {
    if (loadingMore || !hasMore || isSearchMode) return;
    
    const nextPage = currentPage + 1;
    
    try {
      setLoadingMore(true);
      
      const data = await fetchUMOSetlists(nextPage, apiBaseUrl);
      
      if (data?.setlist?.length > 0) {
        setDisplayedPerformances(prev => [...prev, ...data.setlist]);
        setCurrentPage(nextPage);
        setHasMore(data.hasMore !== false);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error(`Error loading page ${nextPage}:`, err);
      setError(`Failed to load more: ${err.message}`);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, isSearchMode, currentPage, apiBaseUrl]);

  // Clear search
  const clearSearch = useCallback(() => {
    setCitySearch('');
    setIsSearchMode(false);
    loadInitialPerformances();
  }, [loadInitialPerformances]);

  // Handle search input
  const handleSearchChange = useCallback((value) => {
    setCitySearch(value);
  }, []);

  // Effects
  useEffect(() => {
    loadInitialPerformances();
  }, [loadInitialPerformances]);

  useEffect(() => {
    if (!debouncedCitySearch.trim()) {
      setIsSearchMode(false);
      if (isSearchMode) {
        loadInitialPerformances();
      }
    } else {
      performSearch(debouncedCitySearch);
    }
  }, [debouncedCitySearch, isSearchMode, loadInitialPerformances, performSearch]);

  return {
    // State
    displayedPerformances,
    loading,
    loadingMore,
    searching,
    error,
    hasMore,
    citySearch,
    isSearchMode,
    
    // Actions
    loadInitialPerformances,
    loadMorePerformances,
    clearSearch,
    handleSearchChange
  };
};