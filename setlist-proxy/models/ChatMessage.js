// setlist-proxy/models/ChatMessage.js
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  // Reference to performance
  performanceId: {
    type: String,
    required: true,
    index: true
  },

  // Author (optional - anonymous allowed)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // For anonymous users
  anonymousId: { type: String },
  displayName: {
    type: String,
    required: true,
    maxlength: 50
  },

  // Message content
  text: {
    type: String,
    required: true,
    maxlength: 500
  },

  // Optional metadata
  isSystemMessage: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Index for efficient querying (newest first, by performance)
chatMessageSchema.index({ performanceId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
