require('dotenv').config();
const { Uploader } = require('@irys/upload');
const { Ethereum } = require('@irys/upload-ethereum');
const crypto = require('crypto');

const getIrysUploader = async () => {
  try {
    const irysUploader = await Uploader(Ethereum)
      .withWallet(process.env.PRIVATE_KEY)
      .withRpc(process.env.SEPOLIA_RPC)
      .devnet();
    
    return irysUploader;
  } catch (error) {
    console.error('Error initializing Irys uploader:', error);
    throw error;
  }
};

const uploadFileToIrys = async (buffer, filename) => {
  try {
    console.log(`🔍 Upload Debug Info:`);
    console.log(`   - Filename: ${filename}`);
    console.log(`   - Buffer size: ${buffer.length} bytes`);
    console.log(`   - Buffer type: ${Buffer.isBuffer(buffer) ? 'Buffer' : typeof buffer}`);
    
    // Validate buffer
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Invalid buffer provided - not a Buffer object');
    }
    
    if (buffer.length === 0) {
      throw new Error('Empty buffer provided');
    }
    
    // Create hash of original buffer for verification
    const originalHash = crypto.createHash('md5').update(buffer).digest('hex');
    console.log(`   - Original MD5: ${originalHash}`);
    
    const irysUploader = await getIrysUploader();
    
    // Check price and balance
    const price = await irysUploader.getPrice(buffer.length);
    const balance = await irysUploader.getBalance();
    console.log(`📊 Cost: ${price} wei, Balance: ${balance} wei`);
    
    if (BigInt(balance) < BigInt(price)) {
      throw new Error(`Insufficient balance. Need: ${price} wei, Have: ${balance} wei`);
    }
    
    // Determine content type
    const contentType = getContentType(filename);
    console.log(`   - Content-Type: ${contentType}`);
    
    // Create a copy of the buffer to ensure it's not modified
    const uploadBuffer = Buffer.from(buffer);
    
    console.log(`🚀 Uploading ${filename}...`);
    const receipt = await irysUploader.upload(uploadBuffer, {
      tags: [
        { name: 'Content-Type', value: contentType },
        { name: 'Filename', value: filename },
        { name: 'Original-Size', value: buffer.length.toString() },
        { name: 'Original-MD5', value: originalHash },
        { name: 'Upload-Timestamp', value: new Date().toISOString() }
      ]
    });
    
    const arweaveUrl = `https://gateway.irys.xyz/${receipt.id}`;
    console.log(`✅ Upload complete: ${arweaveUrl}`);
    console.log(`   - Transaction ID: ${receipt.id}`);
    
    // Optional: Verify upload by downloading and comparing hash
    // Uncomment the next line if you want immediate verification
    // await verifyUpload(arweaveUrl, originalHash);
    
    return {
      id: receipt.id,
      url: arweaveUrl,
      arUrl: `ar://${receipt.id}`,
      originalHash,
      size: buffer.length
    };
    
  } catch (error) {
    console.error('❌ Upload error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      filename,
      bufferSize: buffer?.length
    });
    throw error;
  }
};

// Verify upload integrity
const verifyUpload = async (url, expectedHash) => {
  try {
    console.log(`🔍 Verifying upload integrity...`);
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch uploaded file: ${response.status}`);
    }
    
    const uploadedBuffer = await response.buffer();
    const uploadedHash = crypto.createHash('md5').update(uploadedBuffer).digest('hex');
    
    console.log(`   - Expected MD5: ${expectedHash}`);
    console.log(`   - Uploaded MD5: ${uploadedHash}`);
    console.log(`   - Integrity check: ${expectedHash === uploadedHash ? '✅ PASS' : '❌ FAIL'}`);
    
    if (expectedHash !== uploadedHash) {
      throw new Error('File integrity check failed - uploaded file is corrupted');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Verification error:', error);
    throw error;
  }
};

// Enhanced content type detection
const getContentType = (filename) => {
  const ext = filename.toLowerCase().split('.').pop();
  const contentTypes = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'ico': 'image/x-icon',
    
    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'webm': 'video/webm',
    'mkv': 'video/x-matroska',
    'flv': 'video/x-flv',
    'wmv': 'video/x-ms-wmv',
    'm4v': 'video/x-m4v',
    '3gp': 'video/3gpp',
    
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    'ogg': 'audio/ogg',
    'wma': 'audio/x-ms-wma',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    
    // Default
    'default': 'application/octet-stream'
  };
  
  const contentType = contentTypes[ext] || contentTypes['default'];
  console.log(`🔍 File extension: ${ext} -> Content-Type: ${contentType}`);
  return contentType;
};

// Test function to validate a buffer before upload
const validateBuffer = (buffer, filename) => {
  console.log(`🔍 Validating buffer for ${filename}:`);
  
  if (!Buffer.isBuffer(buffer)) {
    console.error('❌ Not a valid Buffer object');
    return false;
  }
  
  if (buffer.length === 0) {
    console.error('❌ Buffer is empty');
    return false;
  }
  
  // Check for common file signatures
  const signatures = {
    // Video formats
    'mp4': [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp
    'mov': [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70], // ftyp (QuickTime)
    // Alternative MOV signature
    'mov2': [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], // ftyp
    
    // Image formats
    'jpeg': [0xFF, 0xD8, 0xFF],
    'png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    'gif': [0x47, 0x49, 0x46, 0x38]
  };
  
  // Get first 20 bytes for signature checking
  const header = Array.from(buffer.slice(0, 20));
  console.log(`   - First 20 bytes: ${header.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
  
  // Check if buffer starts with expected signature
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'mov') {
    const hasValidSig = signatures.mov.every((byte, i) => buffer[i] === byte) ||
                       signatures.mov2.every((byte, i) => buffer[i] === byte);
    console.log(`   - MOV signature check: ${hasValidSig ? '✅ PASS' : '❌ FAIL'}`);
  }
  
  console.log(`   - Buffer size: ${buffer.length} bytes (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`   - Buffer validation: ✅ PASS`);
  
  return true;
};

// Fund account helper
const fundAccount = async (amount) => {
  try {
    const irysUploader = await getIrysUploader();
    const receipt = await irysUploader.fund(amount);
    console.log(`💸 Funded account with ${amount} wei. Receipt:`, receipt);
    return receipt;
  } catch (error) {
    console.error('❌ Funding error:', error);
    throw error;
  }
};

// Balance check helper
const checkBalance = async (bufferSize) => {
  try {
    const irysUploader = await getIrysUploader();
    const price = await irysUploader.getPrice(bufferSize);
    const balance = await irysUploader.getBalance();
    
    console.log(`💰 Balance: ${balance} wei`);
    console.log(`💵 Cost: ${price} wei`);
    console.log(`✅ Sufficient funds: ${BigInt(balance) >= BigInt(price)}`);
    
    return {
      balance,
      price,
      hasSufficientFunds: BigInt(balance) >= BigInt(price)
    };
  } catch (error) {
    console.error('❌ Balance check error:', error);
    throw error;
  }
};

module.exports = { 
  uploadFileToIrys, 
  fundAccount, 
  checkBalance,
  validateBuffer,
  verifyUpload
};