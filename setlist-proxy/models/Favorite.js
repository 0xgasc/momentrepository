// setlist-proxy/models/Favorite.js
const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  moment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Moment',
    required: true
  },
  collectionRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collection',
    default: null
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

// Unique constraint: user can only favorite a moment once
favoriteSchema.index({ user: 1, moment: 1 }, { unique: true });

// Index for querying user's favorites
favoriteSchema.index({ user: 1, addedAt: -1 });

// Index for querying favorites in a collection
favoriteSchema.index({ user: 1, collectionRef: 1, addedAt: -1 });

module.exports = mongoose.model('Favorite', favoriteSchema);
