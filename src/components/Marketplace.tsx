import { useState, useEffect } from "react";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction, Inputs } from "@mysten/sui/transactions";
import { Card, CardBody, CardFooter } from "./ui/Card";
import { User, TrendingUp, ShoppingBag } from "lucide-react";
import walrusIcon from "./assets/walrus.svg";
import sealIcon from "./assets/seal.svg";
import "./Marketplace.css";

interface GhostContextNFT {
  id: string;
  title: string;
  walrusBlobId: string;
  encryptionKey: string;
  iv: string;
  category: string;
  owner: string;
  version: string;
  isListed?: boolean;
  pricePerQuery?: string;
  totalRevenue?: string;
  totalQueriesSold?: string;
}

const Marketplace = () => {
  const [contexts, setContexts] = useState<GhostContextNFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedContext, setSelectedContext] = useState<GhostContextNFT | null>(null);
  const [queryCount, setQueryCount] = useState("10");
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const signAndExecuteTransaction = useSignAndExecuteTransaction({
    mutationKey: ["marketplace-purchase"],
  });

  const ghostContextPackageId = import.meta.env.VITE_GHOSTCONTEXT_PACKAGE_ID as string | undefined;
  const registryObjectId = import.meta.env.VITE_GHOSTCONTEXT_REGISTRY_ID as string | undefined;

  useEffect(() => {
    loadMarketplace();
  }, []);

  const openPurchaseModal = (context: GhostContextNFT) => {
    if (!currentAccount) {
      alert("Please connect your wallet first");
      return;
    }

    if (!ghostContextPackageId || !registryObjectId) {
      alert("Missing contract configuration");
      return;
    }

    setSelectedContext(context);
    setQueryCount("10");
    setShowPurchaseModal(true);
  };

  const handlePurchaseAccess = async () => {
    if (!selectedContext) return;

    const queries = parseInt(queryCount);
    if (isNaN(queries) || queries <= 0) {
      alert("Please enter a valid number of queries");
      return;
    }

    const pricePerQueryNum = parseInt(selectedContext.pricePerQuery || "0");
    const totalCost = pricePerQueryNum * queries;

    setShowPurchaseModal(false);

    try {
      setPurchasing(selectedContext.id);
      console.log("🛒 Purchasing access to:", selectedContext.title);

      // Get registry shared version
      const registryObj = await suiClient.getObject({
        id: registryObjectId!,
        options: { showOwner: true },
      });
      const registrySharedVersion = (registryObj.data?.owner as any)?.Shared?.initial_shared_version;

      if (!registrySharedVersion) {
        throw new Error("Could not get registry shared version");
      }

      // Get fresh context object to get current shared version
      const contextObj = await suiClient.getObject({
        id: selectedContext.id,
        options: { showOwner: true },
      });
      
      const contextSharedVersion = (contextObj.data?.owner as any)?.Shared?.initial_shared_version;
      console.log("Context shared version:", contextSharedVersion);

      if (!contextSharedVersion) {
        throw new Error("Could not get context shared version");
      }

      // Build transaction
      const tx = new Transaction();
      
      const contextArg = Inputs.SharedObjectRef({
        objectId: selectedContext.id,
        initialSharedVersion: contextSharedVersion,
        mutable: true,
      });

      const registryArg = Inputs.SharedObjectRef({
        objectId: registryObjectId!,
        initialSharedVersion: registrySharedVersion,
        mutable: true,
      });

      // Split coins for payment
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(totalCost)]);

      tx.moveCall({
        target: `${ghostContextPackageId}::ghostcontext::purchase_queries`,
        arguments: [
          tx.object(contextArg),
          tx.pure.u64(queries),
          coin,
          tx.object(registryArg),
        ],
      });

      const response = await signAndExecuteTransaction.mutateAsync({
        transaction: tx,
        chain: "sui:testnet",
      });

      console.log("✅ Purchase successful:", response.digest);
      alert(`Purchase successful! You now have ${queries} queries. Check your wallet for the QueryReceipt NFT with encryption keys.`);
      
      // Reload marketplace to update stats
      await loadMarketplace();
    } catch (error: any) {
      console.error("Purchase failed:", error);
      alert(`Purchase failed: ${error.message || "Unknown error"}`);
    } finally {
      setPurchasing(null);
    }
  };

  const loadMarketplace = async () => {
    if (!ghostContextPackageId) {
      console.error("Missing package ID");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log("🔍 Loading marketplace from blockchain...");
      console.log("Package ID:", ghostContextPackageId);
      
      // Query all ContextCreated events to find all NFTs
      const events = await suiClient.queryEvents({
        query: {
          MoveEventType: `${ghostContextPackageId}::ghostcontext::ContextCreated`
        },
        limit: 50,
      });

      console.log("📦 Found events:", events.data.length);

      // Parse events to get context details
      const contextPromises = events.data.map(async (event: any) => {
        const contextId = event.parsedJson.id;
        
        try {
          // Fetch the actual NFT object to get current state
          const nftObject = await suiClient.getObject({
            id: contextId,
            options: {
              showContent: true,
              showOwner: true,
            },
          });

          if (nftObject.data?.content?.dataType === "moveObject") {
            const fields = (nftObject.data.content as any).fields;
            
            console.log(`Context ${contextId} fields:`, fields);
            
            return {
              id: contextId,
              title: fields.title,
              walrusBlobId: fields.walrus_blob_id,
              encryptionKey: fields.encryption_key || "",
              iv: fields.iv || "",
              category: fields.category,
              owner: fields.owner,
              version: nftObject.data.version || "1",
              isListed: fields.is_listed,
              pricePerQuery: fields.price_per_query?.toString() || "0",
              totalRevenue: fields.total_revenue?.toString() || "0",
              totalQueriesSold: fields.total_queries_sold?.toString() || "0",
            };
          }
        } catch (error) {
          console.error(`Failed to fetch context ${contextId}:`, error);
          return null;
        }
      });

      const fetchedContexts = await Promise.all(contextPromises);
      const validContexts = fetchedContexts.filter((c) => c !== null) as GhostContextNFT[];
      
      console.log("✅ Loaded contexts:", validContexts.length);
      setContexts(validContexts);
    } catch (error) {
      console.error("Failed to load marketplace:", error);
    } finally {
      setLoading(false);
    }
  };

  const categories = ["All", "General", "Technical", "Research", "Education"];

  const filteredContexts = filter === "All" 
    ? contexts 
    : contexts.filter(c => c.category === filter);

  // Generate random document tags based on context ID (deterministic)
  const getDocumentTags = (contextId: string) => {
    const allTags = [
      "PDF", "Markdown", "Text", "JSON", "CSV", 
      "Code", "API Docs", "Tutorial", "Guide", "Notes",
      "Report", "Analysis", "Dataset", "Schema", "Config"
    ];
    
    // Use context ID to generate deterministic random tags
    const hash = contextId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const tagCount = 2 + (hash % 2); // 2-3 tags
    const selectedTags: string[] = [];
    
    for (let i = 0; i < tagCount; i++) {
      const index = (hash + i * 7) % allTags.length;
      if (!selectedTags.includes(allTags[index])) {
        selectedTags.push(allTags[index]);
      }
    }
    
    return selectedTags;
  };

  // Format price for display in MIST
  const formatPriceInMist = (priceStr: string) => {
    const mist = parseInt(priceStr);
    return mist === 0 ? "1,000" : mist.toLocaleString();
  };

  // Format title
  const formatTitle = (title: string) => {
    return title.replace(/_/g, ' ');
  };

  return (
    <div className="marketplace-container">
      <div className="page-container">
      <div className="marketplace-content">
        <aside className="marketplace-sidebar">
          <div className="sidebar-card">
            <h3 className="sidebar-title">Categories</h3>
            <div className="sidebar-menu">
              {categories.map((cat) => {
                const icons: Record<string, string> = {
                  All: "M4 6h16M4 12h16M4 18h16",
                  General: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
                  Technical: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
                  Research: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
                  Education: "M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z",
                };
                return (
                  <button
                    key={cat}
                    className={`menu-item ${filter === cat ? "active" : ""}`}
                    onClick={() => setFilter(cat)}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={icons[cat] || icons.General}></path>
                    </svg>
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Powered By Section - Bottom */}
          <div className="powered-by-section">
            <div className="powered-by-text">Powered by</div>
            <div className="powered-by-item">
              <img src={walrusIcon} alt="Walrus" className="powered-by-icon" />
              <span className="powered-by-name">WALRUS</span>
            </div>
            <div className="powered-by-divider">and</div>
            <div className="powered-by-item">
              <img src={sealIcon} alt="SUI" className="powered-by-icon" />
              <span className="powered-by-name">SUI</span>
            </div>
          </div>
        </aside>

        <main className="marketplace-main">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading marketplace...</p>
            </div>
          ) : contexts.length === 0 ? (
            <div className="empty-state">
              <h2>📭 No Contexts Yet</h2>
              <p>Be the first to mint a GhostContext NFT!</p>
              <a href="/" className="btn-primary">
                Go to Home
              </a>
            </div>
          ) : (
            <div className="context-grid">
              {filteredContexts.map((context) => {
                const isOwned = context.owner === currentAccount?.address;
                const isListed = context.isListed && context.pricePerQuery;
                
                return (
                  <Card key={context.id} className="marketplace-card" hover>
                    <CardBody className="marketplace-card-body">
                      {/* Title with Fixed Height */}
                      <div className="title-section">
                        <h3 className="card-title">{formatTitle(context.title)}</h3>
                        <span className="category-tag">{context.category}</span>
                      </div>

                      {/* Document Tags */}
                      <div className="doc-tags">
                        {getDocumentTags(context.id).map((tag, idx) => (
                          <span key={idx} className="doc-tag">{tag}</span>
                        ))}
                      </div>

                      {/* Price/Status Section */}
                      {isListed ? (
                        <div className="price-container">
                          <div>
                            <div className="price-row">
                              <span className="price-value">{formatPriceInMist(context.pricePerQuery || "0")}</span>
                              <span className="price-unit">MIST</span>
                            </div>
                            <span className="price-subtitle">per query</span>
                          </div>
                        </div>
                      ) : isOwned ? (
                        <div className="status-container">
                          <span className="status-text">Vault</span>
                        </div>
                      ) : (
                        <div className="status-container">
                          <span className="status-text private">Private</span>
                        </div>
                      )}

                      {/* Stats Row */}
                      <div className="stats-row">
                        <div className="stat-item">
                          <ShoppingBag size={12} />
                          <span className="stat-value">{context.totalQueriesSold || "0"}</span>
                          <span className="stat-label">queries</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat-item">
                          <TrendingUp size={12} />
                          <span className="stat-value">{parseInt(context.totalRevenue || "0").toLocaleString()}</span>
                          <span className="stat-label">MIST</span>
                        </div>
                      </div>

                      {/* Owner with Icon */}
                      <div className="owner-row">
                        <User size={14} />
                        <span className="owner-address">
                          {context.owner.substring(0, 6)}...{context.owner.substring(context.owner.length - 4)}
                        </span>
                      </div>
                    </CardBody>

                    <CardFooter className="marketplace-card-footer">
                      {isOwned ? (
                        <button className="action-btn owned-btn" disabled>
                          You Own This
                        </button>
                      ) : isListed ? (
                        <button 
                          className="action-btn purchase-btn"
                          onClick={() => openPurchaseModal(context)}
                          disabled={purchasing === context.id}
                        >
                          {purchasing === context.id ? "Purchasing..." : "Purchase"}
                        </button>
                      ) : (
                        <button className="action-btn unavailable-btn" disabled>
                          Not Available
                        </button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
      </div>

      {/* Purchase Modal */}
      {showPurchaseModal && selectedContext && (
        <div className="modal-overlay" onClick={() => setShowPurchaseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Purchase Queries</h3>
              <button className="modal-close" onClick={() => setShowPurchaseModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="modal-context-info">
                <h4>{selectedContext.title}</h4>
                <p className="modal-price">
                  {formatPriceInMist(selectedContext.pricePerQuery || "0")} MIST per query
                </p>
              </div>

              <div className="modal-input-group">
                <label htmlFor="queryInput" className="modal-label">
                  Number of Queries
                </label>
                <input
                  id="queryInput"
                  type="number"
                  min="1"
                  value={queryCount}
                  onChange={(e) => setQueryCount(e.target.value)}
                  className="modal-input"
                  placeholder="Enter number of queries"
                  autoFocus
                />
              </div>

              <div className="modal-total">
                <span>Total Cost:</span>
                <span className="modal-total-value">
                  {(parseInt(selectedContext.pricePerQuery || "0") * parseInt(queryCount || "0")).toLocaleString()} MIST
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="modal-btn modal-btn-secondary" 
                onClick={() => setShowPurchaseModal(false)}
              >
                Cancel
              </button>
              <button 
                className="modal-btn modal-btn-primary" 
                onClick={handlePurchaseAccess}
                disabled={!queryCount || parseInt(queryCount) <= 0}
              >
                Confirm Purchase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketplace;
