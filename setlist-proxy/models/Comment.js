// setlist-proxy/models/Comment.js
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  // Reference to performance (optional - comment can be on performance OR moment)
  performanceId: {
    type: String,
    required: false,
    index: true
  },

  // Reference to moment (optional - comment can be on performance OR moment)
  momentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Moment',
    default: null,
    index: true
  },

  // Threading support
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },

  // Author (required for comments)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Content
  text: {
    type: String,
    required: true,
    maxlength: 2000
  },

  // Voting
  upvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  downvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Metadata
  isEdited: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Virtual for vote score
commentSchema.virtual('score').get(function() {
  return (this.upvotes?.length || 0) - (this.downvotes?.length || 0);
});

// Ensure virtuals are included in JSON
commentSchema.set('toJSON', { virtuals: true });
commentSchema.set('toObject', { virtuals: true });

// Validation: comment must be associated with either a performance OR a moment
commentSchema.pre('save', function(next) {
  if (!this.performanceId && !this.momentId) {
    return next(new Error('Comment must be associated with either a performance or moment'));
  }
  next();
});

// Index for efficient querying
commentSchema.index({ performanceId: 1, createdAt: -1 });
commentSchema.index({ momentId: 1, createdAt: -1 });
commentSchema.index({ parentId: 1 });

module.exports = mongoose.model('Comment', commentSchema);
