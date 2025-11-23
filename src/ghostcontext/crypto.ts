/**
 * Web Crypto API based encryption/decryption
 * Uses random key (stored on-chain) for NFT transferability
 */

export async function encryptData(
  data: string
): Promise<{ encryptedBlob: Blob; encryptionKey: string; iv: string }> {
  console.log("CRYPTO: Starting encryption");
  console.log("  Data length:", data.length);
  
  // Generate random encryption key (NOT from wallet!)
  const keyBytes = crypto.getRandomValues(new Uint8Array(32)); // 256-bit key
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  
  // Import key for AES-GCM
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    true,
    ["encrypt"]
  );
  
  // Encrypt the data
  const dataBytes = new TextEncoder().encode(data);
  const encryptedBytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    dataBytes
  );
  
  console.log("  Encrypted:", encryptedBytes.byteLength, "bytes");
  console.log("  Key will be stored on-chain - anyone with NFT can decrypt!");
  
  return {
    encryptedBlob: new Blob([encryptedBytes], { type: "application/octet-stream" }),
    encryptionKey: Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join(''),
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('')
  };
}

export async function decryptData(
  encryptedBytes: Uint8Array,
  encryptionKey: string,
  iv: string
): Promise<string> {
  console.log("CRYPTO: Starting decryption");
  console.log("  Encrypted data length:", encryptedBytes.length);
  console.log("  Encryption key:", encryptionKey);
  console.log("  IV:", iv);
  
  if (!encryptionKey || !iv) {
    throw new Error("Missing encryption key or IV");
  }
  
  // Convert key and IV from hex
  const keyBytes = new Uint8Array(encryptionKey.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
  const ivBytes = new Uint8Array(iv.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
  
  // Import key
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  
  // Decrypt
  try {
    const decryptedBytes = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes },
      key,
      encryptedBytes
    );
    
    console.log("  Decrypted:", decryptedBytes.byteLength, "bytes");
    console.log("  Anyone with the on-chain key can decrypt!");
    return new TextDecoder().decode(decryptedBytes);
  } catch (error) {
    console.error("  Decryption failed:", error);
    throw new Error("Decryption failed. The encryption key or data may be corrupted.");
  }
}
