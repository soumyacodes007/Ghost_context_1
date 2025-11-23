import { SealClient, SessionKey } from "@mysten/seal";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { deserializeSealObject, serializeSealObject } from "./seal-serialization";

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
  console.log("🔐 encryptContext called - NEW VERSION");
  console.log("   Package ID:", sealPackageId);
  console.log("   User address:", userAddress);
  console.log("   Data length:", textData.length);
  
  if (!sealPackageId) {
    throw new Error("Seal package id missing. Set VITE_SEAL_PACKAGE_ID.");
  }

  const data = new TextEncoder().encode(textData);
  const policyId = userAddress;

  console.log("   Calling seal.encrypt...");
  const encryptResult = await seal.encrypt({
    threshold: 1,
    packageId: sealPackageId,
    id: policyId,
    data,
  });

  console.log("   Encrypt result type:", typeof encryptResult);
  console.log("   Encrypt result keys:", Object.keys(encryptResult));
  
  // The result should have encryptedObject property
  const encryptedObject = encryptResult.encryptedObject;
  console.log("   encryptedObject type:", typeof encryptedObject);
  console.log("   encryptedObject is Uint8Array:", encryptedObject instanceof Uint8Array);
  
  // If it's a Uint8Array, just use it directly
  // If it's an object, serialize it
  let blobData: Uint8Array;
  if (encryptedObject instanceof Uint8Array) {
    console.log("   ✅ Using encrypted bytes directly:", encryptedObject.length, "bytes");
    console.log("   First 20 bytes:", Array.from(encryptedObject.slice(0, 20)));
    blobData = encryptedObject;
  } else {
    console.log("   Serializing structured object with serializeSealObject...");
    blobData = serializeSealObject(encryptedObject);
    console.log("   ✅ Serialized to", blobData.length, "bytes");
  }
  
  return {
    encryptedBlob: new Blob([blobData], { type: "application/octet-stream" }),
    policyId,
  };
}

export async function createSessionKey(
  userAddress: string,
  walletSigner: {
    signPersonalMessage: (args: {
      message: Uint8Array;
    }) => Promise<{ signature: string }>;
  },
  sealPackageId: string
) {
  console.log("Creating session key...");
  console.log("   User address:", userAddress);
  console.log("   Package ID:", sealPackageId);
  
  if (!sealPackageId) {
    throw new Error("Seal package id missing. Set VITE_SEAL_PACKAGE_ID.");
  }

  try {
    const sessionKey = await SessionKey.create({
      address: userAddress,
      packageId: sealPackageId,
      ttlMin: 30,
      suiClient: sui,
    });

    console.log("   Session key created");

    const message = sessionKey.getPersonalMessage();
    console.log("   Personal message to sign (length:", message.length, ")");
    
    const signResult = await walletSigner.signPersonalMessage({ message });
    console.log("   Signature received (length:", signResult.signature.length, ")");
    
    sessionKey.setPersonalMessageSignature(signResult.signature);

    // Store the address on the session key object since it's not accessible otherwise
    (sessionKey as any).userAddress = userAddress;
    (sessionKey as any).packageId = sealPackageId;

    console.log("   Session key signed and ready");
    return sessionKey;
  } catch (error) {
    console.error("   Failed to create session key:", error);
    throw error;
  }
}

export async function decryptContext(
  encryptedJsonString: string | Uint8Array,
  sessionKey: SessionKey,
  sealPackageId: string
) {
  console.log("🔍 Input type:", typeof encryptedJsonString, encryptedJsonString instanceof Uint8Array ? `Uint8Array(${encryptedJsonString.length})` : 'string');
  try {
    // Convert to Uint8Array if it's a string
    let encryptedBytes: Uint8Array;
    if (typeof encryptedJsonString === 'string') {
      encryptedBytes = new TextEncoder().encode(encryptedJsonString);
    } else {
      encryptedBytes = encryptedJsonString;
    }
    
    console.log("🔍 Encrypted bytes length:", encryptedBytes.length);
    console.log("🔍 First 20 bytes:", Array.from(encryptedBytes.slice(0, 20)));
    console.log("🔍 Seal package ID being used for PTB:", sealPackageId);
    
    // Get the address from session key (stored as userAddress in createSessionKey)
    const userAddress = (sessionKey as any).userAddress;
    if (!userAddress) {
      throw new Error("Session key does not have userAddress. Please recreate the session key.");
    }
    console.log("🔍 Using address for PTB:", userAddress);
    
    // Build a proper PTB that calls seal_policy::seal_approve
    const policyIdBytes = new TextEncoder().encode(userAddress);
    const tx = new Transaction();
    tx.moveCall({
      target: `${sealPackageId}::seal_policy::seal_approve`,
      arguments: [tx.pure.vector("u8", policyIdBytes)],
    });
    const txBytes = await tx.build({ client: sui, onlyTransactionKind: true });
    
    console.log("� Transoaction bytes created:", txBytes.length, "bytes");

    console.log("🔐 Calling Seal decrypt with raw bytes...");
    const decryptedData = await seal.decrypt({
      data: encryptedBytes,
      sessionKey,
      txBytes,
    });

    if (!decryptedData) {
      throw new Error("Seal decrypt returned undefined - decryption failed silently");
    }

    console.log("✅ Decryption successful! Decrypted", decryptedData.length, "bytes");
    return new TextDecoder().decode(decryptedData);
  } catch (error: any) {
    console.error("❌ Decryption failed:", error);
    console.error("   Error type:", typeof error);
    console.error("   Error constructor:", error?.constructor?.name);
    
    // Handle case where error is not an Error object
    const errorMessage = error?.message || String(error) || 'Unknown error';
    
    // Provide more helpful error messages
    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      throw new Error("Access denied: This data was encrypted for a different wallet address. Make sure you're connected with the wallet that encrypted this data.");
    } else if (errorMessage.includes('Invalid PTB')) {
      throw new Error("Invalid transaction format. The encrypted data may be corrupted or incompatible.");
    } else if (errorMessage.includes('session key')) {
      throw new Error("Session key is invalid or expired. Please create a new session key.");
    } else if (errorMessage.includes('undefined')) {
      throw new Error("Decryption failed: The encrypted data may be corrupted or was encrypted with a different wallet/package.");
    }
    
    throw new Error(`Could not unlock GhostContext: ${errorMessage}`);
  }
}

export { SessionKey };
