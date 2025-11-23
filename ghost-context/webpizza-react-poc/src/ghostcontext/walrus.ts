import axios from 'axios';

const PUBLISHER_URL = 'https://publisher.walrus-testnet.walrus.space';
const AGGREGATOR_URL = 'https://aggregator.walrus-testnet.walrus.space';

export async function uploadToWalrus(file: Blob): Promise<string> {
  try {
    const response = await axios.put(
      `${PUBLISHER_URL}/v1/store?epochs=5`,
      file,
      { headers: { 'Content-Type': 'application/octet-stream' } },
    );

    const blobId =
      response.data.newlyCreated?.blobObject.blobId ||
      response.data.alreadyCertified?.blobId;

    if (!blobId) {
      throw new Error('No Blob ID returned from Walrus');
    }

    return blobId;
  } catch (err) {
    console.error('Walrus Upload Error:', err);
    throw err;
  }
}

export async function fetchFromWalrus(blobId: string): Promise<string> {
  const response = await axios.get(`${AGGREGATOR_URL}/v1/${blobId}`, {
    responseType: 'text',
  });
  return response.data;
}


