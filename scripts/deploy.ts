/**
 * GhostContext Smart Contract Deployment Script
 */

/// <reference types="node" />

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Fix for __dirname (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= CONFIG =================
const NETWORK = "testnet";
const PRIVATE_KEY =
  "suiprivkey1qzchlgwk00favfekjusx0x6ymvn6a8uslkjv2npl20zf3cs2mpau54shr2k";
const EXPECTED_ADDRESS =
  "0x3819caed273797d0575aca93f4ab9ed95d80f93e85281affcf0d74f9aab45811";

// =============== MAIN FUNCTION =================
async function deployContract() {
  console.log("🚀 GhostContext - Smart Contract Deployment\n");
  console.log("═".repeat(70));

  // 1. RPC connection
  const rpcUrl = getFullnodeUrl(NETWORK);
  const client = new SuiClient({ url: rpcUrl });
  console.log(`✅ Connected to Sui ${NETWORK}`);
  console.log(`   RPC: ${rpcUrl}\n`);

  // 2. Load keypair
  let keypair: Ed25519Keypair;
  let address: string;

  try {
    const { secretKey } = decodeSuiPrivateKey(PRIVATE_KEY);
    keypair = Ed25519Keypair.fromSecretKey(secretKey);
    address = keypair.toSuiAddress();

    console.log(`📍 Deployer Address: ${address}`);
    console.log(
      address === EXPECTED_ADDRESS
        ? "✅ Address verified!\n"
        : `⚠️ WARNING: Address mismatch (expected ${EXPECTED_ADDRESS})\n`
    );
  } catch (err: any) {
    console.error("❌ Failed to import private key:", err.message);
    process.exit(1);
  }

  // 3. Check SUI balance
  try {
    const bal = await client.getBalance({ owner: address });
    const sui = Number(bal.totalBalance) / 1e9;
    console.log(`💰 Balance: ${sui.toFixed(4)} SUI\n`);

    if (sui < 0.1) {
      console.error("❌ Insufficient balance (requires ≥ 0.1 SUI)");
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Failed to fetch balance:", err);
    process.exit(1);
  }

  // 4. Load compiled Move modules (FIXED PATH)
  const buildPath = path.join(
    __dirname,
    "..",
    "contracts",
    "build",
    "bytecode_modules",
    "ghostcontext"
  );

  console.log(`🔍 Checking build path: ${buildPath}`);

  if (!fs.existsSync(buildPath)) {
    console.error("❌ Build folder not found!");
    console.error("💡 Run:  cd contracts && sui move build");
    process.exit(1);
  }

  const moduleFiles = fs
    .readdirSync(buildPath)
    .filter((f) => f.endsWith(".mv") && !f.includes("test"));

  if (moduleFiles.length === 0) {
    console.error("❌ No compiled modules found!");
    console.error("💡 Make sure Move.toml has the correct package name.");
    process.exit(1);
  }

  console.log(
    `📦 Found ${moduleFiles.length} module(s): ${moduleFiles.join(", ")}\n`
  );

  const modules = moduleFiles.map((file) =>
    Array.from(fs.readFileSync(path.join(buildPath, file)))
  );

  // 5. Create Publish Transaction
  console.log("🔄 Creating deployment transaction...\n");

  const tx = new Transaction();
  tx.setGasBudget(200_000_000); // 0.2 SUI gas

  const [upgradeCap] = tx.publish({
    modules,
    dependencies: ["0x1", "0x2"],
  });

  tx.transferObjects([upgradeCap], address);

  // 6. Execute Transaction
  console.log("⏳ Deploying... This may take 20–60 seconds.\n");

  try {
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    console.log("🎉 DEPLOYMENT SUCCESSFUL!\n");

    const published = result.objectChanges?.find((o) => o.type === "published");
    const packageId = (published as any)?.packageId;

    console.log("═".repeat(70));
    console.log("📦 Package ID:", packageId);
    console.log(
      "🔗 Explorer:",
      `https://suiexplorer.com/txblock/${result.digest}?network=${NETWORK}`
    );
    console.log("═".repeat(70));

    // Save deployment info
    const infoPath = path.join(__dirname, "..", "deployment-info.json");
    fs.writeFileSync(
      infoPath,
      JSON.stringify(
        {
          network: NETWORK,
          packageId,
          deployer: address,
          digest: result.digest,
          time: new Date().toISOString(),
        },
        null,
        2
      )
    );

    console.log(`💾 Saved: ${infoPath}`);
    console.log("🎉 DONE!\n");
  } catch (err) {
    console.error("❌ DEPLOY FAILED", err);
    process.exit(1);
  }
}

deployContract();
