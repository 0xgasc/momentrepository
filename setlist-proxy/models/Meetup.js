// setlist-proxy/models/Meetup.js
const mongoose = require('mongoose');

const meetupReplySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 500
  },
  createdAt: { type: Date, default: Date.now }
});

const meetupParticipantSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  joinedAt: { type: Date, default: Date.now }
});

const meetupSchema = new mongoose.Schema({
  // Reference to performance
  performanceId: {
    type: String,
    required: true,
    index: true
  },

  // Organizer (required - login required for meetups)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Meetup type
  type: {
    type: String,
    enum: ['meetup', 'carpool', 'hotel', 'food', 'other'],
    default: 'meetup'
  },

  // Details
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 1000
  },
  location: {
    type: String,
    maxlength: 200
  },
  time: { type: Date },

  // Participants
  participants: [meetupParticipantSchema],
  maxParticipants: { type: Number },

  // Discussion
  replies: [meetupReplySchema],

  // Status
  isCancelled: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Virtual for participant count
meetupSchema.virtual('participantCount').get(function() {
  return this.participants?.length || 0;
});

// Virtual for spots remaining
meetupSchema.virtual('spotsRemaining').get(function() {
  if (!this.maxParticipants) return null;
  return Math.max(0, this.maxParticipants - (this.participants?.length || 0));
});

// Ensure virtuals are included
meetupSchema.set('toJSON', { virtuals: true });
meetupSchema.set('toObject', { virtuals: true });

// Index for efficient querying
meetupSchema.index({ performanceId: 1, createdAt: -1 });
meetupSchema.index({ performanceId: 1, type: 1 });

module.exports = mongoose.model('Meetup', meetupSchema);
