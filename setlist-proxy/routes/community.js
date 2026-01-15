// setlist-proxy/routes/community.js
// Community features: Comments, Chat, RSVP, Meetups
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

// Helper to validate ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const Comment = require('../models/Comment');
const ChatMessage = require('../models/ChatMessage');
const RSVP = require('../models/RSVP');
const Meetup = require('../models/Meetup');
const Guestbook = require('../models/Guestbook');
const Favorite = require('../models/Favorite');
const Collection = require('../models/Collection');
const Contact = require('../models/Contact');
const Moment = require('../models/Moment');
const { filterContent, sanitizeDisplayName } = require('../utils/contentFilter');

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

// Like comment (auth required) - toggle like on/off
router.post('/comments/:commentId/vote', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required to like' });
    }

    const { commentId } = req.params;
    const { vote } = req.body; // 'up' to like, 'none' to unlike

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const userId = req.user.userId;
    const alreadyLiked = comment.upvotes.some(id => id.toString() === userId);

    if (vote === 'up' && !alreadyLiked) {
      // Add like
      comment.upvotes.push(userId);
    } else if (alreadyLiked) {
      // Remove like (toggle off)
      comment.upvotes = comment.upvotes.filter(id => id.toString() !== userId);
    }

    await comment.save();
    res.json({ likes: comment.upvotes.length, liked: comment.upvotes.some(id => id.toString() === userId) });
  } catch (err) {
    console.error('❌ Like error:', err);
    res.status(500).json({ error: 'Failed to like' });
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
// MOMENT COMMENTS - Comments on individual moments
// ============================================

// Get comments for a moment
router.get('/moments/:momentId/comments', async (req, res) => {
  try {
    const { momentId } = req.params;
    const { sort = 'top' } = req.query;

    const comments = await Comment.find({
      momentId,
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

    res.json({ comments: rootComments, count: comments.length });
  } catch (err) {
    console.error('❌ Get moment comments error:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Get comment count for a moment (lightweight for badges)
router.get('/moments/:momentId/comments/count', async (req, res) => {
  try {
    const { momentId } = req.params;
    const count = await Comment.countDocuments({ momentId, isDeleted: false });
    res.json({ count });
  } catch (err) {
    console.error('❌ Get moment comment count error:', err);
    res.status(500).json({ error: 'Failed to get comment count' });
  }
});

// Create comment on moment (auth required)
router.post('/moments/:momentId/comments',
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

      const { momentId } = req.params;
      const { text, parentId } = req.body;

      // Verify parent exists if replying
      if (parentId) {
        const parent = await Comment.findById(parentId);
        if (!parent || parent.momentId?.toString() !== momentId) {
          return res.status(400).json({ error: 'Invalid parent comment' });
        }
      }

      const comment = new Comment({
        momentId,
        parentId: parentId || null,
        user: req.user.userId,
        text
      });

      await comment.save();
      await comment.populate('user', 'displayName');

      console.log(`💬 New comment on moment ${momentId}`);
      res.status(201).json({ comment: comment.toObject({ virtuals: true }) });
    } catch (err) {
      console.error('❌ Create moment comment error:', err);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  }
);

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

      // Content filter - check message text
      const filterResult = filterContent(text);
      if (filterResult.blocked) {
        return res.status(400).json({
          error: filterResult.reason,
          code: 'CONTENT_BLOCKED'
        });
      }

      // Sanitize display name for anonymous users
      let finalDisplayName = displayName || 'Anonymous';
      if (!req.user && displayName) {
        const nameResult = sanitizeDisplayName(displayName);
        if (!nameResult.valid) {
          return res.status(400).json({
            error: nameResult.reason,
            code: 'NAME_BLOCKED'
          });
        }
        finalDisplayName = nameResult.sanitized;
      }

      const message = new ChatMessage({
        performanceId,
        user: req.user?.userId || null,
        anonymousId: req.user ? null : anonymousId,
        displayName: req.user ? null : finalDisplayName,
        text,
        flagged: filterResult.flagged || false
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

      // Content filter - check message if provided
      if (message) {
        const filterResult = filterContent(message);
        if (filterResult.blocked) {
          return res.status(400).json({
            error: filterResult.reason,
            code: 'CONTENT_BLOCKED'
          });
        }
      }

      // Get and sanitize display name
      let finalDisplayName = displayName || 'Anonymous Fan';
      if (req.user && !isAnonymous) {
        const User = require('../models/User');
        const user = await User.findById(req.user.userId);
        finalDisplayName = user?.displayName || 'Fan';
      } else if (displayName) {
        const nameResult = sanitizeDisplayName(displayName);
        if (!nameResult.valid) {
          return res.status(400).json({
            error: nameResult.reason,
            code: 'NAME_BLOCKED'
          });
        }
        finalDisplayName = nameResult.sanitized;
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

// ============================================
// FAVORITES - Bookmark moments
// ============================================

// Get user's favorites (auth required)
router.get('/favorites', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required' });
    }

    const { collection } = req.query;
    const query = { user: req.user.userId };
    if (collection) query.collectionRef = collection;

    const favorites = await Favorite.find(query)
      .sort({ addedAt: -1 })
      .populate({
        path: 'moment',
        select: 'songName venueName venueCity performanceDate mediaUrl mediaType thumbnailUrl rarityTier duration externalVideoId startTime endTime'
      })
      .lean();

    res.json({
      favorites: favorites.filter(f => f.moment) // Filter out deleted moments
    });
  } catch (err) {
    console.error('❌ Get favorites error:', err.name, err.message);
    console.error('❌ Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    res.status(500).json({ error: 'Failed to fetch favorites', details: err.message });
  }
});

// Check if moment is favorited (auth required)
router.get('/favorites/check/:momentId', async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ isFavorited: false });
    }

    const { momentId } = req.params;

    // Validate ObjectId format
    if (!isValidObjectId(momentId)) {
      return res.json({ isFavorited: false });
    }

    const favorite = await Favorite.findOne({
      user: req.user.userId,
      moment: momentId
    });

    res.json({ isFavorited: !!favorite });
  } catch (err) {
    console.error('❌ Check favorite error:', err.name, err.message);
    res.status(500).json({ error: 'Failed to check favorite' });
  }
});

// Add moment to favorites (auth required)
router.post('/favorites/:momentId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required to favorite' });
    }

    const { momentId } = req.params;
    const { collectionId } = req.body;

    // Validate ObjectId format
    if (!isValidObjectId(momentId)) {
      return res.status(400).json({ error: 'Invalid moment ID format' });
    }

    // Check if already favorited
    const existing = await Favorite.findOne({
      user: req.user.userId,
      moment: momentId
    });

    if (existing) {
      return res.status(400).json({ error: 'Already favorited' });
    }

    const favorite = new Favorite({
      user: req.user.userId,
      moment: momentId,
      collectionRef: collectionId || null
    });

    await favorite.save();

    // Update collection moment count if applicable
    if (collectionId) {
      await Collection.findByIdAndUpdate(collectionId, {
        $inc: { momentCount: 1 }
      });
    }

    console.log(`❤️ User ${req.user.userId} favorited moment ${momentId}`);
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('❌ Add favorite error:', err.name, err.message);
    console.error('❌ Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    res.status(500).json({ error: 'Failed to add favorite', details: err.message });
  }
});

// Remove moment from favorites (auth required)
router.delete('/favorites/:momentId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required' });
    }

    const { momentId } = req.params;

    // Validate ObjectId format
    if (!isValidObjectId(momentId)) {
      return res.status(400).json({ error: 'Invalid moment ID format' });
    }

    const favorite = await Favorite.findOneAndDelete({
      user: req.user.userId,
      moment: momentId
    });

    if (!favorite) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    // Update collection moment count if applicable
    if (favorite.collectionRef) {
      await Collection.findByIdAndUpdate(favorite.collectionRef, {
        $inc: { momentCount: -1 }
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Remove favorite error:', err);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

// ============================================
// COLLECTIONS - Organize favorites
// ============================================

// Get user's collections (auth required)
router.get('/collections', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required' });
    }

    const collections = await Collection.find({ user: req.user.userId })
      .sort({ createdAt: -1 })
      .populate('coverMoment', 'mediaUrl thumbnailUrl')
      .lean();

    res.json({ collections });
  } catch (err) {
    console.error('❌ Get collections error:', err);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// Create collection (auth required)
router.post('/collections',
  [body('name').trim().isLength({ min: 1, max: 100 })],
  async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Login required' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, isPublic } = req.body;

      const collection = new Collection({
        user: req.user.userId,
        name,
        description: description || '',
        isPublic: isPublic || false
      });

      await collection.save();

      console.log(`📁 User ${req.user.userId} created collection: ${name}`);
      res.status(201).json({ collection });
    } catch (err) {
      console.error('❌ Create collection error:', err);
      res.status(500).json({ error: 'Failed to create collection' });
    }
  }
);

// Update collection (auth required, owner only)
router.put('/collections/:collectionId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required' });
    }

    const { collectionId } = req.params;
    const collection = await Collection.findById(collectionId);

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    if (collection.user.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { name, description, isPublic } = req.body;
    if (name) collection.name = name;
    if (description !== undefined) collection.description = description;
    if (isPublic !== undefined) collection.isPublic = isPublic;

    await collection.save();
    res.json({ collection });
  } catch (err) {
    console.error('❌ Update collection error:', err);
    res.status(500).json({ error: 'Failed to update collection' });
  }
});

// Delete collection (auth required, owner only)
router.delete('/collections/:collectionId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required' });
    }

    const { collectionId } = req.params;
    const collection = await Collection.findById(collectionId);

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    if (collection.user.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Remove collection reference from favorites but keep them
    await Favorite.updateMany(
      { collectionRef: collectionId },
      { $set: { collectionRef: null } }
    );

    await Collection.findByIdAndDelete(collectionId);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Delete collection error:', err);
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

// Add moment to collection (auth required)
router.post('/collections/:collectionId/moments/:momentId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required' });
    }

    const { collectionId, momentId } = req.params;

    // Verify collection ownership
    const collection = await Collection.findById(collectionId);
    if (!collection || collection.user.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if moment is already favorited
    let favorite = await Favorite.findOne({
      user: req.user.userId,
      moment: momentId
    });

    if (favorite) {
      // Update existing favorite to add to collection
      const oldCollection = favorite.collectionRef;
      favorite.collectionRef = collectionId;
      await favorite.save();

      // Update counts
      if (oldCollection) {
        await Collection.findByIdAndUpdate(oldCollection, {
          $inc: { momentCount: -1 }
        });
      }
      await Collection.findByIdAndUpdate(collectionId, {
        $inc: { momentCount: 1 }
      });
    } else {
      // Create new favorite in collection
      favorite = new Favorite({
        user: req.user.userId,
        moment: momentId,
        collectionRef: collectionId
      });
      await favorite.save();

      await Collection.findByIdAndUpdate(collectionId, {
        $inc: { momentCount: 1 }
      });
    }

    // Set as cover if first moment
    if (collection.momentCount === 0 || !collection.coverMoment) {
      collection.coverMoment = momentId;
      await collection.save();
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Add to collection error:', err);
    res.status(500).json({ error: 'Failed to add to collection' });
  }
});

// Remove moment from collection (auth required)
router.delete('/collections/:collectionId/moments/:momentId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required' });
    }

    const { collectionId, momentId } = req.params;

    // Verify collection ownership
    const collection = await Collection.findById(collectionId);
    if (!collection || collection.user.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Remove from collection but keep favorite
    const favorite = await Favorite.findOne({
      user: req.user.userId,
      moment: momentId,
      collectionRef: collectionId
    });

    if (favorite) {
      favorite.collectionRef = null;
      await favorite.save();

      await Collection.findByIdAndUpdate(collectionId, {
        $inc: { momentCount: -1 }
      });

      // Update cover if needed
      if (collection.coverMoment?.toString() === momentId) {
        const nextFavorite = await Favorite.findOne({
          user: req.user.userId,
          collectionRef: collectionId
        });
        collection.coverMoment = nextFavorite?.moment || null;
        await collection.save();
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Remove from collection error:', err);
    res.status(500).json({ error: 'Failed to remove from collection' });
  }
});

// ============================================
// PUBLIC COLLECTIONS - Share collections publicly
// ============================================

// Get public collection by ID (no auth required)
router.get('/collections/:collectionId/public', async (req, res) => {
  try {
    const { collectionId } = req.params;

    // Validate ObjectId format
    if (!isValidObjectId(collectionId)) {
      return res.status(400).json({ error: 'Invalid collection ID' });
    }

    // Find collection that is public
    const collection = await Collection.findOne({
      _id: collectionId,
      isPublic: true
    })
      .populate('user', 'displayName')
      .populate('coverMoment', 'mediaUrl thumbnailUrl')
      .lean();

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found or not public' });
    }

    // Get all favorites in this collection with moment data
    const favorites = await Favorite.find({ collectionRef: collectionId })
      .populate({
        path: 'moment',
        select: 'songName venueName venueCity performanceDate mediaUrl mediaType thumbnailUrl rarityTier duration externalVideoId startTime endTime'
      })
      .sort({ addedAt: -1 })
      .lean();

    // Filter out deleted moments and map to just moment data
    const moments = favorites
      .filter(f => f.moment)
      .map(f => f.moment);

    console.log(`📂 Public collection ${collectionId} accessed - ${moments.length} moments`);
    res.json({ collection, moments });
  } catch (err) {
    console.error('❌ Get public collection error:', err);
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
});

// ============================================
// CONTACT FORM
// ============================================

// Rate limiter for contact form
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 submissions per hour
  message: { error: 'Too many contact submissions. Please try again later.' }
});

// Submit contact form (public - no auth required)
router.post('/contact',
  contactLimiter,
  [
    body('name').trim().notEmpty().isLength({ max: 100 }),
    body('email').trim().isEmail().normalizeEmail(),
    body('category').isIn(['general', 'bug', 'feature', 'content', 'other']),
    body('message').trim().notEmpty().isLength({ max: 5000 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid form data', details: errors.array() });
      }

      const { name, email, category, message } = req.body;

      const contact = new Contact({
        name,
        email,
        category,
        message
      });

      await contact.save();
      console.log(`📧 New contact submission from ${email} (${category})`);

      res.status(201).json({ success: true, message: 'Contact submission received' });
    } catch (err) {
      console.error('❌ Contact submission error:', err);
      res.status(500).json({ error: 'Failed to submit contact form' });
    }
  }
);

// Get all contact submissions (admin only)
router.get('/contact', async (req, res) => {
  try {
    // Check for admin auth (passed via middleware in server.js)
    if (!req.user || (req.user.role !== 'admin' && req.user.email !== 'solo@solo.solo')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status, limit = 50, offset = 0 } = req.query;

    const query = {};
    if (status && ['new', 'read', 'resolved'].includes(status)) {
      query.status = status;
    }

    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();

    const total = await Contact.countDocuments(query);
    const newCount = await Contact.countDocuments({ status: 'new' });

    res.json({ contacts, total, newCount });
  } catch (err) {
    console.error('❌ Get contacts error:', err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Update contact status (admin only)
router.put('/contact/:contactId', async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.email !== 'solo@solo.solo')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { contactId } = req.params;
    const { status, adminNotes } = req.body;

    if (!isValidObjectId(contactId)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    const updateData = {};
    if (status && ['new', 'read', 'resolved'].includes(status)) {
      updateData.status = status;
    }
    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }

    const contact = await Contact.findByIdAndUpdate(
      contactId,
      updateData,
      { new: true }
    ).lean();

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    console.log(`📧 Contact ${contactId} updated to status: ${status}`);
    res.json({ contact });
  } catch (err) {
    console.error('❌ Update contact error:', err);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// Delete contact (admin only)
router.delete('/contact/:contactId', async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.email !== 'solo@solo.solo')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { contactId } = req.params;

    if (!isValidObjectId(contactId)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    const contact = await Contact.findByIdAndDelete(contactId);

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    console.log(`📧 Contact ${contactId} deleted`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Delete contact error:', err);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// ============================================
// TOP CONTRIBUTORS - Leaderboard with Badges
// ============================================

// Get top contributors (public)
router.get('/top-contributors', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Aggregate uploads by user, excluding admins
    const contributors = await Moment.aggregate([
      // Only count approved moments
      { $match: { approvalStatus: 'approved' } },
      // Group by user
      {
        $group: {
          _id: '$user',
          uploadCount: { $sum: 1 },
          totalViews: { $sum: '$viewCount' },
          firstCaptures: {
            $sum: { $cond: ['$isFirstMomentForSong', 1, 0] }
          },
          rarityBreakdown: {
            $push: '$rarityTier'
          }
        }
      },
      // Lookup user details
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      // Unwind user info
      { $unwind: '$userInfo' },
      // Filter out admins
      {
        $match: {
          'userInfo.role': { $ne: 'admin' }
        }
      },
      // Project fields
      {
        $project: {
          _id: 1,
          uploadCount: 1,
          totalViews: 1,
          firstCaptures: 1,
          rarityBreakdown: 1,
          displayName: '$userInfo.displayName',
          memberSince: '$userInfo.createdAt',
          role: '$userInfo.role'
        }
      },
      // Sort by upload count
      { $sort: { uploadCount: -1 } },
      // Limit results
      { $limit: parseInt(limit) }
    ]);

    // Add badges to each contributor
    const contributorsWithBadges = contributors.map(c => {
      const badges = [];

      // Upload-based badges
      if (c.uploadCount >= 100) {
        badges.push({ id: 'archive_hero', icon: '🏆', label: 'Archive Hero', color: 'yellow' });
      } else if (c.uploadCount >= 25) {
        badges.push({ id: 'super_contributor', icon: '🌟', label: 'Super Contributor', color: 'purple' });
      } else if (c.uploadCount >= 5) {
        badges.push({ id: 'contributor', icon: '⭐', label: 'Contributor', color: 'blue' });
      } else if (c.uploadCount >= 1) {
        badges.push({ id: 'first_upload', icon: '🎬', label: 'First Upload', color: 'green' });
      }

      // First capture badge (pioneer)
      if (c.firstCaptures >= 10) {
        badges.push({ id: 'pioneer', icon: '🥇', label: 'Pioneer', color: 'orange' });
      }

      // OG Member badge (joined before 2025)
      if (c.memberSince && new Date(c.memberSince) < new Date('2025-01-01')) {
        badges.push({ id: 'og_member', icon: '👴', label: 'OG Member', color: 'gray' });
      }

      // Count rarity tiers
      const rarityCount = {};
      c.rarityBreakdown.forEach(tier => {
        rarityCount[tier] = (rarityCount[tier] || 0) + 1;
      });

      return {
        _id: c._id,
        displayName: c.displayName,
        uploadCount: c.uploadCount,
        totalViews: c.totalViews,
        firstCaptures: c.firstCaptures,
        rarityCount,
        badges,
        memberSince: c.memberSince
      };
    });

    res.json({
      contributors: contributorsWithBadges,
      totalContributors: contributors.length
    });
  } catch (err) {
    console.error('❌ Top contributors error:', err);
    res.status(500).json({ error: 'Failed to fetch top contributors' });
  }
});

module.exports = router;
