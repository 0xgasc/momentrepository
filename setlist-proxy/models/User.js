const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  displayName: { type: String },
  passwordHash: { type: String },
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
  roleAssignedAt: { type: Date, default: null }
}, { timestamps: true });

// ✅ Password setter
userSchema.methods.setPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(password, salt);
};

// ✅ Password checker
userSchema.methods.validatePassword = async function (password) {
  return await bcrypt.compare(password, this.passwordHash);
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

module.exports = mongoose.model('User', userSchema);
