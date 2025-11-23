/**
 * Test script to verify the deployed contract signature
 * This will help us understand what function signature is actually deployed
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

// Configuration - UPDATED with new deployment
const PACKAGE_ID = '0x6344fd2b687d7d3fa1c10f0a334dc0d8b2c9297be53e04595f308f211d5aa0f6';
const REGISTRY_ID = '0xa0fb3229fb221c78c17362ee50ab7f026f16b5fdb616eef7f9de5231c3679b0d';
const RPC_URL = 'https://fullnode.testnet.sui.io:443';

// Test private key from .env (or use your own)
const PRIVATE_KEY = 'suiprivkey1qzchlgwk00favfekjusx0x6ymvn6a8uslkjv2npl20zf3cs2mpau54shr2k';

async function main() {
  console.log('🧪 Testing Contract Signature\n');
  console.log('═'.repeat(70));
  
  // Initialize client
  const client = new SuiClient({ url: RPC_URL });
  console.log('✅ Connected to Sui testnet');
  
  // Setup keypair - decode the sui private key format
  const { secretKey } = decodeSuiPrivateKey(PRIVATE_KEY);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const address = keypair.toSuiAddress();
  console.log(`📍 Address: ${address}`);
  
  // Check balance
  const balance = await client.getBalance({ owner: address });
  console.log(`💰 Balance: ${Number(balance.totalBalance) / 1_000_000_000} SUI\n`);
  
  // Get registry object to check shared version
  console.log('📦 Fetching registry object...');
  const registryObj = await client.getObject({
    id: REGISTRY_ID,
    options: { showOwner: true, showContent: true },
  });
  
  if (!registryObj.data) {
    console.error('❌ Registry object not found!');
    return;
  }
  
  const registryOwner = registryObj.data.owner as any;
  const registrySharedVersion = registryOwner?.Shared?.initial_shared_version;
  console.log(`✅ Registry shared version: ${registrySharedVersion}\n`);
  
  // Get package to inspect available functions
  console.log('📦 Fetching package details...');
  const packageObj = await client.getObject({
    id: PACKAGE_ID,
    options: { showContent: true },
  });
  
  console.log('Package data:', JSON.stringify(packageObj, null, 2));
  console.log('\n');
  
  // Test 1: Try with NEW signature (with encryption keys)
  console.log('═'.repeat(70));
  console.log('TEST 1: Trying NEW signature (with encryption_key and iv)');
  console.log('═'.repeat(70));
  
  try {
    const tx1 = new Transaction();
    tx1.setSender(address);
    
    tx1.moveCall({
      target: `${PACKAGE_ID}::ghostcontext::create_context`,
      arguments: [
        tx1.pure.string('Test Context NEW'),
        tx1.pure.string('test-blob-id-123'),
        tx1.pure.string('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'), // 64 char hex key
        tx1.pure.string('0123456789abcdef01234567'), // 24 char hex IV
        tx1.pure.string('General'),
        tx1.object(REGISTRY_ID),
      ],
    });
    
    // Dry run to test without actually executing
    const dryRunResult1 = await client.dryRunTransactionBlock({
      transactionBlock: await tx1.build({ client }),
    });
    
    console.log('✅ NEW signature works!');
    console.log('Dry run result:', JSON.stringify(dryRunResult1.effects.status, null, 2));
  } catch (error: any) {
    console.log('❌ NEW signature failed');
    console.log('Error:', error.message);
  }
  
  console.log('\n');
  
  // Test 2: Try with OLD signature (without encryption keys)
  console.log('═'.repeat(70));
  console.log('TEST 2: Trying OLD signature (without encryption_key and iv)');
  console.log('═'.repeat(70));
  
  try {
    const tx2 = new Transaction();
    tx2.setSender(address);
    
    tx2.moveCall({
      target: `${PACKAGE_ID}::ghostcontext::create_context`,
      arguments: [
        tx2.pure.string('Test Context OLD'),
        tx2.pure.string('test-blob-id-456'),
        tx2.pure.string('General'),
        tx2.object(REGISTRY_ID),
      ],
    });
    
    // Dry run to test without actually executing
    const dryRunResult2 = await client.dryRunTransactionBlock({
      transactionBlock: await tx2.build({ client }),
    });
    
    console.log('✅ OLD signature works!');
    console.log('Dry run result:', JSON.stringify(dryRunResult2.effects.status, null, 2));
  } catch (error: any) {
    console.log('❌ OLD signature failed');
    console.log('Error:', error.message);
  }
  
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('🎯 CONCLUSION:');
  console.log('Check which test passed to know the correct signature!');
  console.log('═'.repeat(70));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
