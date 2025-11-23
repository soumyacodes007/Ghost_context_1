// Temporary test to debug seal.decrypt issue
import { SealClient, SessionKey } from "@mysten/seal";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

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

console.log("Seal client:", seal);
console.log("Seal client methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(seal)));
