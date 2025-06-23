const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  filename: String,
  cid: String, // IPFS or Arweave hash
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Media', mediaSchema);
