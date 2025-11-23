import type { ParsedChunk } from './pdf-parser';

export interface GhostContextPayload {
  fileName: string;
  chunks: ParsedChunk[];
  description?: string;
  category?: string;
  createdAt: string;
  walrusBlobId?: string;
  policyId?: string;
}

export function createGhostContextPayload(
  fileName: string,
  chunks: ParsedChunk[],
  extras?: Pick<GhostContextPayload, 'description' | 'category'>
): GhostContextPayload {
  return {
    fileName,
    chunks,
    description: extras?.description,
    category: extras?.category,
    createdAt: new Date().toISOString(),
  };
}

export function serializeGhostContextPayload(payload: GhostContextPayload): string {
  return JSON.stringify(payload);
}

export function deserializeGhostContextPayload(serialized: string): GhostContextPayload {
  return JSON.parse(serialized) as GhostContextPayload;
}


