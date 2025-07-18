// scripts/test-railway-setlist.js - Test Railway's Setlist.fm access
const API_BASE_URL = 'https://momentrepository-production.up.railway.app';

async function testRailwayAPI() {
  try {
    console.log('🚂 Testing Railway backend Setlist.fm access...');
    
    // Wait for Railway to deploy our latest changes with the new endpoint
    console.log('⏳ Waiting for Railway deployment (latest code with debugging)...');
    
    // Test the cache refresh to trigger API calls
    console.log('\n🔄 Triggering cache refresh on Railway...');
    const refreshResponse = await fetch(`${API_BASE_URL}/cache/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const refreshData = await refreshResponse.json();
    console.log('📝 Refresh Response:', refreshData);
    
    // Wait a bit then check status
    console.log('\n⏳ Waiting 10 seconds for cache refresh to start...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check status (this endpoint should be available after deployment)
    try {
      console.log('📊 Checking refresh status...');
      const statusResponse = await fetch(`${API_BASE_URL}/cache/refresh/status`);
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log('✅ Status Data:', JSON.stringify(statusData, null, 2));
        
        if (statusData.refreshStatus?.error) {
          console.log('❌ Found error in refresh status:');
          console.log('   Error:', statusData.refreshStatus.error);
        }
      } else {
        console.log(`❌ Status endpoint not available: ${statusResponse.status}`);
        console.log('   (This means Railway hasn\'t deployed our latest changes yet)');
      }
    } catch (err) {
      console.log('❌ Status check failed:', err.message);
    }
    
  } catch (error) {
    console.error('❌ Railway test error:', error.message);
  }
}

testRailwayAPI();