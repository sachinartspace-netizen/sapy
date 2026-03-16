import NetInfo from '@react-native-community/netinfo';
import { api } from '../api/client';
import { modelManager } from './modelManager';
import { database } from '../db/database';
import { ERROR_MESSAGES, DEFAULT_INFERENCE_PARAMS } from '../utils/modelConfig';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  source: 'local' | 'cloud';
  error?: string;
}

interface AIResponse {
  message: string;
  source: 'local' | 'cloud';
  tokensUsed: number;
  inferenceTime: number;
  error?: string;
}

class AIService {
  private isModelLoaded = false;
  private isOnline = true;
  private model: any = null;
  private conversationHistory: ChatMessage[] = [];
  private lastNetworkCheck = 0;
  private networkCheckInterval = 10000; // Check every 10 seconds

  constructor() {
    this.initializeNetworkListener();
    this.loadConversationHistory();
  }

  /**
   * Initialize network connectivity listener
   */
  private initializeNetworkListener() {
    NetInfo.addEventListener((state) => {
      this.isOnline = state.isConnected ?? false;
      console.log('Network status:', this.isOnline ? 'Online' : 'Offline');
    });
  }

  /**
   * Initialize AI service on app startup
   */
  async initialize(): Promise<void> {
    try {
      // Check network connectivity
      const netState = await NetInfo.fetch();
      this.isOnline = netState.isConnected ?? false;

      // Check if model exists locally
      const modelStatus = await modelManager.checkModelStatus();

      if (modelStatus.exists && modelStatus.isValid) {
        console.log('Local model found, loading...');
        this.isModelLoaded = true;
        // In production, initialize ONNX Runtime here
      } else if (this.isOnline) {
        console.log('Model not found, will download on first use');
      }
    } catch (error) {
      console.error('Error initializing AI service:', error);
    }
  }

  /**
   * Load conversation history from SQLite
   */
  private async loadConversationHistory() {
    try {
      const messages = await database.getMessages('default');
      this.conversationHistory = messages.map((msg: any, index: number) => ({
        id: msg.id || String(index),
        role: msg.sender_type === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime(),
        source: msg.sender_type === 'user' ? 'user' : 'local',
      }));
    } catch (error) {
      console.error('Error loading conversation history:', error);
    }
  }

  /**
   * Send message and get AI response
   */
  async sendMessage(userMessage: string): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Add user message to history
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userMessage,
        timestamp: startTime,
        source: 'local',
      };

      this.conversationHistory.push(userMsg);

      // Save user message to database
      await database.addMessage({
        conversation_id: 'default',
        sender_type: 'user',
        content: userMessage,
        created_at: new Date(),
      });

      // Try local inference first if model is loaded
      if (this.isModelLoaded) {
        try {
          const response = await this.localInference(userMessage);
          const inferenceTime = Date.now() - startTime;

          return {
            ...response,
            inferenceTime,
            source: 'local',
          };
        } catch (error) {
          console.warn('Local inference failed, falling back to cloud:', error);
        }
      }

      // Fall back to cloud API
      if (this.isOnline) {
        try {
          const response = await this.cloudInference(userMessage);
          const inferenceTime = Date.now() - startTime;

          return {
            ...response,
            inferenceTime,
            source: 'cloud',
          };
        } catch (error) {
          console.error('Cloud inference failed:', error);
          throw error;
        }
      }

      // No inference method available
      throw new Error(
        'No inference method available. Please check your internet connection or try again later.'
      );
    } catch (error: any) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Local inference using ONNX Runtime
   * This is a placeholder - in production, integrate actual ONNX Runtime
   */
  private async localInference(userMessage: string): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // TODO: Implement actual ONNX Runtime inference
      // Steps:
      // 1. Tokenize input message
      // 2. Build chat history context
      // 3. Run model inference
      // 4. Detokenize output
      // 5. Return response

      // For now, return a simulated response
      const response = await this.simulateLocalInference(userMessage);
      const tokensUsed = this.estimateTokens(userMessage + response);
      const inferenceTime = Date.now() - startTime;

      // Add assistant message to history
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        source: 'local',
      };

      this.conversationHistory.push(assistantMsg);

      // Save to database
      await database.addMessage({
        conversation_id: 'default',
        sender_type: 'ai',
        content: response,
        created_at: new Date(),
      });

      return {
        message: response,
        tokensUsed,
        inferenceTime,
        source: 'local',
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cloud inference using Phase 2A API
   */
  private async cloudInference(userMessage: string): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const response = await api.sendMessage({
        conversation_id: 'default',
        message: userMessage,
      });

      const tokensUsed = this.estimateTokens(userMessage + response.response);
      const inferenceTime = Date.now() - startTime;

      // Add assistant message to history
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.response,
        timestamp: Date.now(),
        source: 'cloud',
      };

      this.conversationHistory.push(assistantMsg);

      // Save to database
      await database.addMessage({
        conversation_id: 'default',
        sender_type: 'ai',
        content: response.response,
        created_at: new Date(),
      });

      return {
        message: response.response,
        tokensUsed,
        inferenceTime,
        source: 'cloud',
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Simulate local inference (placeholder for ONNX Runtime integration)
   */
  private async simulateLocalInference(userMessage: string): Promise<string> {
    // Simulate inference delay (2-5 seconds typically)
    const delay = 2000 + Math.random() * 3000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Generate a contextual response based on user input
    const responses: { [key: string]: string } = {
      hello: 'Hello! I\'m Sapy, your offline AI assistant. How can I help you today?',
      'how are you': 'I\'m doing well, thank you for asking! I\'m ready to assist you with any questions.',
      help:
        'I can help you with:\n• Answering questions\n• Writing content\n• Brainstorming ideas\n• Explaining concepts\n• And much more!\n\nWhat would you like to know?',
      'thank you': 'You\'re welcome! Feel free to ask if you need anything else.',
    };

    const lowerMessage = userMessage.toLowerCase();
    for (const [key, response] of Object.entries(responses)) {
      if (lowerMessage.includes(key)) {
        return response;
      }
    }

    // Default response
    return `I received your message: "${userMessage}". This is a simulated response. In production, I'll use the local AI model (DeepSeek 1.3B) to generate intelligent, contextual responses based on our conversation history. The model runs entirely offline on your device!`;
  }

  /**
   * Estimate tokens in text (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Download model for offline use
   */
  async downloadModel(onProgress?: (progress: number) => void): Promise<boolean> {
    try {
      // Check if model already exists
      const modelStatus = await modelManager.checkModelStatus();
      if (modelStatus.exists && modelStatus.isValid) {
        console.log('Model already exists');
        this.isModelLoaded = true;
        return true;
      }

      // Download model with progress tracking
      const success = await modelManager.downloadModel((progress) => {
        if (onProgress) {
          onProgress(progress.percentage);
        }
      });

      if (success) {
        this.isModelLoaded = true;
        console.log('Model downloaded successfully');
      }

      return success;
    } catch (error) {
      console.error('Error downloading model:', error);
      return false;
    }
  }

  /**
   * Check if model is loaded
   */
  isModelAvailable(): boolean {
    return this.isModelLoaded;
  }

  /**
   * Check if online
   */
  isOnlineMode(): boolean {
    return this.isOnline;
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ChatMessage[] {
    return this.conversationHistory;
  }

  /**
   * Clear conversation history
   */
  async clearHistory(): Promise<void> {
    try {
      this.conversationHistory = [];
      // TODO: Clear from database as well
      await database.addMessage({
        conversation_id: 'default',
        sender_type: 'user',
        content: '[Conversation cleared]',
        created_at: new Date(),
      });
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }

  /**
   * Get AI service status
   */
  getStatus() {
    return {
      modelLoaded: this.isModelLoaded,
      isOnline: this.isOnline,
      conversationLength: this.conversationHistory.length,
      modelPath: this.isModelLoaded ? modelManager.getModelPath() : null,
    };
  }
}

export const aiService = new AIService();
export default aiService;
