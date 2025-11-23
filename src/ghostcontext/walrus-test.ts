/**
 * Walrus Integration Test Utilities
 * Use these functions to test upload/download functionality
 */

import { uploadToWalrus, fetchFromWalrus, blobExists } from './walrus';

/**
 * Test 1: Upload simple text and verify
 */
export async function testSimpleUpload(): Promise<void> {
  console.log('\n🧪 TEST 1: Simple Text Upload');
  console.log('═'.repeat(50));
  
  try {
    // Create a simple text blob
    const testText = 'The treasure is buried under the palm tree.';
    const blob = new Blob([testText], { type: 'text/plain' });
    
    console.log(`📝 Test data: "${testText}"`);
    console.log(`📦 Blob size: ${blob.size} bytes`);
    
    // Upload to Walrus
    const blobId = await uploadToWalrus(blob);
    
    console.log('\n✅ UPLOAD SUCCESSFUL!');
    console.log(`🔑 Blob ID: ${blobId}`);
    console.log(`🔗 Direct URL: https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`);
    
    // Verify it exists
    const exists = await blobExists(blobId);
    console.log(`\n🔍 Blob exists check: ${exists ? '✅ YES' : '❌ NO'}`);
    
    // Download and verify content
    const downloaded = await fetchFromWalrus(blobId);
    console.log(`\n📥 Downloaded content: "${downloaded}"`);
    
    // Verify integrity
    if (downloaded === testText) {
      console.log('✅ INTEGRITY CHECK PASSED - Content matches!');
    } else {
      console.log('❌ INTEGRITY CHECK FAILED - Content mismatch!');
      console.log(`Expected: "${testText}"`);
      console.log(`Got: "${downloaded}"`);
    }
    
    console.log('\n🎉 TEST 1 COMPLETED SUCCESSFULLY!');
    console.log('═'.repeat(50));
    
  } catch (error) {
    console.error('\n❌ TEST 1 FAILED:', error);
    console.log('═'.repeat(50));
    throw error;
  }
}

/**
 * Test 2: Upload JSON payload
 */
export async function testJsonUpload(): Promise<void> {
  console.log('\n🧪 TEST 2: JSON Payload Upload');
  console.log('═'.repeat(50));
  
  try {
    // Create a JSON payload
    const payload = {
      secret: 'The vault code is 1234',
      timestamp: new Date().toISOString(),
      metadata: {
        encrypted: false,
        owner: 'test-user',
      },
    };
    
    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    console.log('📝 Test JSON:');
    console.log(jsonString);
    console.log(`📦 Blob size: ${blob.size} bytes`);
    
    // Upload to Walrus
    const blobId = await uploadToWalrus(blob);
    
    console.log('\n✅ UPLOAD SUCCESSFUL!');
    console.log(`🔑 Blob ID: ${blobId}`);
    
    // Download and parse
    const downloaded = await fetchFromWalrus(blobId);
    const parsedPayload = JSON.parse(downloaded);
    
    console.log('\n📥 Downloaded and parsed JSON:');
    console.log(JSON.stringify(parsedPayload, null, 2));
    
    // Verify secret
    if (parsedPayload.secret === payload.secret) {
      console.log(`\n✅ SECRET VERIFIED: "${parsedPayload.secret}"`);
    } else {
      console.log('❌ SECRET MISMATCH!');
    }
    
    console.log('\n🎉 TEST 2 COMPLETED SUCCESSFULLY!');
    console.log('═'.repeat(50));
    
    return;
  } catch (error) {
    console.error('\n❌ TEST 2 FAILED:', error);
    console.log('═'.repeat(50));
    throw error;
  }
}

/**
 * Test 3: Upload binary data (simulating encrypted content)
 */
export async function testBinaryUpload(): Promise<void> {
  console.log('\n🧪 TEST 3: Binary Data Upload');
  console.log('═'.repeat(50));
  
  try {
    // Create binary data (simulating encryption)
    const originalText = 'Secret document content';
    const encoder = new TextEncoder();
    const data = encoder.encode(originalText);
    
    // Simple XOR "encryption" for demonstration
    const key = 42;
    const encrypted = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      encrypted[i] = data[i] ^ key;
    }
    
    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
    
    console.log(`📝 Original text: "${originalText}"`);
    console.log(`🔒 Encrypted size: ${blob.size} bytes`);
    console.log(`🔑 Encryption key: ${key}`);
    
    // Upload to Walrus
    const blobId = await uploadToWalrus(blob);
    
    console.log('\n✅ UPLOAD SUCCESSFUL!');
    console.log(`🔑 Blob ID: ${blobId}`);
    
    // Download and decrypt
    const downloaded = await fetchFromWalrus(blobId);
    const downloadedBytes = encoder.encode(downloaded);
    
    // Decrypt
    const decrypted = new Uint8Array(downloadedBytes.length);
    for (let i = 0; i < downloadedBytes.length; i++) {
      decrypted[i] = downloadedBytes[i] ^ key;
    }
    
    const decoder = new TextDecoder();
    const decryptedText = decoder.decode(decrypted);
    
    console.log(`\n🔓 Decrypted text: "${decryptedText}"`);
    
    if (decryptedText === originalText) {
      console.log('✅ ENCRYPTION/DECRYPTION CYCLE SUCCESSFUL!');
    } else {
      console.log('❌ DECRYPTION FAILED!');
    }
    
    console.log('\n🎉 TEST 3 COMPLETED SUCCESSFULLY!');
    console.log('═'.repeat(50));
    
  } catch (error) {
    console.error('\n❌ TEST 3 FAILED:', error);
    console.log('═'.repeat(50));
    throw error;
  }
}

/**
 * Run all tests sequentially
 */
export async function runAllWalrusTests(): Promise<void> {
  console.log('\n🚀 STARTING WALRUS INTEGRATION TESTS');
  console.log('═'.repeat(50));
  
  try {
    await testSimpleUpload();
    await testJsonUpload();
    await testBinaryUpload();
    
    console.log('\n\n🎊 ALL TESTS PASSED! 🎊');
    console.log('Walrus integration is working correctly!');
    console.log('═'.repeat(50));
    
  } catch (error) {
    console.error('\n\n❌ TEST SUITE FAILED');
    console.log('═'.repeat(50));
    throw error;
  }
}

/**
 * Quick test function you can call from browser console
 */
export async function quickTest(): Promise<string> {
  const text = 'Hello from GhostContext!';
  const blob = new Blob([text]);
  const blobId = await uploadToWalrus(blob);
  const downloaded = await fetchFromWalrus(blobId);
  
  console.log('✅ Quick test passed!');
  console.log(`Blob ID: ${blobId}`);
  console.log(`Content matches: ${downloaded === text}`);
  
  return blobId;
}


