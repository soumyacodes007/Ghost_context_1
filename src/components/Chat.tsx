// import { useState, useEffect, useRef, useCallback } from "react";
// import { useSearchParams } from "react-router-dom";
// import {
//   ConnectButton,
//   useCurrentAccount,
// } from "@mysten/dapp-kit";
// import { RagEngine } from "../services/rag-engine";
// import { RagEngineWeInfer } from "../services/rag-engine-weinfer";
// import { LlmClient } from "../services/llm-client";
// import { LlmClientWeInfer } from "../services/llm-client-weinfer";
// import { Embedder } from "../services/embedder";
// import { VectorStore } from "../services/vector-store";
// import { PdfParser } from "../services/pdf-parser";
// import {
//   downloadAndDecrypt,
//   type EncryptedMetadata,
// } from "../ghostcontext/encryption-workflow";
// import {
//   createGhostContextPayload,
//   type GhostContextPayload,
// } from "../services/ghostcontext-payload";
// import "./Chat.css";

// interface ChatMessage {
//   role: "user" | "assistant";
//   content: string;
//   timestamp: Date;
//   sources?: Array<{ page: number }>;
// }

// type EngineType = "webllm" | "weinfer";

// const Chat = () => {
//   const [loading, setLoading] = useState(false);
//   const [uploading, setUploading] = useState(false);
//   const [querying, setQuerying] = useState(false);
//   const [question, setQuestion] = useState("");
//   const [answer, setAnswer] = useState("");
//   const [initProgress, setInitProgress] = useState("");
//   const [showBrowserError, setShowBrowserError] = useState(false);
//   const [browserErrorDetails, setBrowserErrorDetails] = useState("");
//   const [isModelLoaded, setIsModelLoaded] = useState(false);
//   const [selectedModel, setSelectedModel] = useState("");
//   const [selectedEngine, setSelectedEngine] = useState<EngineType>("webllm");
//   const [availableModels, setAvailableModels] = useState<any[]>([]);
//   const [loadingProgress, setLoadingProgress] = useState(0);
//   const [uploadProgress, setUploadProgress] = useState(0);
//   const [uploadStatus, setUploadStatus] = useState("");
//   const [uploadFileName, setUploadFileName] = useState("");
//   const [loadedDocumentName, setLoadedDocumentName] = useState("");
