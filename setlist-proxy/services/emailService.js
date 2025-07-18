// Email Service - Skeleton for all user-moderator interactions
// TODO: Configure actual email provider (SendGrid, AWS SES, etc.)

const emailService = {
  
  // Email templates for different scenarios
  templates: {
    
    // User notifications
    momentApproved: {
      subject: '✅ Your moment has been approved!',
      template: (data) => `
        Hi ${data.userName},
        
        Great news! Your moment "${data.momentTitle}" has been approved and is now live on UMO Archive.
        
        📍 Performance: ${data.venueName}, ${data.venueCity} • ${data.performanceDate}
        🎵 Content: ${data.songName} (${data.contentType})
        ⭐ Rarity: ${data.rarityTier} (${data.rarityScore}/6.0)
        
        View your moment: ${data.momentUrl}
        
        Thanks for contributing to UMO Archive!
        
        Best regards,
        The UMO Archive Team
      `
    },
    
    momentRejected: {
      subject: '❌ Your moment submission needs attention',
      template: (data) => `
        Hi ${data.userName},
        
        Unfortunately, your moment "${data.momentTitle}" could not be approved at this time.
        
        📍 Performance: ${data.venueName}, ${data.venueCity} • ${data.performanceDate}
        🎵 Content: ${data.songName} (${data.contentType})
        
        Reason for rejection:
        ${data.rejectionReason}
        
        You can view your submissions and try uploading again: ${data.accountUrl}
        
        Thank you for your understanding.
        
        Best regards,
        The UMO Archive Team
      `
    },
    
    momentNeedsRevision: {
      subject: '📝 Your moment has been updated by a moderator',
      template: (data) => `
        Hi ${data.userName},
        
        A moderator has reviewed and updated your moment "${data.momentTitle}". Please review the changes and resubmit if you agree.
        
        📍 Performance: ${data.venueName}, ${data.venueCity} • ${data.performanceDate}
        🎵 Content: ${data.songName} (${data.contentType})
        
        Moderator feedback:
        ${data.moderatorNote}
        
        Changes made:
        ${data.changesDescription}
        
        Review and resubmit: ${data.accountUrl}
        
        Best regards,
        The UMO Archive Team
      `
    },
    
    momentResubmitted: {
      subject: '🔄 Your moment has been resubmitted for review',
      template: (data) => `
        Hi ${data.userName},
        
        Thank you for updating your moment "${data.momentTitle}". It has been resubmitted for moderator review.
        
        📍 Performance: ${data.venueName}, ${data.venueCity} • ${data.performanceDate}
        🎵 Content: ${data.songName} (${data.contentType})
        
        We'll review your submission and get back to you soon.
        
        Track your submissions: ${data.accountUrl}
        
        Best regards,
        The UMO Archive Team
      `
    },
    
    // Moderator notifications
    newMomentForReview: {
      subject: '🛡️ New moment pending review',
      template: (data) => `
        Hi ${data.moderatorName},
        
        A new moment has been submitted and needs your review.
        
        📍 Performance: ${data.venueName}, ${data.venueCity} • ${data.performanceDate}
        🎵 Content: ${data.songName} (${data.contentType})
        👤 Uploaded by: ${data.uploaderName} (${data.uploaderEmail})
        📅 Submitted: ${data.submissionDate}
        
        Description: ${data.momentDescription || 'No description provided'}
        
        Review in Admin Panel: ${data.adminPanelUrl}
        
        Best regards,
        UMO Archive System
      `
    },
    
    momentResubmittedForMod: {
      subject: '🔄 Moment resubmitted after revision',
      template: (data) => `
        Hi ${data.moderatorName},
        
        A moment you previously sent back for revision has been resubmitted by the user.
        
        📍 Performance: ${data.venueName}, ${data.venueCity} • ${data.performanceDate}
        🎵 Content: ${data.songName} (${data.contentType})
        👤 Updated by: ${data.uploaderName} (${data.uploaderEmail})
        📅 Resubmitted: ${data.resubmissionDate}
        
        Previous feedback: ${data.previousFeedback}
        
        Review in Admin Panel: ${data.adminPanelUrl}
        
        Best regards,
        UMO Archive System
      `
    },
    
    // Admin notifications
    newUserRegistered: {
      subject: '👤 New user registered',
      template: (data) => `
        Hi Admin,
        
        A new user has registered on UMO Archive.
        
        👤 User: ${data.userName} (${data.userEmail})
        📅 Registered: ${data.registrationDate}
        🌍 Location: ${data.userLocation || 'Not provided'}
        
        View in Admin Panel: ${data.adminPanelUrl}
        
        Best regards,
        UMO Archive System
      `
    },
    
    roleAssigned: {
      subject: '🎖️ Your role has been updated',
      template: (data) => `
        Hi ${data.userName},
        
        Your role on UMO Archive has been updated to: ${data.newRole}
        
        ${data.roleDescription}
        
        ${data.newRole === 'mod' ? `
        As a moderator, you can now:
        - Review and approve user submissions
        - Edit metadata and send content back for revision
        - Help maintain content quality on the platform
        
        Access the Admin Panel: ${data.adminPanelUrl}
        ` : ''}
        
        If you have any questions, please contact the admin team.
        
        Best regards,
        The UMO Archive Team
      `
    }
  },
  
  // Email sending functions
  async sendMomentApproved(momentData, userData) {
    const emailData = {
      userName: userData.displayName || userData.email,
      momentTitle: `${momentData.songName} at ${momentData.venueName}`,
      venueName: momentData.venueName,
      venueCity: momentData.venueCity,
      performanceDate: momentData.performanceDate,
      songName: momentData.songName,
      contentType: momentData.contentType,
      rarityTier: momentData.rarityTier,
      rarityScore: momentData.rarityScore,
      momentUrl: `${process.env.FRONTEND_URL}/moments/${momentData._id}`,
    };
    
    return this._sendEmail(
      userData.email,
      this.templates.momentApproved.subject,
      this.templates.momentApproved.template(emailData)
    );
  },
  
  async sendMomentRejected(momentData, userData, rejectionReason) {
    const emailData = {
      userName: userData.displayName || userData.email,
      momentTitle: `${momentData.songName} at ${momentData.venueName}`,
      venueName: momentData.venueName,
      venueCity: momentData.venueCity,
      performanceDate: momentData.performanceDate,
      songName: momentData.songName,
      contentType: momentData.contentType,
      rejectionReason: rejectionReason,
      accountUrl: `${process.env.FRONTEND_URL}/account`,
    };
    
    return this._sendEmail(
      userData.email,
      this.templates.momentRejected.subject,
      this.templates.momentRejected.template(emailData)
    );
  },
  
  async sendMomentNeedsRevision(momentData, userData, moderatorNote, appliedChanges) {
    const changesDescription = Object.entries(appliedChanges)
      .filter(([key, value]) => value)
      .map(([key, value]) => `• ${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${value}`)
      .join('\n');
    
    const emailData = {
      userName: userData.displayName || userData.email,
      momentTitle: `${momentData.songName} at ${momentData.venueName}`,
      venueName: momentData.venueName,
      venueCity: momentData.venueCity,
      performanceDate: momentData.performanceDate,
      songName: momentData.songName,
      contentType: momentData.contentType,
      moderatorNote: moderatorNote,
      changesDescription: changesDescription || 'No specific changes listed',
      accountUrl: `${process.env.FRONTEND_URL}/account`,
    };
    
    return this._sendEmail(
      userData.email,
      this.templates.momentNeedsRevision.subject,
      this.templates.momentNeedsRevision.template(emailData)
    );
  },
  
  async sendMomentResubmitted(momentData, userData) {
    const emailData = {
      userName: userData.displayName || userData.email,
      momentTitle: `${momentData.songName} at ${momentData.venueName}`,
      venueName: momentData.venueName,
      venueCity: momentData.venueCity,
      performanceDate: momentData.performanceDate,
      songName: momentData.songName,
      contentType: momentData.contentType,
      accountUrl: `${process.env.FRONTEND_URL}/account`,
    };
    
    return this._sendEmail(
      userData.email,
      this.templates.momentResubmitted.subject,
      this.templates.momentResubmitted.template(emailData)
    );
  },
  
  async sendNewMomentForReview(momentData, userData, moderatorEmails) {
    const emailData = {
      moderatorName: 'Moderator',
      venueName: momentData.venueName,
      venueCity: momentData.venueCity,
      performanceDate: momentData.performanceDate,
      songName: momentData.songName,
      contentType: momentData.contentType,
      uploaderName: userData.displayName || userData.email,
      uploaderEmail: userData.email,
      submissionDate: new Date().toLocaleDateString(),
      momentDescription: momentData.momentDescription,
      adminPanelUrl: `${process.env.FRONTEND_URL}/admin`,
    };
    
    const promises = moderatorEmails.map(email => 
      this._sendEmail(
        email,
        this.templates.newMomentForReview.subject,
        this.templates.newMomentForReview.template(emailData)
      )
    );
    
    return Promise.all(promises);
  },
  
  async sendMomentResubmittedForMod(momentData, userData, moderatorEmails, previousFeedback) {
    const emailData = {
      moderatorName: 'Moderator',
      venueName: momentData.venueName,
      venueCity: momentData.venueCity,
      performanceDate: momentData.performanceDate,
      songName: momentData.songName,
      contentType: momentData.contentType,
      uploaderName: userData.displayName || userData.email,
      uploaderEmail: userData.email,
      resubmissionDate: new Date().toLocaleDateString(),
      previousFeedback: previousFeedback,
      adminPanelUrl: `${process.env.FRONTEND_URL}/admin`,
    };
    
    const promises = moderatorEmails.map(email => 
      this._sendEmail(
        email,
        this.templates.momentResubmittedForMod.subject,
        this.templates.momentResubmittedForMod.template(emailData)
      )
    );
    
    return Promise.all(promises);
  },
  
  async sendNewUserRegistered(userData, adminEmails) {
    const emailData = {
      userName: userData.displayName || 'Not provided',
      userEmail: userData.email,
      registrationDate: new Date().toLocaleDateString(),
      userLocation: userData.location,
      adminPanelUrl: `${process.env.FRONTEND_URL}/admin`,
    };
    
    const promises = adminEmails.map(email => 
      this._sendEmail(
        email,
        this.templates.newUserRegistered.subject,
        this.templates.newUserRegistered.template(emailData)
      )
    );
    
    return Promise.all(promises);
  },
  
  async sendRoleAssigned(userData, newRole, assignedByUser) {
    const roleDescriptions = {
      admin: 'You now have full administrative access to UMO Archive.',
      mod: 'You can now moderate content and help maintain quality on the platform.',
      user: 'You have standard user access to UMO Archive.'
    };
    
    const emailData = {
      userName: userData.displayName || userData.email,
      newRole: newRole.charAt(0).toUpperCase() + newRole.slice(1),
      roleDescription: roleDescriptions[newRole] || 'Your role has been updated.',
      adminPanelUrl: `${process.env.FRONTEND_URL}/admin`,
    };
    
    return this._sendEmail(
      userData.email,
      this.templates.roleAssigned.subject,
      this.templates.roleAssigned.template(emailData)
    );
  },
  
  // Core email sending function - TO BE IMPLEMENTED WITH ACTUAL EMAIL PROVIDER
  async _sendEmail(to, subject, body) {
    console.log(`📧 EMAIL SKELETON - Would send email:
    To: ${to}
    Subject: ${subject}
    Body Preview: ${body.substring(0, 100)}...
    
    NOTE: Configure actual email provider in emailService.js
    Recommended providers: SendGrid, AWS SES, Mailgun, NodeMailer
    `);
    
    // TODO: Implement actual email sending
    // Example with SendGrid:
    // const msg = {
    //   to: to,
    //   from: process.env.FROM_EMAIL,
    //   subject: subject,
    //   text: body,
    // };
    // return sgMail.send(msg);
    
    return Promise.resolve({ 
      success: true, 
      message: 'Email skeleton executed (not actually sent)',
      to,
      subject 
    });
  },
  
  // Utility function to get moderator emails
  async getModeratorEmails() {
    try {
      const User = require('../models/User');
      const moderators = await User.find({ 
        role: { $in: ['mod', 'admin'] } // Include both mods and admins
      }).select('email');
      const emails = moderators.map(user => user.email);
      console.log(`📧 Found ${emails.length} moderator/admin emails for notification`);
      return emails;
    } catch (error) {
      console.error('📧 Error fetching moderator emails:', error);
      return ['solo@solo.solo']; // Fallback to admin
    }
  },
  
  // Utility function to get admin emails
  async getAdminEmails() {
    try {
      const User = require('../models/User');
      const admins = await User.find({ role: 'admin' }).select('email');
      const emails = admins.map(user => user.email);
      console.log(`📧 Found ${emails.length} admin emails for notification`);
      return emails.length > 0 ? emails : ['solo@solo.solo']; // Fallback
    } catch (error) {
      console.error('📧 Error fetching admin emails:', error);
      return ['solo@solo.solo']; // Fallback to default admin
    }
  }
};

module.exports = emailService;