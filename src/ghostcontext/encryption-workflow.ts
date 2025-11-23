/**
 * Complete encryption workflow for GhostContext
 * Option A: Random keys stored on-chain for NFT transferability
 */

import { encryptData, decryptData } from "./crypto";
import { uploadToWalrus, fetchFromWalrusBytes } from "./walrus";
import {
  serializeGhostContextPayload,
  deserializeGhostContextPayload,
  type GhostContextPayload,
} from "../services/ghostcontext-payload";

export interface EncryptedMetadata {
  walrusBlobId: string;
  encryptionKey: string;
  iv: string;
  userAddress: string;
}

/**
 * Encrypt GhostContext payload and upload to Walrus
 * Uses random key (NOT wallet signature) for transferability
 */
export async function encryptAndUpload(
  payload: GhostContextPayload,
  userAddress: string
): Promise<EncryptedMetadata> {
  console.log("📦 Starting encryption and upload workflow (Option A)");
  console.log("  File:", payload.fileName);
  console.log("  Chunks:", payload.chunks.length);
  
  // Serialize the payload
  const serialized = serializeGhostContextPayload(payload);
  console.log("  Serialized:", serialized.length, "characters");
  
  // Encrypt with Web Crypto API using RANDOM key
  const { encryptedBlob, encryptionKey, iv } = await encryptData(serialized);
  console.log("  Encrypted successfully with random key");
  console.log("  ⚠️ Key will be stored on-chain - anyone with NFT can decrypt!");
  
  // Upload to Walrus
  console.log("  Uploading to Walrus...");
  const walrusBlobId = await uploadToWalrus(encryptedBlob);
  console.log("  ✅ Uploaded to Walrus:", walrusBlobId);
  
  return {
    walrusBlobId,
    encryptionKey,
    iv,
    userAddress,
  };
}

/**
 * Download from Walrus and decrypt GhostContext payload
 * Anyone with the on-chain key can decrypt
 */
export async function downloadAndDecrypt(
  metadata: EncryptedMetadata
): Promise<GhostContextPayload> {
  console.log("📥 Starting download and decryption workflow (Option A)");
  console.log("  Blob ID:", metadata.walrusBlobId);
  console.log("  Using on-chain encryption key");
  
  // Download from Walrus
  const encryptedBytes = await fetchFromWalrusBytes(metadata.walrusBlobId);
  console.log("  Downloaded:", encryptedBytes.length, "bytes");
  
  // Decrypt using the on-chain key
  const decrypted = await decryptData(
    encryptedBytes,
    metadata.encryptionKey,
    metadata.iv
  );
  console.log("  Decrypted successfully");
  
  // Deserialize
  const payload = deserializeGhostContextPayload(decrypted);
  console.log("  ✅ Loaded:", payload.fileName);
  
  return payload;
}
