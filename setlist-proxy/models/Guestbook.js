// setlist-proxy/models/Guestbook.js
const mongoose = require('mongoose');

const guestbookSchema = new mongoose.Schema({
  // Reference to performance
  performanceId: {
    type: String,
    required: true,
    index: true
  },

  // User (optional - anonymous allowed)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Display name (for both logged-in and anonymous)
  displayName: {
    type: String,
    required: true,
    maxlength: 50
  },

  // Optional message
  message: {
    type: String,
    maxlength: 280
  },

  // Whether this was signed anonymously
  isAnonymous: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for fetching signatures chronologically
guestbookSchema.index({ performanceId: 1, createdAt: -1 });

module.exports = mongoose.model('Guestbook', guestbookSchema);
