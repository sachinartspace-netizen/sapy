import { useState, useCallback, useEffect, useRef } from 'react';
import { aiService } from '../services/aiService';
import { Alert } from 'react-native';

export interface UseAIChatReturn {
  // State
  messages: any[];
  isLoading: boolean;
  error: string | null;
  modelLoaded: boolean;
  isOnline: boolean;
  downloadProgress: number;
  
  // Methods
  sendMessage: (message: string) => Promise<void>;
  downloadModel: () => Promise<void>;
  clearHistory: () => Promise<void>;
  retryLastMessage: () => Promise<void>;
  
  // Status
  getStatus: () => any;
}

export function useAIChat(): UseAIChatReturn {
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  const lastMessageRef = useRef<string | null>(null);

  // Initialize AI service on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        await aiService.initialize();
        
        // Load initial status
        const status = aiService.getStatus();
        setModelLoaded(status.modelLoaded);
        setIsOnline(status.isOnline);
        
        // Load conversation history
        const history = aiService.getConversationHistory();
        setMessages(history);
      } catch (err) {
        console.error('Error initializing AI service:', err);
      }
    };

    initialize();

    // Check network status periodically
    const interval = setInterval(() => {
      const status = aiService.getStatus();
      setIsOnline(status.isOnline);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Send message to AI
  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim()) {
        setError('Message cannot be empty');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        lastMessageRef.current = userMessage;

        // Get AI response
        const response = await aiService.sendMessage(userMessage);

        // Update messages
        const history = aiService.getConversationHistory();
        setMessages(history);

        // Log where response came from
        console.log(`Response from ${response.source} (${response.inferenceTime}ms)`);
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to send message. Please try again.';
        setError(errorMsg);
        
        // Show error alert
        Alert.alert('Error', errorMsg, [
          {
            text: 'Retry',
            onPress: () => {
              if (lastMessageRef.current) {
                sendMessage(lastMessageRef.current);
              }
            },
          },
          {
            text: 'Dismiss',
            style: 'cancel',
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Download local model
  const downloadModel = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const success = await aiService.downloadModel((progress) => {
        setDownloadProgress(progress);
      });

      if (success) {
        setModelLoaded(true);
        Alert.alert('Success', 'AI model downloaded successfully!');
      } else {
        setError('Failed to download model');
        Alert.alert(
          'Download Failed',
          'Could not download the AI model. You can still use cloud-based AI.'
        );
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to download model';
      setError(errorMsg);
      Alert.alert('Error', errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear conversation history
  const clearHistory = useCallback(async () => {
    try {
      await aiService.clearHistory();
      setMessages([]);
      setError(null);
    } catch (err) {
      console.error('Error clearing history:', err);
    }
  }, []);

  // Retry last message
  const retryLastMessage = useCallback(async () => {
    if (lastMessageRef.current) {
      await sendMessage(lastMessageRef.current);
    } else {
      setError('No previous message to retry');
    }
  }, [sendMessage]);

  // Get current status
  const getStatus = useCallback(() => {
    return aiService.getStatus();
  }, []);

  return {
    messages,
    isLoading,
    error,
    modelLoaded,
    isOnline,
    downloadProgress,
    sendMessage,
    downloadModel,
    clearHistory,
    retryLastMessage,
    getStatus,
  };
}

export default useAIChat;
