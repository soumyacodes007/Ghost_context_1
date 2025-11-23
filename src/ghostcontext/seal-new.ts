import { SealClient, SessionKey } from "@mysten/seal";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";

const sui = new SuiClient({ url: getFullnodeUrl("testnet") });

const testnetServers = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
  "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
];
const serverConfigs = testnetServers.map((id) => ({ objectId: id, weight: 1 }));

const seal = new SealClient({
  suiClient: sui,
  serverConfigs,
  verifyKeyServers: false,
});

export async function encryptContext(
  textData: string,
  userAddress: string,
  sealPackageId: string
) {
  console.log("ENCRYPT: Starting encryption");
  console.log("  Package ID:", sealPackageId);
  console.log("  User address:", userAddress);
  console.log("  IMPORTANT: You must use the SAME session key to decrypt this data!");
  console.log("  Session keys expire after 30 minutes.");
  
  if (!sealPackageId) {
    throw new Error("Seal package id missing");
  }

  const data = new TextEncoder().encode(textData);
  const { encryptedObject } = await seal.encrypt({
    threshold: 1,
    packageId: sealPackageId,
    id: userAddress,
    data,
  });

  console.log("  Encrypted:", encryptedObject.length, "bytes");
  console.log("  To decrypt: Use the session key created BEFORE this encryption");
  
  return {
    encryptedBlob: new Blob([encryptedObject], { type: "application/octet-stream" }),
    policyId: userAddress,
  };
}

export async function createSessionKey(
  userAddress: string,
  walletSigner: {
    signPersonalMessage: (args: { message: Uint8Array }) => Promise<{ signature: string }>;
  },
  sealPackageId: string
) {
  console.log("SESSION: Creating session key");
  console.log("  Address:", userAddress);
  
  if (!sealPackageId) {
    throw new Error("Seal package id missing");
  }

  const sessionKey = await SessionKey.create({
    address: userAddress,
    packageId: sealPackageId,
    ttlMin: 30,
    suiClient: sui,
  });

  const message = sessionKey.getPersonalMessage();
  const { signature } = await walletSigner.signPersonalMessage({ message });
  sessionKey.setPersonalMessageSignature(signature);

  // Store address for later use
  (sessionKey as any).userAddress = userAddress;
  (sessionKey as any).packageId = sealPackageId;

  console.log("  Session key ready");
  return sessionKey;
}

export async function decryptContext(
  encryptedBytes: Uint8Array,
  sessionKey: SessionKey,
  sealPackageId: string
) {
  console.log("DECRYPT: Starting decryption");
  console.log("  Data length:", encryptedBytes.length);
  
  const userAddress = (sessionKey as any).userAddress;
  if (!userAddress) {
    throw new Error("Session key missing userAddress");
  }

  // Build PTB
  const policyIdBytes = new TextEncoder().encode(userAddress);
  const tx = new Transaction();
  tx.moveCall({
    target: `${sealPackageId}::seal_policy::seal_approve`,
    arguments: [tx.pure.vector("u8", policyIdBytes)],
  });
  const txBytes = await tx.build({ client: sui, onlyTransactionKind: true });
  
  console.log("  PTB created:", txBytes.length, "bytes");
  
  // Check if session key is valid
  console.log("  Session key check:");
  console.log("    - Has userAddress:", !!(sessionKey as any).userAddress);
  console.log("    - Has packageId:", !!(sessionKey as any).packageId);
  console.log("    - Constructor:", sessionKey.constructor.name);
  console.log("    - Is expired:", sessionKey.isExpired());
  console.log("    - Address:", sessionKey.getAddress());
  console.log("    - Package ID:", sessionKey.getPackageId());
  
  if (sessionKey.isExpired()) {
    throw new Error("Session key has expired. Please create a new session key.");
  }
  
  console.log("  Calling seal.decrypt...");

  let decryptedData: any;
  try {
    const decryptPromise = seal.decrypt({
      data: encryptedBytes,
      sessionKey,
      txBytes,
    });
    
    console.log("  Decrypt promise created:", decryptPromise);
    decryptedData = await decryptPromise;
    console.log("  Decrypt resolved with:", decryptedData);
    console.log("  Type:", typeof decryptedData);
    console.log("  Is Uint8Array:", decryptedData instanceof Uint8Array);
    console.log("  Is null:", decryptedData === null);
    console.log("  Is undefined:", decryptedData === undefined);

    if (!decryptedData) {
      console.error("  ERROR: Decrypt returned falsy value!");
      throw new Error("Decryption returned empty result");
    }

    console.log("  SUCCESS: Decrypted", decryptedData.length, "bytes");
    return new TextDecoder().decode(decryptedData);
  } catch (error: any) {
    console.error("  CATCH block - Decrypt error:", error);
    console.error("  Error type:", typeof error);
    console.error("  Error is Error:", error instanceof Error);
    console.error("  Error keys:", error ? Object.keys(error) : "null/undefined");
    
    const errorMsg = error?.message || (error ? JSON.stringify(error) : "undefined error");
    throw new Error(`Decryption failed: ${errorMsg}`);
  }
}

export { SessionKey };
