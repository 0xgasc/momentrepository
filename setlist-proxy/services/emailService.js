// Email Service - DISABLED (Coming Soon)
// SendGrid implementation temporarily disabled

const emailService = {

  // All email functions return "coming soon" status
  async sendMomentApproved(momentData, userData) {
    console.log(`📧 [Coming Soon] Would send approval email to ${userData.email}`);
    return { success: true, message: 'Email feature coming soon', comingSoon: true };
  },

  async sendMomentRejected(momentData, userData, rejectionReason) {
    console.log(`📧 [Coming Soon] Would send rejection email to ${userData.email}`);
    return { success: true, message: 'Email feature coming soon', comingSoon: true };
  },

  async sendMomentNeedsRevision(momentData, userData, moderatorNote, appliedChanges) {
    console.log(`📧 [Coming Soon] Would send revision request email to ${userData.email}`);
    return { success: true, message: 'Email feature coming soon', comingSoon: true };
  },

  async sendMomentResubmitted(momentData, userData) {
    console.log(`📧 [Coming Soon] Would send resubmission confirmation email to ${userData.email}`);
    return { success: true, message: 'Email feature coming soon', comingSoon: true };
  },

  async sendNewMomentForReview(momentData, userData, moderatorEmails) {
    console.log(`📧 [Coming Soon] Would notify ${moderatorEmails.length} moderators of new submission`);
    return { success: true, message: 'Email feature coming soon', comingSoon: true };
  },

  async sendMomentResubmittedForMod(momentData, userData, moderatorEmails, previousFeedback) {
    console.log(`📧 [Coming Soon] Would notify ${moderatorEmails.length} moderators of resubmission`);
    return { success: true, message: 'Email feature coming soon', comingSoon: true };
  },

  async sendNewUserRegistered(userData, adminEmails) {
    console.log(`📧 [Coming Soon] Would notify admins of new user: ${userData.email}`);
    return { success: true, message: 'Email feature coming soon', comingSoon: true };
  },

  async sendRoleAssigned(userData, newRole, assignedByUser) {
    console.log(`📧 [Coming Soon] Would notify ${userData.email} of role change to ${newRole}`);
    return { success: true, message: 'Email feature coming soon', comingSoon: true };
  },

  // Utility functions still work
  async getModeratorEmails() {
    try {
      const User = require('../models/User');
      const moderators = await User.find({
        role: { $in: ['mod', 'admin'] }
      }).select('email');
      const emails = moderators.map(user => user.email);
      if (emails.length === 0) {
        const fallback = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
        return fallback;
      }
      return emails;
    } catch (error) {
      const fallback = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
      return fallback;
    }
  },

  async getAdminEmails() {
    try {
      const User = require('../models/User');
      const admins = await User.find({ role: 'admin' }).select('email');
      const emails = admins.map(user => user.email);
      if (emails.length === 0) {
        const fallback = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
        return fallback;
      }
      return emails;
    } catch (error) {
      const fallback = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
      return fallback;
    }
  }
};

module.exports = emailService;
