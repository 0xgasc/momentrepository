// setlist-proxy/routes/upcomingShows.js
// API for managing upcoming tour dates
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const UpcomingShow = require('../models/UpcomingShow');
const axios = require('axios');
const cheerio = require('cheerio');

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
      if (!req.user || (req.user.role !== 'admin' && !['solo@solo.solo', 'solo2@solo.solo'].includes(req.user.email))) {
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

module.exports = router;
