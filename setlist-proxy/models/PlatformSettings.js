// Platform Settings Model - Global configuration for UMO Archive
const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema({
  // Setting identifier (should be unique, only one settings document)
  _id: { type: String, default: 'platform_config' },
  
  // Web3/NFT Layer Settings
  web3Enabled: { 
    type: Boolean, 
    default: true,
    description: 'Enable/disable all Web3 and NFT functionality platform-wide'
  },
  
  // Future settings can be added here
  maintenanceMode: {
    type: Boolean,
    default: false,
    description: 'Put platform in maintenance mode'
  },
  
  uploadsEnabled: {
    type: Boolean,
    default: true,
    description: 'Enable/disable new moment uploads'
  },
  
  maxFileSize: {
    type: Number,
    default: 6442450944, // 6GB in bytes
    description: 'Maximum file upload size in bytes'
  },
  
  // Moderation settings
  autoApprovalEnabled: {
    type: Boolean,
    default: false,
    description: 'Automatically approve all uploads (bypass moderation)'
  },
  
  // Platform metadata
  platformName: {
    type: String,
    default: 'UMO Archive',
    description: 'Platform display name'
  },
  
  platformDescription: {
    type: String,
    default: 'Decentralized concert moment platform for Unknown Mortal Orchestra',
    description: 'Platform description for metadata'
  },
  
  // Admin contact
  adminEmail: {
    type: String,
    default: 'solo@solo.solo',
    description: 'Primary admin email'
  },
  
  // Timestamps
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Update timestamp on save
platformSettingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get current settings (creates default if none exist)
platformSettingsSchema.statics.getCurrentSettings = async function() {
  let settings = await this.findById('platform_config');
  
  if (!settings) {
    // Create default settings
    settings = new this({
      _id: 'platform_config',
      web3Enabled: true,
      maintenanceMode: false,
      uploadsEnabled: true,
      autoApprovalEnabled: false
    });
    await settings.save();
    console.log('📋 Created default platform settings');
  }
  
  return settings;
};

// Static method to update specific setting
platformSettingsSchema.statics.updateSetting = async function(key, value, updatedBy) {
  const settings = await this.getCurrentSettings();
  settings[key] = value;
  settings.updatedBy = updatedBy;
  await settings.save();
  console.log(`⚙️ Platform setting updated: ${key} = ${value}`);
  return settings;
};

// Virtual for Web3 feature list
platformSettingsSchema.virtual('web3Features').get(function() {
  if (!this.web3Enabled) return [];
  
  return [
    'NFT Minting',
    'Wallet Connection',
    'Token Creation',
    'Revenue Sharing',
    'Blockchain Metadata',
    'OpenSea Integration'
  ];
});

// Virtual for settings summary
platformSettingsSchema.virtual('settingsSummary').get(function() {
  return {
    web3Enabled: this.web3Enabled,
    maintenanceMode: this.maintenanceMode,
    uploadsEnabled: this.uploadsEnabled,
    autoApprovalEnabled: this.autoApprovalEnabled,
    lastUpdated: this.updatedAt
  };
});

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);