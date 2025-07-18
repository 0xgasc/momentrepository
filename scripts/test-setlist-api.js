// scripts/test-setlist-api.js - Test Setlist.fm API directly
require('dotenv').config();

async function testSetlistAPI() {
  const apiKey = process.env.SETLIST_FM_API_KEY;
  console.log(`🔑 Using API Key: ${apiKey ? 'Found' : 'Missing'} (${apiKey?.substring(0, 10)}...)`);
  
  if (!apiKey) {
    console.error('❌ No API key found in environment');
    return;
  }
  
  try {
    console.log('\n🎸 Testing Setlist.fm API for Umphrey\'s McGee...');
    
    const response = await fetch('https://api.setlist.fm/rest/1.0/artist/e2305342-0bde-4a2c-aed0-4b88694834de/setlists?p=1', {
      headers: {
        'Accept': 'application/json',
        'x-api-key': apiKey,
        'User-Agent': 'UMORepository/1.0'
      }
    });
    
    console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📊 Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Success! Found ${data.setlist?.length || 0} setlists`);
      console.log(`📈 Total available: ${data.total || 0}`);
      console.log(`📄 Items per page: ${data.itemsPerPage || 0}`);
      console.log(`📑 Current page: ${data.page || 0}`);
      
      // Show first setlist as example
      if (data.setlist && data.setlist.length > 0) {
        const firstShow = data.setlist[0];
        console.log(`\n🎵 Latest show example:`);
        console.log(`   Date: ${firstShow.eventDate}`);
        console.log(`   Venue: ${firstShow.venue?.name}`);
        console.log(`   City: ${firstShow.venue?.city?.name}, ${firstShow.venue?.city?.country?.name}`);
        console.log(`   Songs: ${firstShow.sets?.set?.reduce((total, set) => total + (set.song?.length || 0), 0) || 0}`);
      }
    } else {
      const errorText = await response.text();
      console.log(`❌ Error Response:`, errorText);
      
      if (response.status === 403) {
        console.log(`\n💡 403 Forbidden could mean:`);
        console.log(`   - Invalid API key`);
        console.log(`   - Rate limit exceeded`);
        console.log(`   - API key doesn't have permission for this endpoint`);
      } else if (response.status === 429) {
        console.log(`\n⚠️ 429 Rate Limited - Too many requests`);
        const retryAfter = response.headers.get('retry-after');
        if (retryAfter) {
          console.log(`   Retry after: ${retryAfter} seconds`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Network Error:', error.message);
  }
}

testSetlistAPI();