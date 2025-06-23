import React, { useEffect, useState, createContext, useContext, useCallback, useMemo } from 'react';
import { styles } from './styles';
import { formatDate, formatShortDate, formatFileSize, FEATURED_ARTISTS } from './utils';

// API Base URL - automatically detects if running on mobile
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5050'  // Local development
  : `http://${window.location.hostname}:5050`;  // Use same hostname as frontend

console.log('🌐 Current hostname:', window.location.hostname);
console.log('🌐 Using API Base URL:', API_BASE_URL);
// Authentication Context
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (email, password, displayName) => {
    try {
      const response = await fetch('${API_BASE_URL}/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for proper debouncing
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Improved getMajorArtistStatus function with better date parsing
const getMajorArtistStatus = async (artist) => {
  try {
    console.log(`🔍 Fetching setlists for ${artist.name} (${artist.mbid})...`);
    
    const response = await fetch(
      `${API_BASE_URL}/api/rest/1.0/artist/${artist.mbid}/setlists?p=1`,
      { 
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000)
      }
    );

    if (response.ok) {
      const data = await response.json();
      const totalSetlists = data.total || 0;
      const setlists = data.setlist || [];
      
      console.log(`✅ Successfully fetched ${totalSetlists} setlists for ${artist.name}`);
      
      // Check if artist is currently on tour (concert in last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      console.log(`📅 Checking tour status against date: ${ninetyDaysAgo.toISOString().split('T')[0]}`);
      
      // Improved date parsing function
      const parseSetlistDate = (eventDate) => {
        if (!eventDate) return null;
        
        try {
          // Handle DD-MM-YYYY format from setlist.fm
          if (eventDate.includes('-')) {
            const parts = eventDate.split('-');
            if (parts.length === 3) {
              const day = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10);
              const year = parseInt(parts[2], 10);
              
              // Validate the date parts
              if (year >= 1900 && year <= 2030 && 
                  month >= 1 && month <= 12 && 
                  day >= 1 && day <= 31) {
                
                const date = new Date(year, month - 1, day); // month is 0-indexed
                
                // Double-check the date is valid (handles invalid dates like Feb 30)
                if (date.getFullYear() === year && 
                    date.getMonth() === month - 1 && 
                    date.getDate() === day) {
                  return date;
                }
              }
            }
          }
          
          // Fallback: try parsing as ISO date or other format
          const fallbackDate = new Date(eventDate);
          if (!isNaN(fallbackDate.getTime())) {
            return fallbackDate;
          }
          
          return null;
        } catch (err) {
          console.warn(`Failed to parse date: ${eventDate}`, err);
          return null;
        }
      };
      
      // Check recent concerts with improved logging
      const recentConcerts = setlists.filter(setlist => {
        const concertDate = parseSetlistDate(setlist.eventDate);
        if (concertDate) {
          const isRecent = concertDate >= ninetyDaysAgo;
          console.log(`  📅 ${setlist.eventDate} (${concertDate.toISOString().split('T')[0]}) -> ${isRecent ? '✅ RECENT' : '❌ OLD'}`);
          return isRecent;
        } else {
          console.log(`  📅 ${setlist.eventDate} -> ❌ INVALID DATE`);
          return false;
        }
      });
      
      const isOnTour = recentConcerts.length > 0;
      
      console.log(`🎪 ${artist.name} tour status: ${isOnTour ? '✅ ON TOUR' : '❌ NOT ON TOUR'} (${recentConcerts.length} recent concerts)`);
      
      return {
        ...artist,
        totalSetlists,
        isMajorArtist: totalSetlists >= 50,
        isOnTour,
        recentConcerts: recentConcerts.length // Add for debugging
      };
    } else if (response.status === 404) {
      console.log(`⚠️ No setlists found for ${artist.name} (this is normal for some artists)`);
      return { ...artist, totalSetlists: 0, isMajorArtist: false, isOnTour: false };
    } else {
      console.error(`❌ Failed to fetch setlists for ${artist.name}:`, response.status, response.statusText);
      return { ...artist, totalSetlists: 0, isMajorArtist: false, isOnTour: false };
    }
  } catch (err) {
    console.error('❌ Error fetching setlist count for', artist.name, ':', err);
    return { ...artist, totalSetlists: 0, isMajorArtist: false, isOnTour: false };
  }
};

// Enhanced Artist Search Component with improved sorting
const ArtistSearch = ({ onArtistSelect, currentArtist }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState('');

  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Improved artist sorting function
  const sortArtistResults = (artists, query) => {
    const queryLower = query.toLowerCase().trim();
    
    return artists.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aDisambiguation = (a.disambiguation || '').toLowerCase();
      const bDisambiguation = (b.disambiguation || '').toLowerCase();
      
      // 1. HIGHEST PRIORITY: Exact match gets top spot
      const aExact = aName === queryLower;
      const bExact = bName === queryLower;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;
      
      // 2. Main artist without disambiguation vs. artists with disambiguation
      const aHasDisambig = a.disambiguation && a.disambiguation.trim().length > 0;
      const bHasDisambig = b.disambiguation && b.disambiguation.trim().length > 0;
      
      // Prefer artists without disambiguation (usually the main artist)
      if (!aHasDisambig && bHasDisambig) return -1;
      if (!bHasDisambig && aHasDisambig) return 1;
      
      // 3. Penalize obvious collaboration/side project indicators
      const collaborationWords = ['feat.', 'featuring', 'ft.', '&', ' and ', ' with ', 'vs.', 'versus'];
      const sideProjectWords = ['tribute', 'cover', 'plays', 'experience', 'society', 'duo', 'cover band'];
      
      const aIsCollaboration = collaborationWords.some(word => 
        aName.includes(word) || aDisambiguation.includes(word)
      );
      const bIsCollaboration = collaborationWords.some(word => 
        bName.includes(word) || bDisambiguation.includes(word)
      );
      
      const aIsSideProject = sideProjectWords.some(word => 
        aName.includes(word) || aDisambiguation.includes(word)
      );
      const bIsSideProject = sideProjectWords.some(word => 
        bName.includes(word) || bDisambiguation.includes(word)
      );
      
      // Penalize collaborations and side projects
      if (!aIsCollaboration && bIsCollaboration) return -1;
      if (!bIsCollaboration && aIsCollaboration) return 1;
      if (!aIsSideProject && bIsSideProject) return -1;
      if (!bIsSideProject && aIsSideProject) return 1;
      
      // 4. Prefer names that start with the query
      const aStarts = aName.startsWith(queryLower);
      const bStarts = bName.startsWith(queryLower);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;
      
      // 5. For artists with similar names, prefer shorter disambiguation
      if (aHasDisambig && bHasDisambig) {
        // Prefer disambiguation that suggests main artist activity
        const mainArtistIndicators = ['rapper', 'singer', 'musician', 'band', 'us rapper', 'american rapper'];
        const aIsMainArtist = mainArtistIndicators.some(indicator => 
          aDisambiguation.includes(indicator)
        );
        const bIsMainArtist = mainArtistIndicators.some(indicator => 
          bDisambiguation.includes(indicator)
        );
        
        if (aIsMainArtist && !bIsMainArtist) return -1;
        if (bIsMainArtist && !aIsMainArtist) return 1;
        
        // Otherwise prefer shorter disambiguation
        return a.disambiguation.length - b.disambiguation.length;
      }
      
      // 6. Shorter name = more likely to be main artist
      const nameLengthDiff = a.name.length - b.name.length;
      if (Math.abs(nameLengthDiff) > 10) return nameLengthDiff;
      
      // 7. Alphabetical as final tiebreaker
      return a.name.localeCompare(b.name);
    });
  };

  const searchArtists = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      setError('');
      return;
    }

    setSearching(true);
    setError('');
    
    try {
      // Special handling for known artists that might have search issues
      const knownArtistMappings = {
        'muse': { name: 'Muse', mbid: '9c9f1380-2516-4fc9-a3e6-f9f61941d090' },
        'tyler the creator': { name: 'Tyler, The Creator', mbid: 'f6beac20-5dfe-4d1f-ae02-0b0a740aafd6' },
        'tyler, the creator': { name: 'Tyler, The Creator', mbid: 'f6beac20-5dfe-4d1f-ae02-0b0a740aafd6' }
      };
      
      const queryKey = query.toLowerCase().trim();
      if (knownArtistMappings[queryKey]) {
        console.log(`🎯 Using known mapping for "${query}"`);
        const knownArtist = knownArtistMappings[queryKey];
        
        try {
          const artistWithStatus = await getMajorArtistStatus(knownArtist);
          setSearchResults([artistWithStatus]);
          setShowResults(true);
          setSearching(false);
          return;
        } catch (err) {
          console.error(`❌ Error with known artist mapping - will try API search:`, err);
        }
      }

      // Regular API search
      const response = await fetch(
        `${API_BASE_URL}/api/rest/1.0/search/artists?artistName=${encodeURIComponent(query)}`,
        { 
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10000)
        }
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      let artists = (data.artist || []).filter(artist => artist.name && artist.mbid);

      console.log('🔍 Raw API search results for "' + query + '":', artists.length, 'artists');

      if (artists.length === 0) {
        setError(`No artists found for "${query}". Try searching for a different artist.`);
        setSearchResults([]);
        setShowResults(true);
        return;
      }

      // Apply improved sorting
      const sortedArtists = sortArtistResults(artists, query).slice(0, 10);

      console.log('🎯 Top sorted results:', sortedArtists.slice(0, 3).map(a => 
        `${a.name} ${a.disambiguation ? '(' + a.disambiguation + ')' : ''}`
      ));

      // Get major artist status for top results
      const artistsWithStatus = await Promise.all(
        sortedArtists.map(getMajorArtistStatus)
      );

      setSearchResults(artistsWithStatus);
      setShowResults(true);
      
    } catch (err) {
      console.error('Artist search error:', err);
      setError(err.name === 'AbortError' ? 'Search timed out. Try again.' : 'Search failed. Check your connection.');
      setSearchResults([]);
      setShowResults(true);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    searchArtists(debouncedSearchQuery);
  }, [debouncedSearchQuery, searchArtists]);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const selectArtist = (artist) => {
    onArtistSelect(artist);
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setError('');
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setError('');
  };

  return (
    <div className="relative max-w-md mx-auto">
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Search for any artist..."
          className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
        />
        
        <div className="absolute right-3 top-3 flex items-center gap-2">
          {searching && (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          )}
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {error ? (
            <div className="px-4 py-3 text-red-600 text-center text-sm">
              {error}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="px-4 py-3 text-gray-500 text-center">
              No artists found
            </div>
          ) : (
            searchResults.map((artist) => (
              <button
                key={artist.mbid}
                onClick={() => selectArtist(artist)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      {artist.name}
                      {artist.isMajorArtist && (
                        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                          50+ shows
                        </span>
                      )}
                      {artist.isOnTour && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          on tour
                        </span>
                      )}
                    </div>
                    {artist.disambiguation && (
                      <div className="text-sm text-gray-500">{artist.disambiguation}</div>
                    )}
                  </div>
                  {artist.totalSetlists > 0 && (
                    <div className="text-xs text-gray-400">
                      {artist.totalSetlists} concerts
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {currentArtist && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full">
            <span className="font-medium">Viewing: {currentArtist.name}</span>
            <button
              onClick={() => onArtistSelect(null)}
              className="ml-2 text-blue-600 hover:text-blue-800"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced Featured Artists Component with name-based status checking
const FeaturedArtists = ({ onArtistSelect }) => {
  const [loading, setLoading] = useState({});
  const [artistCache, setArtistCache] = useState(new Map());
  const [artistStatuses, setArtistStatuses] = useState(new Map());

  const getCachedArtistData = useCallback(async (artistName) => {
    // Check cache first
    if (artistCache.has(artistName)) {
      return artistCache.get(artistName);
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rest/1.0/search/artists?artistName=${encodeURIComponent(artistName)}`,
        { headers: { Accept: 'application/json' } }
      );

      if (response.ok) {
        const data = await response.json();
        const artists = data.artist || [];
        
        const exactMatch = artists.find(a => 
          a.name.toLowerCase() === artistName.toLowerCase()
        );
        
        const result = exactMatch || (artists.length > 0 ? artists[0] : null);
        
        // Cache the result
        if (result) {
          setArtistCache(prev => new Map(prev).set(artistName, result));
        }
        
        return result;
      }
    } catch (err) {
      console.error('Error fetching artist:', err);
    }
    
    return null;
  }, [artistCache]);

  // Smart status checker that tries multiple approaches
  const getArtistStatus = useCallback(async (artist) => {
    console.log(`🔍 Getting status for ${artist.name}...`);
    
    // Method 1: Try the original MBID first (works for Muse and major artists)
    try {
      console.log(`  📋 Method 1: Trying original MBID ${artist.mbid}`);
      const statusWithOriginalMbid = await getMajorArtistStatus(artist);
      
      // If we get setlist data, use it
      if (statusWithOriginalMbid.totalSetlists > 0) {
        console.log(`  ✅ Method 1 SUCCESS: ${statusWithOriginalMbid.totalSetlists} setlists found`);
        return statusWithOriginalMbid;
      } else {
        console.log(`  ❌ Method 1 FAILED: No setlists found`);
      }
    } catch (err) {
      console.log(`  ❌ Method 1 ERROR:`, err.message);
    }
    
    // Method 2: Search by name and use that MBID
    try {
      console.log(`  🔍 Method 2: Searching by name "${artist.name}"`);
      const artistData = await getCachedArtistData(artist.name);
      
      if (artistData && artistData.mbid) {
        console.log(`  📋 Method 2: Found MBID ${artistData.mbid} (${artistData.mbid === artist.mbid ? 'SAME' : 'DIFFERENT'})`);
        const statusWithSearchMbid = await getMajorArtistStatus(artistData);
        
        if (statusWithSearchMbid.totalSetlists > 0) {
          console.log(`  ✅ Method 2 SUCCESS: ${statusWithSearchMbid.totalSetlists} setlists found`);
          return statusWithSearchMbid;
        } else {
          console.log(`  ❌ Method 2 FAILED: No setlists found with search MBID`);
        }
      } else {
        console.log(`  ⚠️ Method 2 SKIPPED: No search result found`);
      }
    } catch (err) {
      console.log(`  ❌ Method 2 ERROR:`, err.message);
    }
    
    // Method 3: Try alternative name searches (for artists with special characters)
    if (artist.name.includes('.') || artist.name.includes('&')) {
      try {
        console.log(`  🔍 Method 3: Trying alternative name searches`);
        
        const alternatives = [];
        
        // For "Fontaines D.C." try "Fontaines DC" 
        if (artist.name.includes('D.C.')) {
          alternatives.push(artist.name.replace('D.C.', 'DC'));
        }
        
        // Try without periods
        if (artist.name.includes('.')) {
          alternatives.push(artist.name.replace(/\./g, ''));
        }
        
        for (const altName of alternatives) {
          console.log(`    🔍 Trying alternative: "${altName}"`);
          const artistData = await getCachedArtistData(altName);
          
          if (artistData && artistData.mbid) {
            console.log(`    📋 Found MBID ${artistData.mbid} for "${altName}"`);
            const statusWithAltMbid = await getMajorArtistStatus(artistData);
            
            if (statusWithAltMbid.totalSetlists > 0) {
              console.log(`    ✅ Method 3 SUCCESS: ${statusWithAltMbid.totalSetlists} setlists found`);
              return statusWithAltMbid;
            }
          }
        }
        
        console.log(`  ❌ Method 3 FAILED: No alternatives worked`);
      } catch (err) {
        console.log(`  ❌ Method 3 ERROR:`, err.message);
      }
    }
    
    // Method 4: Return default (no status)
    console.log(`  🚫 All methods failed for ${artist.name}`);
    return { ...artist, totalSetlists: 0, isMajorArtist: false, isOnTour: false };
  }, [getCachedArtistData]);

  // Load artist statuses on mount
  useEffect(() => {
    const loadArtistStatuses = async () => {
      const statusPromises = FEATURED_ARTISTS.map(async (artist) => {
        try {
          const status = await getArtistStatus(artist);
          return { name: artist.name, status };
        } catch (err) {
          console.error(`❌ Final error getting status for ${artist.name}:`, err);
          return { name: artist.name, status: { ...artist, totalSetlists: 0, isMajorArtist: false, isOnTour: false } };
        }
      });

      const results = await Promise.all(statusPromises);
      const statusMap = new Map();
      results.forEach(({ name, status }) => {
        statusMap.set(name, status);
      });
      setArtistStatuses(statusMap);
    };

    loadArtistStatuses();
  }, [getArtistStatus]);

  const handleFeaturedArtistClick = async (artistName) => {
    setLoading(prev => ({ ...prev, [artistName]: true }));
    
    try {
      // Special case for Muse
      if (artistName.toLowerCase() === 'muse') {
        const museArtist = { name: 'Muse', mbid: '9c9f1380-2516-4fc9-a3e6-f9f61941d090' };
        console.log('🎯 Using direct MBID for Muse:', museArtist);
        onArtistSelect(museArtist);
        return;
      }
      
      // For all other artists: use search API
      const artistData = await getCachedArtistData(artistName);
      
      if (artistData) {
        onArtistSelect(artistData);
      } else {
        console.error('Artist not found:', artistName);
        alert(`Could not find artist: ${artistName}`);
      }
    } catch (err) {
      console.error('Error loading artist:', err);
      alert('Error loading artist data');
    } finally {
      setLoading(prev => ({ ...prev, [artistName]: false }));
    }
  };

  return (
    <div className="mb-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {FEATURED_ARTISTS.map((artist) => {
          const status = artistStatuses.get(artist.name);
          
          return (
            <button
              key={artist.mbid}
              onClick={() => handleFeaturedArtistClick(artist.name)}
              disabled={loading[artist.name]}
              className="p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-sm font-medium text-center text-gray-900 leading-tight mb-2">
                {loading[artist.name] ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Loading...
                  </div>
                ) : (
                  artist.name
                )}
              </div>
              
              {/* Status Tags */}
              {status && !loading[artist.name] && (
                <div className="flex flex-wrap gap-1 justify-center">
                  {status.totalSetlists > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                      {status.totalSetlists} shows
                    </span>
                  )}
                  {status.isOnTour && (
                    <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                      on tour
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Improved Login Component with better user workflow
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('login'); // 'login', 'register', 'userNotFound'
  const [message, setMessage] = useState('');
  const { login, register } = useAuth();

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await login(email, password);
      setMessage('Login successful! Refreshing page...');
      
      // Refresh the page after successful login
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (err) {
      console.log('Login error:', err.message);
      
      // Check if it's a "user not found" error
      if (err.message.includes('User not found') || err.message.includes('not found')) {
        setMode('userNotFound');
        setError('');
        setMessage(''); // Clear message when switching to userNotFound mode
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    // Validation
    if (!displayName.trim()) {
      setError('Display name is required');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      await register(email, password, displayName);
      setMessage('Account created successfully! Refreshing page...');
      
      // Refresh the page after successful registration
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (mode === 'login') {
      handleLogin();
    } else if (mode === 'register' || mode === 'userNotFound') {
      handleRegister();
    }
  };

  const switchToRegister = () => {
    setMode('register');
    setError('');
    setMessage('');
    if (!displayName) {
      // Auto-suggest display name from email
      const emailName = email.split('@')[0];
      setDisplayName(emailName);
    }
  };

  const switchToLogin = () => {
    setMode('login');
    setError('');
    setMessage('');
    setDisplayName('');
  };

  const startOver = () => {
    setMode('login');
    setError('');
    setMessage('');
    setEmail('');
    setPassword('');
    setDisplayName('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {mode === 'login' ? 'Welcome Back' : 
             mode === 'userNotFound' ? 'Create Account' : 
             'Create Account'}
          </h2>
          <p className="text-gray-600 mt-2">
            {mode === 'login' ? 'Sign in to upload and manage your concert moments' :
             mode === 'userNotFound' ? 'Set up your new account to get started' :
             'Join the community of concert moment collectors'}
          </p>
        </div>
        
        {/* Success Message */}
        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 text-center">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
              {message}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* User Not Found Message - only show in userNotFound mode */}
        {mode === 'userNotFound' && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4 text-center">
            <p className="font-medium">No account found for {email}</p>
            <p className="text-sm mt-1">Would you like to create a new account with this email?</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display Name - only for register modes */}
          {(mode === 'register' || mode === 'userNotFound') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name *
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="How others will see you"
                required
              />
            </div>
          )}
          
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your@email.com"
              required
              disabled={mode === 'userNotFound' && loading} // Only disable when loading in userNotFound mode
            />
          </div>
          
          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={mode === 'login' ? 'Enter your password' : 'Create a password (min 6 characters)'}
              required
              minLength={mode !== 'login' ? 6 : undefined}
            />
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !email || !password || ((mode === 'register' || mode === 'userNotFound') && !displayName)}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {mode === 'login' ? 'Signing In...' : 'Creating Account...'}
              </div>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>
        
        {/* Mode Switching */}
        <div className="text-center mt-6">
          {mode === 'login' ? (
            <button
              onClick={switchToRegister}
              className="text-blue-600 hover:text-blue-800 underline"
              disabled={loading}
            >
              Don't have an account? Create one
            </button>
          ) : mode === 'userNotFound' ? (
            <button
              onClick={startOver}
              className="text-gray-600 hover:text-gray-800 underline"
              disabled={loading}
            >
              Try different email address
            </button>
          ) : (
            <button
              onClick={switchToLogin}
              className="text-blue-600 hover:text-blue-800 underline"
              disabled={loading}
            >
              Already have an account? Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Moment Detail Modal
const MomentDetailModal = ({ moment, onClose }) => {
  const { user } = useAuth();
  const isOwner = user && moment.user && user.id === moment.user._id;
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({
    setName: moment.setName || '',
    momentDescription: moment.momentDescription || '',
    emotionalTags: moment.emotionalTags || '',
    momentType: moment.momentType || 'performance',
    specialOccasion: moment.specialOccasion || '',
    instruments: moment.instruments || '',
    audioQuality: moment.audioQuality || 'good',
    videoQuality: moment.videoQuality || 'good',
    crowdReaction: moment.crowdReaction || '',
    guestAppearances: moment.guestAppearances || '',
    personalNote: moment.personalNote || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleDownload = () => {
    try {
      const link = document.createElement('a');
      link.href = moment.mediaUrl;
      link.download = moment.fileName || 'moment-file';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download file. Please try opening the link directly.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Please log in again to save changes');
      }

      const response = await fetch(`${API_BASE_URL}/moments/${moment._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editedData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save changes');
      }

      setIsEditing(false);
      window.location.reload();
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = isOwner && isEditing ? styles.input : styles.inputReadonly;

  return (
    <div style={styles.modal.overlay} onClick={onClose}>
      <div style={styles.modal.content} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modal.header}>
          <div>
            <h2 style={styles.modal.title}>Moment Details</h2>
            <p style={styles.modal.subtitle}>
              {isOwner ? 'Your moment details' : `Moment by ${moment.user?.displayName || 'Anonymous'}`}
            </p>
          </div>
          {isOwner && (
            <button
              onClick={() => {
                setIsEditing(!isEditing);
                setError('');
              }}
              style={isEditing ? styles.button.secondary : styles.button.primary}
            >
              {isEditing ? 'Cancel Edit' : 'Edit'}
            </button>
          )}
        </div>

        {error && (
          <div style={styles.message.error}>
            {error}
          </div>
        )}

        {/* Core Information */}
        <div style={styles.section.container}>
          <h3 style={styles.section.title}>📝 Core Information</h3>
          
          <div style={styles.section.grid}>
            <div>
              <label style={styles.label}>Song Name</label>
              <input type="text" value={moment.songName || ''} readOnly style={styles.inputReadonly} />
            </div>
            
            <div>
              <label style={styles.label}>Set Name</label>
              <input
                type="text"
                value={isEditing ? editedData.setName : (moment.setName || '')}
                readOnly={!isEditing}
                onChange={(e) => isEditing && setEditedData({...editedData, setName: e.target.value})}
                style={inputStyle}
                placeholder="e.g., Encore, Set 1"
              />
            </div>
          </div>

          <div style={styles.section.grid}>
            <div>
              <label style={styles.label}>Venue</label>
              <input type="text" value={moment.venueName || ''} readOnly style={styles.inputReadonly} />
            </div>
            
            <div>
              <label style={styles.label}>Location</label>
              <input 
                type="text" 
                value={`${moment.venueCity}${moment.venueCountry ? ', ' + moment.venueCountry : ''}`} 
                readOnly 
                style={styles.inputReadonly} 
              />
            </div>
          </div>
        </div>

        {/* Moment Details */}
        <div style={styles.section.container}>
          <h3 style={styles.section.title}>🎭 Moment Details</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={styles.label}>Description</label>
            <textarea
              value={isEditing ? editedData.momentDescription : (moment.momentDescription || '')}
              readOnly={!isEditing}
              onChange={(e) => isEditing && setEditedData({...editedData, momentDescription: e.target.value})}
              style={isOwner && isEditing ? styles.textarea : {...styles.textarea, backgroundColor: '#f5f5f5'}}
              placeholder="Describe what happens in this moment"
            />
          </div>

          <div style={styles.section.grid}>
            <div>
              <label style={styles.label}>Type</label>
              {isEditing ? (
                <select
                  value={editedData.momentType}
                  onChange={(e) => setEditedData({...editedData, momentType: e.target.value})}
                  style={styles.input}
                >
                  <option value="performance">Performance</option>
                  <option value="crowd">Crowd Reaction</option>
                  <option value="backstage">Backstage</option>
                  <option value="arrival">Band Arrival</option>
                  <option value="interaction">Artist-Fan Interaction</option>
                </select>
              ) : (
                <input type="text" value={moment.momentType || ''} readOnly style={styles.inputReadonly} />
              )}
            </div>
            
            <div>
              <label style={styles.label}>Quality</label>
              <input 
                type="text" 
                value={`Audio: ${moment.audioQuality || 'N/A'}, Video: ${moment.videoQuality || 'N/A'}`} 
                readOnly 
                style={styles.inputReadonly} 
              />
            </div>
          </div>
        </div>

        {/* Media File */}
        <div style={styles.section.container}>
          <h3 style={styles.section.title}>📁 Media File</h3>
          
          <div style={styles.mediaDisplay.container}>
            <p style={styles.mediaDisplay.fileName}>{moment.fileName}</p>
            <p style={styles.mediaDisplay.fileInfo}>
              {moment.fileSize ? formatFileSize(moment.fileSize) : 'Unknown size'} • {moment.mediaType}
            </p>
            <button onClick={handleDownload} style={styles.button.success}>
              Open Decentralized Storage Link
            </button>
            <p style={styles.mediaDisplay.warning}>
              ⚠️ This will open/download the file from permanent storage
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={styles.footerActions.container}>
          <button onClick={onClose} style={styles.button.secondary}>
            Close
          </button>
          
          {isOwner && isEditing && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={saving ? styles.button.disabled : styles.button.success}
            >
              {saving ? (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ 
                    width: '16px', 
                    height: '16px', 
                    border: '2px solid #fff',
                    borderTop: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginRight: '8px'
                  }}></div>
                  Saving...
                </div>
              ) : (
                'Save Changes'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Enhanced Upload Modal
const EnhancedUploadModal = ({ uploadingMoment, onClose }) => {
  const [step, setStep] = useState('form');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [uploadStage, setUploadStage] = useState('');
  
  const [formData, setFormData] = useState({
    songName: uploadingMoment?.songName || '',
    venueName: uploadingMoment?.venueName || '',
    venueCity: uploadingMoment?.venueCity || '',
    venueCountry: uploadingMoment?.venueCountry || '',
    performanceDate: uploadingMoment?.performanceDate || '',
    setName: uploadingMoment?.setName || '',
    songPosition: uploadingMoment?.songPosition || 1,
    personalNote: '',
    momentDescription: '',
    emotionalTags: '',
    specialOccasion: '',
    audioQuality: 'good',
    videoQuality: 'good',
    momentType: 'performance',
    instruments: '',
    guestAppearances: '',
    crowdReaction: '',
    uniqueElements: ''
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    const maxSize = 6 * 1024 * 1024 * 1024; // 6GB
    if (selectedFile.size > maxSize) {
      setError('File too large. Maximum size is 6GB.');
      return;
    }

    setFile(selectedFile);
    setError('');
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    if (!formData.songName || !formData.venueName || !formData.venueCity) {
      setError('Please fill in required fields: Song Name, Venue, and City');
      return;
    }

    setStep('uploading');
    setUploading(true);
    setError('');
    setUploadProgress(0);
    setUploadStage('Preparing upload...');

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Please log in to upload moments');
      }

      setUploadProgress(10);
      setUploadStage('Uploading to decentralized storage...');

      const fileResponse = await fetch(`${API_BASE_URL}/upload-file`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formDataUpload
      });

      if (!fileResponse.ok) {
        const errorData = await fileResponse.json();
        throw new Error(errorData.error || 'File upload failed');
      }

      const fileData = await fileResponse.json();
      setUploadProgress(70);
      setUploadStage('Saving moment metadata...');

      const momentPayload = {
        performanceId: uploadingMoment.performanceId,
        performanceDate: formData.performanceDate,
        venueName: formData.venueName,
        venueCity: formData.venueCity,
        venueCountry: formData.venueCountry,
        songName: formData.songName,
        setName: formData.setName,
        songPosition: formData.songPosition,
        mediaUrl: fileData.fileUri,
        mediaType: file.type.startsWith('video/') ? 'video' : 
                   file.type.startsWith('audio/') ? 'audio' : 
                   file.type.startsWith('image/') ? 'image' : 'unknown',
        fileName: file.name,
        fileSize: file.size,
        personalNote: formData.personalNote,
        momentDescription: formData.momentDescription,
        emotionalTags: formData.emotionalTags,
        specialOccasion: formData.specialOccasion,
        audioQuality: formData.audioQuality,
        videoQuality: formData.videoQuality,
        momentType: formData.momentType,
        instruments: formData.instruments,
        guestAppearances: formData.guestAppearances,
        crowdReaction: formData.crowdReaction,
        uniqueElements: formData.uniqueElements
      };

      const momentResponse = await fetch(`${API_BASE_URL}/upload-moment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(momentPayload)
      });

      if (!momentResponse.ok) {
        const errorData = await momentResponse.json();
        throw new Error(errorData.error || 'Failed to save moment');
      }

      setUploadProgress(100);
      setUploadStage('Complete!');
      setStep('success');

      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 3000);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
      setStep('form');
      setUploadStage('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.modal.overlay} onClick={() => step === 'form' && onClose()}>
      <div style={styles.modal.content} onClick={(e) => e.stopPropagation()}>
        {step === 'form' && (
          <div>
            <h2 style={styles.modal.title}>🎵 Upload a Moment</h2>
            <p style={styles.modal.subtitle}>Create a detailed record of this musical moment for NFT metadata</p>

            {error && <div style={styles.message.error}>{error}</div>}

            {/* Core Information */}
            <div style={styles.section.container}>
              <h3 style={styles.section.title}>📝 Core Information</h3>
              
              <div style={styles.section.grid}>
                <div>
                  <label style={styles.label}>Song Name *</label>
                  <input
                    type="text"
                    value={formData.songName}
                    onChange={(e) => handleInputChange('songName', e.target.value)}
                    style={styles.input}
                    placeholder="Enter song name"
                  />
                </div>
                
                <div>
                  <label style={styles.label}>Set Name</label>
                  <input
                    type="text"
                    value={formData.setName}
                    onChange={(e) => handleInputChange('setName', e.target.value)}
                    style={styles.input}
                    placeholder="e.g., Encore, Set 1"
                  />
                </div>
              </div>

              <div style={styles.section.grid}>
                <div>
                  <label style={styles.label}>Venue Name *</label>
                  <input
                    type="text"
                    value={formData.venueName}
                    onChange={(e) => handleInputChange('venueName', e.target.value)}
                    style={styles.input}
                  />
                </div>
                
                <div>
                  <label style={styles.label}>City *</label>
                  <input
                    type="text"
                    value={formData.venueCity}
                    onChange={(e) => handleInputChange('venueCity', e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>
            </div>

            {/* Moment Details */}
            <div style={styles.section.container}>
              <h3 style={styles.section.title}>🎭 Moment Details</h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={styles.label}>Moment Description</label>
                <textarea
                  value={formData.momentDescription}
                  onChange={(e) => handleInputChange('momentDescription', e.target.value)}
                  style={styles.textarea}
                  placeholder="Describe what happens in this moment"
                />
              </div>

              <div style={styles.section.grid}>
                <div>
                  <label style={styles.label}>Moment Type</label>
                  <select
                    value={formData.momentType}
                    onChange={(e) => handleInputChange('momentType', e.target.value)}
                    style={styles.input}
                  >
                    <option value="performance">Performance</option>
                    <option value="crowd">Crowd Reaction</option>
                    <option value="backstage">Backstage</option>
                    <option value="arrival">Band Arrival</option>
                    <option value="interaction">Artist-Fan Interaction</option>
                  </select>
                </div>
                
                <div>
                  <label style={styles.label}>Emotional Tags</label>
                  <input
                    type="text"
                    value={formData.emotionalTags}
                    onChange={(e) => handleInputChange('emotionalTags', e.target.value)}
                    style={styles.input}
                    placeholder="energetic, emotional, epic"
                  />
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div style={styles.section.container}>
              <h3 style={styles.section.title}>📁 Media File</h3>
              
              <div style={styles.fileUpload.container}>
                <input
                  type="file"
                  id="enhanced-file-upload"
                  style={{ display: 'none' }}
                  accept="video/*,audio/*,image/*"
                  onChange={handleFileSelect}
                />
                <label htmlFor="enhanced-file-upload" style={{ cursor: 'pointer' }}>
                  {!file ? (
                    <div>
                      <div style={styles.fileUpload.icon}>📁</div>
                      <p style={styles.fileUpload.text}>Click to select media file</p>
                      <p style={styles.fileUpload.subtext}>Video, Audio, or Image files up to 6GB</p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{file.name}</p>
                      <p style={{ color: '#6b7280' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Actions */}
            <div style={styles.footerActions.container}>
              <button onClick={onClose} style={styles.button.secondary}>Cancel</button>
              
              <button
                onClick={handleUpload}
                disabled={!file || !formData.songName || !formData.venueName || !formData.venueCity}
                style={(!file || !formData.songName || !formData.venueName || !formData.venueCity) 
                  ? styles.button.disabled 
                  : styles.button.primary}
              >
                🚀 Create NFT-Ready Moment
              </button>
            </div>
          </div>
        )}

        {step === 'uploading' && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h2 style={styles.modal.title}>🚀 Creating Your NFT-Ready Moment</h2>
            
            <div style={{
              backgroundColor: '#f3f4f6',
              borderRadius: '8px',
              height: '8px',
              marginBottom: '1rem',
              overflow: 'hidden'
            }}>
              <div
                style={{
                  backgroundColor: '#3b82f6',
                  height: '100%',
                  width: `${uploadProgress}%`,
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
            
            <p style={{ color: '#6b7280', fontSize: '1rem', marginBottom: '0.5rem' }}>
              {uploadProgress}% Complete
            </p>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              {uploadStage}
            </p>
          </div>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ ...styles.modal.title, color: '#059669' }}>
              NFT-Ready Moment Created!
            </h2>
            <p style={{ color: '#6b7280' }}>Your moment is ready for NFT minting.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Smart Song Display Component
const SmartSongDisplay = ({ song, songIndex, setlist, setInfo, handleUploadMoment, user }) => {
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMoments, setShowMoments] = useState(false);
  const [selectedMoment, setSelectedMoment] = useState(null);
  const [error, setError] = useState(null);

  const momentsFetch = useMemo(() => {
    return async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/moments/performance/${setlist.id}`,
          { signal: AbortSignal.timeout(5000) }
        );
        
        if (response.ok) {
          const data = await response.json();
          const filteredMoments = data.moments.filter(
            moment => moment.songName === song.name
          );
          setMoments(filteredMoments);
        } else {
          throw new Error('Failed to fetch moments');
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Failed to load moments:', err);
          setError('Failed to load moments');
        }
      } finally {
        setLoading(false);
      }
    };
  }, [setlist.id, song.name]);

  useEffect(() => {
    momentsFetch();
  }, [momentsFetch]);

  if (loading) {
    return (
      <li className="border-b border-gray-100 pb-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-400">{song.name}</span>
            <div className="animate-pulse w-4 h-4 bg-gray-300 rounded"></div>
          </div>
          {user && (
            <button
              onClick={() => handleUploadMoment(setlist, song, { name: setInfo.name, songIndex: songIndex + 1 })}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Upload Moment
            </button>
          )}
        </div>
      </li>
    );
  }

  if (error) {
    return (
      <li className="border-b border-gray-100 pb-3">
        <div className="flex justify-between items-center">
          <span className="font-medium text-gray-900">{song.name}</span>
          {user && (
            <button
              onClick={() => handleUploadMoment(setlist, song, { name: setInfo.name, songIndex: songIndex + 1 })}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Upload Moment
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <li className="border-b border-gray-100 pb-3">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3 flex-1">
          {moments.length > 0 ? (
            <button
              onClick={() => setShowMoments(!showMoments)}
              className="font-medium text-blue-600 hover:text-blue-800 transition-colors text-left flex items-center gap-2"
            >
              {song.name} 
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                {moments.length} moment{moments.length !== 1 ? 's' : ''}
              </span>
              <span className="text-gray-400">{showMoments ? '▼' : '▶'}</span>
            </button>
          ) : (
            <span className="font-medium text-gray-900">{song.name}</span>
          )}

          {user && (
            <button
              onClick={() => handleUploadMoment(setlist, song, { name: setInfo.name, songIndex: songIndex + 1 })}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              Upload Moment
            </button>
          )}
        </div>
      </div>

      {showMoments && moments.length > 0 && (
        <div className="mt-3 ml-4">
          <div className="flex flex-wrap gap-2">
            {moments.slice(0, 10).map((moment) => (
              <button
                key={moment._id}
                onClick={() => setSelectedMoment(moment)}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded border transition-colors"
              >
                by {moment.user?.displayName || 'Anonymous'}
                {moment.momentType && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({moment.momentType})
                  </span>
                )}
              </button>
            ))}
            {moments.length > 10 && (
              <span className="px-3 py-2 text-gray-500 text-sm">+{moments.length - 10} more</span>
            )}
          </div>
        </div>
      )}

      {selectedMoment && (
        <MomentDetailModal moment={selectedMoment} onClose={() => setSelectedMoment(null)} />
      )}
    </li>
  );
};

// Main Setlists Component
function Setlists({ selectedArtist }) {
  const [setlists, setSetlists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [expandedSetlistId, setExpandedSetlistId] = useState(null);
  const [uploadingMoment, setUploadingMoment] = useState(null);
  const { user } = useAuth();

  const fetchSetlists = async (pageToFetch, artist) => {
    if (!artist) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rest/1.0/artist/${artist.mbid}/setlists?p=${pageToFetch}`,
        { 
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000)
        }
      );

      if (!response.ok) throw new Error(`Failed to fetch setlists: ${response.status}`);

      const data = await response.json();
      if (data && data.setlist) {
        const newSetlists = data.setlist;
        setSetlists((prev) => (pageToFetch === 1 ? newSetlists : [...prev, ...newSetlists]));
        if (newSetlists.length === 0) setHasMore(false);
      } else {
        setError('No setlists found for this artist');
        setHasMore(false);
      }
    } catch (err) {
      setError(err.name === 'AbortError' ? 'Request timed out' : err.message);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedArtist) {
      setSetlists([]);
      setPage(1);
      setHasMore(true);
      setError(null);
      fetchSetlists(1, selectedArtist);
    }
  }, [selectedArtist]);

  const handleUploadMoment = (setlist, song, setInfo) => {
    if (!user) {
      alert('Please log in to upload moments');
      return;
    }
    
    setUploadingMoment({ 
      performanceId: setlist.id,
      performanceDate: setlist.eventDate,
      venueName: setlist.venue.name,
      venueCity: setlist.venue.city.name,
      venueCountry: setlist.venue.city.country?.name || '',
      songName: song.name,
      setName: setInfo?.name || '',
      songPosition: setInfo?.songIndex || 0
    });
  };

  if (!selectedArtist) return null;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold">{selectedArtist.name} Setlists</h2>
        <p className="text-gray-600">Upload moments from their performances</p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>⚠️ {error}</p>
          <button
            onClick={() => fetchSetlists(1, selectedArtist)}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}
      
      <div className="space-y-4">
        {setlists.map((setlist) => (
          <div key={setlist.id} className="border border-gray-200 rounded-lg bg-white shadow-sm">
            <div
              onClick={() => setExpandedSetlistId(prev => prev === setlist.id ? null : setlist.id)}
              className="cursor-pointer p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="font-semibold text-lg">
                {setlist.eventDate} - {setlist.venue.name}, {setlist.venue.city.name}
                <span className="ml-2 text-gray-400 text-sm">
                  {expandedSetlistId === setlist.id ? '▼' : '▶'}
                </span>
              </div>
            </div>

            {expandedSetlistId === setlist.id && (
              <div className="border-t border-gray-200 p-4">
                {setlist.sets?.set?.map((set, index) => (
                  <div key={index} className="mb-6">
                    {set.name && <h4 className="text-lg font-semibold mb-3">{set.name}</h4>}
                    <ol className="space-y-3">
                      {set.song.map((song, i) => (
                        <SmartSongDisplay
                          key={`${song.name}-${i}`}
                          song={song}
                          songIndex={i}
                          setlist={setlist}
                          setInfo={set}
                          handleUploadMoment={handleUploadMoment}
                          user={user}
                        />
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="inline-flex items-center text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            Loading setlists...
          </div>
        </div>
      )}
      
      {!loading && hasMore && setlists.length > 0 && (
        <div className="text-center mt-6">
          <button 
            onClick={() => {
              const nextPage = page + 1;
              fetchSetlists(nextPage, selectedArtist);
              setPage(nextPage);
            }} 
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Load More Setlists
          </button>
        </div>
      )}

      {uploadingMoment && user && (
        <EnhancedUploadModal
          uploadingMoment={uploadingMoment}
          onClose={() => setUploadingMoment(null)}
        />
      )}
    </div>
  );
}

// Main App Component
function MainApp() {
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const { user, logout, loading } = useAuth();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const artistId = urlParams.get('artist');
    const artistName = urlParams.get('name');
    
    if (artistId && artistName) {
      setSelectedArtist({ mbid: artistId, name: artistName });
    }
  }, []);

  const handleArtistSelect = (artist) => {
    setSelectedArtist(artist);
    
    if (artist) {
      const url = new URL(window.location);
      url.searchParams.set('artist', artist.mbid);
      url.searchParams.set('name', artist.name);
      window.history.pushState({}, '', url);
    } else {
      const url = new URL(window.location);
      url.searchParams.delete('artist');
      url.searchParams.delete('name');
      window.history.pushState({}, '', url);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl flex items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
          Loading...
        </div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg">
          <Login />
          <div className="p-4 border-t">
            <button
              onClick={() => setShowLogin(false)}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Continue Browsing Without Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold">mmnts</h1>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-gray-600">Welcome, {user.displayName}!</span>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="text-gray-600">
                <span className="mr-3">Browse read-only</span>
                <button
                  onClick={() => setShowLogin(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Login to Upload
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Artist Search */}
        <div className="mb-8">
          <ArtistSearch onArtistSelect={handleArtistSelect} currentArtist={selectedArtist} />
        </div>

        {/* Conditional Layout */}
        {selectedArtist ? (
          <>
            <Setlists selectedArtist={selectedArtist} />
            
            <div className="mt-12 pt-8 border-t border-gray-200">
              <FeaturedArtists onArtistSelect={handleArtistSelect} />
            </div>
          </>
        ) : (
          <>
            <FeaturedArtists onArtistSelect={handleArtistSelect} />
            
            <div className="text-center py-12 mt-8">
              <div className="text-xl text-gray-600 mb-4">Search for any artist above to view their setlists</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// App Component
export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}