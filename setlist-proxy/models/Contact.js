// setlist-proxy/models/Contact.js
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxLength: 254
  },
  category: {
    type: String,
    required: true,
    enum: ['general', 'bug', 'feature', 'content', 'other'],
    default: 'general'
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxLength: 5000
  },
  status: {
    type: String,
    enum: ['new', 'read', 'resolved'],
    default: 'new'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field on save
contactSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Contact', contactSchema);
