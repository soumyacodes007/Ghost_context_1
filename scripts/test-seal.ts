import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { fromB64 } from "@mysten/bcs";
import { Keypair, decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { SealClient, SessionKey } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import { config } from "dotenv";

// Load .env file
config();

// Hard-code the deployed ghostcontext package ID that also contains `seal_policy`.
// This should match both VITE_GHOSTCONTEXT_PACKAGE_ID and VITE_SEAL_PACKAGE_ID in the frontend.
const POLICY_PACKAGE_ID = "0x60a70b92dddbd54fc41aeab0e88292c1b1868a60eae702479c82b9857063a263";

// Seal testnet key servers (same as in src/ghostcontext/seal.ts)
const TESTNET_SERVERS = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
  "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
];

async function main() {
  console.log("\n🧪 Running Seal round-trip test (no Walrus)...");
  console.log("Policy package:", POLICY_PACKAGE_ID);

  const sui = new SuiClient({ url: getFullnodeUrl("testnet") });
  const serverConfigs = TESTNET_SERVERS.map((objectId) => ({ objectId, weight: 1 }));

  const seal = new SealClient({
    suiClient: sui as any,
    serverConfigs,
    verifyKeyServers: false,
  });

  // Use a local testnet keypair for signing the session key.
  // IMPORTANT: set TEST_SEAL_SECRET_KEY to your Sui private key (bech32 or base64) before running.
  const secretKeyInput = process.env.TEST_SEAL_SECRET_KEY;
  if (!secretKeyInput) {
    throw new Error(
      "TEST_SEAL_SECRET_KEY env var missing. Set it to a Sui secret key (bech32 format like 'suiprivkey1...' or base64) before running seal:test."
    );
  }
  
  let keypair: Keypair;
  if (secretKeyInput.startsWith('suiprivkey')) {
    // Bech32 format - parse directly
    keypair = Keypair.fromSecretKey(secretKeyInput);
  } else {
    // Base64 format - decode first
    const secretKeyBytes = fromB64(secretKeyInput);
    const { schema, secretKey } = decodeSuiPrivateKey(secretKeyBytes);
    keypair = Keypair.fromSecretKey(secretKey, schema);
  }
  
  const address = keypair.getPublicKey().toSuiAddress();
  console.log("Using test signer address:", address);

  console.log("\n1) Creating SessionKey...");
  const sessionKey = await SessionKey.create({
    address,
    packageId: POLICY_PACKAGE_ID,
    ttlMin: 10,
    signer: keypair,
    suiClient: sui as any,
  });
  console.log("✅ SessionKey created");

  const plaintext = "The treasure is buried under the palm tree.";
  const data = new TextEncoder().encode(plaintext);

  console.log("\n2) Encrypting with Seal...");
  const { encryptedObject } = await seal.encrypt({
    threshold: 1,
    packageId: POLICY_PACKAGE_ID,
    id: address, // policy id = user address, same pattern as frontend
    data,
  });
  console.log("✅ Encryption complete; ciphertext length:", encryptedObject.length);

  console.log("\n3) Building PTB calling seal_policy::seal_approve...");
  const policyIdBytes = new TextEncoder().encode(address);
  const tx = new Transaction();
  tx.moveCall({
    target: `${POLICY_PACKAGE_ID}::seal_policy::seal_approve`,
    arguments: [tx.pure.vector("u8", policyIdBytes)],
  });
  const txBytes = await tx.build({ client: sui, onlyTransactionKind: true });
  console.log("✅ PTB built; bytes:", txBytes.length);

  console.log("\n4) Decrypting with Seal...");
  try {
    const decrypted = await seal.decrypt({
      data: encryptedObject,
      sessionKey,
      txBytes,
    });
    const text = new TextDecoder().decode(decrypted);
    console.log("✅ Decryption result:", JSON.stringify(text));
    if (text === plaintext) {
      console.log("\n🎉 Seal round-trip SUCCESS: plaintext matches.");
      process.exit(0);
    } else {
      console.error("\n❌ Seal round-trip FAILED: plaintext mismatch.");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("\n❌ Seal.decrypt failed:");
    console.error("   Raw:", error);
    console.error("   Type:", error?.constructor?.name);
    console.error("   Message:", error?.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\n❌ Test script crashed:", e);
  process.exit(1);
});
