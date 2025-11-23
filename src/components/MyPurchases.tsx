import { useState, useEffect } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useNavigate } from "react-router-dom";
import { decryptData } from "../ghostcontext/crypto";
import { fetchFromWalrusBytes } from "../ghostcontext/walrus";
import { deserializeGhostContextPayload } from "../services/ghostcontext-payload";
import { Card, CardBody, CardFooter } from "./ui/Card";
import { User, TrendingUp, ShoppingBag, Copy, Check } from "lucide-react";
import "./MyPurchases.css";

interface QueryReceipt {
  id: string;
  contextId: string;
  walrusBlobId: string;
  encryptionKey: string;
  iv: string;
  queriesPurchased: number;
  queriesRemaining: number;
  purchasedAt: string;
  contextTitle?: string;
}

const MyPurchases = () => {
  const [receipts, setReceipts] = useState<QueryReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReceipt, setLoadingReceipt] = useState<string | null>(null);
  const [copiedBlobId, setCopiedBlobId] = useState<string | null>(null);
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const navigate = useNavigate();

  const ghostContextPackageId = import.meta.env.VITE_GHOSTCONTEXT_PACKAGE_ID as string | undefined;

  useEffect(() => {
    console.log("🔍 MyPurchases - Package ID:", ghostContextPackageId);
    console.log("🔍 Expected NEW package:", "0x6344fd2b687d7d3fa1c10f0a334dc0d8b2c9297be53e04595f308f211d5aa0f6");
    console.log("🔍 OLD package (should NOT be this):", "0x7bb1869916ab70453bb935830d664cba9ea46889e69d42e20bfe025714da0bf8");
  }, []);

  useEffect(() => {
    if (currentAccount) {
      loadMyReceipts();
    }
  }, [currentAccount]);

  const loadMyReceipts = async () => {
    if (!currentAccount || !ghostContextPackageId) return;

    try {
      setLoading(true);
      console.log("📥 Loading your purchases...");

      // Get all objects owned by user
      const ownedObjects = await suiClient.getOwnedObjects({
        owner: currentAccount.address,
        options: {
          showType: true,
          showContent: true,
        },
      });

      console.log("Found owned objects:", ownedObjects.data.length);

      // Filter for QueryReceipts
      const receiptPromises = ownedObjects.data
        .filter((obj) => {
          const type = obj.data?.type;
          return type?.includes("QueryReceipt");
        })
        .map(async (obj) => {
          if (obj.data?.content?.dataType === "moveObject") {
            const fields = (obj.data.content as any).fields;
            
            console.log("📋 Receipt fields:", fields);
            console.log("🔑 Encryption key from receipt:", fields.encryption_key);
            console.log("🔑 IV from receipt:", fields.iv);

            // Try to get context title
            let contextTitle = "Unknown Context";
            try {
              const contextObj = await suiClient.getObject({
                id: fields.context_id,
                options: { showContent: true },
              });
              if (contextObj.data?.content?.dataType === "moveObject") {
                const contextFields = (contextObj.data.content as any).fields;
                contextTitle = contextFields.title;
              }
            } catch (error) {
              console.error("Failed to fetch context title:", error);
            }

            return {
              id: obj.data.objectId,
              contextId: fields.context_id,
              walrusBlobId: fields.walrus_blob_id,
              encryptionKey: fields.encryption_key || "",
              iv: fields.iv || "",
              queriesPurchased: parseInt(fields.queries_purchased),
              queriesRemaining: parseInt(fields.queries_remaining),
              purchasedAt: fields.purchased_at,
              contextTitle,
            };
          }
          return null;
        });

      const fetchedReceipts = await Promise.all(receiptPromises);
      const validReceipts = fetchedReceipts.filter((r) => r !== null) as QueryReceipt[];

      console.log("✅ Loaded receipts:", validReceipts.length);
      setReceipts(validReceipts);
    } catch (error) {
      console.error("Failed to load receipts:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyBlobId = async (blobId: string) => {
    try {
      await navigator.clipboard.writeText(blobId);
      setCopiedBlobId(blobId);
      setTimeout(() => setCopiedBlobId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      alert("Failed to copy blob ID");
    }
  };

  const handleLoadAndChat = async (receipt: QueryReceipt) => {
    try {
      setLoadingReceipt(receipt.id);
      console.log("🔓 Loading purchased context:", receipt.contextTitle);
      console.log("Receipt data:", receipt);
      console.log("Encryption key:", receipt.encryptionKey);
      console.log("IV:", receipt.iv);
      console.log("Walrus blob ID:", receipt.walrusBlobId);

      if (!receipt.encryptionKey || !receipt.iv) {
        throw new Error("Receipt is missing encryption keys. This might be an old receipt from before keys were stored on-chain.");
      }

      // Download encrypted blob from Walrus
      console.log("📥 Downloading from Walrus:", receipt.walrusBlobId);
      const encryptedBytes = await fetchFromWalrusBytes(receipt.walrusBlobId);

      // Decrypt using keys from receipt
      console.log("🔐 Decrypting with receipt keys...");
      const decrypted = await decryptData(
        encryptedBytes,
        receipt.encryptionKey,
        receipt.iv
      );

      // Deserialize payload
      const payload = deserializeGhostContextPayload(decrypted);
      console.log("✅ Loaded:", payload.fileName);

      // Store in sessionStorage to pass to Chat
      sessionStorage.setItem("loadedContext", JSON.stringify({
        payload,
        receiptId: receipt.id,
        queriesRemaining: receipt.queriesRemaining,
      }));

      // Navigate to chat page
      navigate("/chat?loadContext=true");
    } catch (error: any) {
      console.error("Failed to load context:", error);
      alert(`Failed to load: ${error.message}`);
    } finally {
      setLoadingReceipt(null);
    }
  };

  if (!currentAccount) {
    return (
      <div className="purchases-container">
        <div className="page-container">
          <div className="empty-state">
            <div className="empty-state-icon">🔒</div>
            <h2 className="empty-state-title">Wallet Not Connected</h2>
            <p className="empty-state-text">Please connect your wallet to view your purchases.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="purchases-container">
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">📚 My Purchases</h1>
          <p className="page-subtitle">Your purchased GhostContext access</p>
        </div>

        <div className="purchases-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your purchases...</p>
          </div>
        ) : receipts.length === 0 ? (
          <div className="empty-state">
            <h2>📭 No Purchases Yet</h2>
            <p>You haven't purchased any contexts yet.</p>
            <button onClick={() => navigate("/marketplace")} className="btn-primary">
              Browse Marketplace
            </button>
          </div>
        ) : (
          <div className="receipts-grid">
            {receipts.map((receipt) => (
              <Card key={receipt.id} className="marketplace-card" hover>
                <CardBody className="marketplace-card-body">
                  {/* Title with Status Badge */}
                  <div className="title-section">
                    <h3 className="card-title">{receipt.contextTitle}</h3>
                    {receipt.queriesRemaining > 0 ? (
                      <span className="category-tag" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>Active</span>
                    ) : (
                      <span className="category-tag" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>Expired</span>
                    )}
                  </div>

                  {/* Document Tags */}
                  <div className="doc-tags">
                    <span className="doc-tag">Purchased</span>
                    <span className="doc-tag">Encrypted</span>
                  </div>

                  {/* Queries Info */}
                  <div className="price-container">
                    <div>
                      <div className="price-row">
                        <span className="price-value">{receipt.queriesRemaining}</span>
                        <span className="price-unit">/ {receipt.queriesPurchased}</span>
                      </div>
                      <span className="price-subtitle">queries remaining</span>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="stats-row">
                    <div className="stat-item">
                      <ShoppingBag size={12} />
                      <span className="stat-value">{receipt.queriesPurchased}</span>
                      <span className="stat-label">purchased</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item">
                      <TrendingUp size={12} />
                      <span className="stat-value">{receipt.queriesRemaining}</span>
                      <span className="stat-label">left</span>
                    </div>
                  </div>

                  {/* Receipt ID */}
                  <div className="owner-row">
                    <User size={14} />
                    <span className="owner-address">
                      {receipt.id.substring(0, 8)}...{receipt.id.substring(receipt.id.length - 6)}
                    </span>
                  </div>

                  {/* Blob ID with Copy Button */}
                  <div className="blob-id-row">
                    <div className="blob-id-content">
                      <span className="blob-id-label">Blob ID:</span>
                      <span className="blob-id-value">
                        {receipt.walrusBlobId.substring(0, 12)}...{receipt.walrusBlobId.substring(receipt.walrusBlobId.length - 8)}
                      </span>
                    </div>
                    <button
                      className="copy-btn"
                      onClick={() => copyBlobId(receipt.walrusBlobId)}
                      title="Copy full blob ID"
                    >
                      {copiedBlobId === receipt.walrusBlobId ? (
                        <Check size={14} />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </CardBody>

                <CardFooter className="marketplace-card-footer">
                  {!receipt.encryptionKey || !receipt.iv ? (
                    <button className="action-btn unavailable-btn" disabled title="This receipt is from the old contract without encryption keys">
                      ⚠️ No Keys
                    </button>
                  ) : receipt.queriesRemaining > 0 ? (
                    <button
                      className="action-btn purchase-btn"
                      onClick={() => handleLoadAndChat(receipt)}
                      disabled={loadingReceipt === receipt.id}
                    >
                      {loadingReceipt === receipt.id ? "Loading..." : "🔓 Load & Chat"}
                    </button>
                  ) : (
                    <button className="action-btn unavailable-btn" disabled>
                      No Queries Left
                    </button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default MyPurchases;
