import { useState, useEffect, useRef } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Upload, Lock, FileText, Check } from "lucide-react";
import { RagEngine } from "../services/rag-engine";
import { LlmClient } from "../services/llm-client";
import { Embedder } from "../services/embedder";
import { VectorStore } from "../services/vector-store";
import { PdfParser } from "../services/pdf-parser";
import { Transaction, Inputs } from "@mysten/sui/transactions";
import {
  encryptAndUpload,
  type EncryptedMetadata,
} from "../ghostcontext/encryption-workflow";
import {
  createGhostContextPayload,
  type GhostContextPayload,
} from "../services/ghostcontext-payload";
import "./Vault.css";

const Vault = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadFileName, setUploadFileName] = useState("");
  const [ghostPayload, setGhostPayload] = useState<GhostContextPayload | null>(null);
  const [walrusBlobId, setWalrusBlobId] = useState("");
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptionMetadata, setEncryptionMetadata] = useState<EncryptedMetadata | null>(null);
  const [contextTitle, setContextTitle] = useState("");
  const [contextCategory, setContextCategory] = useState("General");
  const [pricePerQuery, setPricePerQuery] = useState("1");
  const [mintedContextId, setMintedContextId] = useState("");
  const [isMinting, setIsMinting] = useState(false);
  const [registrySharedVersion, setRegistrySharedVersion] = useState<string | null>(null);
  const [contextSharedVersion, setContextSharedVersion] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const signAndExecuteTransaction = useSignAndExecuteTransaction({
    mutationKey: ["vault-sign"],
  });

  const ghostContextPackageId = import.meta.env.VITE_GHOSTCONTEXT_PACKAGE_ID as string | undefined;
  const registryObjectId = import.meta.env.VITE_GHOSTCONTEXT_REGISTRY_ID as string | undefined;

  const ragRef = useRef<RagEngine | null>(null);

  useEffect(() => {
    const llm = new LlmClient();
    const embedder = new Embedder();
    const vectorStore = new VectorStore();
    const parser = new PdfParser();
    ragRef.current = new RagEngine(llm, embedder, vectorStore, parser);
  }, []);

  useEffect(() => {
    if (!registryObjectId) return;
    suiClient
      .getObject({ id: registryObjectId, options: { showOwner: true } })
      .then((result) => {
        const sharedVersion = (result.data?.owner as any)?.Shared?.initial_shared_version;
        if (sharedVersion) {
          setRegistrySharedVersion(sharedVersion);
        }
      })
      .catch((error) => console.error("Failed to fetch registry shared version", error));
  }, [registryObjectId, suiClient]);

  const fetchContextSharedVersion = async (objectId: string) => {
    try {
      const response = await suiClient.getObject({
        id: objectId,
        options: { showOwner: true },
      });
      const sharedVersion = (response.data?.owner as any)?.Shared?.initial_shared_version;
      if (sharedVersion) {
        setContextSharedVersion(sharedVersion);
      }
    } catch (error) {
      console.error("Failed to fetch context shared version", error);
    }
  };

  const showToastNotification = (message: string, type: "success" | "error") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  const onFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadFileName(file.name);
    setUploadProgress(0);
    setUploadStatus("Starting...");

    try {
      const rag = ragRef.current;
      if (!rag) throw new Error("RAG engine not initialized");

      setUploadStatus("📖 Parsing PDF...");
      setUploadProgress(10);

      const chunks = await rag.parser.parseFile(file);
      setGhostPayload(
        createGhostContextPayload(file.name, chunks, {
          category: contextCategory,
        })
      );
      setContextTitle(file.name.replace(/\.[^/.]+$/, ""));
      setWalrusBlobId("");
      setMintedContextId("");
      setContextSharedVersion(null);
      setUploadProgress(30);
      setUploadStatus(`✂️ Split into ${chunks.length} chunks`);

      const totalChunks = chunks.length;
      for (const [index] of chunks.entries()) {
        const chunkNum = index + 1;
        setUploadStatus(`🔢 Processing chunk ${chunkNum}/${totalChunks}...`);
        setUploadProgress(30 + Math.floor((index / totalChunks) * 60));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      setUploadProgress(100);
      setUploadStatus("✅ Complete!");
      showToastNotification(`Document "${file.name}" processed successfully!`, "success");
    } catch (error) {
      console.error("❌ Processing error:", error);
      showToastNotification("Error processing document", "error");
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleEncryptAndUpload = async () => {
    if (!ghostPayload) {
      showToastNotification("Upload a document first.", "error");
      return;
    }
    if (!currentAccount) {
      showToastNotification("Connect your wallet first.", "error");
      return;
    }

    try {
      setIsEncrypting(true);
      const metadata = await encryptAndUpload(ghostPayload, currentAccount.address);
      console.log("🔐 Encryption metadata:", metadata);
      console.log("🔑 Encryption key:", metadata.encryptionKey);
      console.log("🔑 IV:", metadata.iv);
      setEncryptionMetadata(metadata);
      setWalrusBlobId(metadata.walrusBlobId);
      setGhostPayload({
        ...ghostPayload,
        walrusBlobId: metadata.walrusBlobId,
        policyId: currentAccount.address,
      });
      showToastNotification("Context encrypted & uploaded to Walrus!", "success");
    } catch (error: any) {
      console.error("Encryption failed:", error);
      showToastNotification(`Encryption failed: ${error.message}`, "error");
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleMintContext = async () => {
    if (!currentAccount || !ghostContextPackageId || !registryObjectId || !registrySharedVersion) {
      showToastNotification("Missing configuration or wallet not connected.", "error");
      return;
    }
    if (!walrusBlobId || !encryptionMetadata) {
      showToastNotification("Encrypt and upload to Walrus first.", "error");
      return;
    }

    try {
      setIsMinting(true);
      const title = contextTitle || ghostPayload?.fileName || "GhostContext";
      const tx = new Transaction();
      const registryArg = Inputs.SharedObjectRef({
        objectId: registryObjectId,
        initialSharedVersion: registrySharedVersion,
        mutable: true,
      });

      console.log("🪙 Minting with keys:");
      console.log("  - Encryption Key:", encryptionMetadata.encryptionKey);
      console.log("  - IV:", encryptionMetadata.iv);
      console.log("  - Walrus Blob:", walrusBlobId);

      tx.moveCall({
        target: `${ghostContextPackageId}::ghostcontext::create_context`,
        arguments: [
          tx.pure.string(title),
          tx.pure.string(walrusBlobId),
          tx.pure.string(encryptionMetadata.encryptionKey),
          tx.pure.string(encryptionMetadata.iv),
          tx.pure.string(contextCategory || "General"),
          tx.object(registryArg),
        ],
      });

      const response = await signAndExecuteTransaction.mutateAsync({
        transaction: tx,
        chain: "sui:testnet",
      });

      const txDetails = await suiClient.waitForTransaction({
        digest: response.digest,
        options: { showEvents: true },
      });

      const createdEvent = txDetails.events?.find(
        (event: any) => event.type === `${ghostContextPackageId}::ghostcontext::ContextCreated`
      );
      const parsedEvent = createdEvent?.parsedJson as Record<string, any> | undefined;
      const contextId = parsedEvent?.id as string | undefined;

      if (contextId) {
        setMintedContextId(contextId);
        await fetchContextSharedVersion(contextId);
      }

      showToastNotification("GhostContext NFT minted successfully!", "success");
    } catch (error) {
      console.error("Mint failed", error);
      showToastNotification("Minting failed. Check console.", "error");
    } finally {
      setIsMinting(false);
    }
  };

  const handleListContext = async () => {
    if (!currentAccount || !ghostContextPackageId) {
      showToastNotification("Missing configuration.", "error");
      return;
    }
    if (!mintedContextId || !contextSharedVersion) {
      showToastNotification("Mint a context first.", "error");
      return;
    }

    let parsedPrice: bigint;
    try {
      parsedPrice = BigInt(pricePerQuery || "1");
    } catch {
      showToastNotification("Price must be a positive integer.", "error");
      return;
    }

    if (parsedPrice <= 0n) {
      showToastNotification("Price must be > 0.", "error");
      return;
    }

    try {
      const tx = new Transaction();
      const contextArg = Inputs.SharedObjectRef({
        objectId: mintedContextId,
        initialSharedVersion: contextSharedVersion,
        mutable: true,
      });

      tx.moveCall({
        target: `${ghostContextPackageId}::ghostcontext::list_context`,
        arguments: [tx.object(contextArg), tx.pure.u64(parsedPrice)],
      });

      await signAndExecuteTransaction.mutateAsync({
        transaction: tx,
        chain: "sui:testnet",
      });

      showToastNotification("Context listed for sale!", "success");
    } catch (error) {
      console.error("List failed", error);
      showToastNotification("Failed to list context.", "error");
    }
  };

  // Show connect wallet overlay if not connected
  if (!currentAccount) {
    return (
      <div className="vault-container">
        <div className="vault-overlay">
          <div className="vault-overlay-content">
            <Lock size={64} className="vault-overlay-icon" />
            <h2 className="vault-overlay-title">Connect Your Wallet</h2>
            <p className="vault-overlay-text">
              Connect your Sui wallet to encrypt documents and mint NFTs
            </p>
            <div style={{
              background: 'linear-gradient(135deg, #6C63FF 0%, #8B7FFF 100%)',
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(108, 99, 255, 0.25)',
              display: 'inline-block',
            }}>
              {/* ConnectButton will be rendered here */}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vault-container">
      <div className="vault-content-wrapper">
        {/* 2-Column Grid Layout */}
        <div className="vault-grid">
          {/* LEFT COLUMN - Upload Zone (40%) */}
          <div className="vault-upload-column">
            {!ghostPayload ? (
              /* Drop Zone */
              <label htmlFor="vaultFileInput" className="vault-dropzone">
                <input
                  type="file"
                  id="vaultFileInput"
                  accept=".pdf"
                  onChange={onFileUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
                <Upload size={64} className="dropzone-icon" />
                <h3 className="dropzone-title">
                  {uploading ? 'Processing...' : 'Drag & drop your PDF here'}
                </h3>
                <p className="dropzone-text">
                  {uploading ? uploadStatus : 'or click to browse'}
                </p>
                {uploading && (
                  <div className="dropzone-progress">
                    <div className="progress-bar-modern">
                      <div className="progress-fill-modern" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <p className="progress-percent">{uploadProgress}%</p>
                  </div>
                )}
              </label>
            ) : (
              /* File Preview Card */
              <div className="vault-file-preview">
                <FileText size={80} className="file-preview-icon" />
                <h3 className="file-preview-name">{ghostPayload.fileName}</h3>
                <div className="file-preview-badge">
                  <Check size={16} />
                  <span>Ready to Encrypt</span>
                </div>
                <button
                  className="file-preview-change"
                  onClick={() => {
                    setGhostPayload(null);
                    setWalrusBlobId("");
                    setMintedContextId("");
                    setContextSharedVersion(null);
                    setEncryptionMetadata(null);
                  }}
                >
                  Change File
                </button>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN - Configuration Form (60%) */}
          <div className="vault-config-column">
            <div className="vault-config-card">
              <h2 className="config-title">Encryption Metadata</h2>
              
              <div className="config-form">
                <div className="form-field">
                  <label className="field-label">Title</label>
                  <input
                    type="text"
                    value={contextTitle}
                    onChange={(e) => setContextTitle(e.target.value)}
                    placeholder="e.g. Ferrari Engine Manual"
                    className="field-input"
                    disabled={!ghostPayload}
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">Category</label>
                  <select
                    value={contextCategory}
                    onChange={(e) => setContextCategory(e.target.value)}
                    className="field-select"
                    disabled={!ghostPayload}
                  >
                    <option value="General">General</option>
                    <option value="Technical">Technical</option>
                    <option value="Medical">Medical</option>
                    <option value="Legal">Legal</option>
                    <option value="Financial">Financial</option>
                    <option value="Educational">Educational</option>
                  </select>
                </div>

                <div className="form-field">
                  <label className="field-label">Price Per Query</label>
                  <div className="field-input-group">
                    <input
                      type="number"
                      min="1"
                      value={pricePerQuery}
                      onChange={(e) => setPricePerQuery(e.target.value)}
                      className="field-input-with-suffix"
                      disabled={!ghostPayload}
                    />
                    <span className="field-suffix">MIST</span>
                  </div>
                </div>

                {/* Main Action Button */}
                {!walrusBlobId ? (
                  <button
                    className="btn-vault-main"
                    onClick={handleEncryptAndUpload}
                    disabled={!ghostPayload || isEncrypting}
                  >
                    <Lock size={20} />
                    <span>{isEncrypting ? 'Encrypting...' : 'Encrypt & Mint NFT'}</span>
                  </button>
                ) : !mintedContextId ? (
                  <button
                    className="btn-vault-main"
                    onClick={handleMintContext}
                    disabled={isMinting}
                  >
                    <Lock size={20} />
                    <span>{isMinting ? 'Minting...' : 'Mint NFT'}</span>
                  </button>
                ) : !contextSharedVersion ? (
                  <div className="success-message">
                    <Check size={24} />
                    <span>NFT Minted Successfully!</span>
                  </div>
                ) : (
                  <button
                    className="btn-vault-main"
                    onClick={handleListContext}
                  >
                    <Lock size={20} />
                    <span>List for Sale</span>
                  </button>
                )}

                {/* Status Messages */}
                {walrusBlobId && (
                  <div className="status-message success">
                    <Check size={16} />
                    <span>Encrypted & uploaded to Walrus</span>
                  </div>
                )}
                {mintedContextId && (
                  <div className="status-message success">
                    <Check size={16} />
                    <span>NFT minted successfully</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className={`toast ${toastType}`}>
          <span className="toast-icon">{toastType === "success" ? "✅" : "❌"}</span>
          <span className="toast-message">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default Vault;
