import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { SealClient, SessionKey } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";

// This test mimics the frontend logic in src/ghostcontext/seal.ts as closely as possible.
// It uses the same package id and key servers, but runs in Node so we can see detailed
// errors without the browser in the way.

// IMPORTANT: set TEST_SEAL_ADDRESS to the Sui address you are using in the wallet
// when testing the frontend. This lets us check whether that address can round-trip
// encrypt/decrypt with the deployed seal_policy package.
const FRONTEND_ADDRESS = process.env.TEST_SEAL_ADDRESS;

// Package id must match VITE_SEAL_PACKAGE_ID / VITE_GHOSTCONTEXT_PACKAGE_ID
const PACKAGE_ID = "0x60a70b92dddbd54fc41aeab0e88292c1b1868a60eae702479c82b9857063a263";

// Same key servers as src/ghostcontext/seal.ts
type ServerConfig = { objectId: string; weight: number };
const TESTNET_SERVERS: string[] = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
  "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
];
const SERVER_CONFIGS: ServerConfig[] = TESTNET_SERVERS.map((objectId) => ({
  objectId,
  weight: 1,
}));

async function main() {
  if (!FRONTEND_ADDRESS) {
    throw new Error(
      "TEST_SEAL_ADDRESS env var missing. Set it to the Sui address used in your wallet (same as frontend)."
    );
  }

  console.log("\n🧪 Running frontend-style Seal test (no Walrus)...");
  console.log("Package:", PACKAGE_ID);
  console.log("Frontend address:", FRONTEND_ADDRESS);

  const sui = new SuiClient({ url: getFullnodeUrl("testnet") });
  const seal = new SealClient({
    suiClient: sui as any,
    serverConfigs: SERVER_CONFIGS,
    verifyKeyServers: false,
  });

  console.log("\n1) Creating SessionKey (like createSessionKey without wallet signature)...");
  // This uses the on-chain SessionKey contract directly, without personal-message signature.
  const sessionKey = await SessionKey.create({
    address: FRONTEND_ADDRESS,
    packageId: PACKAGE_ID,
    ttlMin: 10,
    suiClient: sui as any,
  });
  console.log("✅ SessionKey created");

  const plaintext = "GhostContext frontend-style test";
  const data = new TextEncoder().encode(plaintext);

  console.log("\n2) Encrypting with Seal (same pattern as encryptContext)...");
  const { encryptedObject } = await seal.encrypt({
    threshold: 1,
    packageId: PACKAGE_ID,
    id: FRONTEND_ADDRESS,
    data,
  });
  console.log("✅ Encryption complete; ciphertext length:", encryptedObject.length);

  console.log("\n3) Building PTB calling seal_policy::seal_approve (same as decryptContext)...");
  const policyIdBytes = new TextEncoder().encode(FRONTEND_ADDRESS);
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::seal_policy::seal_approve`,
    arguments: [tx.pure.vector("u8", policyIdBytes)],
  });
  const txBytes = await tx.build({ client: sui, onlyTransactionKind: true });
  console.log("✅ PTB built; bytes:", txBytes.length);

  console.log("\n4) Decrypting with Seal (same as decryptContext)...");
  try {
    const decrypted = await seal.decrypt({
      data: encryptedObject,
      sessionKey,
      txBytes,
    });
    const text = new TextDecoder().decode(decrypted);
    console.log("✅ Decryption result:", JSON.stringify(text));
    if (text === plaintext) {
      console.log("\n🎉 Frontend-style Seal test SUCCESS: plaintext matches.");
      process.exit(0);
    } else {
      console.error("\n❌ Frontend-style Seal test FAILED: plaintext mismatch.");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("\n❌ Seal.decrypt failed in frontend-style test:");
    console.error("   Raw:", error);
    console.error("   Type:", error?.constructor?.name);
    console.error("   Message:", error?.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\n❌ Frontend-style test script crashed:", e);
  process.exit(1);
});
