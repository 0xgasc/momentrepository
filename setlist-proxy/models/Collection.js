// setlist-proxy/models/Collection.js
const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true
  },
  description: {
    type: String,
    maxlength: 500,
    default: ''
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  momentCount: {
    type: Number,
    default: 0
  },
  coverMoment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Moment',
    default: null
  }
}, {
  timestamps: true
});

// Index for querying user's collections
collectionSchema.index({ user: 1, createdAt: -1 });

// Index for public collections
collectionSchema.index({ isPublic: 1, momentCount: -1 });

module.exports = mongoose.model('Collection', collectionSchema);
