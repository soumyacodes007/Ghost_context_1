import { pipeline, env } from '@xenova/transformers';

export class Embedder {
  private pipe: any;
  private progressCallback?: (message: string) => void;
  
  constructor() {
    // Configure Transformers.js for browser environment
    env.allowRemoteModels = true;
    env.allowLocalModels = false;
    
    // Disable Node.js-specific backends
    env.backends.onnx.wasm.numThreads = 1;
    
    // Use CDN for WASM files
    env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@latest/dist/';
  }
  
  setProgressCallback(callback: (message: string) => void): void {
    this.progressCallback = callback;
  }
  
  async initialize(): Promise<void> {
    console.log('🔢 Initializing embedder (all-MiniLM-L6-v2)...');
    this.progressCallback?.('Loading embedder model...');
    
    this.pipe = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { 
        quantized: true,
        progress_callback: (progress: any) => {
          if (progress.status === 'downloading') {
            const percent = Math.round(progress.progress || 0);
            const message = `Downloading embedder: ${progress.file} (${percent}%)`;
            console.log(message);
            this.progressCallback?.(message);
          } else if (progress.status === 'done') {
            this.progressCallback?.('Embedder loaded ✓');
          }
        }
      }
    );
    
    console.log('✅ Embedder ready!');
  }
  
  async embed(text: string): Promise<number[]> {
    if (!this.pipe) {
      throw new Error('Embedder not initialized. Please load a model first.');
    }
    
    console.log('🔢 Embedding text:', text.substring(0, 100) + '...');
    const startTime = Date.now();
    
    const output = await this.pipe(text, { 
      pooling: 'mean', 
      normalize: true 
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ Embedding complete in ${duration}ms`);
    
    return Array.from(output.data);
  }
}

