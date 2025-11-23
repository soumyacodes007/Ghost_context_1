import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { RagEngine } from "../services/rag-engine";
import { RagEngineWeInfer } from "../services/rag-engine-weinfer";
import { LlmClient } from "../services/llm-client";
import { LlmClientWeInfer } from "../services/llm-client-weinfer";
import { Embedder } from "../services/embedder";
import { VectorStore } from "../services/vector-store";
import { PdfParser } from "../services/pdf-parser";
import { Transaction, Inputs } from "@mysten/sui/transactions";
import {
  encryptAndUpload,
  downloadAndDecrypt,
  type EncryptedMetadata,
} from "../ghostcontext/encryption-workflow";
import {
  createGhostContextPayload,
  type GhostContextPayload,
} from "../services/ghostcontext-payload";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import walrusIcon from "./assets/walrus.svg";
import sealIcon from "./assets/seal.svg";
import "./Home.css";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: Array<{ page: number }>;
}

type EngineType = "webllm" | "weinfer";

const Home = () => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [initProgress, setInitProgress] = useState("");
  const [showBrowserError, setShowBrowserError] = useState(false);
  const [browserErrorDetails, setBrowserErrorDetails] = useState("");
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedEngine, setSelectedEngine] = useState<EngineType>("webllm");
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadFileName, setUploadFileName] = useState("");
  const [loadedDocumentName, setLoadedDocumentName] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [ghostPayload, setGhostPayload] = useState<GhostContextPayload | null>(
    null
  );
  const [walrusBlobId, setWalrusBlobId] = useState("");
  const [ghostStatus, setGhostStatus] = useState("");
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptionMetadata, setEncryptionMetadata] = useState<EncryptedMetadata | null>(
    null
  );
  const [remoteBlobId, setRemoteBlobId] = useState("");
  const [contextTitle, setContextTitle] = useState("");
  const [contextCategory, setContextCategory] = useState("General");
  const [pricePerQuery, setPricePerQuery] = useState("1");
  const [mintedContextId, setMintedContextId] = useState("");
  const [isMinting, setIsMinting] = useState(false);
  const [registrySharedVersion, setRegistrySharedVersion] = useState<
    string | null
  >(null);
  const [contextSharedVersion, setContextSharedVersion] = useState<
    string | null
  >(null);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const signAndExecuteTransaction = useSignAndExecuteTransaction({
    mutationKey: ["ghostcontext-sign"],
  });

  const ghostContextPackageId = import.meta.env.VITE_GHOSTCONTEXT_PACKAGE_ID as
    | string
    | undefined;
  const registryObjectId = import.meta.env.VITE_GHOSTCONTEXT_REGISTRY_ID as
    | string
    | undefined;

  // RAG Feature Flags
  const [enableSourceCitations, setEnableSourceCitations] = useState(false);
  const [enableConversationalMemory, setEnableConversationalMemory] =
    useState(false);
  const [enableHybridSearch, setEnableHybridSearch] = useState(false);

  // Conversation History
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ question: string; answer: string }>
  >([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // UI State
  const [shouldStopGeneration, setShouldStopGeneration] = useState(false);
  const [activeSection, setActiveSection] = useState<'engine' | 'model' | 'rag' | 'upload' | null>('engine');

  // Refs for services
  const ragStandardRef = useRef<RagEngine | null>(null);
  const ragWeInferRef = useRef<RagEngineWeInfer | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize services
  useEffect(() => {
    const llmStandard = new LlmClient();
    const llmWeInfer = new LlmClientWeInfer();
    const embedder = new Embedder();
    const vectorStore = new VectorStore();
    const parser = new PdfParser();

    ragStandardRef.current = new RagEngine(
      llmStandard,
      embedder,
      vectorStore,
      parser
    );
    ragWeInferRef.current = new RagEngineWeInfer(
      llmWeInfer,
      embedder,
      vectorStore,
      parser
    );

    updateAvailableModels();
  }, []);

  const [searchParams] = useSearchParams();

  // Get current RAG engine
  const getRag = useCallback((): RagEngine | RagEngineWeInfer => {
    return selectedEngine === "weinfer"
      ? ragWeInferRef.current!
      : ragStandardRef.current!;
  }, [selectedEngine]);

  // Load context from sessionStorage (from My Purchases)
  useEffect(() => {
    const loadContext = searchParams.get("loadContext");
    if (loadContext === "true") {
      const storedData = sessionStorage.getItem("loadedContext");
      if (storedData) {
        const loadPurchasedContext = async () => {
          try {
            const { payload } = JSON.parse(storedData);
            console.log("📥 Loading purchased context from session storage");
            console.log("📦 Payload has", payload.chunks.length, "chunks");
            
            if (!isModelLoaded) {
              showToastNotification(
                `Content ready to load: ${payload.fileName}. Please select and load a model first.`,
                "error"
              );
              // Keep the data in session storage so it can be loaded after model is ready
              return;
            }
            
            await ingestGhostPayload(payload);
            
            sessionStorage.removeItem("loadedContext");
            showToastNotification(`Loaded: ${payload.fileName} with ${payload.chunks.length} chunks`, "success");
          } catch (error) {
            console.error("Failed to load from session:", error);
            showToastNotification("Failed to load purchased context", "error");
          }
        };
        
        loadPurchasedContext();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isModelLoaded]);

  const updateAvailableModels = () => {
    const models =
      selectedEngine === "weinfer"
        ? ragWeInferRef.current?.llm.availableModels || []
        : ragStandardRef.current?.llm.availableModels || [];
    setAvailableModels(models);
  };

  const onEngineChange = (engine: EngineType) => {
    if (isModelLoaded) {
      showToastNotification(
        "Engine already loaded. Refresh page to change engine.",
        "error"
      );
      return;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔄 ENGINE SELECTED: ${engine === "weinfer" ? "WeInfer (Optimized)" : "WebLLM (Standard)"}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    setSelectedEngine(engine);
    setSelectedModel("");
    updateAvailableModels();
    
    // Auto-collapse and move to next section
    setTimeout(() => {
      setActiveSection('model');
    }, 300);
  };

  const checkBrowserCapabilities = (): {
    supported: boolean;
    message: string;
  } => {
    const hasWebGPU = "gpu" in navigator;
    const hasWasm = typeof WebAssembly !== "undefined";

    if (hasWebGPU) {
      return {
        supported: true,
        message: "WebGPU detected - will use GPU acceleration",
      };
    } else if (hasWasm) {
      return {
        supported: true,
        message: "WebGPU not found - will use CPU mode (slower)",
      };
    } else {
      return {
        supported: false,
        message:
          "Browser not supported - WebGPU and WebAssembly are both unavailable",
      };
    }
  };

  useEffect(() => {
    const capabilities = checkBrowserCapabilities();

    if (!capabilities.supported) {
      setShowBrowserError(true);
      setBrowserErrorDetails(capabilities.message);
      return;
    }

    console.log("✅", capabilities.message);
  }, []);

  useEffect(() => {
    updateAvailableModels();
  }, [selectedEngine]);

  useEffect(() => {
    if (!registryObjectId) return;
    suiClient
      .getObject({ id: registryObjectId, options: { showOwner: true } })
      .then((result) => {
        const sharedVersion = (result.data?.owner as any)?.Shared
          ?.initial_shared_version;
        if (sharedVersion) {
          setRegistrySharedVersion(sharedVersion);
        }
      })
      .catch((error) =>
        console.error("Failed to fetch registry shared version", error)
      );
  }, [registryObjectId, suiClient]);

  const fetchContextSharedVersion = useCallback(
    async (objectId: string) => {
      try {
        const response = await suiClient.getObject({
          id: objectId,
          options: { showOwner: true },
        });
        const sharedVersion = (response.data?.owner as any)?.Shared
          ?.initial_shared_version;
        if (sharedVersion) {
          setContextSharedVersion(sharedVersion);
        }
      } catch (error) {
        console.error("Failed to fetch context shared version", error);
      }
    },
    [suiClient]
  );

  const onModelChange = async (modelId: string) => {
    if (isModelLoaded) {
      showToastNotification(
        "Model already loaded. Refresh page to change model.",
        "error"
      );
      return;
    }

    if (!modelId || modelId === "") {
      return;
    }

    setSelectedModel(modelId);

    const rag = getRag();
    rag.llm.setModel(modelId);

    setLoading(true);
    setLoadingProgress(0);
    setCurrentStep(1);

    try {
      // Set up progress callbacks
      rag.llm.setProgressCallback((progress: string) => {
        if (progress) {
          console.log("LLM progress:", progress);
          setInitProgress(`[LLM] ${progress}`);

          if (
            progress.includes("Loading model from cache") ||
            progress.includes("loading from cache") ||
            progress.includes("Compiling") ||
            progress.includes("Initializing")
          ) {
            setLoadingProgress((prev) => Math.min(65, prev + 5));
          } else if (progress.includes("%")) {
            const match = progress.match(/(\d+)%/);
            if (match) {
              const percent = parseInt(match[1]);
              setLoadingProgress(Math.floor(percent * 0.7));
            }
          } else {
            setLoadingProgress((prev) => Math.min(65, prev + 2));
          }
        }
      });

      rag.embedder.setProgressCallback((progress: string) => {
        if (progress) {
          console.log("Embedder progress:", progress);
          setInitProgress(`[Embedder] ${progress}`);

          if (progress.includes("cache") || progress.includes("loaded")) {
            setLoadingProgress((prev) =>
              prev >= 70 && prev < 88 ? Math.min(88, prev + 3) : prev
            );
          } else if (progress.includes("%")) {
            const match = progress.match(/(\d+)%/);
            if (match) {
              const percent = parseInt(match[1]);
              setLoadingProgress(Math.floor(70 + percent * 0.2));
            }
          } else {
            setLoadingProgress((prev) =>
              prev >= 70 && prev < 88 ? Math.min(88, prev + 2) : prev
            );
          }
        }
      });

      console.log("🚀 Starting initialization...");

      // Step 1: LLM
      setCurrentStep(1);
      setInitProgress("Initializing LLM...");
      setLoadingProgress(5);

      await rag.llm.initialize();

      setLoadingProgress((prev) => Math.max(70, prev));
      console.log("✅ LLM ready");

      // Step 2: Embedder
      setCurrentStep(2);
      setInitProgress("Initializing embedder...");

      await rag.embedder.initialize();

      setLoadingProgress((prev) => Math.max(90, prev));
      console.log("✅ Embedder ready");

      // Step 3: Vector Store
      setCurrentStep(3);
      setInitProgress("Initializing vector store...");

      await rag.vectorStore.initialize();

      setLoadingProgress(100);
      console.log("✅ Vector store ready");

      // Complete
      setCurrentStep(4);
      setInitProgress("✅ All systems ready!");

      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log("✅ RAG initialization complete");
      setLoading(false);
      setIsModelLoaded(true);
      
      // Auto-collapse and move to next section
      setTimeout(() => {
        setActiveSection('upload');
      }, 500);
    } catch (error) {
      console.error("❌ Initialization error:", error);
      setLoading(false);
      setShowBrowserError(true);
      setBrowserErrorDetails((error as Error).message);
    }
  };

  const getCurrentModelName = (): string => {
    const model = availableModels.find((m) => m.id === selectedModel);
    return model?.name || selectedModel;
  };

  const ingestGhostPayload = useCallback(
    async (payload: GhostContextPayload) => {
      const rag = getRag();
      await rag.vectorStore.clear();
      for (const chunk of payload.chunks) {
        const embedding = await rag.embedder.embed(chunk.text);
        await rag.vectorStore.addChunk({
          id: `${payload.fileName}-${chunk.chunkIndex}`,
          text: chunk.text,
          embedding,
          metadata: {
            filename: payload.fileName,
            chunkIndex: chunk.chunkIndex,
            pageNumber: chunk.pageNumber,
          },
        });
      }
      setLoadedDocumentName(payload.fileName);
    },
    [getRag]
  );

  const handleEncryptAndUpload = async () => {
    if (!ghostPayload) {
      showToastNotification("Upload a document before encrypting.", "error");
      return;
    }
    if (!currentAccount) {
      showToastNotification("Connect a Sui wallet first.", "error");
      return;
    }
    
    try {
      setIsEncrypting(true);
      setGhostStatus("🔐 Encrypting with random key (Option A)...");
      
      // Option A: Random key, no wallet signature needed
      const metadata = await encryptAndUpload(
        ghostPayload,
        currentAccount.address
      );
      
      setEncryptionMetadata(metadata);
      setWalrusBlobId(metadata.walrusBlobId);
      
      setGhostPayload({
        ...ghostPayload,
        walrusBlobId: metadata.walrusBlobId,
        policyId: currentAccount.address,
      });
      
      showToastNotification(
        `Context encrypted & uploaded! Key will be stored on-chain for NFT transferability.`,
        "success"
      );
    } catch (error: any) {
      console.error("Encryption failed:", error);
      showToastNotification(
        `Encryption failed: ${error.message || "Unknown error"}`,
        "error"
      );
    } finally {
      setIsEncrypting(false);
      setTimeout(() => setGhostStatus(""), 1200);
    }
  };

  // Session key function removed - no longer needed with Web Crypto API

  const handleLoadFromWalrus = async () => {
    if (!remoteBlobId.trim()) {
      showToastNotification("Enter a Walrus blob ID first.", "error");
      return;
    }
    if (!currentAccount) {
      showToastNotification("Connect your wallet first.", "error");
      return;
    }
    if (!encryptionMetadata) {
      showToastNotification(
        "Encryption metadata not found. You can only decrypt data you encrypted in this session.",
        "error"
      );
      return;
    }
    
    try {
      setIsLoadingRemote(true);
      setGhostStatus("⬇️ Downloading from Walrus...");
      
      // Option A: No wallet signature needed, just use the stored key
      const payload = await downloadAndDecrypt({
        ...encryptionMetadata,
        walrusBlobId: remoteBlobId.trim(),
      });
      
      setGhostStatus("📦 Loading context...");
      await ingestGhostPayload(payload);
      setGhostPayload(payload);
      setWalrusBlobId(remoteBlobId.trim());
      
      showToastNotification(
        `GhostContext "${payload.fileName}" loaded successfully!`,
        "success"
      );
    } catch (error: any) {
      console.error("Failed to load GhostContext:", error);
      showToastNotification(
        `Failed to load: ${error.message || "Decryption failed. Check encryption key."}`,
        "error"
      );
    } finally {
      setIsLoadingRemote(false);
      setGhostStatus("");
    }
  };

  const handleMintContext = async () => {
    if (!currentAccount) {
      showToastNotification("Connect a Sui wallet before minting.", "error");
      return;
    }
    if (!ghostContextPackageId || !registryObjectId || !registrySharedVersion) {
      showToastNotification(
        "Missing GhostContext contract env (package/registry).",
        "error"
      );
      return;
    }
    if (!walrusBlobId || !encryptionMetadata) {
      showToastNotification("Encrypt and upload to Walrus first.", "error");
      return;
    }
    try {
      setIsMinting(true);
      setGhostStatus("🪙 Minting GhostContext NFT with encryption key...");
      const title = contextTitle || ghostPayload?.fileName || "GhostContext";
      const tx = new Transaction();
      const registryArg = Inputs.SharedObjectRef({
        objectId: registryObjectId,
        initialSharedVersion: registrySharedVersion,
        mutable: true,
      });

      // NEW CONTRACT: Store encryption keys on-chain
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
        (event: any) =>
          event.type ===
          `${ghostContextPackageId}::ghostcontext::ContextCreated`
      );
      const parsedEvent = createdEvent?.parsedJson as
        | Record<string, any>
        | undefined;
      const contextId = parsedEvent?.id as string | undefined;
      if (contextId) {
        setMintedContextId(contextId);
        await fetchContextSharedVersion(contextId);
      }
      showToastNotification("GhostContext NFT minted with encryption key on-chain!", "success");
    } catch (error) {
      console.error("Mint failed", error);
      showToastNotification("Minting failed. Check console.", "error");
    } finally {
      setIsMinting(false);
      setGhostStatus("");
    }
  };

  const handleListContext = async () => {
    if (!currentAccount) {
      showToastNotification("Connect a wallet first.", "error");
      return;
    }
    if (!ghostContextPackageId) {
      showToastNotification("Missing GhostContext package id.", "error");
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
      setGhostStatus("📢 Listing context on-chain...");
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
      showToastNotification("Context listed for sale.", "success");
    } catch (error) {
      console.error("List failed", error);
      showToastNotification("Failed to list context.", "error");
    } finally {
      setGhostStatus("");
    }
  };

  const onFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      setUploading(true);
      setUploadFileName(file.name);
      setUploadProgress(0);
      setUploadStatus("Starting...");

      try {
        const rag = getRag();

        setUploadStatus("🗑️ Clearing previous data...");
        setUploadProgress(5);
        await rag.vectorStore.clear();

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

        console.log(`📄 PDF parsed: ${chunks.length} chunks`);

        const totalChunks = chunks.length;
        for (const [index, chunk] of chunks.entries()) {
          const chunkNum = index + 1;

          const textPreview = chunk.text.substring(0, 100).replace(/\n/g, " ");
          setUploadStatus(
            `🔢 Embedding chunk ${chunkNum}/${totalChunks}: "${textPreview}${
              chunk.text.length > 100 ? "..." : ""
            }"`
          );
          setUploadProgress(30 + Math.floor((index / totalChunks) * 60));

          await new Promise((resolve) => setTimeout(resolve, 0));

          console.log(
            `🔢 Embedding chunk ${chunkNum}/${totalChunks} (page ${chunk.pageNumber})`
          );

          const embedding = await rag.embedder.embed(chunk.text);

          await rag.vectorStore.addChunk({
            id: `${file.name}-${index}`,
            text: chunk.text,
            embedding,
            metadata: {
              filename: file.name,
              chunkIndex: chunk.chunkIndex,
              pageNumber: chunk.pageNumber,
            },
          });
        }

        setUploadProgress(100);
        setUploadStatus("✅ Complete!");
        setLoadedDocumentName(file.name);

        showToastNotification(
          `Document "${file.name}" ingested successfully!`,
          "success"
        );
        
        // Auto-collapse after upload complete
        setTimeout(() => {
          setActiveSection(null);
        }, 1000);
      } catch (error) {
        console.error("❌ Ingestion error:", error);
        showToastNotification(
          "Error ingesting document. Check console for details.",
          "error"
        );
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setUploading(false);
        event.target.value = "";
      }
    }
  };

  const showToastNotification = (
    message: string,
    type: "success" | "error"
  ) => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);

    setTimeout(() => {
      setShowToast(false);
    }, 4000);
  };

  const onQuery = async () => {
    if (!question.trim()) return;

    setQuerying(true);
    setShouldStopGeneration(false);
    setAnswer("");

    const currentQuestion = question;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🚀 QUERY STARTED`);
    console.log(`📝 Question: ${currentQuestion}`);
    console.log(`⚙️ Using Engine: ${selectedEngine === "weinfer" ? "WeInfer (Optimized)" : "WebLLM (Standard)"}`);
    console.log(`🤖 Model: ${getCurrentModelName()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const userMessage: ChatMessage = {
      role: "user",
      content: currentQuestion,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMessage]);
    setQuestion("");

    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, assistantMessage]);
    const assistantIndex = chatMessages.length + 1;

    scrollToBottom();

    try {
      const rag = getRag();
      const conversationContext = enableConversationalMemory
        ? conversationHistory
        : [];

      await rag.query(
        currentQuestion,
        (partialAnswer: string) => {
          if (shouldStopGeneration) {
            console.log("⏹️ Generation stopped by user");
            throw new Error("STOPPED_BY_USER");
          }
          setAnswer(partialAnswer);
          setChatMessages((prev) => {
            const updated = [...prev];
            updated[assistantIndex] = {
              ...updated[assistantIndex],
              content: partialAnswer,
            };
            return updated;
          });
          scrollToBottom();
        },
        conversationContext,
        enableHybridSearch,
        enableSourceCitations
      );

      if (enableConversationalMemory && answer) {
        setConversationHistory((prev) => [
          ...prev,
          {
            question: currentQuestion,
            answer: answer,
          },
        ]);
        console.log(
          `💭 Conversation history: ${conversationHistory.length + 1} exchanges`
        );
      }


    } catch (error: any) {
      console.error("❌ Query error:", error);
      if (error.message === "STOPPED_BY_USER") {
        console.log("⏹️ Generation stopped - keeping partial answer");
        setChatMessages((prev) => {
          const updated = [...prev];
          if (updated[assistantIndex]?.content === "") {
            updated[assistantIndex] = {
              ...updated[assistantIndex],
              content: "⏹️ Generation stopped.",
            };
          }
          return updated;
        });
      } else {
        console.error("❌ Unexpected error:", error);
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[assistantIndex] = {
            ...updated[assistantIndex],
            content:
              "❌ Error querying document. Make sure you have uploaded a PDF first.",
          };
          return updated;
        });
      }
    } finally {
      setQuerying(false);
      setShouldStopGeneration(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop =
          chatContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, answer]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(e.target.value);
    e.target.style.height = '48px';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const stopGeneration = () => {
    setShouldStopGeneration(true);
    console.log("⏹️ Stop generation requested");
  };

  const clearConversation = () => {
    setConversationHistory([]);
    setChatMessages([]);
    setQuestion("");
    setAnswer("");
    console.log("🗑️ Conversation history cleared");
    showToastNotification("Conversation history cleared", "success");
  };

  const getPageNumbers = (sources?: Array<{ page: number }>): string => {
    if (!sources || sources.length === 0) return "";
    return sources.map((s) => s.page).join(", ");
  };

  const getBrowserInfo = (): string => {
    return navigator.userAgent;
  };

  return (
    <main className="main">
      {/* Loading Overlay */}
      {loading && !showBrowserError && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <h2 className="loading-title">Loading AI Models...</h2>
            <p className="loading-text">{initProgress || "Initializing..."}</p>
            <div className="progress-container">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${loadingProgress}%` }}></div>
              </div>
              <p className="progress-text">{loadingProgress}%</p>
            </div>
          </div>
        </div>
      )}

        {/* Browser Error Section */}
        {showBrowserError && (
          <div className="error-section card">
            <h2>⚠️ WebGPU Not Available</h2>
            <p className="error-message">{browserErrorDetails}</p>

            <div className="setup-instructions">
              <h3>🔧 Quick Fix:</h3>
              <ol>
                <li>
                  <strong>Visit:</strong>
                  <a
                    href="chrome://flags"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    chrome://flags
                  </a>{" "}
                  or
                  <a
                    href="edge://flags"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    edge://flags
                  </a>
                </li>
                <li>
                  <strong>Search:</strong> "WebGPU"
                </li>
                <li>
                  <strong>Enable:</strong> "Unsafe WebGPU"
                </li>
                <li>
                  <strong>Relaunch</strong> browser
                </li>
                <li>
                  <strong>Refresh</strong> this page
                </li>
              </ol>

              <h3>📋 Requirements:</h3>
              <ul>
                <li>✅ Chrome 113+ or Edge 113+</li>
                <li>✅ 4GB+ RAM available</li>
                <li>
                  ✅ Modern GPU (Intel HD 5500+, NVIDIA GTX 650+, AMD HD 7750+)
                </li>
                <li>✅ Hardware acceleration enabled</li>
              </ul>

              <h3>🧪 Test Your Browser:</h3>
              <p>
                <a
                  href="https://webgpureport.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="test-button"
                >
                  Check WebGPU Support →
                </a>
              </p>

              <details className="troubleshooting">
                <summary>🐛 More Troubleshooting</summary>
                <div className="troubleshooting-content">
                  <h4>Still not working?</h4>
                  <ul>
                    <li>Update your browser to latest version</li>
                    <li>Update graphics drivers</li>
                    <li>
                      Enable hardware acceleration:{" "}
                      <code>chrome://settings/system</code>
                    </li>
                    <li>
                      Try Chrome Canary:{" "}
                      <a
                        href="https://www.google.com/chrome/canary/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download
                      </a>
                    </li>
                    <li>Check console (F12) for detailed errors</li>
                  </ul>
                  <p>
                    <strong>Current browser:</strong>
                    <br />
                    <code>{getBrowserInfo()}</code>
                  </p>
                </div>
              </details>
            </div>
          </div>
        )}

        {loading && !showBrowserError && (
          <div className="loading-section">
            <h2>🔄 Loading AI Models...</h2>

            <div className="progress-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              <div className="progress-percentage">{loadingProgress}%</div>
            </div>

            <p className="progress-text">{initProgress || "Initializing..."}</p>

            <div className="loading-steps">
              <div
                className={`step ${currentStep >= 1 ? "active" : ""} ${
                  currentStep > 1 ? "complete" : ""
                }`}
              >
                <span className="step-icon">
                  {currentStep > 1 ? "✅" : currentStep === 1 ? "⏳" : "⏸️"}
                </span>
                <span>LLM Model</span>
              </div>
              <div
                className={`step ${currentStep >= 2 ? "active" : ""} ${
                  currentStep > 2 ? "complete" : ""
                }`}
              >
                <span className="step-icon">
                  {currentStep > 2 ? "✅" : currentStep === 2 ? "⏳" : "⏸️"}
                </span>
                <span>Embedder</span>
              </div>
              <div
                className={`step ${currentStep >= 3 ? "active" : ""} ${
                  currentStep > 3 ? "complete" : ""
                }`}
              >
                <span className="step-icon">
                  {currentStep > 3 ? "✅" : currentStep === 3 ? "⏳" : "⏸️"}
                </span>
                <span>Vector Store</span>
              </div>
            </div>

            <p className="info">
              First load may take a few minutes (downloading model files)
            </p>
          </div>
        )}

      {/* Browser Error */}
      {showBrowserError && (
        <div className="loading-overlay">
          <div className="loading-content">
            <h2 className="loading-title">⚠️ WebGPU Not Available</h2>
            <p className="loading-text">{browserErrorDetails}</p>
            <p className="loading-text" style={{ marginTop: 'var(--spacing-lg)' }}>
              Please enable WebGPU in your browser settings and refresh the page.
            </p>
          </div>
        </div>
      )}

      {/* Main 2-Column Layout */}
      {!loading && !showBrowserError && (
        <div className="home-layout">
          {/* LEFT COLUMN - Controls & Settings */}
          <div className="home-controls">
            {/* Progress Bar - Upper Right */}
            <div className="setup-progress-sidebar">
              <div className="progress-percentage">
                {Math.round((
                  (selectedEngine ? 25 : 0) +
                  (isModelLoaded ? 25 : 0) +
                  (loadedDocumentName ? 50 : 0)
                ))}%
              </div>
              <div className="progress-bar-vertical">
                <div 
                  className="progress-fill-vertical" 
                  style={{ 
                    height: `${
                      (selectedEngine ? 25 : 0) +
                      (isModelLoaded ? 25 : 0) +
                      (loadedDocumentName ? 50 : 0)
                    }%` 
                  }}
                ></div>
                <div className="progress-steps-vertical">
                  <div className={`progress-step-dot ${selectedEngine ? 'completed' : 'pending'}`}></div>
                  <div className={`progress-step-dot ${isModelLoaded ? 'completed' : selectedEngine ? 'active' : 'pending'}`}></div>
                  <div className={`progress-step-dot ${loadedDocumentName ? 'completed' : isModelLoaded ? 'active' : 'pending'}`}></div>
                </div>
              </div>
            </div>

            <div className="home-controls-inner">
            <div className="controls-sections-wrapper">
            {/* Pending Content Banner */}
            {searchParams.get("loadContext") === "true" && !isModelLoaded && sessionStorage.getItem("loadedContext") && (
              <div className="controls-section" style={{ background: 'var(--color-warning-light)', borderColor: 'var(--color-warning)' }}>
                <div className="section-header">
                  <h2 className="section-title">Content Ready to Load</h2>
                </div>
                <p className="section-description">
                  Your purchased content is ready. Please select and load a model below to start chatting.
                </p>
              </div>
            )}

            {/* Engine Selection */}
            <div className={`step-card ${selectedEngine ? 'completed' : activeSection === 'engine' ? 'active' : 'pending'}`}>
              <div 
                className="step-header" 
                onClick={() => !isModelLoaded && setActiveSection(activeSection === 'engine' ? null : 'engine')}
                style={{ cursor: isModelLoaded ? 'default' : 'pointer' }}
              >
                <div className="step-number-wrapper">
                  <div className="step-number">
                    {selectedEngine ? '✓' : '1'}
                  </div>
                  <h3 className="step-title">Select Engine</h3>
                </div>
                <span className="step-icon">
                  {selectedEngine ? '✓' : activeSection === 'engine' ? '▲' : '▼'}
                </span>
              </div>
              {activeSection === 'engine' && (
              <div className="step-content">
              <div className="option-group">
                <label className={`option-item ${selectedEngine === "webllm" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="engine"
                    value="webllm"
                    checked={selectedEngine === "webllm"}
                    onChange={() => onEngineChange("webllm")}
                    disabled={isModelLoaded}
                    className="option-radio"
                  />
                  <div className="option-content">
                    <div className="option-title">WebLLM (Standard)</div>
                    <div className="option-description">Original implementation</div>
                  </div>
                </label>
                <label className={`option-item ${selectedEngine === "weinfer" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="engine"
                    value="weinfer"
                    checked={selectedEngine === "weinfer"}
                    onChange={() => onEngineChange("weinfer")}
                    disabled={isModelLoaded}
                    className="option-radio"
                  />
                  <div className="option-content">
                    <div className="option-title">WeInfer (Optimized)</div>
                    <div className="option-description">~3.76x faster with buffer reuse</div>
                  </div>
                </label>
              </div>
              </div>
              )}
            </div>

            {/* Model Selection */}
            <div className={`step-card ${isModelLoaded ? 'completed' : activeSection === 'model' ? 'active' : 'pending'} ${!selectedEngine ? 'disabled' : ''}`}>
              <div 
                className="step-header" 
                onClick={() => selectedEngine && !isModelLoaded && setActiveSection(activeSection === 'model' ? null : 'model')}
                style={{ cursor: selectedEngine && !isModelLoaded ? 'pointer' : 'default' }}
              >
                <div className="step-number-wrapper">
                  <div className="step-number">
                    {isModelLoaded ? '✓' : '2'}
                  </div>
                  <h3 className="step-title">Select Model</h3>
                </div>
                <span className="step-icon">
                  {isModelLoaded ? '✓' : activeSection === 'model' ? '▲' : '▼'}
                </span>
              </div>
              {activeSection === 'model' && selectedEngine && (
              <div className="step-content">
              <div className="form-group">
                <label htmlFor="modelSelect" className="form-label">Choose LLM Model:</label>
                <select
                  id="modelSelect"
                  value={selectedModel}
                  onChange={(e) => onModelChange(e.target.value)}
                  disabled={isModelLoaded}
                  className="form-select"
                >
                  <option value="" disabled>-- Select an LLM Model --</option>
                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} - {model.size} ({model.speed}, {model.quality})
                    </option>
                  ))}
                </select>
              </div>
              </div>
              )}
            </div>

            {/* RAG Options - Optional */}
            <div className={`step-card optional-step ${activeSection === 'rag' ? 'active' : 'pending'}`}>
              <div 
                className="step-header" 
                onClick={() => setActiveSection(activeSection === 'rag' ? null : 'rag')}
                style={{ cursor: 'pointer' }}
              >
                <div className="step-number-wrapper">
                  <div className="step-number optional-number">⚙</div>
                  <h3 className="step-title">Advanced Options <span className="optional-badge">Optional</span></h3>
                </div>
                <span className="step-icon">{activeSection === 'rag' ? '▲' : '▼'}</span>
              </div>
              {activeSection === 'rag' && (
              <div className="step-content">
              <div className="option-group">
                <label className="option-item">
                  <input
                    type="checkbox"
                    checked={enableSourceCitations}
                    onChange={(e) => setEnableSourceCitations(e.target.checked)}
                    disabled={querying}
                    className="option-checkbox"
                  />
                  <div className="option-content">
                    <div className="option-title">Source Citations</div>
                    <div className="option-description">Show page numbers in answers</div>
                  </div>
                </label>
                <label className="option-item">
                  <input
                    type="checkbox"
                    checked={enableConversationalMemory}
                    onChange={(e) => setEnableConversationalMemory(e.target.checked)}
                    disabled={querying}
                    className="option-checkbox"
                  />
                  <div className="option-content">
                    <div className="option-title">Conversational Memory</div>
                    <div className="option-description">Remember previous questions</div>
                  </div>
                </label>
                <label className="option-item">
                  <input
                    type="checkbox"
                    checked={enableHybridSearch}
                    onChange={(e) => setEnableHybridSearch(e.target.checked)}
                    disabled={querying}
                    className="option-checkbox"
                  />
                  <div className="option-content">
                    <div className="option-title">Hybrid Search</div>
                    <div className="option-description">Semantic + keyword search</div>
                  </div>
                </label>
              </div>
              {enableConversationalMemory && conversationHistory.length > 0 && (
                <button
                  className="btn-control-secondary"
                  onClick={clearConversation}
                  disabled={querying}
                  style={{ marginTop: 'var(--spacing-md)' }}
                >
                  Clear Conversation ({conversationHistory.length})
                </button>
              )}
              </div>
              )}
            </div>

            {/* Document Upload */}
            <div className={`step-card ${loadedDocumentName ? 'completed' : activeSection === 'upload' ? 'active' : 'pending'} ${!isModelLoaded ? 'disabled' : ''}`}>
              <div 
                className="step-header" 
                onClick={() => isModelLoaded && setActiveSection(activeSection === 'upload' ? null : 'upload')}
                style={{ cursor: isModelLoaded ? 'pointer' : 'default' }}
              >
                <div className="step-number-wrapper">
                  <div className="step-number">
                    {loadedDocumentName ? '✓' : '3'}
                  </div>
                  <h3 className="step-title">Upload Document</h3>
                </div>
                <span className="step-icon">
                  {loadedDocumentName ? '✓' : activeSection === 'upload' ? '▲' : '▼'}
                </span>
              </div>
              {activeSection === 'upload' && isModelLoaded && (
              <div className="step-content">
              <p className="section-description">
                Upload a PDF document to chat with using AI
              </p>

              {!uploading && !loadedDocumentName && isModelLoaded && (
                <label htmlFor="fileInput" className="upload-area">
                  <input
                    type="file"
                    id="fileInput"
                    accept=".pdf"
                    onChange={onFileUpload}
                    disabled={uploading || !isModelLoaded}
                  />
                  <p className="upload-text">Click to choose PDF file</p>
                  <p className="upload-hint">100% local - never sent to any server</p>
                </label>
              )}

              {!isModelLoaded && (
                <div className="upload-area" style={{ cursor: 'not-allowed', opacity: 0.6 }}>
                  <p className="upload-text">Load a model first</p>
                </div>
              )}

              {uploading && (
                <div>
                  <p style={{ marginBottom: 'var(--spacing-md)', fontWeight: 'var(--font-medium)' }}>
                    Processing: {uploadFileName}
                  </p>
                  <div className="progress-container">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <p className="progress-text">{uploadStatus}</p>
                  </div>
                </div>
              )}

              {!uploading && loadedDocumentName && (
                <div>
                  <div className="status-badge" style={{ marginBottom: 'var(--spacing-md)' }}>
                    Loaded: {loadedDocumentName}
                  </div>
                  <button
                    className="btn-control-secondary"
                    onClick={() => {
                      setLoadedDocumentName("");
                      setGhostPayload(null);
                      setWalrusBlobId("");
                      setMintedContextId("");
                      setContextSharedVersion(null);
                    }}
                  >
                    Change Document
                  </button>
                </div>
              )}
              </div>
              )}
            </div>

            </div>

            {/* Powered By Section - Bottom */}
            <div className="powered-by-section">
              <div className="powered-by-text">Powered by</div>
              <img src={walrusIcon} alt="Walrus" className="powered-by-icon" />
              <div className="powered-by-divider">and</div>
              <img src={sealIcon} alt="SUI" className="powered-by-icon" />
            </div>

            </div>
          </div>

          {/* RIGHT COLUMN - Chat Interface */}
          <div className="home-chat">
            {/* Chat Messages */}
            <div className="chat-messages-container" ref={chatContainerRef}>
              {chatMessages.length === 0 ? (
                <div className="chat-empty-state">
                  <h3 className="chat-empty-title">Ready to chat!</h3>
                  <p className="chat-empty-text">Upload a PDF document and start asking questions.</p>
                </div>
              ) : (
                <div className="chat-messages">
                  {chatMessages.map((message, index) => (
                    <div key={index} className={`message-wrapper ${message.role}`}>
                      <div className="message-bubble">
                        <div className="message-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                        <div className="message-meta">
                          <span className="message-time">
                            {message.timestamp.toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {message.sources && message.sources.length > 0 && (
                            <span className="message-sources">
                              Pages: {getPageNumbers(message.sources)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {querying && (
                    <div className="message-wrapper assistant">
                      <div className="message-bubble">
                        <div className="typing-indicator">
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="chat-input-container">
              <div className="chat-input-wrapper">
                <textarea
                  value={question}
                  onChange={handleTextareaChange}
                  placeholder="Ask a question about your document..."
                  disabled={querying || !loadedDocumentName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onQuery();
                      e.currentTarget.style.height = '48px';
                    }
                  }}
                  className="chat-input"
                  rows={1}
                />
                {!querying ? (
                  <button
                    onClick={onQuery}
                    disabled={!question.trim() || !loadedDocumentName}
                    className="chat-send-btn"
                    title={!loadedDocumentName ? "Upload a PDF first" : "Send message"}
                  >
                    ➤
                  </button>
                ) : (
                  <button
                    onClick={stopGeneration}
                    className="chat-send-btn chat-stop-btn"
                    title="Stop generation"
                  >
                    ⏹
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className={`toast ${toastType}`}>
          <span className="toast-message">{toastMessage}</span>
        </div>
      )}
    </main>
  );
};

export default Home;

