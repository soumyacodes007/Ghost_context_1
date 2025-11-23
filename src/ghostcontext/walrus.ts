const PUBLISHER_URL = 'https://publisher.walrus-testnet.walrus.space';
const AGGREGATOR_URL = 'https://aggregator.walrus-testnet.walrus.space';

export interface WalrusUploadResponse {
  newlyCreated?: {
    blobObject: {
      id: string;
      registeredEpoch: number;
      blobId: string;
      size: number;
      encodingType: string;
      certifiedEpoch: number | null;
      storage: any;
      deletable: boolean;
    };
    resourceOperation: any;
    cost: number;
  };
  alreadyCertified?: {
    blobId: string;
    event: any;
    endEpoch: number;
  };
}

/**
 * Upload a file/blob to Walrus decentralized storage
 * @param file - Blob or File to upload
 * @param epochs - Number of epochs to store (default: 5)
 * @returns Blob ID from Walrus
 */
export async function uploadToWalrus(
  file: Blob,
  epochs: number = 5
): Promise<string> {
  try {
    console.log(`📤 Uploading ${file.size} bytes to Walrus...`);
    console.log(`🌐 Publisher: ${PUBLISHER_URL}`);

    const response = await fetch(
      `${PUBLISHER_URL}/v1/blobs?epochs=${epochs}`,
      {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Upload failed: ${response.status} - ${errorText}`);
      throw new Error(`Walrus upload failed: ${response.status} - ${errorText}`);
    }

    const result: WalrusUploadResponse = await response.json();
    console.log('📦 Walrus response:', result);

    let blobId: string;
    if (result.newlyCreated) {
      blobId = result.newlyCreated.blobObject.blobId;
      console.log('✅ File uploaded successfully!');
      console.log(`📦 Blob ID: ${blobId}`);
      console.log(`💰 Cost: ${result.newlyCreated.cost} MIST`);
    } else if (result.alreadyCertified) {
      blobId = result.alreadyCertified.blobId;
      console.log('✅ File already exists on Walrus!');
      console.log(`📦 Blob ID: ${blobId}`);
    } else {
      console.error('❌ Unexpected response format:', result);
      throw new Error('No Blob ID returned from Walrus');
    }

    return blobId;
  } catch (err) {
    console.error('❌ Walrus Upload Error:', err);
    throw err;
  }
}

/**
 * Fetch/download a blob from Walrus by its blob ID
 * @param blobId - The Walrus blob ID
 * @returns The blob content as a string
 */
export async function fetchFromWalrus(blobId: string): Promise<string> {
  try {
    console.log(`📥 Fetching blob from Walrus: ${blobId}`);
    console.log(`🌐 Aggregator: ${AGGREGATOR_URL}`);

    const response = await fetch(
      `${AGGREGATOR_URL}/v1/blobs/${blobId}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Download failed: ${response.status} - ${errorText}`);
      throw new Error(`Walrus download failed: ${response.status} - ${errorText}`);
    }

    const text = await response.text();
    console.log(`✅ Downloaded ${text.length} characters from Walrus`);
    return text;
  } catch (err) {
    console.error('❌ Walrus Fetch Error:', err);
    throw err;
  }
}

/**
 * Fetch/download a blob from Walrus as raw bytes
 * Useful for binary data like encrypted content
 * @param blobId - The Walrus blob ID
 * @returns The blob content as Uint8Array
 */
export async function fetchFromWalrusBytes(blobId: string): Promise<Uint8Array> {
  try {
    console.log(`📥 Fetching binary blob from Walrus: ${blobId}`);
    console.log(`🌐 Aggregator: ${AGGREGATOR_URL}`);

    const response = await fetch(
      `${AGGREGATOR_URL}/v1/blobs/${blobId}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Download failed: ${response.status} - ${errorText}`);
      throw new Error(`Walrus download failed: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    console.log(`✅ Downloaded ${bytes.length} bytes from Walrus`);
    return bytes;
  } catch (err) {
    console.error('❌ Walrus Fetch Error:', err);
    throw err;
  }
}

/**
 * Check if a blob exists on Walrus
 * @param blobId - The blob ID to check
 * @returns true if exists, false otherwise
 */
export async function blobExists(blobId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${AGGREGATOR_URL}/v1/blobs/${blobId}`,
      {
        method: 'HEAD',
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}


