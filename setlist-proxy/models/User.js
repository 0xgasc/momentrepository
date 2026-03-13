const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  displayName: { type: String },
  passwordHash: { type: String },
  // OAuth authentication fields
  authProvider: {
    type: String,
    enum: ['local', 'google', 'discord'],
    default: 'local'
  },
  oauthId: { type: String, default: null },
  avatarUrl: { type: String, default: null },
  role: {
    type: String,
    enum: ['user', 'mod', 'admin'],
    default: 'user'
  },
  lastActive: { type: Date, default: Date.now },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }, // Track who assigned their role
  roleAssignedAt: { type: Date, default: null },
  // Social links for community connection
  socialLinks: {
    reddit: { type: String, default: '' },
    discord: { type: String, default: '' },
    instagram: { type: String, default: '' },
    twitter: { type: String, default: '' },
    whatsapp: { type: String, default: '' }
  },
  // Optional bio for user profiles
  bio: { type: String, maxlength: 500, default: '' },
  // User preferences (theme settings, etc.)
  preferences: {
    theme: {
      accentColor: { type: String, default: '#eab308' },
      extraDark: { type: Boolean, default: false }
    }
  },
  // Shows attended tracking (RSVPs, guestbook signatures, and uploads)
  showsAttended: [{ type: String }], // Array of performance IDs
  // Proxy account fields (admin creates on behalf of someone)
  isProxy: { type: Boolean, default: false },
  proxyClaimed: { type: Boolean, default: false },
  proxyCreatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

// ✅ Password setter
userSchema.methods.setPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(password, salt);
};

// ✅ Password checker
userSchema.methods.validatePassword = async function (password) {
  if (!this.passwordHash) {
    return false; // OAuth users have no password
  }
  return await bcrypt.compare(password, this.passwordHash);
};

// ✅ Check if user can use password login
userSchema.methods.hasPasswordAuth = function() {
  return this.authProvider === 'local' && !!this.passwordHash;
};

// ✅ Role checking methods
userSchema.methods.isAdmin = function() {
  return this.role === 'admin';
};

userSchema.methods.isMod = function() {
  return this.role === 'mod';
};

userSchema.methods.isModOrAdmin = function() {
  return this.role === 'mod' || this.role === 'admin';
};

userSchema.methods.canModerate = function() {
  return this.isModOrAdmin();
};

userSchema.methods.canAssignRoles = function() {
  return this.isAdmin();
};

// ✅ Update last active timestamp
userSchema.methods.updateLastActive = function() {
  this.lastActive = new Date();
  return this.save();
};

// ✅ Shows attended tracking
userSchema.methods.addShowAttended = function(performanceId) {
  if (!performanceId) return;
  // Add to array if not already present (Set behavior)
  if (!this.showsAttended.includes(performanceId)) {
    this.showsAttended.push(performanceId);
  }
};

userSchema.methods.removeShowAttended = function(performanceId) {
  if (!performanceId) return;
  this.showsAttended = this.showsAttended.filter(id => id !== performanceId);
};

userSchema.methods.hasAttendedShow = function(performanceId) {
  return this.showsAttended.includes(performanceId);
};

// ✅ Proxy account helper
userSchema.methods.isUnclaimedProxy = function() {
  return this.isProxy && !this.proxyClaimed;
};

// Index for OAuth lookups
userSchema.index({ authProvider: 1, oauthId: 1 });
// Index for proxy account lookups
userSchema.index({ isProxy: 1, displayName: 1 });

module.exports = mongoose.model('User', userSchema);
