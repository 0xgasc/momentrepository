// setlist-proxy/models/Moment.js - UPDATED WITH NFT FIELDS
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
  
  // Rarity Calculation Fields - calculated by server endpoints
  rarityScore: { type: Number, default: 0 }, // Calculated automatically (0-200)
  isFirstMomentForSong: { type: Boolean, default: false }, // First moment uploaded for this song
  songTotalPerformances: { type: Number, default: 0 }, // How many times this song has been performed live
  rarityTier: { 
    type: String, 
    enum: ['legendary', 'epic', 'rare', 'uncommon', 'common'], 
    default: 'common' 
  },
  
  // ✅ EXISTING NFT fields (keep these as they are)
  nftMinted: { type: Boolean, default: false },
  nftTokenId: { type: String }, // Will be set when NFT is minted
  nftContractAddress: { type: String }, // NFT contract address
  nftMetadataHash: { type: String }, // IPFS hash of NFT metadata
  
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

// ✅ NEW INDEXES for NFT features (add these)
momentSchema.index({ nftContractAddress: 1 }); // Find moments by contract
momentSchema.index({ nftMintEndTime: 1 }); // Find active minting windows
momentSchema.index({ nftMintedCount: -1 }); // Sort by popularity
momentSchema.index({ nftSplitsContract: 1 }); // Find by splits contract

// Virtual for getting full venue name
momentSchema.virtual('fullVenueName').get(function() {
  return `${this.venueName}, ${this.venueCity}${this.venueCountry ? ', ' + this.venueCountry : ''}`;
});

// Virtual for rarity display
momentSchema.virtual('rarityDisplay').get(function() {
  const tierEmojis = {
    legendary: '🌟',
    epic: '💎',
    rare: '🔥',
    uncommon: '⭐',
    common: '📀'
  };
  
  return {
    emoji: tierEmojis[this.rarityTier] || '📀',
    tier: this.rarityTier,
    score: this.rarityScore,
    percentage: Math.round((this.rarityScore / 200) * 100)
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

// Method to generate NFT metadata (updated with rarity)
momentSchema.methods.generateNFTMetadata = function() {
  const rarityDisplay = this.rarityDisplay;
  
  return {
    name: `${this.songName} - ${this.venueName} (${this.performanceDate})`,
    description: this.momentDescription || `A ${rarityDisplay.tier} moment from ${this.songName} performed at ${this.venueName} on ${this.performanceDate}`,
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
      },
      // Rarity attributes
      {
        trait_type: "Rarity Tier",
        value: this.rarityTier
      },
      {
        trait_type: "Rarity Score",
        value: this.rarityScore,
        display_type: "number",
        max_value: 200
      },
      {
        trait_type: "Song Total Performances",
        value: this.songTotalPerformances,
        display_type: "number"
      },
      {
        trait_type: "First Moment for Song",
        value: this.isFirstMomentForSong ? "Yes" : "No"
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
      creator: this.user,
      performance_id: this.performanceId,
      moment_id: this._id,
      created_at: this.createdAt,
      personal_note: this.personalNote,
      crowd_reaction: this.crowdReaction,
      special_occasion: this.specialOccasion,
      guest_appearances: this.guestAppearances,
      unique_elements: this.uniqueElements,
      rarity_score: this.rarityScore,
      rarity_tier: this.rarityTier,
      is_first_moment: this.isFirstMomentForSong,
      // ✅ NEW: NFT edition properties
      nft_contract: this.nftContractAddress,
      splits_contract: this.nftSplitsContract,
      mint_count: this.nftMintedCount,
      is_minting_active: this.isMintingActive
    }
  };
};

module.exports = mongoose.model('Moment', momentSchema);