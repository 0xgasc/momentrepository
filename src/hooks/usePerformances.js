// src/hooks/usePerformances.js - FIXED VERSION
import { useState, useCallback, useEffect, useRef } from 'react';
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
  
  const [currentSearchPage, setCurrentSearchPage] = useState(1);
  const [currentSearchQuery, setCurrentSearchQuery] = useState('');

  // Use ref to track if we're already searching to prevent loops
  const isSearchingRef = useRef(false);
  const lastSearchQuery = useRef('');

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
        setDisplayedPerformances([]);
        setError('No UMO performances found');
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading performances:', err);
      setError(`Failed to load performances: ${err.message}`);
      setDisplayedPerformances([]);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  // Perform search - UPDATED to support pagination
  const performSearch = useCallback(async (searchTerm, page = 1, append = false) => {
    // Prevent duplicate searches
    if (isSearchingRef.current && !append) {
      return;
    }
    
    isSearchingRef.current = true;
    
    if (!append) {
      setSearching(true);
      setIsSearchMode(true);
      setCurrentSearchQuery(searchTerm);
      setCurrentSearchPage(1);
    } else {
      setLoadingMore(true);
    }
    
    setError('');
    
    try {
      console.log(`🔍 ${append ? 'Loading more' : 'Starting'} search for: "${searchTerm}" (page ${page})`);
      const data = await searchUMOPerformances(searchTerm, apiBaseUrl, page);
      
      if (data && data.setlist) {
        if (append) {
          // Append results for "load more"
          setDisplayedPerformances(prev => [...prev, ...data.setlist]);
          setCurrentSearchPage(page);
        } else {
          // New search results
          setDisplayedPerformances(data.setlist);
          setCurrentSearchPage(1);
        }
        
        // Update hasMore based on pagination info
        setHasMore(data.hasMore !== false);
        
        console.log(`✅ Search ${append ? 'append' : 'complete'}: ${data.setlist.length} results for "${searchTerm}" (page ${page})`);
      } else {
        if (!append) {
          setDisplayedPerformances([]);
        }
        setHasMore(false);
        console.log(`✅ Search complete: 0 results for "${searchTerm}"`);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(`Search failed: ${err.message}`);
      if (!append) {
        setDisplayedPerformances([]);
      }
      setHasMore(false);
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setSearching(false);
      }
      isSearchingRef.current = false;
    }
  }, [apiBaseUrl]);

  // Load more performances - UPDATED to support search pagination
  const loadMorePerformances = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    
    if (isSearchMode && currentSearchQuery) {
      // Load more search results
      const nextPage = currentSearchPage + 1;
      await performSearch(currentSearchQuery, nextPage, true);
    } else {
      // Load more regular results
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
    }
  }, [loadingMore, hasMore, isSearchMode, currentSearchQuery, currentSearchPage, currentPage, apiBaseUrl, performSearch]);

  // Clear search - UPDATED
  const clearSearch = useCallback(() => {
    console.log('🧹 Clearing search');
    setCitySearch('');
    setIsSearchMode(false);
    setError('');
    setSearching(false);
    setCurrentSearchQuery('');
    setCurrentSearchPage(1);
    isSearchingRef.current = false;
    lastSearchQuery.current = '';
    loadInitialPerformances();
  }, [loadInitialPerformances]);

  // Handle search input
  const handleSearchChange = useCallback((value) => {
    setCitySearch(value);
    setError('');
    
    // Reset search tracking when user types
    if (!value.trim()) {
      lastSearchQuery.current = '';
    }
  }, []);

  // Load initial data on mount
  useEffect(() => {
    loadInitialPerformances();
  }, []); // Only run once on mount

  // Handle search with proper dependency management
  useEffect(() => {
    const searchTerm = debouncedCitySearch.trim();
    
    if (!searchTerm) {
      // User cleared search
      if (isSearchMode) {
        console.log('🧹 Clearing search due to empty search term');
        setIsSearchMode(false);
        setSearching(false);
        isSearchingRef.current = false;
        lastSearchQuery.current = '';
        loadInitialPerformances();
      }
    } else {
      // User entered search term
      if (lastSearchQuery.current !== searchTerm) {
        console.log(`🔍 New search triggered: "${searchTerm}"`);
        performSearch(searchTerm);
      }
    }
  }, [debouncedCitySearch]); // Only depend on the debounced search term

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