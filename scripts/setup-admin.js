// scripts/setup-admin.js - Bootstrap admin user and update existing data
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../setlist-proxy/models/User');
const Moment = require('../setlist-proxy/models/Moment');

async function setupAdmin() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/umo-archive');
    console.log('✅ Connected to MongoDB');

    // 1. Set solo@solo.solo as admin
    console.log('\n👑 Setting up admin user...');
    const adminEmail = 'solo@solo.solo';
    
    let adminUser = await User.findOne({ email: adminEmail });
    if (adminUser) {
      adminUser.role = 'admin';
      adminUser.roleAssignedAt = new Date();
      await adminUser.save();
      console.log(`✅ Updated ${adminEmail} to admin role`);
    } else {
      console.log(`⚠️  Admin user ${adminEmail} not found. Please register first.`);
    }

    // 2. Set all existing users to 'user' role if they don't have one
    console.log('\n👥 Updating existing users...');
    const usersWithoutRole = await User.find({ role: { $exists: false } });
    if (usersWithoutRole.length > 0) {
      await User.updateMany(
        { role: { $exists: false } },
        { 
          $set: { 
            role: 'user',
            lastActive: new Date()
          }
        }
      );
      console.log(`✅ Updated ${usersWithoutRole.length} users to 'user' role`);
    } else {
      console.log('✅ All users already have roles assigned');
    }

    // 3. Set all existing moments to 'approved' status (grandfather them in)
    console.log('\n📋 Updating existing moments...');
    const momentsWithoutStatus = await Moment.find({ approvalStatus: { $exists: false } });
    if (momentsWithoutStatus.length > 0) {
      await Moment.updateMany(
        { approvalStatus: { $exists: false } },
        { 
          $set: { 
            approvalStatus: 'approved',
            reviewedBy: adminUser ? adminUser._id : null,
            reviewedAt: new Date()
          }
        }
      );
      console.log(`✅ Grandfathered ${momentsWithoutStatus.length} existing moments as 'approved'`);
    } else {
      console.log('✅ All moments already have approval status');
    }

    // 4. Display summary
    console.log('\n📊 Current System Status:');
    const userStats = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    console.log('Users by role:');
    userStats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count}`);
    });

    const momentStats = await Moment.aggregate([
      { $group: { _id: '$approvalStatus', count: { $sum: 1 } } }
    ]);
    console.log('Moments by approval status:');
    momentStats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count}`);
    });

    console.log('\n🎉 Admin setup complete!');
    console.log(`Admin user: ${adminEmail}`);
    console.log('All existing content has been approved.');
    console.log('New uploads will require moderation starting now.');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('💾 Database connection closed');
  }
}

// Run the setup
setupAdmin();