// setlist-proxy/models/RSVP.js
const mongoose = require('mongoose');

const rsvpSchema = new mongoose.Schema({
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

  // For anonymous RSVPs
  anonymousId: { type: String },

  // Display name
  displayName: {
    type: String,
    required: true,
    maxlength: 50
  },

  // Optional message
  message: {
    type: String,
    maxlength: 200
  }
}, {
  timestamps: true
});

// Ensure one RSVP per user/anonymous per performance
rsvpSchema.index(
  { performanceId: 1, user: 1 },
  { unique: true, sparse: true }
);
rsvpSchema.index(
  { performanceId: 1, anonymousId: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model('RSVP', rsvpSchema);
