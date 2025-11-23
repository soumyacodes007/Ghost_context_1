/**
 * GhostContext Smart Contract Deployment Script
 * Deploy GhostContext to Sui blockchain using TypeScript SDK
 */

/// <reference types="node" />

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import * as fs from "fs";
import * as path from "path";

// @ts-ignore - __dirname is provided by tsx at runtime
declare const __dirname: string;

// ==================== Configuration ====================
const NETWORK = "testnet";
const PRIVATE_KEY =
  "suiprivkey1qzchlgwk00favfekjusx0x6ymvn6a8uslkjv2npl20zf3cs2mpau54shr2k";
const EXPECTED_ADDRESS =
  "0x3819caed273797d0575aca93f4ab9ed95d80f93e85281affcf0d74f9aab45811";

// ==================== Main Deployment Function ====================
async function deployContract() {
  console.log("🚀 GhostContext - Smart Contract Deployment\n");
  console.log("═".repeat(70));

  // 1. Setup RPC and client
  const rpcUrl = getFullnodeUrl(NETWORK);
  const client = new SuiClient({ url: rpcUrl });
  console.log(`✅ Connected to Sui ${NETWORK}`);
  console.log(`   RPC: ${rpcUrl}\n`);

  // 2. Import keypair
  let keypair: Ed25519Keypair;
  let address: string;

  try {
    const { schema, secretKey } = decodeSuiPrivateKey(PRIVATE_KEY);
    keypair = Ed25519Keypair.fromSecretKey(secretKey);
    address = keypair.toSuiAddress();

    console.log(`📍 Deployer Address: ${address}`);

    if (address === EXPECTED_ADDRESS) {
      console.log(`✅ Address verified!\n`);
    } else {
      console.log(`⚠️  Address mismatch (expected ${EXPECTED_ADDRESS})\n`);
    }
  } catch (error: any) {
    console.error("❌ Failed to import private key");
    console.error("   Error:", error.message);
    process.exit(1);
  }

  // 3. Check balance
  try {
    const balance = await client.getBalance({ owner: address });
    const suiBalance = Number(balance.totalBalance) / 1000000000;

    console.log(`💰 Balance: ${suiBalance.toFixed(4)} SUI\n`);

    if (suiBalance < 0.1) {
      console.error("❌ Insufficient balance (need at least 0.1 SUI)");
      console.log("\n💡 Get testnet tokens:");
      console.log("   https://discord.gg/sui (#testnet-faucet)");
      console.log(`   !faucet ${address}\n`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ Failed to check balance:", error);
    process.exit(1);
  }

  // 4. Load compiled modules
  const buildPath = path.join(
    __dirname,
    "..",
    "contracts",
    "build",
    "ghostcontext",
    "bytecode_modules"
  );

  if (!fs.existsSync(buildPath)) {
    console.error("❌ Contract not built!");
    console.log("\n💡 Build first: sui move build\n");
    process.exit(1);
  }

  const moduleFiles = fs
    .readdirSync(buildPath)
    .filter((f) => f.endsWith(".mv") && !f.includes("test"));

  if (moduleFiles.length === 0) {
    console.error("❌ No compiled modules found!");
    console.log("\n💡 Build first: cd contracts && sui move build\n");
    process.exit(1);
  }

  const modules = moduleFiles.map((file) => {
    return Array.from(fs.readFileSync(path.join(buildPath, file)));
  });

  console.log(
    `📦 Found ${modules.length} module(s): ${moduleFiles.join(", ")}\n`
  );

  // 5. Create deployment transaction
  console.log("🔄 Creating deployment transaction...");

  const tx = new Transaction();
  tx.setGasBudget(100000000);

  const [upgradeCap] = tx.publish({
    modules,
    dependencies: ["0x1", "0x2"],
  });

  tx.transferObjects([upgradeCap], address);

  // 6. Execute deployment
  console.log("⏳ Deploying to blockchain (30-60 seconds)...\n");

  try {
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      },
    });

    console.log("\n✅ DEPLOYMENT SUCCESSFUL!\n");
    console.log("═".repeat(70));

    // 7. Extract info
    const publishedChange = result.objectChanges?.find(
      (c) => c.type === "published"
    );
    const packageId = (publishedChange as any)?.packageId;

    if (!packageId) {
      console.error("❌ Failed to extract package ID from deployment");
      console.error(
        "Object changes:",
        JSON.stringify(result.objectChanges, null, 2)
      );
      process.exit(1);
    }

    // Also look for the MarketplaceRegistry shared object created in init()
    // Shared objects created in init() appear as "created" with owner type "Shared"
    let registryId: string | null = null;
    let registrySharedVersion: string | null = null;

    for (const change of result.objectChanges || []) {
      if (change.type === "created") {
        const created = change as any;
        // Check if it's a MarketplaceRegistry and if it's shared
        if (
          created.objectType &&
          created.objectType.includes("MarketplaceRegistry")
        ) {
          registryId = created.objectId;
          // For shared objects, get initialSharedVersion from owner
          if (created.owner && created.owner.Shared) {
            registrySharedVersion =
              created.owner.Shared.initial_shared_version?.toString() || null;
          } else if (created.version) {
            // Fallback to version if owner structure is different
            registrySharedVersion = created.version.toString();
          }
          break;
        }
      }
    }

    // 8. Display results
    console.log("\n📋 DEPLOYMENT INFORMATION:");
    console.log("═".repeat(70));
    console.log(`Package ID:  ${packageId}`);
    console.log(`Transaction: ${result.digest}`);
    if (registryId) {
      console.log(`Registry ID: ${registryId}`);
      console.log(`Registry Shared Version: ${registrySharedVersion}`);
    }
    console.log("═".repeat(70));

    const explorerUrl = `https://suiexplorer.com/txblock/${result.digest}?network=${NETWORK}`;
    console.log(`\n🔗 Explorer: ${explorerUrl}\n`);

    // 9. Save deployment info
    const deploymentInfo = {
      network: NETWORK,
      packageId: packageId,
      registryId: registryId,
      registrySharedVersion: registrySharedVersion,
      deployerAddress: address,
      transactionDigest: result.digest,
      deployedAt: new Date().toISOString(),
      explorerUrl: explorerUrl,
    };

    const infoPath = path.join(__dirname, "..", "deployment-info.json");
    fs.writeFileSync(infoPath, JSON.stringify(deploymentInfo, null, 2));

    console.log("💾 Saved: deployment-info.json\n");

    // 10. Next steps
    console.log("📝 NEXT STEPS:\n");
    console.log("Update your .env file:");
    console.log(`VITE_GHOSTCONTEXT_PACKAGE_ID=${packageId}`);
    if (registryId) {
      console.log(`VITE_GHOSTCONTEXT_REGISTRY_ID=${registryId}`);
    }
    console.log("\n🎉 DEPLOYMENT COMPLETE!\n");
  } catch (error: any) {
    console.error("\n❌ DEPLOYMENT FAILED");
    console.error("Error:", error.message || error);

    if (error.data) {
      console.error("\nError details:", JSON.stringify(error.data, null, 2));
    }

    if (error.cause) {
      console.error("\nCause:", error.cause);
    }

    // Log full error for debugging
    if (process.env.DEBUG) {
      console.error("\nFull error:", error);
    }

    process.exit(1);
  }
}

deployContract().catch(console.error);
