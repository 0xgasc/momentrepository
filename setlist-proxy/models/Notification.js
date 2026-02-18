const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['comment', 'approval', 'rejection', 'needs_revision'],
    required: true
  },
  message: { type: String, required: true },
  relatedMoment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Moment',
    default: null
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  read: { type: Boolean, default: false, index: true }
}, { timestamps: true });

// Compound index for efficient unread count queries
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
