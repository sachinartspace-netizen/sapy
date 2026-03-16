// DeepSeek 1.3B ONNX Model Configuration
// Quantized 8-bit model for mobile inference

export const MODEL_CONFIG = {
  // Model Information
  name: 'deepseek-1.3b',
  version: '1.0',
  size: '~800MB', // Approximate size when compressed
  
  // Model URLs (using Hugging Face)
  // In production, you might host these on your own server
  downloadUrl: 'https://huggingface.co/deepseek/deepseek-1.3b-onnx/resolve/main/model.onnx',
  tokenizerUrl: 'https://huggingface.co/deepseek/deepseek-1.3b-onnx/resolve/main/tokenizer.json',
  
  // Local storage paths
  modelPath: '/models/deepseek-1.3b.onnx',
  tokenizerPath: '/models/deepseek-1.3b-tokenizer.json',
  
  // Model Parameters
  maxTokens: 2048,
  contextWindow: 2048,
  vocabSize: 32000,
  
  // Generation Parameters
  temperature: 0.7,
  topP: 0.9,
  topK: 50,
  repetitionPenalty: 1.0,
  
  // Inference Settings
  maxNewTokens: 512, // Max tokens to generate per response
  minNewTokens: 10,
  
  // System Prompt
  systemPrompt: `You are Sapy, a helpful AI assistant that works offline on the user's device. 
You are knowledgeable, friendly, and always provide accurate information.
You respect user privacy - all conversations are stored locally on their device.
Keep responses concise and helpful. Use markdown for formatting when appropriate.`,

  // Special Tokens
  tokens: {
    bos: '<|begin▁of▁sentence|>', // Beginning of sequence
    eos: '<|end▁of▁sentence|>',   // End of sequence
    pad: '<|padding|>',             // Padding token
    unk: '<|unk|>',                 // Unknown token
  },
  
  // Quantization Settings
  quantization: {
    enabled: true,
    type: 'int8', // 8-bit quantization
    precision: 'float16', // Use float16 for faster inference
  },
  
  // Performance Settings
  performance: {
    batchSize: 1,
    numThreads: 4, // Use 4 CPU threads
    gpuAcceleration: true, // Enable if available on device
  },
  
  // Model Capabilities
  capabilities: {
    chat: true,
    instruction: true,
    multiTurn: true,
    reasoning: true,
  },
  
  // Validation
  checksum: {
    // SHA256 of model file (for integrity checking)
    enabled: true,
    // This would be the actual SHA256 hash in production
    expected: 'placeholder-sha256-hash',
  },
};

// Token configuration for encoding/decoding
export const TOKENIZER_CONFIG = {
  // BPE (Byte Pair Encoding) configuration
  vocabSize: MODEL_CONFIG.vocabSize,
  maxTokenLength: 2048,
  
  // Special token IDs
  bos_token_id: 1,
  eos_token_id: 2,
  pad_token_id: 0,
  unk_token_id: 3,
  
  // Chat template
  chatTemplate: `<|system|>
{system}
<|endoftext|>
<|user|>
{prompt}
<|endoftext|>
<|assistant|>
{response}`,
};

// Default inference parameters
export const DEFAULT_INFERENCE_PARAMS = {
  temperature: MODEL_CONFIG.temperature,
  topP: MODEL_CONFIG.topP,
  topK: MODEL_CONFIG.topK,
  maxNewTokens: MODEL_CONFIG.maxNewTokens,
  repetitionPenalty: MODEL_CONFIG.repetitionPenalty,
  doSample: true,
};

// Download configuration
export const DOWNLOAD_CONFIG = {
  // Retry configuration
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds between retries
  
  // Timeout
  timeout: 300000, // 5 minutes per request
  
  // Chunk size for downloads
  chunkSize: 1024 * 1024, // 1MB chunks
  
  // Resume support
  resumeSupported: true,
};

// Cache configuration
export const CACHE_CONFIG = {
  maxCacheSize: 2 * 1024 * 1024 * 1024, // 2GB max cache
  cachePath: '/models/cache',
  
  // TTL for cached items (optional)
  ttl: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// Error messages
export const ERROR_MESSAGES = {
  MODEL_NOT_FOUND: 'AI model not found. Falling back to cloud API.',
  DOWNLOAD_FAILED: 'Failed to download AI model. Using cloud API instead.',
  INFERENCE_FAILED: 'Local inference failed. Using cloud API instead.',
  NETWORK_ERROR: 'Network connection required for cloud API.',
  STORAGE_FULL: 'Device storage is full. Please free up space.',
  MODEL_CORRUPTED: 'Model file corrupted. Re-downloading...',
  TOKENIZER_MISSING: 'Tokenizer not found. Using default encoding.',
};

export default {
  MODEL_CONFIG,
  TOKENIZER_CONFIG,
  DEFAULT_INFERENCE_PARAMS,
  DOWNLOAD_CONFIG,
  CACHE_CONFIG,
  ERROR_MESSAGES,
};
