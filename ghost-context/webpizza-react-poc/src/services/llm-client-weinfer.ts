import { CreateMLCEngine } from '../lib/weinfer/index.js';
import type { MLCEngineInterface, ChatCompletionRequest, ChatCompletion } from '@mlc-ai/web-llm';

export class LlmClientWeInfer {
  private engine: MLCEngineInterface | null = null;
  private progressCallback?: (message: string) => void;
  private currentModel = 'Phi-3-mini-4k-instruct-q4f16_1-MLC';
  
  // Available models for WeInfer
  public readonly availableModels = [
    { 
      id: 'Phi-3-mini-4k-instruct-q4f16_1-MLC', 
      name: 'Phi-3 Mini (2GB)', 
      size: '~2GB',
      speed: 'Fast',
      quality: 'Good'
    },
    { 
      id: 'Qwen2-1.5B-Instruct-q4f16_1-MLC', 
      name: 'Qwen 2 1.5B (1GB)', 
      size: '~1GB',
      speed: 'Very Fast',
      quality: 'Good'
    },
    { 
      id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC', 
      name: 'Mistral 7B (4GB)', 
      size: '~4GB',
      speed: 'Medium',
      quality: 'Excellent'
    },
    { 
      id: 'Llama-3-8B-Instruct-q4f16_1-MLC', 
      name: 'Llama 3 8B (4GB)', 
      size: '~4GB',
      speed: 'Medium',
      quality: 'Excellent'
    },
    { 
      id: 'gemma-2b-it-q4f16_1-MLC', 
      name: 'Gemma 2B (1.2GB)', 
      size: '~1.2GB',
      speed: 'Fast',
      quality: 'Good'
    }
  ];
  
  setProgressCallback(callback: (message: string) => void): void {
    this.progressCallback = callback;
  }
  
  setModel(modelId: string): void {
    this.currentModel = modelId;
  }
  
  getCurrentModel(): string {
    return this.currentModel;
  }
  
  private throwWebGPUError(reason: string): void {
    const error = new Error(
      'WebGPU is required for this demo.\n\n' +
      '❌ Issue: ' + reason + '\n\n' +
      'Requirements:\n' +
      '✅ Chrome 113+ or Edge 113+ with WebGPU enabled\n' +
      '✅ Modern GPU (Intel HD 5500+, NVIDIA GTX 650+, AMD HD 7750+, Apple M1+)\n' +
      '✅ 4GB+ RAM available\n\n' +
      'Setup:\n' +
      '1. Open chrome://flags\n' +
      '2. Search "WebGPU"\n' +
      '3. Enable "Unsafe WebGPU"\n' +
      '4. Restart browser\n\n' +
      'Check your browser: https://webgpureport.org/'
    );
    this.progressCallback?.('❌ WebGPU not available - ' + reason);
    throw error;
  }
  
  async initialize(): Promise<void> {
    console.log('🔍 Checking WebGPU availability (WeInfer)...');
    
    if (!('gpu' in navigator)) {
      this.throwWebGPUError('Navigator.gpu API not found');
      return;
    }
    
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (!adapter) {
        this.throwWebGPUError('No WebGPU adapter available');
        return;
      }
      console.log('✅ WebGPU adapter found:', adapter);
    } catch (error) {
      this.throwWebGPUError('Failed to request WebGPU adapter: ' + error);
      return;
    }
    
    const modelInfo = this.availableModels.find(m => m.id === this.currentModel);
    console.log(`🚀 Initializing WeInfer with ${modelInfo?.name || this.currentModel}...`);
    this.progressCallback?.(`Initializing ${modelInfo?.name || 'LLM'}...`);
    
    this.engine = await CreateMLCEngine(
      this.currentModel,
      { 
        initProgressCallback: (progress) => {
          console.log('WeInfer Progress:', progress.text);
          this.progressCallback?.(progress.text);
        },
        logLevel: 'WARN',
      }
    ) as unknown as MLCEngineInterface;
    
    console.log(`✅ WeInfer LLM ready! (${modelInfo?.name})`);
  }
  
  async generate(prompt: string, onToken?: (token: string) => void): Promise<string> {
    if (!this.engine) {
      throw new Error('LLM engine not initialized. WebGPU is required.');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 Starting WeInfer LLM generation...');
    console.log('📝 Prompt length:', prompt.length, 'chars');
    
    const startTime = performance.now();
    let fullResponse = '';
    let tokenCount = 0;
    
    const request: ChatCompletionRequest = {
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 512,
      stream: true,
      top_p: 0.9,
    };
    
    const chunks = await this.engine.chat.completions.create(request);
    
    for await (const chunk of chunks as AsyncIterable<ChatCompletion>) {
      const delta = (chunk.choices[0] as any)?.delta?.content || '';
      if (delta) {
        fullResponse += delta;
        tokenCount++;
        
        if (onToken) {
          onToken(fullResponse);
        }
      }
    }
    
    const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ WeInfer generation complete in ${totalTime}s (${tokenCount} tokens)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return fullResponse;
  }
}

