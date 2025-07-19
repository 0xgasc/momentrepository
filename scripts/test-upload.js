// scripts/test-upload.js - Test upload endpoint
const fs = require('fs');
const FormData = require('form-data');
const { default: fetch } = require('node-fetch');

const API_BASE_URL = 'https://momentrepository-production.up.railway.app';

async function testUpload() {
  try {
    console.log('🧪 Testing upload endpoint...');
    
    // Create a small test file
    const testData = Buffer.from('Test upload file content for UMO Archive', 'utf8');
    
    // First, let's test if we can authenticate
    console.log('\n🔐 Testing authentication...');
    const authResponse = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'solo@solo.solo',
        password: 'solo'
      })
    });
    
    if (!authResponse.ok) {
      throw new Error(`Auth failed: ${authResponse.status}`);
    }
    
    const authData = await authResponse.json();
    console.log('✅ Authentication successful');
    
    // Test upload with FormData
    console.log('\n📤 Testing file upload...');
    const formData = new FormData();
    formData.append('file', testData, {
      filename: 'test-upload.txt',
      contentType: 'text/plain'
    });
    
    const uploadResponse = await fetch(`${API_BASE_URL}/upload-file`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.token}`
      },
      body: formData
    });
    
    console.log(`📊 Upload Response Status: ${uploadResponse.status}`);
    console.log(`📊 Upload Response Headers:`, Object.fromEntries(uploadResponse.headers.entries()));
    
    const responseText = await uploadResponse.text();
    console.log('📄 Response Body:', responseText);
    
    if (uploadResponse.ok) {
      console.log('✅ Upload test successful!');
      const result = JSON.parse(responseText);
      console.log('🔗 File URI:', result.fileUri);
    } else {
      console.log('❌ Upload failed');
      console.log('📄 Error details:', responseText);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    console.error('📄 Stack:', error.stack);
  }
}

testUpload();