/**
 * Seal + Walrus Diagnostic Tools
 * Use these to test the full encryption/decryption cycle
 */

import { encryptContext, createSessionKey, decryptContext } from './seal';
import { uploadToWalrus, fetchFromWalrusBytes } from './walrus';

/**
 * Test full encryption → Walrus → decryption cycle
 * This mimics what GhostContext does
 */
export async function testFullCycle(
  testData: string,
  userAddress: string,
  wallet: any,
  sealPackageId: string
): Promise<void> {
  console.log('\n🧪 TESTING FULL SEAL + WALRUS CYCLE');
  console.log('═'.repeat(60));
  console.log(`📝 Test data: "${testData}"`);
  console.log(`👤 User address: ${userAddress}`);
  console.log(`📦 Seal package ID: ${sealPackageId}`);
  
  try {
    // Step 1: Encrypt with Seal
    console.log('\n━━━ STEP 1: Encrypt with Seal ━━━');
    const { encryptedBlob, policyId } = await encryptContext(
      testData,
      userAddress,
      sealPackageId
    );
    console.log(`✅ Encryption complete`);
    console.log(`  Encrypted blob size: ${encryptedBlob.size} bytes`);
    console.log(`  Policy ID: ${policyId}`);
    
    // Step 2: Upload to Walrus
    console.log('\n━━━ STEP 2: Upload to Walrus ━━━');
    const blobId = await uploadToWalrus(encryptedBlob);
    console.log(`✅ Uploaded to Walrus`);
    console.log(`  Blob ID: ${blobId}`);
    console.log(`  Direct URL: https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`);
    
    // Step 3: Wait a moment (Walrus propagation)
    console.log('\n━━━ STEP 3: Wait for Walrus propagation ━━━');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`✅ Wait complete`);
    
    // Step 4: Fetch from Walrus (binary bytes)
    console.log('\n━━━ STEP 4: Fetch from Walrus ━━━');
    const fetchedBytes = await fetchFromWalrusBytes(blobId);
    console.log(`✅ Fetched from Walrus`);
    console.log(`  Fetched byte length: ${fetchedBytes.length} bytes`);
    
    // Step 5: Create session key
    console.log('\n━━━ STEP 5: Create Seal session key ━━━');
    const sessionKey = await createSessionKey(
      userAddress,
      wallet,
      sealPackageId
    );
    console.log(`✅ Session key created`);
    
    // Step 6: Decrypt
    console.log('\n━━━ STEP 6: Decrypt with Seal ━━━');
    const decrypted = await decryptContext(fetchedBytes, sessionKey);
    console.log(`✅ Decryption complete`);
    console.log(`  Decrypted data: "${decrypted}"`);
    
    // Step 7: Verify
    console.log('\n━━━ STEP 7: Verify integrity ━━━');
    if (decrypted === testData) {
      console.log(`✅✅✅ FULL CYCLE SUCCESS! ✅✅✅`);
      console.log(`Original and decrypted data match perfectly!`);
    } else {
      console.log(`❌ Data mismatch!`);
      console.log(`  Original: "${testData}"`);
      console.log(`  Decrypted: "${decrypted}"`);
    }
    
    console.log('\n═'.repeat(60));
    console.log('🎉 TEST COMPLETED SUCCESSFULLY');
    
  } catch (error) {
    console.log('\n═'.repeat(60));
    console.error('❌ TEST FAILED:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * Quick diagnostic - just test encryption structure
 */
export async function diagnoseEncryptionStructure(
  testData: string,
  userAddress: string,
  sealPackageId: string
): Promise<void> {
  console.log('\n🔍 DIAGNOSING ENCRYPTION STRUCTURE');
  console.log('═'.repeat(60));
  
  const { encryptedBlob } = await encryptContext(
    testData,
    userAddress,
    sealPackageId
  );
  
  const encryptedText = await encryptedBlob.text();
  const parsed = JSON.parse(encryptedText);
  
  console.log('\n📦 Encrypted Object Analysis:');
  console.log('Type:', typeof parsed);
  console.log('Keys:', Object.keys(parsed));
  console.log('\nDetailed Structure:');
  
  function analyzeStructure(obj: any, indent = 0): void {
    const prefix = '  '.repeat(indent);
    for (const key in obj) {
      const value = obj[key];
      const valueType = Array.isArray(value) ? 'Array' : typeof value;
      
      if (value instanceof Uint8Array) {
        console.log(`${prefix}${key}: Uint8Array(${value.length})`);
      } else if (Array.isArray(value)) {
        console.log(`${prefix}${key}: Array(${value.length})`);
        if (value.length > 0) {
          const firstItemType = typeof value[0];
          console.log(`${prefix}  First item type: ${firstItemType}`);
          if (firstItemType === 'number') {
            console.log(`${prefix}  Sample values: [${value.slice(0, 10).join(', ')}...]`);
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        console.log(`${prefix}${key}: Object`);
        analyzeStructure(value, indent + 1);
      } else {
        console.log(`${prefix}${key}: ${valueType} = ${JSON.stringify(value).substring(0, 100)}`);
      }
    }
  }
  
  analyzeStructure(parsed);
  console.log('\n═'.repeat(60));
}


