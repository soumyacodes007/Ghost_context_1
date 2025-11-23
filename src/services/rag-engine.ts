import { LlmClient } from "./llm-client";
import { Embedder } from "./embedder";
import { VectorStore } from "./vector-store";
import { PdfParser } from "./pdf-parser";

export class RagEngine {
  constructor(
    public llm: LlmClient,
    public embedder: Embedder,
    public vectorStore: VectorStore,
    public parser: PdfParser
  ) {}

  async initialize(): Promise<void> {
    console.log("🚀 Initializing WebPizza RAG Engine...");

    console.log("1/3: Initializing LLM...");
    await this.llm.initialize();

    console.log("2/3: Initializing embedder...");
    await this.embedder.initialize();

    console.log("3/3: Initializing vector store...");
    await this.vectorStore.initialize();

    console.log("✅ RAG Engine ready!");
  }

  async ingest(file: File): Promise<void> {
    const parsedChunks = await this.parser.parseFile(file);

    for (const parsedChunk of parsedChunks) {
      const embedding = await this.embedder.embed(parsedChunk.text);
      await this.vectorStore.addChunk({
        id: `${file.name}-${parsedChunk.chunkIndex}`,
        text: parsedChunk.text,
        embedding,
        metadata: {
          filename: file.name,
          chunkIndex: parsedChunk.chunkIndex,
          pageNumber: parsedChunk.pageNumber,
        },
      });
    }
  }

  async query(
    question: string,
    onToken?: (partialAnswer: string) => void,
    conversationHistory: Array<{ question: string; answer: string }> = [],
    useHybridSearch = false,
    enableSourceCitations = false
  ): Promise<string> {
    const ragStartTime = performance.now();
    console.log("🔍 RAG Query started:", question);

    const totalChunks = await this.vectorStore.getChunkCount();
    console.log(`📊 Vector store contains ${totalChunks} chunks`);

    if (totalChunks === 0) {
      console.warn(
        "⚠️ Vector store is empty! Please upload a PDF document first."
      );
      return "Please upload a PDF document first before asking questions.";
    }

    console.log("1️⃣ Embedding question...");
    const embedStart = performance.now();
    const queryEmbedding = await this.embedder.embed(question);
    const embedTime = ((performance.now() - embedStart) / 1000).toFixed(2);
    console.log(
      `✅ Question embedded in ${embedTime}s, vector length:`,
      queryEmbedding.length
    );

    console.log("2️⃣ Searching vector store...");
    const searchStart = performance.now();
    const searchResults = await this.vectorStore.search(
      queryEmbedding,
      3,
      useHybridSearch,
      question
    );
    const searchTime = ((performance.now() - searchStart) / 1000).toFixed(2);
    console.log(
      `✅ Found ${searchResults.length} relevant chunks in ${searchTime}s`
    );
    console.log(
      "📄 Chunks:",
      searchResults.map(
        (r, i) =>
          `[${i}] Page ${
            r.chunk.metadata?.["pageNumber"] || "?"
          } (score: ${r.score.toFixed(3)}): ${r.chunk.text.substring(0, 50)}...`
      )
    );

    console.log(
      `3️⃣ Building context ${
        enableSourceCitations ? "with" : "without"
      } source citations...`
    );
    let context: string;

    if (enableSourceCitations) {
      const contextParts = searchResults.map((result, i) => {
        const pageNum = result.chunk.metadata?.["pageNumber"] || "unknown";
        return `[Source ${i + 1} - Page ${pageNum}]\n${result.chunk.text}`;
      });
      context = contextParts.join("\n\n");
    } else {
      context = searchResults.map((r) => r.chunk.text).join("\n\n");
    }

    console.log("✅ Context length:", context.length, "chars");

    console.log("4️⃣ Generating answer with LLM...");
    const llmStart = performance.now();

    let conversationContext = "";
    if (conversationHistory.length > 0) {
      conversationContext = "\n\nPrevious conversation:\n";
      conversationHistory.forEach((exchange, i) => {
        conversationContext += `Q${i + 1}: ${exchange.question}\nA${i + 1}: ${
          exchange.answer
        }\n\n`;
      });
      console.log(
        `💭 Including ${conversationHistory.length} previous exchanges in context`
      );
    }

    const citationInstruction = enableSourceCitations
      ? " Always cite your sources by mentioning the page number when referencing information."
      : "";

    const answerInstruction = enableSourceCitations
      ? " (remember to cite page numbers when referencing information)"
      : "";

    const prompt = `You are a helpful assistant. Answer the question based on the provided context.${citationInstruction}${conversationContext}

Context:
${context}

Question: ${question}

Answer${answerInstruction}:`;

    const answer = await this.llm.generate(prompt, onToken);

    // Log system prompt and response
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("SYSTEM PROMPT:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(
      "You are a helpful assistant. Answer the question based on the provided context."
    );
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(" LLM RESPONSE:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(answer);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return answer;
  }
}
