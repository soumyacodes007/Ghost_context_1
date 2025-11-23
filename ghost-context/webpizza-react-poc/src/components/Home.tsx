import { useState, useEffect, useRef, useCallback } from "react";
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSignPersonalMessage,
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
  SessionKey,
  encryptContext,
  createSessionKey,
  decryptContext,
} from "../ghostcontext/seal";
import { uploadToWalrus, fetchFromWalrus } from "../ghostcontext/walrus";
import {
  deserializeGhostContextPayload,
  createGhostContextPayload,
  serializeGhostContextPayload,
  GhostContextPayload,
} from "../services/ghostcontext-payload";
import { VERSION } from "../version";
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
  const [policyId, setPolicyId] = useState("");
  const [ghostStatus, setGhostStatus] = useState("");
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [sessionKeyState, setSessionKeyState] = useState<SessionKey | null>(
    null
  );
  const [sessionStatus, setSessionStatus] = useState("");
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
  const signPersonalMessage = useSignPersonalMessage({
    mutationKey: ["ghostcontext-sign-message"],
  });

  const sealPackageId = import.meta.env.VITE_SEAL_PACKAGE_ID as
    | string
    | undefined;
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
  const [showSetupSection, setShowSetupSection] = useState(true);
  const [shouldStopGeneration, setShouldStopGeneration] = useState(false);

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

  // Get current RAG engine
  const getRag = useCallback((): RagEngine | RagEngineWeInfer => {
    return selectedEngine === "weinfer"
      ? ragWeInferRef.current!
      : ragStandardRef.current!;
  }, [selectedEngine]);

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

    console.log(
      `🔄 Switched to ${engine === "weinfer" ? "WeInfer" : "WebLLM"} engine`
    );
    setSelectedEngine(engine);
    setSelectedModel("");
    updateAvailableModels();
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
      showToastNotification("Upload a document before sealing it.", "error");
      return;
    }
    if (!currentAccount) {
      showToastNotification(
        "Connect a Sui wallet to encrypt with Seal.",
        "error"
      );
      return;
    }
    if (!sealPackageId) {
      showToastNotification("Missing VITE_SEAL_PACKAGE_ID env.", "error");
      return;
    }
    try {
      setIsEncrypting(true);
      setGhostStatus("🔐 Encrypting with Seal...");
      const serialized = serializeGhostContextPayload(ghostPayload);
      const { encryptedBlob, policyId: policy } = await encryptContext(
        serialized,
        currentAccount.address,
        sealPackageId
      );
      setGhostStatus("☁️ Uploading to Walrus...");
      const blobId = await uploadToWalrus(encryptedBlob);
      setWalrusBlobId(blobId);
      setPolicyId(policy);
      setGhostPayload((prev) =>
        prev ? { ...prev, walrusBlobId: blobId, policyId: policy } : prev
      );
      showToastNotification("Context sealed & uploaded to Walrus.", "success");
    } catch (error) {
      console.error("GhostContext upload failed", error);
      showToastNotification(
        "GhostContext upload failed. Check console.",
        "error"
      );
    } finally {
      setIsEncrypting(false);
      setTimeout(() => setGhostStatus(""), 1200);
    }
  };

  const handleCreateSealSession = async () => {
    if (!currentAccount) {
      showToastNotification("Connect a wallet first.", "error");
      return;
    }
    if (!sealPackageId) {
      showToastNotification("Missing VITE_SEAL_PACKAGE_ID env.", "error");
      return;
    }
    try {
      setSessionStatus("Requesting wallet signature...");
      const walletSigner = {
        signPersonalMessage: ({ message }: { message: Uint8Array }) =>
          signPersonalMessage.mutateAsync({ message }),
      };
      const session = await createSessionKey(
        currentAccount.address,
        walletSigner,
        sealPackageId
      );
      setSessionKeyState(session);
      showToastNotification("Session key ready (valid for 60 min).", "success");
    } catch (error) {
      console.error("Session key error", error);
      showToastNotification("Failed to create Seal session key.", "error");
    } finally {
      setSessionStatus("");
    }
  };

  const handleLoadFromWalrus = async () => {
    if (!remoteBlobId.trim()) {
      showToastNotification("Enter a Walrus blob ID first.", "error");
      return;
    }
    if (!sessionKeyState) {
      showToastNotification("Authorize a Seal session first.", "error");
      return;
    }
    try {
      setIsLoadingRemote(true);
      setGhostStatus("⬇️ Fetching Walrus blob...");
      const encryptedText = await fetchFromWalrus(remoteBlobId.trim());
      const decrypted = await decryptContext(encryptedText, sessionKeyState);
      const payload = deserializeGhostContextPayload(decrypted);
      await ingestGhostPayload(payload);
      setGhostPayload(payload);
      setWalrusBlobId(remoteBlobId.trim());
      setPolicyId(payload.policyId || "");
      showToastNotification(
        `GhostContext "${payload.fileName}" ready.`,
        "success"
      );
    } catch (error) {
      console.error("Failed to load GhostContext", error);
      showToastNotification(
        "Failed to load GhostContext from Walrus.",
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
    if (!walrusBlobId) {
      showToastNotification("Upload to Walrus first.", "error");
      return;
    }
    try {
      setIsMinting(true);
      setGhostStatus("🪙 Minting GhostContext NFT...");
      const title = contextTitle || ghostPayload?.fileName || "GhostContext";
      const tx = new Transaction();
      const registryArg = Inputs.SharedObjectRef({
        objectId: registryObjectId,
        initialSharedVersion: registrySharedVersion,
        mutable: true,
      });

      tx.moveCall({
        target: `${ghostContextPackageId}::ghostcontext::create_context`,
        arguments: [
          tx.pure.string(title),
          tx.pure.string(walrusBlobId),
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
      showToastNotification("GhostContext NFT minted.", "success");
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
        setPolicyId("");
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
    console.log("🚀 Starting query:", currentQuestion);

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

      console.log("📝 Final answer length:", answer.length);

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

      console.log("✅ Query complete!");
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
      console.log("🏁 Query finished - cleaning up");
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
      <div className="container">
        <h1>🍕 WebPizza AI/RAG POC</h1>
        <p className="subtitle">Private Document Chat - 100% Client-Side AI</p>

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

        {!loading && (
          <div className="chat-layout">
            {/* Collapsible Setup Section */}
            <div
              className={`setup-section ${
                !showSetupSection ? "collapsed" : ""
              }`}
            >
              <button
                className="toggle-setup-button"
                onClick={() => setShowSetupSection(!showSetupSection)}
              >
                {showSetupSection ? "▼" : "▶"}{" "}
                {showSetupSection ? "Hide" : "Show"} Setup
              </button>

              {showSetupSection && (
                <div className="setup-content">
                  <section className="engine-section card">
                    <h2>⚡ Engine Selection</h2>
                    <div className="engine-selector">
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="engine"
                          value="webllm"
                          checked={selectedEngine === "webllm"}
                          onChange={() => onEngineChange("webllm")}
                          disabled={isModelLoaded}
                        />
                        <span className="radio-text">
                          <strong>WebLLM</strong> (Standard)
                          <small>Original implementation</small>
                        </span>
                      </label>
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="engine"
                          value="weinfer"
                          checked={selectedEngine === "weinfer"}
                          onChange={() => onEngineChange("weinfer")}
                          disabled={isModelLoaded}
                        />
                        <span className="radio-text">
                          <strong>WeInfer</strong> (Optimized)
                          <small>
                            ⚡ ~3.76x faster with buffer reuse + async pipeline
                          </small>
                        </span>
                      </label>
                      {!isModelLoaded && (
                        <p className="hint">
                          💡 WeInfer offers significant performance improvements
                          through GPU buffer reuse and asynchronous pipeline
                          processing.
                        </p>
                      )}
                      {isModelLoaded && (
                        <p className="hint success">
                          ✅ Engine:{" "}
                          {selectedEngine === "weinfer"
                            ? "WeInfer (Optimized)"
                            : "WebLLM (Standard)"}
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="model-section card">
                    <h2>🤖 Model Selection</h2>
                    <div className="model-selector">
                      <label htmlFor="modelSelect">Choose LLM Model:</label>
                      <select
                        id="modelSelect"
                        value={selectedModel}
                        onChange={(e) => onModelChange(e.target.value)}
                        disabled={isModelLoaded}
                        className="model-select"
                      >
                        <option value="" disabled>
                          -- Select an LLM Model --
                        </option>
                        {availableModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name} - {model.size} ({model.speed},{" "}
                            {model.quality})
                          </option>
                        ))}
                      </select>
                      {!isModelLoaded && !selectedModel && (
                        <p className="hint">
                          👆 Choose a model to get started. Faster models =
                          quicker responses but lower quality.
                        </p>
                      )}
                      {!isModelLoaded && selectedModel && (
                        <p className="hint warning">
                          ⏳ Initializing model... This may take a few minutes
                          on first load.
                        </p>
                      )}
                      {isModelLoaded && (
                        <p className="hint success">
                          ✅ Model loaded: {getCurrentModelName()}
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="rag-options-section card">
                    <h2>⚙️ RAG Options</h2>
                    <div className="options-grid">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={enableSourceCitations}
                          onChange={(e) =>
                            setEnableSourceCitations(e.target.checked)
                          }
                          disabled={querying}
                        />
                        <span className="checkbox-text">
                          <strong>📖 Source Citations</strong>
                          <small>Show page numbers in answers</small>
                        </span>
                      </label>

                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={enableConversationalMemory}
                          onChange={(e) =>
                            setEnableConversationalMemory(e.target.checked)
                          }
                          disabled={querying}
                        />
                        <span className="checkbox-text">
                          <strong>💭 Conversational Memory</strong>
                          <small>
                            Remember previous questions for follow-ups
                          </small>
                        </span>
                      </label>

                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={enableHybridSearch}
                          onChange={(e) =>
                            setEnableHybridSearch(e.target.checked)
                          }
                          disabled={querying}
                        />
                        <span className="checkbox-text">
                          <strong>🔍 Hybrid Search</strong>
                          <small>
                            Combine semantic (70%) + keyword (30%) search
                          </small>
                        </span>
                      </label>
                    </div>

                    {enableConversationalMemory &&
                      conversationHistory.length > 0 && (
                        <div className="conversation-info">
                          <p className="hint">
                            💭 Conversation: {conversationHistory.length}{" "}
                            exchange(s)
                          </p>
                          <button
                            className="clear-conversation-button"
                            onClick={clearConversation}
                            disabled={querying}
                          >
                            🗑️ Clear Conversation
                          </button>
                        </div>
                      )}
                  </section>

                  <section className="upload-section card">
                    <h2>📄 Step 1: Upload PDF Document</h2>

                    {!isModelLoaded && (
                      <div className="hint warning">
                        ⚠️ Please select and load a model first before uploading
                        documents.
                      </div>
                    )}

                    {!uploading && !loadedDocumentName && isModelLoaded && (
                      <div className="upload-area">
                        <input
                          type="file"
                          id="fileInput"
                          accept=".pdf"
                          onChange={onFileUpload}
                          disabled={uploading || !isModelLoaded}
                        />
                        <label
                          htmlFor="fileInput"
                          className={`upload-button ${
                            uploading || !isModelLoaded ? "disabled" : ""
                          }`}
                        >
                          📎 Choose PDF File
                        </label>
                      </div>
                    )}

                    {uploading && (
                      <div className="upload-progress">
                        <h3>📄 Processing: {uploadFileName}</h3>
                        <div className="progress-container">
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{ width: `${uploadProgress}%` }}
                            ></div>
                          </div>
                          <div className="progress-percentage">
                            {uploadProgress}%
                          </div>
                        </div>
                        <p className="progress-text">{uploadStatus}</p>
                      </div>
                    )}

                    {!uploading && loadedDocumentName && (
                      <div className="loaded-document">
                        <div className="document-info">
                          <span className="document-icon">📄</span>
                          <span className="document-name">
                            {loadedDocumentName}
                          </span>
                        </div>
                        <button
                          className="change-document-button"
                          onClick={() => {
                            setLoadedDocumentName("");
                            setGhostPayload(null);
                            setWalrusBlobId("");
                            setPolicyId("");
                            setMintedContextId("");
                            setContextSharedVersion(null);
                          }}
                          title="Upload a different document"
                        >
                          🔄 Change Document
                        </button>
                      </div>
                    )}

                    <p className="hint">
                      💡 Your document stays 100% local - never sent to any
                      server
                    </p>
                  </section>

                  <section className="wallet-section card">
                    <div className="wallet-bar">
                      <div>
                        <h2>🔐 Wallet & Access Control</h2>
                        <p className="hint">
                          Connect your Sui wallet (testnet) to mint NFTs and
                          decrypt Walrus blobs.
                        </p>
                      </div>
                      <ConnectButton />
                    </div>
                    {currentAccount ? (
                      <p className="hint success">
                        Connected: {currentAccount.address.slice(0, 6)}...
                        {currentAccount.address.slice(-4)}
                      </p>
                    ) : (
                      <p className="hint warning">
                        Wallet disconnected. Connect to unlock GhostContext
                        features.
                      </p>
                    )}
                  </section>

                  <section className="ghostcontext-section card">
                    <h2>🛡️ GhostContext Vault</h2>
                    <p className="hint">
                      Seal encrypt the parsed chunks, upload to Walrus, and
                      register ownership on Sui.
                    </p>
                    <div className="context-input-grid">
                      <label className="context-field">
                        <span>Context Title</span>
                        <input
                          type="text"
                          value={contextTitle}
                          onChange={(e) => setContextTitle(e.target.value)}
                          placeholder="e.g. Ferrari Engine Manual"
                        />
                      </label>
                      <label className="context-field">
                        <span>Category</span>
                        <input
                          type="text"
                          value={contextCategory}
                          onChange={(e) => setContextCategory(e.target.value)}
                          placeholder="General"
                        />
                      </label>
                      <label className="context-field">
                        <span>Price Per Query (in MIST)</span>
                        <input
                          type="number"
                          min="1"
                          value={pricePerQuery}
                          onChange={(e) => setPricePerQuery(e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="ghost-buttons">
                      <button
                        className="ghost-action primary"
                        onClick={handleEncryptAndUpload}
                        disabled={
                          !ghostPayload || !currentAccount || isEncrypting
                        }
                      >
                        {isEncrypting
                          ? "Encrypting..."
                          : "Seal Encrypt + Upload"}
                      </button>
                      <button
                        className="ghost-action"
                        onClick={handleMintContext}
                        disabled={!walrusBlobId || !currentAccount || isMinting}
                      >
                        {isMinting ? "Minting..." : "Mint Context NFT"}
                      </button>
                      <button
                        className="ghost-action secondary"
                        onClick={handleListContext}
                        disabled={!mintedContextId || !contextSharedVersion}
                      >
                        List Context
                      </button>
                    </div>

                    {(ghostStatus || walrusBlobId || mintedContextId) && (
                      <div className="ghostcontext-status">
                        {ghostStatus && <p>{ghostStatus}</p>}
                        {walrusBlobId && (
                          <p>
                            Walrus Blob:{" "}
                            <span className="ghost-id-pill">
                              {walrusBlobId}
                            </span>
                          </p>
                        )}
                        {policyId && (
                          <p>
                            Seal Policy:{" "}
                            <span className="ghost-id-pill">{policyId}</span>
                          </p>
                        )}
                        {mintedContextId && (
                          <p>
                            Context NFT:{" "}
                            <span className="ghost-id-pill">
                              {mintedContextId}
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </section>

                  <section className="ghostcontext-access card">
                    <h2>🔑 Session & Remote Loading</h2>
                    <div className="ghost-access-grid">
                      <button
                        className="ghost-action primary"
                        onClick={handleCreateSealSession}
                        disabled={!currentAccount || !!sessionStatus}
                      >
                        {sessionStatus
                          ? sessionStatus
                          : "Authorize Browser Session"}
                      </button>
                      <div className="context-field">
                        <span>Walrus Blob ID</span>
                        <input
                          type="text"
                          value={remoteBlobId}
                          onChange={(e) => setRemoteBlobId(e.target.value)}
                          placeholder="Enter Walrus blob ID"
                        />
                      </div>
                      <button
                        className="ghost-action secondary"
                        onClick={handleLoadFromWalrus}
                        disabled={
                          !remoteBlobId || !sessionKeyState || isLoadingRemote
                        }
                      >
                        {isLoadingRemote ? "Loading..." : "Load into RAG"}
                      </button>
                    </div>
                    {sessionKeyState && (
                      <p className="hint success">
                        Session key active. Decryptions stay inside the browser.
                      </p>
                    )}
                  </section>
                </div>
              )}
            </div>

            {/* Toast Notification */}
            {showToast && (
              <div
                className={`toast ${
                  toastType === "success" ? "success" : "error"
                }`}
              >
                <span className="toast-icon">
                  {toastType === "success" ? "✅" : "❌"}
                </span>
                <span className="toast-message">{toastMessage}</span>
              </div>
            )}

            {/* Chat Area */}
            <div className="chat-section">
              <div className="chat-container" ref={chatContainerRef}>
                {chatMessages.length === 0 && (
                  <div className="chat-empty-state">
                    <div className="empty-icon">💬</div>
                    <h3>Ready to chat!</h3>
                    <p>Upload a PDF document and start asking questions.</p>
                  </div>
                )}

                <div className="chat-messages">
                  {chatMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`message-wrapper ${
                        message.role === "user" ? "user" : "assistant"
                      }`}
                    >
                      <div className="message-bubble">
                        <div className="message-content">{message.content}</div>
                        <div className="message-meta">
                          <span className="message-time">
                            {message.timestamp.toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {message.sources && message.sources.length > 0 && (
                            <span className="message-sources">
                              📄 Pages: {getPageNumbers(message.sources)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {querying && (
                    <div className="message-wrapper assistant">
                      <div className="message-bubble typing">
                        <div className="typing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Fixed Input at Bottom */}
              <div className="chat-input-container">
                <div className="chat-input-wrapper">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask a question about your document..."
                    disabled={querying || !loadedDocumentName}
                    onKeyUp={(e) => e.key === "Enter" && onQuery()}
                    className="chat-input"
                  />
                  {!querying && (
                    <button
                      onClick={onQuery}
                      disabled={!question.trim() || !loadedDocumentName}
                      className="send-button"
                      title={
                        !loadedDocumentName
                          ? "Upload a PDF first"
                          : "Send message"
                      }
                    >
                      ➤
                    </button>
                  )}
                  {querying && (
                    <button
                      onClick={stopGeneration}
                      className="stop-button"
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

        <footer className="footer">
          <section className="tech-info">
            <p>
              <strong>Tech Stack:</strong> React 18 + Vite + WebLLM/WeInfer +
              Transformers.js + PDF.js + IndexedDB + WebGPU
            </p>
            <p>
              <strong>Privacy:</strong> 100% client-side - all processing
              happens in your browser via WebGPU/WASM
            </p>
          </section>

          <div className="footer-content">
            <div className="footer-links">
              <a href="/privacy-policy" className="footer-link">
                Privacy Policy
              </a>
              <span className="footer-separator">•</span>
              <a href="/cookie-policy" className="footer-link">
                Cookie Policy
              </a>
            </div>
            <div className="footer-credits">
              Made with <span className="heart">❤️</span> by
              <a
                href="https://emanuelestrazzullo.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="author-link"
              >
                Emanuele Strazzullo
              </a>
              <span className="footer-separator">•</span>
              <a
                href="https://www.linkedin.com/in/emanuelestrazzullo/"
                target="_blank"
                rel="noopener noreferrer"
                className="social-link"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
                LinkedIn
              </a>
            </div>
            <div className="footer-version">v{VERSION}</div>
          </div>
        </footer>
      </div>
    </main>
  );
};

export default Home;
