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
  if (!sealPackageId) {
    throw new Error("Seal package id missing. Set VITE_SEAL_PACKAGE_ID.");
  }

  const data = new TextEncoder().encode(textData);
  const policyId = userAddress;

  const { encryptedObject } = await seal.encrypt({
    threshold: 1,
    packageId: sealPackageId,
    id: policyId,
    data,
  });

  const serialized = JSON.stringify(encryptedObject);
  return {
    encryptedBlob: new Blob([serialized], { type: "application/json" }),
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
  if (!sealPackageId) {
    throw new Error("Seal package id missing. Set VITE_SEAL_PACKAGE_ID.");
  }

  const sessionKey = await SessionKey.create({
    address: userAddress,
    packageId: sealPackageId,
    ttlMin: 60,
    suiClient: sui,
  });

  const message = sessionKey.getPersonalMessage();
  const { signature } = await walletSigner.signPersonalMessage({ message });
  sessionKey.setPersonalMessageSignature(signature);

  return sessionKey;
}

export async function decryptContext(
  encryptedJsonString: string,
  sessionKey: SessionKey
) {
  try {
    const encryptedObject = JSON.parse(encryptedJsonString);
    const tx = new Transaction();
    const txBytes = await tx.build({ client: sui, onlyTransactionKind: true });

    const decryptedData = await seal.decrypt({
      data: encryptedObject,
      sessionKey,
      txBytes,
    });

    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Could not unlock GhostContext.");
  }
}

export { SessionKey };
