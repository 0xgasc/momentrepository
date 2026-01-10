// setlist-proxy/routes/upcomingShows.js
// API for managing upcoming tour dates
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const UpcomingShow = require('../models/UpcomingShow');
const axios = require('axios');
const cheerio = require('cheerio');

// Helper: Check if user has admin access
const isAdmin = (req) => {
  return req.user && (req.user.role === 'admin' || req.user.role === 'mod');
};

// Get all upcoming shows (public)
router.get('/', async (req, res) => {
  try {
    const { includesPast = 'false' } = req.query;

    const query = { isActive: true, isCancelled: false };
    if (includesPast === 'false') {
      query.eventDate = { $gte: new Date() };
    }

    const shows = await UpcomingShow.find(query)
      .sort({ eventDate: 1 })
      .lean();

    // Separate into upcoming and past
    const now = new Date();
    const upcoming = shows.filter(s => new Date(s.eventDate) >= now);
    const past = shows.filter(s => new Date(s.eventDate) < now);

    res.json({
      upcoming,
      past,
      total: shows.length
    });
  } catch (err) {
    console.error('❌ Get upcoming shows error:', err);
    res.status(500).json({ error: 'Failed to fetch shows' });
  }
});

// Get single show (public)
router.get('/:id', async (req, res) => {
  try {
    const show = await UpcomingShow.findById(req.params.id).lean();
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }
    res.json({ show });
  } catch (err) {
    console.error('❌ Get show error:', err);
    res.status(500).json({ error: 'Failed to fetch show' });
  }
});

// Create show (admin only)
router.post('/',
  [
    body('eventDate').isISO8601(),
    body('venue.name').trim().notEmpty(),
    body('venue.city').trim().notEmpty(),
    body('venue.country').trim().notEmpty()
  ],
  async (req, res) => {
    try {
      if (!isAdmin(req)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const show = new UpcomingShow(req.body);
      await show.save();

      console.log(`📅 New upcoming show created: ${show.venue.name} on ${show.eventDate}`);
      res.status(201).json({ show });
    } catch (err) {
      console.error('❌ Create show error:', err);
      res.status(500).json({ error: 'Failed to create show' });
    }
  }
);

// Update show (admin only)
router.put('/:id', async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && !['solo@solo.solo', 'solo2@solo.solo'].includes(req.user.email))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const show = await UpcomingShow.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    res.json({ show });
  } catch (err) {
    console.error('❌ Update show error:', err);
    res.status(500).json({ error: 'Failed to update show' });
  }
});

// Delete show (admin only)
router.delete('/:id', async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && !['solo@solo.solo', 'solo2@solo.solo'].includes(req.user.email))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const show = await UpcomingShow.findByIdAndDelete(req.params.id);
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Delete show error:', err);
    res.status(500).json({ error: 'Failed to delete show' });
  }
});

// Link upcoming show to past performance (admin only)
router.post('/:id/link-performance', async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && !['solo@solo.solo', 'solo2@solo.solo'].includes(req.user.email))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { performanceId } = req.body;
    const show = await UpcomingShow.findByIdAndUpdate(
      req.params.id,
      { linkedPerformanceId: performanceId },
      { new: true }
    );

    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    res.json({ show });
  } catch (err) {
    console.error('❌ Link performance error:', err);
    res.status(500).json({ error: 'Failed to link performance' });
  }
});

// Scrape tour dates from UMO website (admin only)
router.post('/scrape', async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && !['solo@solo.solo', 'solo2@solo.solo'].includes(req.user.email))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    console.log('🔄 Starting tour date scrape...');

    // Try to fetch from UMO's website
    const umoUrl = 'https://www.unknownmortalorchestra.com/home-1';
    let shows = [];

    try {
      const response = await axios.get(umoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);

      // UMO uses Squarespace - try to find event data
      // Look for common Squarespace event structures
      $('[class*="event"], [class*="tour"], [data-block-type="32"]').each((i, el) => {
        const $el = $(el);
        const text = $el.text().trim();

        // Try to extract date, venue, city
        const dateMatch = text.match(/(\w+ \d{1,2},? \d{4})|(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{2}-\d{2})/);
        const venueMatch = text.match(/(?:at|@)\s+([^,\n]+)/i);
        const cityMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s*([A-Z]{2})?/);

        if (dateMatch) {
          shows.push({
            dateText: dateMatch[0],
            venue: venueMatch ? venueMatch[1].trim() : 'TBA',
            city: cityMatch ? cityMatch[1].trim() : 'TBA',
            state: cityMatch && cityMatch[2] ? cityMatch[2] : '',
            rawText: text.substring(0, 200)
          });
        }
      });

      // Also try to find JSON-LD event data
      $('script[type="application/ld+json"]').each((i, el) => {
        try {
          const jsonData = JSON.parse($(el).html());
          if (jsonData['@type'] === 'Event' || (Array.isArray(jsonData) && jsonData.some(d => d['@type'] === 'Event'))) {
            const events = Array.isArray(jsonData) ? jsonData.filter(d => d['@type'] === 'Event') : [jsonData];
            events.forEach(event => {
              shows.push({
                dateText: event.startDate,
                venue: event.location?.name || 'TBA',
                city: event.location?.address?.addressLocality || 'TBA',
                state: event.location?.address?.addressRegion || '',
                country: event.location?.address?.addressCountry || 'USA',
                ticketUrl: event.url || null,
                rawText: event.name || ''
              });
            });
          }
        } catch (e) {
          // Invalid JSON, skip
        }
      });

      console.log(`📝 Found ${shows.length} potential tour dates`);

    } catch (fetchErr) {
      console.error('❌ Failed to fetch UMO website:', fetchErr.message);
      // Continue with empty shows - admin can add manually
    }

    // Process found shows
    let added = 0;
    let updated = 0;

    for (const show of shows) {
      try {
        // Parse date
        let eventDate;
        if (show.dateText) {
          eventDate = new Date(show.dateText);
          if (isNaN(eventDate.getTime())) {
            console.log(`⚠️ Could not parse date: ${show.dateText}`);
            continue;
          }
        } else {
          continue;
        }

        // Skip past dates
        if (eventDate < new Date()) {
          continue;
        }

        // Check if already exists
        const existing = await UpcomingShow.findOne({
          eventDate: {
            $gte: new Date(eventDate.setHours(0, 0, 0, 0)),
            $lt: new Date(eventDate.setHours(23, 59, 59, 999))
          },
          'venue.city': show.city
        });

        if (existing) {
          // Update if we have more info
          if (show.ticketUrl && !existing.ticketUrl) {
            existing.ticketUrl = show.ticketUrl;
            await existing.save();
            updated++;
          }
        } else {
          // Create new
          const newShow = new UpcomingShow({
            eventDate,
            venue: {
              name: show.venue || 'TBA',
              city: show.city || 'TBA',
              state: show.state || '',
              country: show.country || 'USA'
            },
            ticketUrl: show.ticketUrl || '',
            ticketStatus: 'tba',
            eventType: 'headlining',
            notes: `Scraped from UMO website. Raw: ${show.rawText?.substring(0, 100) || ''}`
          });
          await newShow.save();
          added++;
          console.log(`✅ Added: ${show.venue} - ${show.city} on ${eventDate.toDateString()}`);
        }
      } catch (parseErr) {
        console.error('❌ Error processing show:', parseErr.message);
      }
    }

    console.log(`🎉 Scrape complete: ${added} added, ${updated} updated`);

    res.json({
      success: true,
      added,
      updated,
      message: shows.length === 0
        ? 'No shows found on website. UMO may use dynamic loading - please add shows manually.'
        : `Found ${shows.length} dates, added ${added}, updated ${updated}`
    });

  } catch (err) {
    console.error('❌ Scrape error:', err);
    res.status(500).json({ error: 'Scrape failed: ' + err.message });
  }
});

// Bulk import tour dates (admin only)
// Accepts format like:
// Mar. 10, 2026
// Vilnius, Lithuania
// Kablys
// tickets
router.post('/bulk-import', async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && !['solo@solo.solo', 'solo2@solo.solo'].includes(req.user.email))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { rawText } = req.body;
    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).json({ error: 'rawText is required' });
    }

    console.log('📋 Starting bulk import...');

    // Split by lines and clean up
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l && l.toLowerCase() !== 'tickets');

    const parsedShows = [];
    let i = 0;

    while (i < lines.length) {
      const dateLine = lines[i];

      // Check if this is a date line
      const datePatterns = [
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:\s*-\s*\d{1,2})?,?\s*(\d{4})$/i,
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
        /^(\d{4})-(\d{2})-(\d{2})$/
      ];

      let isDateLine = datePatterns.some(p => p.test(dateLine));

      if (isDateLine && i + 2 < lines.length) {
        const locationLine = lines[i + 1];
        const venueLine = lines[i + 2];

        // Parse date - handle formats like "Mar. 10, 2026" or "Aug. 28 - 30, 2026"
        let eventDate;
        const monthMatch = dateLine.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:\s*-\s*\d{1,2})?,?\s*(\d{4})$/i);
        if (monthMatch) {
          const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
          const month = months[monthMatch[1].toLowerCase()];
          const day = parseInt(monthMatch[2]);
          const year = parseInt(monthMatch[3]);
          eventDate = new Date(year, month, day, 20, 0, 0); // 8 PM default
        } else {
          eventDate = new Date(dateLine);
        }

        if (isNaN(eventDate.getTime())) {
          console.log(`⚠️ Could not parse date: ${dateLine}`);
          i++;
          continue;
        }

        // Parse location (City, Country)
        const locationParts = locationLine.split(',').map(p => p.trim());
        const city = locationParts[0] || 'TBA';
        const country = locationParts[1] || 'Unknown';

        // Check if it's a festival (has "Festival" or year range in venue or date has range)
        const isFestival = dateLine.includes('-') || venueLine.toLowerCase().includes('festival') || venueLine.match(/\d{4}$/);

        parsedShows.push({
          eventDate,
          venue: {
            name: venueLine,
            city,
            state: '',
            country
          },
          eventType: isFestival ? 'festival' : 'headlining',
          festivalName: isFestival ? venueLine : '',
          ticketStatus: 'available',
          rawDate: dateLine,
          rawLocation: locationLine
        });

        i += 3;
      } else {
        i++;
      }
    }

    console.log(`📝 Parsed ${parsedShows.length} shows from input`);

    // Import to database
    let added = 0;
    let skipped = 0;

    for (const show of parsedShows) {
      // Check if already exists (same date + city)
      const startOfDay = new Date(show.eventDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(show.eventDate);
      endOfDay.setHours(23, 59, 59, 999);

      const existing = await UpcomingShow.findOne({
        eventDate: { $gte: startOfDay, $lte: endOfDay },
        'venue.city': show.venue.city
      });

      if (existing) {
        console.log(`⏭️ Skipping (exists): ${show.venue.city} on ${show.eventDate.toDateString()}`);
        skipped++;
        continue;
      }

      const newShow = new UpcomingShow({
        eventDate: show.eventDate,
        venue: show.venue,
        eventType: show.eventType,
        festivalName: show.festivalName,
        ticketStatus: show.ticketStatus,
        ticketUrl: '',
        notes: `Imported: ${show.rawDate} - ${show.rawLocation}`,
        isActive: true,
        isCancelled: false
      });

      await newShow.save();
      added++;
      console.log(`✅ Added: ${show.venue.name} - ${show.venue.city} on ${show.eventDate.toDateString()}`);
    }

    console.log(`🎉 Bulk import complete: ${added} added, ${skipped} skipped`);

    res.json({
      success: true,
      parsed: parsedShows.length,
      added,
      skipped,
      message: `Parsed ${parsedShows.length} shows. Added ${added}, skipped ${skipped} (already existed).`
    });

  } catch (err) {
    console.error('❌ Bulk import error:', err);
    res.status(500).json({ error: 'Bulk import failed: ' + err.message });
  }
});

// Auto-link upcoming shows to setlist.fm performances
// Called when a performance is fetched/created
router.post('/auto-link', async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && !['solo@solo.solo', 'solo2@solo.solo'].includes(req.user.email))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { performanceId, eventDate, venueName, city } = req.body;

    if (!performanceId || !eventDate) {
      return res.status(400).json({ error: 'performanceId and eventDate required' });
    }

    // Find matching upcoming show
    const showDate = new Date(eventDate);
    const startOfDay = new Date(showDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(showDate);
    endOfDay.setHours(23, 59, 59, 999);

    let query = {
      eventDate: { $gte: startOfDay, $lte: endOfDay },
      linkedPerformanceId: { $exists: false }
    };

    // If city provided, narrow down
    if (city) {
      query['venue.city'] = { $regex: new RegExp(city, 'i') };
    }

    const upcomingShow = await UpcomingShow.findOne(query);

    if (upcomingShow) {
      upcomingShow.linkedPerformanceId = performanceId;
      await upcomingShow.save();
      console.log(`🔗 Auto-linked upcoming show to performance: ${performanceId}`);
      return res.json({ success: true, linked: true, upcomingShowId: upcomingShow._id });
    }

    res.json({ success: true, linked: false, message: 'No matching upcoming show found' });
  } catch (err) {
    console.error('❌ Auto-link error:', err);
    res.status(500).json({ error: 'Auto-link failed: ' + err.message });
  }
});

// Auto-scan: find all unlinked past shows and try to link them to setlist.fm
router.post('/auto-scan', async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && !['solo@solo.solo', 'solo2@solo.solo'].includes(req.user.email))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    console.log('🔍 Starting auto-scan for unlinked past shows...');

    // Load the UMO cache - create instance and load from disk
    const { UMOCache } = require('../utils/umoCache');
    const umoCache = new UMOCache();
    await umoCache.loadCache();
    const performances = await umoCache.getPerformances();

    if (!performances || performances.length === 0) {
      return res.json({ success: true, linked: 0, message: 'No performances in cache to scan' });
    }

    // Find all unlinked past shows
    const now = new Date();
    const unlinkedShows = await UpcomingShow.find({
      eventDate: { $lt: now },
      linkedPerformanceId: { $exists: false },
      isActive: true,
      isCancelled: false
    });

    console.log(`📋 Found ${unlinkedShows.length} unlinked past shows to scan`);

    let linked = 0;

    for (const show of unlinkedShows) {
      // Find matching performance by date
      // Show.eventDate is JS Date, performance.eventDate is DD-MM-YYYY string
      const showYear = show.eventDate.getFullYear();
      const showMonth = String(show.eventDate.getMonth() + 1).padStart(2, '0');
      const showDay = String(show.eventDate.getDate()).padStart(2, '0');
      const showDateStr = `${showDay}-${showMonth}-${showYear}`;

      const matching = performances.filter(p => {
        if (p.eventDate !== showDateStr) return false;

        // Also try to match city (fuzzy)
        const perfCity = p.venue?.city?.name?.toLowerCase() || '';
        const showCity = show.venue?.city?.toLowerCase() || '';

        return perfCity.includes(showCity) || showCity.includes(perfCity);
      });

      if (matching.length === 1) {
        // Exact match found
        show.linkedPerformanceId = matching[0].id;
        await show.save();
        linked++;
        console.log(`✅ Linked: ${show.venue.city} on ${showDateStr} → ${matching[0].id}`);
      } else if (matching.length > 1) {
        console.log(`⚠️ Multiple matches for ${show.venue.city} on ${showDateStr}: ${matching.length} found`);
      }
    }

    console.log(`🎉 Auto-scan complete: linked ${linked} shows`);

    res.json({
      success: true,
      scanned: unlinkedShows.length,
      linked,
      message: `Scanned ${unlinkedShows.length} unlinked shows, linked ${linked}`
    });

  } catch (err) {
    console.error('❌ Auto-scan error:', err);
    res.status(500).json({ error: 'Auto-scan failed: ' + err.message });
  }
});

// Get upcoming show by linked performance ID (for community features)
router.get('/by-performance/:performanceId', async (req, res) => {
  try {
    const show = await UpcomingShow.findOne({
      linkedPerformanceId: req.params.performanceId
    }).lean();

    if (!show) {
      return res.json({ show: null });
    }

    res.json({ show });
  } catch (err) {
    console.error('❌ Get by performance error:', err);
    res.status(500).json({ error: 'Failed to fetch show' });
  }
});

module.exports = router;
