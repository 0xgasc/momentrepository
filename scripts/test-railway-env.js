// scripts/test-railway-env.js - Test Railway environment variables
const API_BASE_URL = 'https://momentrepository-production.up.railway.app';

async function testEnvironment() {
  try {
    console.log('🔍 Testing Railway environment variables...');
    
    // Test health endpoint
    const healthResponse = await fetch(`${API_BASE_URL}/`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    
    // Test cache refresh to see the API key error
    console.log('\n🔄 Testing cache refresh (should show API key error)...');
    const refreshResponse = await fetch(`${API_BASE_URL}/cache/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const refreshData = await refreshResponse.json();
    console.log('🔍 Refresh response:', refreshData);
    
    // Wait a few seconds then check status
    setTimeout(async () => {
      console.log('\n📊 Checking refresh status...');
      const statusResponse = await fetch(`${API_BASE_URL}/cache/refresh/status`);
      const statusData = await statusResponse.json();
      console.log('🔍 Status data:', statusData);
    }, 3000);
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testEnvironment();