// scripts/bootstrap-admin.js - Simple script to bootstrap admin
const API_BASE_URL = 'https://momentrepository-production.up.railway.app';

async function bootstrapAdmin() {
  try {
    console.log('🔧 Bootstrapping admin system...');
    
    const response = await fetch(`${API_BASE_URL}/bootstrap-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        adminSecret: 'UMO-ADMIN-SETUP-2024'
      })
    });
    
    const result = await response.json();
    console.log('🔍 Full response:', result);
    
    if (response.ok) {
      console.log('✅ Success:', result.message);
      console.log('👑 Admin:', result.admin);
      if (result.usersUpdated !== undefined) {
        console.log('👥 Users updated:', result.usersUpdated);
      }
      if (result.momentsUpdated !== undefined) {
        console.log('📋 Moments updated:', result.momentsUpdated);
      }
      console.log('📋 Note:', result.note);
    } else {
      console.error('❌ Error:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
    console.log('💡 Make sure your backend server is running on port 5050');
  }
}

bootstrapAdmin();