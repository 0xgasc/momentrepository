// setlist-proxy/utils/umoCache.js - WORKING VERSION with direct API + medley processing
const fs = require('fs').promises;
const path = require('path');

class UMOCache {
  constructor() {
    // Store cache in project root, create directory automatically
    this.cacheDir = path.join(__dirname, '..');
    this.cacheFile = path.join(this.cacheDir, 'umo-cache.json');
    this.cache = null;
    this.isLoading = false;
  }

  async ensureCacheDirectory() {
    try {
      await fs.access(this.cacheDir);
    } catch {
      await fs.mkdir(this.cacheDir, { recursive: true });
    }
  }

  async loadCache() {
    try {
      const data = await fs.readFile(this.cacheFile, 'utf8');
      this.cache = JSON.parse(data);
      console.log(`✅ UMO cache loaded: ${this.cache.performances.length} performances, last updated: ${this.cache.lastUpdated}`);
      return this.cache;
    } catch (err) {
      console.log('📦 No existing cache found, will build fresh');
      return null;
    }
  }

  async saveCache(cacheData) {
    try {
      await this.ensureCacheDirectory();
      await fs.writeFile(this.cacheFile, JSON.stringify(cacheData, null, 2));
      this.cache = cacheData;
      console.log(`💾 UMO cache saved: ${cacheData.performances.length} performances`);
    } catch (err) {
      console.error('❌ Failed to save cache:', err);
    }
  }

  async needsRefresh() {
    if (!this.cache) return true;
    
    const lastUpdate = new Date(this.cache.lastUpdated);
    const now = new Date();
    const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
    
    // Refresh if more than 18 hours old
    const needsRefresh = hoursSinceUpdate > 18;
    
    console.log(`🔍 Cache age: ${hoursSinceUpdate.toFixed(1)} hours, needs refresh: ${needsRefresh}`);
    return needsRefresh;
  }

  async checkForNewShows(apiBaseUrl, currentCount) {
    try {
      console.log('🔍 Quick check for new UMO shows...');
      
      // DIRECT API CALL - not through proxy
      const response = await fetch(`https://api.setlist.fm/rest/1.0/artist/e2305342-0bde-4a2c-aed0-4b88694834de/setlists?p=1`, {
        headers: { 
          Accept: 'application/json',
          'x-api-key': process.env.SETLIST_FM_API_KEY,
          'User-Agent': 'UMORepository/1.0'
        },
        signal: this.createTimeoutSignal(10000)
      });
      
      console.log(`📡 Quick check response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        const hasNewShows = data.total > currentCount;
        console.log(`📊 setlist.fm total: ${data.total}, cached: ${currentCount}, new shows: ${hasNewShows}`);
        return hasNewShows;
      } else {
        console.warn(`⚠️ Quick check failed: ${response.status}, assuming no new shows`);
      }
      
      return false;
    } catch (err) {
      console.error('❌ Error checking for new shows:', err);
      return false;
    }
  }

  createTimeoutSignal(timeout) {
    if (typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(timeout);
    } else {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), timeout);
      return controller.signal;
    }
  }

  // NEW: Helper function to split medley songs
  splitMedleySongs(songName) {
    if (!songName || typeof songName !== 'string') {
      return [];
    }
    
    // Split on "/" and clean up each song name
    const songs = songName.split('/')
      .map(song => song.trim())
      .filter(song => song.length > 0)
      .filter(song => {
        // Filter out common non-song medley indicators
        const lowercased = song.toLowerCase();
        return !lowercased.includes('medley') && 
               !lowercased.includes('intro') && 
               !lowercased.includes('outro') &&
               !lowercased.includes('jam') &&
               !lowercased.includes('reprise') &&
               song.length > 1; // Avoid single character splits
      });
    
    if (songs.length > 1) {
      console.log(`🎵 Split "${songName}" → [${songs.join(', ')}]`);
    }
    return songs;
  }

  async buildFreshCache(apiBaseUrl, progressCallback) {
    if (this.isLoading) {
      console.log('⏳ Cache build already in progress...');
      return this.cache;
    }

    this.isLoading = true;
    
    try {
      console.log('🏗️ Building fresh UMO cache with medley processing...');
      
      const allPerformances = [];
      const allSongs = new Map();
      const cities = new Set();
      const venues = new Set();
      const years = new Set();
      
      let page = 1;
      let hasMore = true;
      let consecutiveEmptyPages = 0;
      let consecutiveErrors = 0;
      
      while (hasMore && page <= 300 && consecutiveEmptyPages < 15 && consecutiveErrors < 5) {
        try {
          if (progressCallback) {
            progressCallback({ 
              page, 
              totalPerformances: allPerformances.length, 
              status: `Scanning page ${page}...` 
            });
          }
          
          console.log(`📄 Fetching page ${page}...`);
          
          // DIRECT API CALL - not through proxy
          const response = await fetch(`https://api.setlist.fm/rest/1.0/artist/e2305342-0bde-4a2c-aed0-4b88694834de/setlists?p=${page}`, {
            headers: { 
              Accept: 'application/json',
              'x-api-key': process.env.SETLIST_FM_API_KEY,
              'User-Agent': 'UMORepository/1.0'
            },
            signal: this.createTimeoutSignal(20000)
          });

          console.log(`📡 Page ${page} response: ${response.status} ${response.statusText}`);

          if (!response.ok) {
            if (response.status === 429) {
              console.warn(`⚠️ Rate limited on page ${page}`);
              
              // Try to get retry-after header
              const retryAfter = response.headers.get('retry-after');
              const waitTime = retryAfter ? parseInt(retryAfter) : 60;
              
              console.log(`⏳ Waiting ${waitTime} seconds before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
              
              // Retry once
              console.log(`🔄 Retrying page ${page}...`);
              const retryResponse = await fetch(`https://api.setlist.fm/rest/1.0/artist/e2305342-0bde-4a2c-aed0-4b88694834de/setlists?p=${page}`, {
                headers: { 
                  Accept: 'application/json',
                  'x-api-key': process.env.SETLIST_FM_API_KEY,
                  'User-Agent': 'UMORepository/1.0'
                },
                signal: this.createTimeoutSignal(20000)
              });
              
              if (retryResponse.ok) {
                console.log(`✅ Retry successful for page ${page}`);
                const data = await retryResponse.json();
                // Process the retry data
                if (data.setlist && data.setlist.length > 0) {
                  this.processPageData(data, allPerformances, allSongs, cities, venues, years);
                  consecutiveEmptyPages = 0;
                  consecutiveErrors = 0;
                } else {
                  consecutiveEmptyPages++;
                }
              } else {
                console.error(`❌ Retry failed for page ${page}: ${retryResponse.status}`);
                consecutiveErrors++;
                if (consecutiveErrors >= 5) {
                  console.warn(`⚠️ Too many consecutive errors, stopping scan`);
                  break;
                }
              }
            } else {
              console.error(`❌ HTTP error on page ${page}: ${response.status}`);
              consecutiveErrors++;
            }
            
            page++;
            // Longer delay after errors
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }

          const data = await response.json();
          
          if (data.setlist && data.setlist.length > 0) {
            this.processPageData(data, allPerformances, allSongs, cities, venues, years);
            consecutiveEmptyPages = 0;
            consecutiveErrors = 0;
            page++;
            
            // 2 second delay between successful requests
            console.log(`⏳ Waiting 2 seconds before next page...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
          } else {
            console.log(`📄 Page ${page} returned no setlists`);
            consecutiveEmptyPages++;
            page++;
            
            // Shorter delay for empty pages
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (err) {
          console.error(`❌ Error on page ${page}:`, err.message);
          consecutiveErrors++;
          page++;
          
          if (consecutiveErrors >= 5) {
            console.warn(`⚠️ Too many consecutive errors, stopping scan`);
            break;
          }
          
          // Longer delay after errors
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // Process song data
      const songDatabase = {};
      allSongs.forEach((songData, songName) => {
        songData.performances.sort((a, b) => {
          const dateA = this.parseDate(a.date);
          const dateB = this.parseDate(b.date);
          return dateB - dateA;
        });
        
        songDatabase[songName] = {
          ...songData,
          venues: Array.from(songData.venues),
          cities: Array.from(songData.cities), 
          countries: Array.from(songData.countries),
          firstPerformed: songData.performances[songData.performances.length - 1]?.date,
          lastPerformed: songData.performances[0]?.date,
          totalPerformances: songData.performances.length
        };
      });
      
      const cacheData = {
        lastUpdated: new Date().toISOString(),
        totalApiCalls: page - 1,
        performances: allPerformances.sort((a, b) => this.parseDate(b.eventDate) - this.parseDate(a.eventDate)),
        songDatabase,
        searchIndexes: {
          cities: Array.from(cities).sort(),
          venues: Array.from(venues).sort(),
          years: Array.from(years).sort((a, b) => b - a)
        },
        stats: {
          totalPerformances: allPerformances.length,
          totalSongs: Object.keys(songDatabase).length,
          dateRange: {
            earliest: allPerformances[allPerformances.length - 1]?.eventDate,
            latest: allPerformances[0]?.eventDate
          },
          apiCallsUsed: page - 1
        }
      };
      
      await this.saveCache(cacheData);
      
      console.log(`✅ Fresh cache built: ${allPerformances.length} performances, ${Object.keys(songDatabase).length} songs`);
      
      return cacheData;
      
    } finally {
      this.isLoading = false;
    }
  }

  // UPDATED: Process page data with medley splitting
  processPageData(data, allPerformances, allSongs, cities, venues, years) {
    data.setlist.forEach(setlist => {
      allPerformances.push(setlist);
      
      cities.add(`${setlist.venue.city.name}, ${setlist.venue.city.country?.name || 'Unknown'}`);
      venues.add(setlist.venue.name);
      
      const year = setlist.eventDate.split('-')[2];
      if (year) years.add(year);
      
      if (setlist.sets && setlist.sets.set) {
        setlist.sets.set.forEach(set => {
          if (set.song) {
            set.song.forEach((song, songIndex) => {
              if (song.name) {
                // NEW: Split medley songs
                const individualSongs = this.splitMedleySongs(song.name);
                
                // If it's a medley (multiple songs), process each individually
                if (individualSongs.length > 1) {
                  console.log(`🎭 Processing medley: "${song.name}" → ${individualSongs.length} songs`);
                  
                  individualSongs.forEach((individualSongName, medleyIndex) => {
                    this.addSongToDatabase(
                      allSongs, 
                      individualSongName, 
                      setlist, 
                      set, 
                      songIndex, 
                      `${song.name} (medley part ${medleyIndex + 1})`
                    );
                  });
                } else if (individualSongs.length === 1) {
                  // Single song (not a medley)
                  this.addSongToDatabase(allSongs, individualSongs[0], setlist, set, songIndex);
                }
                // If length is 0, it was filtered out (probably not a real song)
              }
            });
          }
        });
      }
    });
  }

  // NEW: Helper function to add song to database
  addSongToDatabase(allSongs, songName, setlist, set, songIndex, originalName = null) {
    if (!allSongs.has(songName)) {
      allSongs.set(songName, {
        songName: songName,
        performances: [],
        venues: new Set(),
        cities: new Set(),
        countries: new Set()
      });
    }
    
    const songData = allSongs.get(songName);
    songData.performances.push({
      id: setlist.id,
      venue: setlist.venue.name,
      city: setlist.venue.city.name,
      country: setlist.venue.city.country?.name,
      date: setlist.eventDate,
      setName: set.name,
      songPosition: songIndex + 1,
      originalName: originalName || songName // Track if this came from a medley
    });
    
    songData.venues.add(setlist.venue.name);
    songData.cities.add(setlist.venue.city.name);
    if (setlist.venue.city.country?.name) {
      songData.countries.add(setlist.venue.city.country.name);
    }
  }

  parseDate(dateString) {
    if (!dateString) return new Date(0);
    
    if (dateString.includes('-')) {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
      }
    }
    
    return new Date(dateString);
  }

  async getPerformances() {
    if (!this.cache) await this.loadCache();
    return this.cache?.performances || [];
  }

  async getSongDatabase() {
    if (!this.cache) await this.loadCache();
    return this.cache?.songDatabase || {};
  }

  async getSearchIndexes() {
    if (!this.cache) await this.loadCache();
    return this.cache?.searchIndexes || { cities: [], venues: [], years: [] };
  }

  async getStats() {
    if (!this.cache) await this.loadCache();
    return this.cache?.stats || {};
  }

  // Enhanced search method with pagination support
  async searchPerformancesByCity(cityQuery, page = 1, limit = 20) {
    const performances = await this.getPerformances();
    const query = cityQuery.toLowerCase().trim();
    
    if (!query) {
      // Return paginated results for empty query
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      return {
        results: performances.slice(startIndex, endIndex),
        totalResults: performances.length,
        hasMore: endIndex < performances.length,
        page,
        limit
      };
    }
    
    console.log(`🔍 Enhanced search for: "${query}" (page ${page})`);
    
    const allResults = performances.filter(setlist => {
      // Search in city and venue (original functionality)
      const cityMatch = setlist.venue.city.name.toLowerCase().includes(query);
      const venueMatch = setlist.venue.name.toLowerCase().includes(query);
      const countryMatch = (setlist.venue.city.country?.name || '').toLowerCase().includes(query);
      
      // NEW: Search in year (e.g., "2023", "2024")
      const eventDate = setlist.eventDate || '';
      const year = eventDate.split('-')[2] || '';
      const yearMatch = year.includes(query);
      
      // NEW: Search in full date string
      const dateMatch = eventDate.toLowerCase().includes(query);
      
      // NEW: Search in song names (including split medley songs)
      let songMatch = false;
      if (setlist.sets && setlist.sets.set) {
        songMatch = setlist.sets.set.some(set => {
          if (set.song && Array.isArray(set.song)) {
            return set.song.some(song => {
              if (song && song.name) {
                // Check original song name
                if (song.name.toLowerCase().includes(query)) {
                  return true;
                }
                
                // Also check split medley songs
                const splitSongs = this.splitMedleySongs(song.name);
                return splitSongs.some(splitSong => 
                  splitSong.toLowerCase().includes(query)
                );
              }
              return false;
            });
          }
          return false;
        });
      }
      
      const matched = cityMatch || venueMatch || countryMatch || yearMatch || songMatch || dateMatch;
      
      if (matched) {
        let matchType = 'unknown';
        if (cityMatch) matchType = 'city';
        else if (venueMatch) matchType = 'venue';
        else if (countryMatch) matchType = 'country';
        else if (yearMatch) matchType = 'year';
        else if (songMatch) matchType = 'song';
        else if (dateMatch) matchType = 'date';
        
        console.log(`✅ Match found: ${setlist.venue.name} (${setlist.eventDate}) - matched by ${matchType}`);
      }
      
      return matched;
    });
    
    // Apply pagination to search results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedResults = allResults.slice(startIndex, endIndex);
    
    console.log(`🎯 Enhanced search results: ${paginatedResults.length}/${allResults.length} performances for "${query}" (page ${page})`);
    
    return {
      results: paginatedResults,
      totalResults: allResults.length,
      hasMore: endIndex < allResults.length,
      page,
      limit
    };
  }
}

module.exports = { UMOCache };