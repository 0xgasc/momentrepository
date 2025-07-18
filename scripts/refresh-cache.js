// scripts/refresh-cache.js - Script to refresh production cache
const API_BASE_URL = 'https://momentrepository-production.up.railway.app';

async function refreshCache() {
  try {
    console.log('🔄 Triggering cache refresh...');
    
    const response = await fetch(`${API_BASE_URL}/cache/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('🔍 Response:', result);
    
    if (response.ok) {
      console.log('✅ Cache refresh started successfully');
      console.log('📊 Estimated API calls:', result.estimatedApiCalls);
      console.log('⏳ This will take several minutes to complete...');
      console.log('💡 Check the Railway logs to monitor progress');
    } else {
      console.error('❌ Error:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

refreshCache();