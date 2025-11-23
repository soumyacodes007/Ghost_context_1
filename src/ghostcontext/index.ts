/**
 * GhostContext - Privacy-First RAG Vault
 * 
 * Main exports for the GhostContext system:
 * - Walrus storage integration
 * - Seal encryption (coming soon)
 * - Sui blockchain access control (coming soon)
 */

// Walrus Storage
export {
  uploadToWalrus,
  fetchFromWalrus,
  fetchFromWalrusBytes,
  blobExists,
  type WalrusUploadResponse,
} from './walrus';

// Payload Management
export {
  createGhostContextPayload,
  serializeGhostContextPayload,
  deserializeGhostContextPayload,
  type GhostContextPayload,
} from '../services/ghostcontext-payload';

// Test Utilities (remove in production)
export {
  testSimpleUpload,
  testJsonUpload,
  testBinaryUpload,
  runAllWalrusTests,
  quickTest,
} from './walrus-test';

