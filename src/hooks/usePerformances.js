// src/hooks/usePerformances.js - FIXED VERSION without duplicates
import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchUMOSetlists, fetchAllUMOSetlists, searchUMOPerformances } from '../utils';
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
  const [showOnlyWithMoments, setShowOnlyWithMoments] = useState(false);
  const [allPerformances, setAllPerformances] = useState([]); // Cache all performances when needed
  
  // FIXED: Better search state tracking
  const [searchState, setSearchState] = useState({
    query: '',
    page: 1,
    hasMore: true,
    results: []
  });

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

  // Load all performances when moments filter is enabled
  const loadAllPerformances = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const data = await fetchAllUMOSetlists(apiBaseUrl);
      
      if (data?.setlist?.length > 0) {
        setAllPerformances(data.setlist);
        setDisplayedPerformances(data.setlist);
        setHasMore(false); // No pagination when showing all
      } else {
        setAllPerformances([]);
        setDisplayedPerformances([]);
        setError('No UMO performances found');
      }
    } catch (err) {
      console.error('Error loading all performances:', err);
      setError(`Failed to load performances: ${err.message}`);
      setDisplayedPerformances([]);
      setAllPerformances([]);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  // FIXED: Perform search with proper state management
  const performSearch = useCallback(async (searchTerm, page = 1, append = false) => {
    // Prevent duplicate searches
    if (isSearchingRef.current && !append) {
      return;
    }
    
    isSearchingRef.current = true;
    
    if (!append) {
      setSearching(true);
      setIsSearchMode(true);
    } else {
      setLoadingMore(true);
    }
    
    setError('');
    
    try {
      console.log(`🔍 ${append ? 'Loading more' : 'Starting'} search for: "${searchTerm}" (page ${page})`);
      const data = await searchUMOPerformances(searchTerm, apiBaseUrl, page);
      
      if (data && data.setlist) {
        if (append) {
          // FIXED: Check if we already have these results to prevent duplicates
          const existingIds = new Set(searchState.results.map(p => p.id));
          const newResults = data.setlist.filter(p => !existingIds.has(p.id));
          
          if (newResults.length > 0) {
            const updatedResults = [...searchState.results, ...newResults];
            setSearchState(prev => ({
              ...prev,
              page: page,
              results: updatedResults,
              hasMore: data.hasMore !== false && newResults.length > 0
            }));
            setDisplayedPerformances(updatedResults);
          } else {
            // No new results, we've reached the end
            setSearchState(prev => ({ ...prev, hasMore: false }));
            setHasMore(false);
          }
        } else {
          // New search results
          setSearchState({
            query: searchTerm,
            page: 1,
            results: data.setlist,
            hasMore: data.hasMore !== false
          });
          setDisplayedPerformances(data.setlist);
        }
        
        // Update global hasMore based on search state
        setHasMore(data.hasMore !== false);
        
        console.log(`✅ Search ${append ? 'append' : 'complete'}: ${data.setlist.length} results for "${searchTerm}" (page ${page})`);
      } else {
        if (!append) {
          setDisplayedPerformances([]);
          setSearchState({
            query: searchTerm,
            page: 1,
            results: [],
            hasMore: false
          });
        }
        setHasMore(false);
        console.log(`✅ Search complete: 0 results for "${searchTerm}"`);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(`Search failed: ${err.message}`);
      if (!append) {
        setDisplayedPerformances([]);
        setSearchState({
          query: searchTerm,
          page: 1,
          results: [],
          hasMore: false
        });
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
  }, [apiBaseUrl, searchState.results]);

  // FIXED: Load more performances with proper state tracking
  const loadMorePerformances = useCallback(async () => {
    if (loadingMore || !hasMore) {
      console.log('🚫 Load more blocked:', { loadingMore, hasMore });
      return;
    }
    
    if (isSearchMode && searchState.query) {
      // FIXED: Load more search results using search state
      const nextPage = searchState.page + 1;
      console.log(`📄 Loading more search results for "${searchState.query}" page ${nextPage}`);
      await performSearch(searchState.query, nextPage, true);
    } else {
      // Load more regular results
      const nextPage = currentPage + 1;
      
      try {
        setLoadingMore(true);
        
        const data = await fetchUMOSetlists(nextPage, apiBaseUrl);
        
        if (data?.setlist?.length > 0) {
          // FIXED: Check for duplicates in regular results too
          const existingIds = new Set(displayedPerformances.map(p => p.id));
          const newResults = data.setlist.filter(p => !existingIds.has(p.id));
          
          if (newResults.length > 0) {
            setDisplayedPerformances(prev => [...prev, ...newResults]);
            setCurrentPage(nextPage);
            setHasMore(data.hasMore !== false);
          } else {
            setHasMore(false);
          }
        } else {
          setHasMore(false);
        }
      } catch (err) {
        console.error(`Error loading page ${nextPage}:`, err);
        setError(`Failed to load more: ${err.message}`);
        setHasMore(false);
      } finally {
        setLoadingMore(false);
      }
    }
  }, [loadingMore, hasMore, isSearchMode, searchState, currentPage, apiBaseUrl, performSearch, displayedPerformances]);

  // FIXED: Clear search with proper state reset
  const clearSearch = useCallback(() => {
    console.log('🧹 Clearing search');
    setCitySearch('');
    setIsSearchMode(false);
    setError('');
    setSearching(false);
    setSearchState({
      query: '',
      page: 1,
      results: [],
      hasMore: true
    });
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
  }, [loadInitialPerformances]); // Only run once on mount

  // Handle moments filter toggle
  useEffect(() => {
    if (showOnlyWithMoments && allPerformances.length === 0) {
      // Load all performances when moments filter is first enabled
      loadAllPerformances();
    } else if (!showOnlyWithMoments && allPerformances.length > 0) {
      // Return to paginated view when filter is disabled
      setAllPerformances([]);
      loadInitialPerformances();
    }
  }, [showOnlyWithMoments, allPerformances.length, loadAllPerformances, loadInitialPerformances]);

  // FIXED: Handle search with proper dependency management
  useEffect(() => {
    const searchTerm = debouncedCitySearch.trim();
    
    if (!searchTerm) {
      // User cleared search
      if (isSearchMode) {
        console.log('🧹 Clearing search due to empty search term');
        setIsSearchMode(false);
        setSearching(false);
        setSearchState({
          query: '',
          page: 1,
          results: [],
          hasMore: true
        });
        isSearchingRef.current = false;
        lastSearchQuery.current = '';
        loadInitialPerformances();
      }
    } else {
      // User entered search term
      if (lastSearchQuery.current !== searchTerm) {
        console.log(`🔍 New search triggered: "${searchTerm}"`);
        lastSearchQuery.current = searchTerm;
        performSearch(searchTerm);
      }
    }
  }, [debouncedCitySearch, isSearchMode, loadInitialPerformances, performSearch]);

  return {
    // State
    displayedPerformances,
    loading,
    loadingMore,
    searching,
    error,
    hasMore: isSearchMode ? searchState.hasMore : hasMore,
    citySearch,
    isSearchMode,
    showOnlyWithMoments,
    
    // Actions
    loadInitialPerformances,
    loadMorePerformances,
    clearSearch,
    handleSearchChange,
    setShowOnlyWithMoments
  };
};