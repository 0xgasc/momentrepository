// setlist-proxy/models/UpcomingShow.js
// Admin-managed upcoming tour dates
const mongoose = require('mongoose');

const upcomingShowSchema = new mongoose.Schema({
  // Event details
  eventDate: { type: Date, required: true, index: true },

  // Venue info
  venue: {
    name: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String },
    country: { type: String, required: true },
    countryCode: { type: String }
  },

  // Ticket info
  ticketUrl: { type: String },
  ticketStatus: {
    type: String,
    enum: ['available', 'sold_out', 'limited', 'presale', 'tba'],
    default: 'available'
  },

  // Event type
  eventType: {
    type: String,
    enum: ['headlining', 'festival', 'support', 'special'],
    default: 'headlining'
  },
  festivalName: { type: String },

  // Admin notes
  notes: { type: String },

  // Status
  isActive: { type: Boolean, default: true },
  isCancelled: { type: Boolean, default: false },

  // Link to past performance (after show happens)
  linkedPerformanceId: { type: String }
}, {
  timestamps: true
});

// Virtual to check if show is upcoming
upcomingShowSchema.virtual('isUpcoming').get(function() {
  return this.eventDate > new Date();
});

// Virtual for formatted date
upcomingShowSchema.virtual('formattedDate').get(function() {
  return this.eventDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
});

upcomingShowSchema.set('toJSON', { virtuals: true });
upcomingShowSchema.set('toObject', { virtuals: true });

// Index for efficient querying
upcomingShowSchema.index({ eventDate: 1, isActive: 1 });
upcomingShowSchema.index({ 'venue.city': 1 });

module.exports = mongoose.model('UpcomingShow', upcomingShowSchema);
