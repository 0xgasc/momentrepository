// setlist-proxy/models/Moment.js - FIXED WITH CONTENT TYPE FIELD
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
  thumbnailUrl: { type: String }, // Custom thumbnail/cover art URL
  fileName: { type: String }, // Original filename
  fileSize: { type: Number }, // File size in bytes
  duration: { type: Number }, // Duration in seconds (for video/audio)

  // YouTube/External Video Support (UMOTube)
  mediaSource: {
    type: String,
    enum: ['upload', 'youtube', 'vimeo', 'soundcloud', 'archive'],
    default: 'upload'
  },
  externalVideoId: { type: String }, // YouTube video ID
  startTime: { type: Number, default: 0 }, // Clip start timestamp (seconds)
  endTime: { type: Number }, // Clip end timestamp (seconds)
  showInMoments: { type: Boolean, default: true }, // Hide from main feed if false

  // View Tracking
  viewCount: { type: Number, default: 0 },
  uniqueViews: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ipHash: { type: String },
    viewedAt: { type: Date, default: Date.now }
  }],

  // Audio-Specific Metadata
  sourceType: {
    type: String,
    enum: ['soundboard', 'audience', 'matrix', 'unknown'],
    default: 'unknown'
  },
  taperNotes: { type: String },
  recordingDevice: { type: String },
  coverageType: { type: String, enum: ['full', 'clip'], default: 'full' },

  // Timestamp Comments (for audio waveform)
  timestampComments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String, maxlength: 500 },
    timestamp: { type: Number }, // seconds into audio
    createdAt: { type: Date, default: Date.now }
  }],

  // ✅ CRITICAL FIX: Added contentType field
  contentType: {
    type: String,
    enum: ['song', 'intro', 'outro', 'jam', 'crowd', 'other', 'full-show'],
    default: 'song'
  },
  
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
  
  // Rarity Calculation Fields - calculated by server endpoints
  rarityScore: { type: Number, default: 0 }, // Calculated automatically (0-200)
  isFirstMomentForSong: { type: Boolean, default: false }, // First moment uploaded for this song
  songTotalPerformances: { type: Number, default: 0 }, // How many times this song has been performed live
 rarityTier: { 
  type: String, 
  enum: ['legendary', 'mythic', 'epic', 'rare', 'uncommon', 'common', 'basic'], 
  default: 'basic' 
},
  
  // ✅ EXISTING NFT fields (keep these as they are)
  nftMinted: { type: Boolean, default: false },
  nftTokenId: { type: Number }, // ✅ CHANGED: Now numeric instead of string
  nftContractAddress: { type: String },
  nftMetadataHash: { type: String },
  
  // ✅ NEW NFT EDITION FIELDS (add these)
  nftSplitsContract: { type: String }, // 0xSplits contract address for revenue sharing
  nftMintPrice: { type: String }, // Price in wei as string (e.g., "1000000000000000" for 0.001 ETH)
  nftMintDuration: { type: Number }, // Duration in seconds (e.g., 604800 for 7 days)
  nftMintStartTime: { type: Date }, // When minting window opened
  nftMintEndTime: { type: Date }, // When minting window closes
  nftCreationTxHash: { type: String }, // Transaction hash of NFT edition creation
  nftMintedCount: { type: Number, default: 0 }, // How many have been minted by collectors
  nftMintHistory: [{ // Track individual mints
    minter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    minterAddress: { type: String }, // Wallet address that minted
    quantity: { type: Number }, // How many they minted
    txHash: { type: String }, // Transaction hash of the mint
    mintedAt: { type: Date, default: Date.now }
  }],
  nftCardUrl: { type: String }, // Generated NFT card image URL
  
  // ✅ NEW: Moderation system
  approvalStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'needs_revision'], 
    default: 'pending' 
  },
  reviewedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  },
  reviewedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null },
  moderatorChanges: { type: String, default: null }, // If mod suggests changes
  userApprovedChanges: { type: Boolean, default: false }, // User approves mod changes
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field on save
momentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// ✅ EXISTING INDEXES (keep these)
momentSchema.index({ performanceId: 1, songName: 1 });
momentSchema.index({ user: 1 });
momentSchema.index({ performanceDate: -1 });
momentSchema.index({ nftMinted: 1 });
momentSchema.index({ momentType: 1 });
momentSchema.index({ audioQuality: 1, videoQuality: 1 });
momentSchema.index({ rarityScore: -1 }); // Index for rarity queries
momentSchema.index({ rarityTier: 1 }); // Index for tier queries
momentSchema.index({ songName: 1, createdAt: 1 }); // For first moment detection

// ✅ CRITICAL FIX: Added contentType index for filtering
momentSchema.index({ contentType: 1 }); // Index for content type filtering
momentSchema.index({ performanceId: 1, contentType: 1 }); // Compound index for performance + content type

// ✅ NEW INDEXES for NFT features (add these)
momentSchema.index({ nftContractAddress: 1 }); // Find moments by contract
momentSchema.index({ nftMintEndTime: 1 }); // Find active minting windows
momentSchema.index({ nftMintedCount: -1 }); // Sort by popularity
momentSchema.index({ nftSplitsContract: 1 }); // Find by splits contract

// ✅ NEW INDEXES for moderation system
momentSchema.index({ approvalStatus: 1 }); // Find by approval status
momentSchema.index({ reviewedBy: 1 }); // Find by reviewer
momentSchema.index({ approvalStatus: 1, createdAt: -1 }); // Pending moments sorted by date
momentSchema.index({ user: 1, approvalStatus: 1 }); // User's moments by status

// ✅ NEW INDEXES for UMOTube, view tracking, and audio features
momentSchema.index({ mediaSource: 1 }); // UMOTube queries
momentSchema.index({ showInMoments: 1 }); // Filter visibility
momentSchema.index({ viewCount: -1 }); // Popular moments
momentSchema.index({ mediaSource: 1, approvalStatus: 1 }); // UMOTube approved videos

// Virtual for getting full venue name
momentSchema.virtual('fullVenueName').get(function() {
  return `${this.venueName}, ${this.venueCity}${this.venueCountry ? ', ' + this.venueCountry : ''}`;
});

// Virtual for rarity display

// Replace the existing rarityDisplay virtual in Moment.js with this:
momentSchema.virtual('rarityDisplay').get(function() {
  const tierEmojis = {
    legendary: '🌟',
    mythic: '🔮', 
    epic: '💎',
    rare: '🔥',
    uncommon: '⭐',
    common: '📀',
    basic: '⚪'
  };
  
  const tierColors = {
    legendary: '#FFD700',
    mythic: '#8B5CF6',
    epic: '#9B59B6', 
    rare: '#E74C3C',
    uncommon: '#3498DB',
    common: '#95A5A6',
    basic: '#BDC3C7'
  };
  
  return {
    emoji: tierEmojis[this.rarityTier] || '⚪',
    tier: this.rarityTier,
    score: this.rarityScore,
    percentage: Math.round((this.rarityScore / 7.0) * 100),
    color: tierColors[this.rarityTier] || '#BDC3C7',
    maxScore: 7.0
  };
});


// ✅ NEW VIRTUAL: Check if NFT edition exists
momentSchema.virtual('hasNFTEdition').get(function() {
  return !!(this.nftContractAddress && this.nftTokenId);
});

// ✅ NEW VIRTUAL: Check if minting is currently active
momentSchema.virtual('isMintingActive').get(function() {
  if (!this.hasNFTEdition) return false;
  if (!this.nftMintEndTime) return false;
  return new Date() < new Date(this.nftMintEndTime);
});

// ✅ NEW VIRTUAL: Time remaining for minting
momentSchema.virtual('mintingTimeRemaining').get(function() {
  if (!this.isMintingActive) return 0;
  const now = new Date();
  const endTime = new Date(this.nftMintEndTime);
  return Math.max(0, endTime - now); // milliseconds remaining
});

// ✅ UPDATED: Content type virtual for display
momentSchema.virtual('contentTypeDisplay').get(function() {
  const typeInfo = {
    song: { emoji: '🎵', label: 'Song Performance' },
    intro: { emoji: '🎭', label: 'Intro' },
    outro: { emoji: '🎬', label: 'Outro' },
    jam: { emoji: '🎸', label: 'Jam/Improv' },
    crowd: { emoji: '👥', label: 'Crowd Moment' },
    other: { emoji: '🎪', label: 'Other Content' }
  };
  
  return typeInfo[this.contentType || 'song'] || typeInfo.other;
});

// Method to generate NFT metadata (updated with content type)
momentSchema.methods.generateNFTMetadata = function() {
  const rarityDisplay = this.rarityDisplay;
  const contentDisplay = this.contentTypeDisplay;
  
  // Format upload timestamp for provenance
  const uploadTimestamp = this.createdAt.toISOString();
  const uploadDate = this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long', 
    day: 'numeric',
    timeZone: 'UTC'
  });
  const uploadTime = this.createdAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC'
  });
  
  return {
    name: `${this.songName} - ${this.venueName} (${this.performanceDate})`,
    description: this.momentDescription || `A ${rarityDisplay.tier} ${contentDisplay.label.toLowerCase()} from ${this.songName} at ${this.venueName} on ${this.performanceDate}. Originally uploaded on ${uploadDate} at ${uploadTime} UTC.`,
    image: this.mediaUrl,
    external_url: this.mediaUrl,
    attributes: [
      // ✅ PROMINENT: Upload provenance attributes first
      {
        trait_type: "Upload Date",
        value: uploadDate
      },
      {
        trait_type: "Upload Time (UTC)",
        value: uploadTime
      },
      {
        trait_type: "Upload Timestamp",
        value: uploadTimestamp,
        display_type: "date"
      },
      {
        trait_type: "Uploader",
        value: this.user?.displayName || "Anonymous"
      },
      
      // Content identification
      {
        trait_type: "Content Type",
        value: contentDisplay.label
      },
      {
        trait_type: "Song/Content Name",
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
      
      // Media details
      {
        trait_type: "Media Type",
        value: this.mediaType
      },
      {
        trait_type: "File Size (MB)",
        value: Math.round((this.fileSize || 0) / 1024 / 1024),
        display_type: "number"
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
      
      // ✅ SIMPLIFIED: Rarity attributes (3-factor system)
      {
        trait_type: "Rarity Tier",
        value: this.rarityTier
      },
      {
        trait_type: "Rarity Score",
        value: this.rarityScore,
        display_type: "number",
        max_value: 6
      },
      {
        trait_type: "Song Total Performances",
        value: this.songTotalPerformances,
        display_type: "number"
      },
      
      // ✅ NEW: NFT Edition attributes
      {
        trait_type: "Edition Size",
        value: this.nftMintedCount || 0,
        display_type: "number"
      },
      {
        trait_type: "Mint Price (ETH)",
        value: this.nftMintPrice ? parseFloat(this.nftMintPrice) / 1e18 : 0,
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
      // ✅ ENHANCED: Provenance properties
      creator: this.user,
      creator_name: this.user?.displayName || "Anonymous",
      upload_timestamp_iso: uploadTimestamp,
      upload_timestamp_unix: Math.floor(this.createdAt.getTime() / 1000),
      
      // Content identification
      performance_id: this.performanceId,
      moment_id: this._id,
      content_type: this.contentType,
      
      // ✅ SIMPLIFIED: Only the 6 metadata fields we use for rarity
      moment_description: this.momentDescription,
      emotional_tags: this.emotionalTags,
      special_occasion: this.specialOccasion,
      instruments: this.instruments,
      crowd_reaction: this.crowdReaction,
      unique_elements: this.uniqueElements,
      
      // Rarity data
      rarity_score: this.rarityScore,
      rarity_tier: this.rarityTier,
      
      // ✅ NEW: NFT edition properties
      nft_contract: this.nftContractAddress,
      splits_contract: this.nftSplitsContract,
      mint_count: this.nftMintedCount,
      is_minting_active: this.isMintingActive,
      
      // ✅ PROVENANCE: File integrity data
      original_filename: this.fileName,
      file_size_bytes: this.fileSize,
      media_url: this.mediaUrl,
      
      // Platform info
      platform: "UMO Archive",
      platform_version: "1.0",
      blockchain: "Ethereum",
      standard: "ERC-1155"
    }
  };
};

// ✅ ALSO ADD: Method to verify upload authenticity
momentSchema.methods.getProvenanceData = function() {
  return {
    uploader: {
      id: this.user._id || this.user,
      name: this.user?.displayName || "Anonymous",
      email: this.user?.email || null
    },
    upload: {
      timestamp: this.createdAt.toISOString(),
      unix_timestamp: Math.floor(this.createdAt.getTime() / 1000),
      date_formatted: this.createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric',
        timeZone: 'UTC'
      }),
      time_formatted: this.createdAt.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC'
      })
    },
    content: {
      id: this._id,
      performance_id: this.performanceId,
      song_name: this.songName,
      venue: this.venueName,
      city: this.venueCity,
      performance_date: this.performanceDate,
      content_type: this.contentType
    },
    file: {
      original_name: this.fileName,
      size_bytes: this.fileSize,
      size_mb: Math.round((this.fileSize || 0) / 1024 / 1024),
      media_type: this.mediaType,
      storage_url: this.mediaUrl
    },
    blockchain: {
      nft_minted: this.nftMinted,
      contract_address: this.nftContractAddress,
      token_id: this.nftTokenId,
      creation_tx: this.nftCreationTxHash
    }
  };
};


module.exports = mongoose.model('Moment', momentSchema);