import { LlmClientWeInfer } from './llm-client-weinfer';
import { Embedder } from './embedder';
import { VectorStore } from './vector-store';
import { PdfParser } from './pdf-parser';

export class RagEngineWeInfer {
  constructor(
    public llm: LlmClientWeInfer,
    public embedder: Embedder,
    public vectorStore: VectorStore,
    public parser: PdfParser
  ) {}
  
  async initialize(): Promise<void> {
    console.log('🚀 Initializing WebPizza RAG Engine (WeInfer)...');
    
    console.log('1/3: Initializing LLM (WeInfer)...');
    await this.llm.initialize();
    
    console.log('2/3: Initializing embedder...');
    await this.embedder.initialize();
    
    console.log('3/3: Initializing vector store...');
    await this.vectorStore.initialize();
    
    console.log('✅ RAG Engine (WeInfer) ready!');
  }
  
  async query(
    question: string, 
    onToken?: (partialAnswer: string) => void,
    conversationHistory: Array<{question: string; answer: string}> = [],
    useHybridSearch = false,
    enableSourceCitations = false
  ): Promise<string> {
    const ragStartTime = performance.now();
    console.log('🔍 RAG Query started (WeInfer):', question);
    
    const totalChunks = await this.vectorStore.getChunkCount();
    console.log(`📊 Vector store contains ${totalChunks} chunks`);
    
    if (totalChunks === 0) {
      console.warn('⚠️ Vector store is empty! Please upload a PDF document first.');
      return 'Please upload a PDF document first before asking questions.';
    }
    
    const queryEmbedding = await this.embedder.embed(question);
    const searchResults = await this.vectorStore.search(queryEmbedding, 3, useHybridSearch, question);
    
    let context: string;
    if (enableSourceCitations) {
      const contextParts = searchResults.map((result, i) => {
        const pageNum = result.chunk.metadata?.['pageNumber'] || 'unknown';
        return `[Source ${i + 1} - Page ${pageNum}]\n${result.chunk.text}`;
      });
      context = contextParts.join('\n\n');
    } else {
      context = searchResults.map(r => r.chunk.text).join('\n\n');
    }
    
    let conversationContext = '';
    if (conversationHistory.length > 0) {
      conversationContext = '\n\nPrevious conversation:\n';
      conversationHistory.forEach((exchange, i) => {
        conversationContext += `Q${i + 1}: ${exchange.question}\nA${i + 1}: ${exchange.answer}\n\n`;
      });
    }
    
    const citationInstruction = enableSourceCitations 
      ? ' Always cite your sources by mentioning the page number when referencing information.' 
      : '';
    
    const answerInstruction = enableSourceCitations
      ? ' (remember to cite page numbers when referencing information)'
      : '';
    
    const prompt = `You are a helpful assistant. Answer the question based on the provided context.${citationInstruction}${conversationContext}

Context:
${context}

Question: ${question}

Answer${answerInstruction}:`;
    
    const answer = await this.llm.generate(prompt, onToken);
    
    const totalTime = ((performance.now() - ragStartTime) / 1000).toFixed(2);
    console.log(`✅ RAG Query complete (WeInfer) in ${totalTime}s`);
    
    return answer;
  }
}

