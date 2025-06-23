const mongoose = require('mongoose');

const momentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Performance details
  performanceId: { type: String, required: true },
  performanceDate: { type: String, required: true }, // e.g., "2024-01-15"
  
  // Venue details
  venueName: { type: String, required: true },
  venueCity: { type: String, required: true },
  venueCountry: { type: String },
  
  // Song details
  songName: { type: String, required: true },
  setName: { type: String }, // e.g., "Encore", "Set 1", etc.
  songPosition: { type: Number }, // Position in the set
  
  // Media
  mediaUrl: { type: String, required: true }, // Arweave/IPFS link
  mediaType: { type: String }, // 'video', 'audio', 'image'
  fileName: { type: String }, // Original filename
  fileSize: { type: Number }, // File size in bytes
  
  // Enhanced metadata for NFT
  personalNote: { type: String }, // User's personal thoughts
  momentDescription: { type: String }, // What happens in the moment
  emotionalTags: { type: String }, // Tags like "energetic, emotional, epic"
  specialOccasion: { type: String }, // "Birthday show, last song, encore"
  audioQuality: { type: String, enum: ['excellent', 'good', 'fair', 'poor'], default: 'good' },
  videoQuality: { type: String, enum: ['excellent', 'good', 'fair', 'poor'], default: 'good' },
  momentType: { 
    type: String, 
    enum: ['performance', 'crowd', 'backstage', 'arrival', 'interaction'], 
    default: 'performance' 
  },
  instruments: { type: String }, // "guitar solo, drum break, piano"
  guestAppearances: { type: String }, // Any special guests
  crowdReaction: { type: String }, // Description of crowd reaction
  uniqueElements: { type: String }, // Anything special about this moment
  
  // NFT preparation fields
  nftMinted: { type: Boolean, default: false },
  nftTokenId: { type: String }, // Will be set when NFT is minted
  nftContractAddress: { type: String }, // NFT contract address
  nftMetadataHash: { type: String }, // IPFS hash of NFT metadata
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field on save
momentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
momentSchema.index({ performanceId: 1, songName: 1 });
momentSchema.index({ user: 1 });
momentSchema.index({ performanceDate: -1 });
momentSchema.index({ nftMinted: 1 });
momentSchema.index({ momentType: 1 });
momentSchema.index({ audioQuality: 1, videoQuality: 1 });

// Virtual for getting full venue name
momentSchema.virtual('fullVenueName').get(function() {
  return `${this.venueName}, ${this.venueCity}${this.venueCountry ? ', ' + this.venueCountry : ''}`;
});

// Method to generate NFT metadata
momentSchema.methods.generateNFTMetadata = function() {
  return {
    name: `${this.songName} - ${this.venueName} (${this.performanceDate})`,
    description: this.momentDescription || `A moment from ${this.songName} performed at ${this.venueName} on ${this.performanceDate}`,
    image: this.mediaUrl,
    external_url: this.mediaUrl,
    attributes: [
      {
        trait_type: "Song",
        value: this.songName
      },
      {
        trait_type: "Venue",
        value: this.venueName
      },
      {
        trait_type: "City",
        value: this.venueCity
      },
      {
        trait_type: "Country",
        value: this.venueCountry || "Unknown"
      },
      {
        trait_type: "Performance Date",
        value: this.performanceDate
      },
      {
        trait_type: "Set",
        value: this.setName || "Main Set"
      },
      {
        trait_type: "Song Position",
        value: this.songPosition || 0,
        display_type: "number"
      },
      {
        trait_type: "Media Type",
        value: this.mediaType
      },
      {
        trait_type: "Audio Quality",
        value: this.audioQuality
      },
      {
        trait_type: "Video Quality", 
        value: this.videoQuality
      },
      {
        trait_type: "Moment Type",
        value: this.momentType
      },
      {
        trait_type: "File Size (MB)",
        value: Math.round((this.fileSize || 0) / 1024 / 1024),
        display_type: "number"
      }
    ].concat(
      // Add emotional tags as separate attributes if they exist
      this.emotionalTags ? this.emotionalTags.split(',').map(tag => ({
        trait_type: "Emotion",
        value: tag.trim()
      })) : []
    ).concat(
      // Add instruments as separate attributes if they exist
      this.instruments ? this.instruments.split(',').map(instrument => ({
        trait_type: "Instrument",
        value: instrument.trim()
      })) : []
    ).filter(attr => attr.value), // Remove empty attributes
    properties: {
      creator: this.user,
      performance_id: this.performanceId,
      moment_id: this._id,
      created_at: this.createdAt,
      personal_note: this.personalNote,
      crowd_reaction: this.crowdReaction,
      special_occasion: this.specialOccasion,
      guest_appearances: this.guestAppearances,
      unique_elements: this.uniqueElements
    }
  };
};

module.exports = mongoose.model('Moment', momentSchema);