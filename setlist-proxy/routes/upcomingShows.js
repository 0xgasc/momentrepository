// setlist-proxy/routes/upcomingShows.js
// API for managing upcoming tour dates
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const UpcomingShow = require('../models/UpcomingShow');

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

module.exports = router;
