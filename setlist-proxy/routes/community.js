// setlist-proxy/routes/community.js
// Community features: Comments, Chat, RSVP, Meetups
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const Comment = require('../models/Comment');
const ChatMessage = require('../models/ChatMessage');
const RSVP = require('../models/RSVP');
const Meetup = require('../models/Meetup');
const Guestbook = require('../models/Guestbook');

// Rate limiters
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 messages per minute
  message: { error: 'Chat rate limit exceeded' }
});

const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Comment rate limit exceeded' }
});

// ============================================
// COMMENTS - Reddit-style threaded comments
// ============================================

// Get comments for a performance
router.get('/performances/:performanceId/comments', async (req, res) => {
  try {
    const { performanceId } = req.params;
    const { sort = 'top' } = req.query;

    const comments = await Comment.find({
      performanceId,
      isDeleted: false
    })
      .populate('user', 'displayName')
      .lean();

    // Build comment tree
    const commentMap = {};
    const rootComments = [];

    comments.forEach(comment => {
      comment.score = (comment.upvotes?.length || 0) - (comment.downvotes?.length || 0);
      comment.replies = [];
      commentMap[comment._id] = comment;
    });

    comments.forEach(comment => {
      if (comment.parentId && commentMap[comment.parentId]) {
        commentMap[comment.parentId].replies.push(comment);
      } else if (!comment.parentId) {
        rootComments.push(comment);
      }
    });

    // Sort root comments
    if (sort === 'top') {
      rootComments.sort((a, b) => b.score - a.score);
    } else if (sort === 'new') {
      rootComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json({ comments: rootComments });
  } catch (err) {
    console.error('❌ Get comments error:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Create comment (auth required)
router.post('/performances/:performanceId/comments',
  commentLimiter,
  [body('text').trim().isLength({ min: 1, max: 2000 })],
  async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Login required to comment' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { performanceId } = req.params;
      const { text, parentId } = req.body;

      // Verify parent exists if replying
      if (parentId) {
        const parent = await Comment.findById(parentId);
        if (!parent || parent.performanceId !== performanceId) {
          return res.status(400).json({ error: 'Invalid parent comment' });
        }
      }

      const comment = new Comment({
        performanceId,
        parentId: parentId || null,
        user: req.user.userId,
        text
      });

      await comment.save();
      await comment.populate('user', 'displayName');

      console.log(`💬 New comment on performance ${performanceId}`);
      res.status(201).json({ comment: comment.toObject({ virtuals: true }) });
    } catch (err) {
      console.error('❌ Create comment error:', err);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  }
);

// Vote on comment (auth required)
router.post('/comments/:commentId/vote', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required to vote' });
    }

    const { commentId } = req.params;
    const { vote } = req.body; // 'up', 'down', or 'none'

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const userId = req.user.userId;

    // Remove existing votes
    comment.upvotes = comment.upvotes.filter(id => id.toString() !== userId);
    comment.downvotes = comment.downvotes.filter(id => id.toString() !== userId);

    // Add new vote
    if (vote === 'up') {
      comment.upvotes.push(userId);
    } else if (vote === 'down') {
      comment.downvotes.push(userId);
    }

    await comment.save();
    res.json({ score: comment.score });
  } catch (err) {
    console.error('❌ Vote error:', err);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// Edit comment (auth required, owner only)
router.put('/comments/:commentId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required' });
    }

    const { commentId } = req.params;
    const { text } = req.body;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.user.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    comment.text = text;
    comment.isEdited = true;
    await comment.save();

    res.json({ comment: comment.toObject({ virtuals: true }) });
  } catch (err) {
    console.error('❌ Edit comment error:', err);
    res.status(500).json({ error: 'Failed to edit comment' });
  }
});

// Delete comment (auth required, owner only)
router.delete('/comments/:commentId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required' });
    }

    const { commentId } = req.params;
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.user.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    comment.isDeleted = true;
    comment.text = '[deleted]';
    await comment.save();

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Delete comment error:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ============================================
// CHAT - Real-time chat (persists forever)
// ============================================

// Get chat messages for a performance
router.get('/performances/:performanceId/chat', async (req, res) => {
  try {
    const { performanceId } = req.params;
    const { limit = 100, before } = req.query;

    const query = { performanceId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await ChatMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('user', 'displayName')
      .lean();

    // Return in chronological order
    res.json({ messages: messages.reverse() });
  } catch (err) {
    console.error('❌ Get chat error:', err);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

// Post chat message (anonymous allowed)
router.post('/performances/:performanceId/chat',
  chatLimiter,
  [body('text').trim().isLength({ min: 1, max: 500 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { performanceId } = req.params;
      const { text, displayName, anonymousId } = req.body;

      const message = new ChatMessage({
        performanceId,
        user: req.user?.userId || null,
        anonymousId: req.user ? null : anonymousId,
        displayName: req.user ? null : (displayName || 'Anonymous'),
        text
      });

      // If user is logged in, get their display name
      if (req.user) {
        const User = require('../models/User');
        const user = await User.findById(req.user.userId);
        message.displayName = user?.displayName || 'User';
      }

      await message.save();
      await message.populate('user', 'displayName');

      const messageObj = message.toObject();

      // Emit via Socket.io if available
      if (req.app.get('io')) {
        req.app.get('io').to(`chat-${performanceId}`).emit('chat-message', messageObj);
      }

      res.status(201).json({ message: messageObj });
    } catch (err) {
      console.error('❌ Post chat error:', err);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// ============================================
// GUESTBOOK - Simple signatures
// ============================================

// Get guestbook signatures for a performance
router.get('/performances/:performanceId/guestbook', async (req, res) => {
  try {
    const { performanceId } = req.params;

    const signatures = await Guestbook.find({ performanceId })
      .sort({ createdAt: -1 })
      .populate('user', 'displayName')
      .lean();

    res.json({
      signatures: signatures.map(s => ({
        _id: s._id,
        displayName: s.isAnonymous ? s.displayName : (s.user?.displayName || s.displayName),
        message: s.message,
        createdAt: s.createdAt,
        isAnonymous: s.isAnonymous,
        user: s.isAnonymous ? null : s.user
      }))
    });
  } catch (err) {
    console.error('❌ Get guestbook error:', err);
    res.status(500).json({ error: 'Failed to fetch guestbook' });
  }
});

// Sign guestbook (anonymous allowed)
router.post('/performances/:performanceId/guestbook',
  [body('message').optional().trim().isLength({ max: 280 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { performanceId } = req.params;
      const { displayName, message, isAnonymous } = req.body;

      // Get display name
      let finalDisplayName = displayName || 'Anonymous Fan';
      if (req.user && !isAnonymous) {
        const User = require('../models/User');
        const user = await User.findById(req.user.userId);
        finalDisplayName = user?.displayName || 'Fan';
      }

      const signature = new Guestbook({
        performanceId,
        user: (req.user && !isAnonymous) ? req.user.userId : null,
        displayName: finalDisplayName,
        message: message || null,
        isAnonymous: isAnonymous || !req.user
      });

      await signature.save();

      console.log(`✍️ New guestbook signature for performance ${performanceId}`);
      res.status(201).json({ signature: signature.toObject() });
    } catch (err) {
      console.error('❌ Sign guestbook error:', err);
      res.status(500).json({ error: 'Failed to sign guestbook' });
    }
  }
);

// ============================================
// RSVP - "I'm going!" list
// ============================================

// Get RSVPs for a performance
router.get('/performances/:performanceId/rsvp', async (req, res) => {
  try {
    const { performanceId } = req.params;

    const rsvps = await RSVP.find({ performanceId })
      .sort({ createdAt: -1 })
      .populate('user', 'displayName')
      .lean();

    res.json({
      count: rsvps.length,
      rsvps: rsvps.map(r => ({
        id: r._id,
        displayName: r.user?.displayName || r.displayName,
        message: r.message,
        createdAt: r.createdAt,
        isAnonymous: !r.user
      }))
    });
  } catch (err) {
    console.error('❌ Get RSVPs error:', err);
    res.status(500).json({ error: 'Failed to fetch RSVPs' });
  }
});

// Add RSVP (anonymous allowed)
router.post('/performances/:performanceId/rsvp', async (req, res) => {
  try {
    const { performanceId } = req.params;
    const { displayName, message, anonymousId } = req.body;

    // Check for existing RSVP
    const existingQuery = req.user
      ? { performanceId, user: req.user.userId }
      : { performanceId, anonymousId };

    const existing = await RSVP.findOne(existingQuery);
    if (existing) {
      return res.status(400).json({ error: 'Already RSVPed to this show' });
    }

    // Get user display name if logged in
    let userDisplayName = displayName || 'Anonymous';
    if (req.user) {
      const User = require('../models/User');
      const user = await User.findById(req.user.userId);
      userDisplayName = user?.displayName || user?.email?.split('@')[0] || 'User';
    }

    const rsvp = new RSVP({
      performanceId,
      user: req.user?.userId || null,
      anonymousId: req.user ? null : anonymousId,
      displayName: userDisplayName,
      message
    });

    await rsvp.save();

    console.log(`🙋 New RSVP for performance ${performanceId}`);
    res.status(201).json({ rsvp });
  } catch (err) {
    console.error('❌ Add RSVP error:', err);
    res.status(500).json({ error: 'Failed to add RSVP' });
  }
});

// Remove RSVP
router.delete('/performances/:performanceId/rsvp', async (req, res) => {
  try {
    const { performanceId } = req.params;
    const { anonymousId } = req.body;

    const query = req.user
      ? { performanceId, user: req.user.userId }
      : { performanceId, anonymousId };

    const result = await RSVP.deleteOne(query);

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'RSVP not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Remove RSVP error:', err);
    res.status(500).json({ error: 'Failed to remove RSVP' });
  }
});

// ============================================
// MEETUPS - Pre-show coordination
// ============================================

// Get meetups for a performance
router.get('/performances/:performanceId/meetups', async (req, res) => {
  try {
    const { performanceId } = req.params;
    const { type } = req.query;

    const query = { performanceId, isCancelled: false };
    if (type) query.type = type;

    const meetups = await Meetup.find(query)
      .sort({ time: 1, createdAt: -1 })
      .populate('user', 'displayName')
      .populate('participants.user', 'displayName')
      .populate('replies.user', 'displayName')
      .lean();

    res.json({ meetups });
  } catch (err) {
    console.error('❌ Get meetups error:', err);
    res.status(500).json({ error: 'Failed to fetch meetups' });
  }
});

// Create meetup (auth required)
router.post('/performances/:performanceId/meetups',
  [
    body('title').trim().isLength({ min: 1, max: 100 }),
    body('type').isIn(['meetup', 'carpool', 'hotel', 'food', 'other'])
  ],
  async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Login required to create meetups' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { performanceId } = req.params;
      const { type, title, description, location, time, maxParticipants } = req.body;

      const meetup = new Meetup({
        performanceId,
        user: req.user.userId,
        type,
        title,
        description,
        location,
        time: time ? new Date(time) : null,
        maxParticipants,
        participants: [{ user: req.user.userId }] // Creator auto-joins
      });

      await meetup.save();
      await meetup.populate('user', 'displayName');
      await meetup.populate('participants.user', 'displayName');

      console.log(`📍 New ${type} meetup for performance ${performanceId}`);
      res.status(201).json({ meetup: meetup.toObject({ virtuals: true }) });
    } catch (err) {
      console.error('❌ Create meetup error:', err);
      res.status(500).json({ error: 'Failed to create meetup' });
    }
  }
);

// Update meetup (auth required, owner only)
router.put('/meetups/:meetupId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required' });
    }

    const { meetupId } = req.params;
    const meetup = await Meetup.findById(meetupId);

    if (!meetup) {
      return res.status(404).json({ error: 'Meetup not found' });
    }

    if (meetup.user.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { title, description, location, time, maxParticipants } = req.body;

    if (title) meetup.title = title;
    if (description !== undefined) meetup.description = description;
    if (location !== undefined) meetup.location = location;
    if (time !== undefined) meetup.time = time ? new Date(time) : null;
    if (maxParticipants !== undefined) meetup.maxParticipants = maxParticipants;

    await meetup.save();
    await meetup.populate('user', 'displayName');
    await meetup.populate('participants.user', 'displayName');

    res.json({ meetup: meetup.toObject({ virtuals: true }) });
  } catch (err) {
    console.error('❌ Update meetup error:', err);
    res.status(500).json({ error: 'Failed to update meetup' });
  }
});

// Delete/cancel meetup (auth required, owner only)
router.delete('/meetups/:meetupId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required' });
    }

    const { meetupId } = req.params;
    const meetup = await Meetup.findById(meetupId);

    if (!meetup) {
      return res.status(404).json({ error: 'Meetup not found' });
    }

    if (meetup.user.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    meetup.isCancelled = true;
    await meetup.save();

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Delete meetup error:', err);
    res.status(500).json({ error: 'Failed to delete meetup' });
  }
});

// Join meetup (auth required)
router.post('/meetups/:meetupId/join', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required to join meetups' });
    }

    const { meetupId } = req.params;
    const meetup = await Meetup.findById(meetupId);

    if (!meetup || meetup.isCancelled) {
      return res.status(404).json({ error: 'Meetup not found' });
    }

    // Check if already joined
    const alreadyJoined = meetup.participants.some(
      p => p.user.toString() === req.user.userId
    );
    if (alreadyJoined) {
      return res.status(400).json({ error: 'Already joined this meetup' });
    }

    // Check max participants
    if (meetup.maxParticipants && meetup.participants.length >= meetup.maxParticipants) {
      return res.status(400).json({ error: 'Meetup is full' });
    }

    meetup.participants.push({ user: req.user.userId });
    await meetup.save();
    await meetup.populate('participants.user', 'displayName');

    res.json({ meetup: meetup.toObject({ virtuals: true }) });
  } catch (err) {
    console.error('❌ Join meetup error:', err);
    res.status(500).json({ error: 'Failed to join meetup' });
  }
});

// Leave meetup (auth required)
router.post('/meetups/:meetupId/leave', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required' });
    }

    const { meetupId } = req.params;
    const meetup = await Meetup.findById(meetupId);

    if (!meetup) {
      return res.status(404).json({ error: 'Meetup not found' });
    }

    // Can't leave if you're the organizer
    if (meetup.user.toString() === req.user.userId) {
      return res.status(400).json({ error: 'Organizer cannot leave meetup' });
    }

    meetup.participants = meetup.participants.filter(
      p => p.user.toString() !== req.user.userId
    );
    await meetup.save();

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Leave meetup error:', err);
    res.status(500).json({ error: 'Failed to leave meetup' });
  }
});

// Reply to meetup (auth required)
router.post('/meetups/:meetupId/reply',
  [body('text').trim().isLength({ min: 1, max: 500 })],
  async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Login required' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { meetupId } = req.params;
      const { text } = req.body;

      const meetup = await Meetup.findById(meetupId);
      if (!meetup || meetup.isCancelled) {
        return res.status(404).json({ error: 'Meetup not found' });
      }

      meetup.replies.push({
        user: req.user.userId,
        text
      });

      await meetup.save();
      await meetup.populate('replies.user', 'displayName');

      res.json({ meetup: meetup.toObject({ virtuals: true }) });
    } catch (err) {
      console.error('❌ Reply to meetup error:', err);
      res.status(500).json({ error: 'Failed to add reply' });
    }
  }
);

module.exports = router;
