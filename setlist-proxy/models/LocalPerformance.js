// setlist-proxy/models/LocalPerformance.js
// Model for shows not on setlist.fm (e.g., older archive.org recordings)
const mongoose = require('mongoose');

const localPerformanceSchema = new mongoose.Schema({
  // Use prefix 'local_' + ObjectId to distinguish from setlist.fm IDs
  performanceId: {
    type: String,
    unique: true,
    required: true,
    validate: {
      validator: function(v) {
        return v.startsWith('local_');
      },
      message: 'performanceId must start with "local_"'
    }
  },

  // Event date in YYYY-MM-DD format
  eventDate: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
        const [year, month, day] = v.split('-').map(Number);
        const d = new Date(v);
        return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
      },
      message: 'eventDate must be a valid calendar date in YYYY-MM-DD format'
    }
  },

  // Venue information
  venue: {
    name: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String },
    country: { type: String, default: 'United States' }
  },

  // Setlist (optional - can be populated from archive filenames)
  sets: [{
    name: { type: String, default: 'Main Set' },
    songs: [{
      name: { type: String, required: true },
      position: { type: Number }
    }]
  }],

  // Source information
  archiveOrgId: { type: String },  // If imported from archive.org
  archiveOrgUrl: { type: String }, // Full URL to archive.org item
  notes: { type: String },

  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isVerified: { type: Boolean, default: false }
});

// Update the updatedAt field on save
localPerformanceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Generate unique performanceId before validation
localPerformanceSchema.pre('validate', function(next) {
  if (!this.performanceId) {
    this.performanceId = 'local_' + new mongoose.Types.ObjectId().toString();
  }
  next();
});

// Indexes
localPerformanceSchema.index({ performanceId: 1 });
localPerformanceSchema.index({ eventDate: -1 });
localPerformanceSchema.index({ 'venue.name': 'text', 'venue.city': 'text' });
localPerformanceSchema.index({ archiveOrgId: 1 });
localPerformanceSchema.index({ createdBy: 1 });

// Virtual for formatted date display (setlist.fm style DD-MM-YYYY)
localPerformanceSchema.virtual('eventDateFormatted').get(function() {
  const parts = this.eventDate.split('-');
  return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY
});

// Virtual for full venue string
localPerformanceSchema.virtual('fullVenueName').get(function() {
  const parts = [this.venue.name, this.venue.city];
  if (this.venue.state) parts.push(this.venue.state);
  if (this.venue.country) parts.push(this.venue.country);
  return parts.join(', ');
});

// Method to transform to setlist.fm-like structure for API compatibility
localPerformanceSchema.methods.toSetlistFormat = function() {
  return {
    id: this.performanceId,
    eventDate: this.eventDateFormatted,
    venue: {
      name: this.venue.name,
      city: {
        name: this.venue.city,
        state: this.venue.state,
        stateCode: this.venue.state,
        country: {
          name: this.venue.country
        }
      }
    },
    sets: {
      set: this.sets.map(s => ({
        name: s.name,
        song: s.songs.map(song => ({
          name: song.name
        }))
      }))
    },
    _isLocal: true // Flag to identify local performances
  };
};

module.exports = mongoose.model('LocalPerformance', localPerformanceSchema);
