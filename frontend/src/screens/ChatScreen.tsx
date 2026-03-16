import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MessageBubble } from '../components/MessageBubble';
import { MessageInput } from '../components/MessageInput';
import { TypingIndicator } from '../components/TypingIndicator';
import { Message } from '../types';
import { useAIChat } from '../hooks/useAIChat';
import { messageLimitService } from '../services/messageLimitService';
import { licenseService } from '../services/licenseService';
import { syncCoordinator } from '../services/syncCoordinator';

const ChatScreen = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const aiChat = useAIChat();
  const [showModelDownloadPrompt, setShowModelDownloadPrompt] = useState(false);
  const [usageString, setUsageString] = useState<string>('0 / 55');
  const [remainingMessages, setRemainingMessages] = useState<number>(55);
  const [syncStatus, setSyncStatus] = useState<any>({ status: 'idle', isOnline: true });
  const flatListRef = useRef<FlatList>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [aiChat.messages]);

  // Check if model should be downloaded on first load
  useEffect(() => {
    if (!aiChat.modelLoaded && aiChat.isOnline) {
      setShowModelDownloadPrompt(true);
    }
  }, [aiChat.modelLoaded, aiChat.isOnline]);

  // Update usage on component mount and when messages change
  useEffect(() => {
    updateUsage();
  }, [aiChat.messages.length]);

  // Monitor sync status
  useEffect(() => {
    const interval = setInterval(async () => {
      const status = await syncCoordinator.getStatus();
      setSyncStatus(status);
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const updateUsage = async () => {
    try {
      const usage = await messageLimitService.getDailyUsage();
      setUsageString(
        `${usage.messagesUsed} / ${usage.messagesLimit}`
      );
      setRemainingMessages(usage.remainingMessages);
    } catch (error) {
      console.error('Error updating usage:', error);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || aiChat.isLoading) return;

    // Check message limit
    const limitCheck = await messageLimitService.canSendMessage();
    if (!limitCheck.canSend) {
      Alert.alert(
        'Daily Limit Reached',
        limitCheck.reason,
        [
          {
            text: 'View Plans',
            onPress: () => navigation.navigate('Subscription'),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
      return;
    }

    try {
      // Record message usage
      await messageLimitService.recordMessageUsage();
      await updateUsage();
      
      // Send message
      await aiChat.sendMessage(text);
    } catch (error) {
      // Error is already handled in the hook
      console.error('Error sending message:', error);
    }
  };

  const handleDownloadModel = async () => {
    setShowModelDownloadPrompt(false);
    try {
      await aiChat.downloadModel();
    } catch (error) {
      console.error('Error downloading model:', error);
    }
  };

  const scrollToEnd = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const renderMessage = ({ item }: { item: any }) => (
    <MessageBubble
      message={{
        id: item.id,
        conversation_id: item.conversation_id || 'default',
        sender_type: item.role === 'user' ? 'user' : 'ai',
        content: item.content,
        created_at: new Date(item.timestamp),
      }}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flexContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Status Bar */}
        <View style={styles.statusBar}>
          <View style={styles.statusContent}>
            <View style={styles.statusIndicator}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: aiChat.isOnline ? '#4CAF50' : '#FF9800',
                  },
                ]}
              />
              <Text style={styles.statusText}>
                {aiChat.isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            <View style={styles.modeIndicator}>
              <Text style={styles.modeText}>
                {aiChat.modelLoaded ? '🤖 Local AI' : '☁️ Cloud AI'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.usageIndicator}
              onPress={() => navigation.navigate('Subscription')}
            >
              <Text style={styles.usageText}>{usageString}</Text>
            </TouchableOpacity>
          </View>

          {/* Sync Status Row */}
          <View style={styles.syncStatusRow}>
            {syncStatus.status === 'syncing' && (
              <View style={styles.syncingIndicator}>
                <ActivityIndicator size="small" color="#0066FF" />
                <Text style={styles.syncingText}>Syncing...</Text>
              </View>
            )}
            {syncStatus.status === 'offline' && (
              <Text style={styles.offlineWarning}>⚠️ Offline - Messages will sync when online</Text>
            )}
            {syncStatus.status === 'error' && (
              <Text style={styles.errorWarning}>❌ Sync error - Retrying...</Text>
            )}
            {syncStatus.queuedMessages > 0 && (
              <Text style={styles.queueWarning}>📤 {syncStatus.queuedMessages} pending</Text>
            )}
          </View>

          {remainingMessages < 20 && licenseService.getCurrentTier() !== 'PREMIUM' && (
            <Text style={styles.limitWarning}>
              ⚠️ {remainingMessages} messages remaining
            </Text>
          )}
        </View>

        {/* Download Model Prompt */}
        {showModelDownloadPrompt && !aiChat.modelLoaded && (
          <View style={styles.downloadPrompt}>
            <Text style={styles.downloadTitle}>
              Download AI Model for Offline Use?
            </Text>
            <Text style={styles.downloadDescription}>
              Download DeepSeek 1.3B (~800MB) to chat without internet
            </Text>
            <View style={styles.downloadButtons}>
              <TouchableOpacity
                style={[styles.downloadButton, styles.skipButton]}
                onPress={() => setShowModelDownloadPrompt(false)}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.downloadButton, styles.downloadButtonPrimary]}
                onPress={handleDownloadModel}
              >
                {aiChat.isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={styles.downloadButtonText}>Download</Text>
                    {aiChat.downloadProgress > 0 && (
                      <Text style={styles.downloadProgress}>
                        {Math.round(aiChat.downloadProgress)}%
                      </Text>
                    )}
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Messages List */}
        <View style={styles.chatContainer}>
          {aiChat.messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>
                {aiChat.modelLoaded ? '🤖' : '💬'}
              </Text>
              <Text style={styles.emptyTitle}>
                {aiChat.modelLoaded
                  ? 'Chat with Offline AI'
                  : 'Start Chatting'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {aiChat.modelLoaded
                  ? 'Your messages are processed locally on your device'
                  : 'Type a message to get started'}
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={aiChat.messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messageList}
              scrollEnabled={true}
              onContentSizeChange={scrollToEnd}
            />
          )}

          {aiChat.isLoading && (
            <View style={styles.typingContainer}>
              <TypingIndicator />
              <Text style={styles.typingText}>
                {aiChat.modelLoaded ? 'Thinking locally...' : 'Connecting...'}
              </Text>
            </View>
          )}
        </View>

        {/* Error Message */}
        {aiChat.error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{aiChat.error}</Text>
          </View>
        )}

        {/* Message Input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={aiChat.isLoading}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flexContainer: {
    flex: 1,
  },
  statusBar: {
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statusContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A202C',
  },
  modeIndicator: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0066FF',
  },
  usageIndicator: {
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  usageText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0066FF',
  },
  syncStatusRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncingText: {
    fontSize: 11,
    color: '#0066FF',
    fontWeight: '500',
  },
  offlineWarning: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
  },
  errorWarning: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
  },
  queueWarning: {
    fontSize: 11,
    color: '#8B5CF6',
    fontWeight: '600',
    marginLeft: 8,
  },
  limitWarning: {
    fontSize: 11,
    color: '#F59E0B',
    marginTop: 8,
    fontWeight: '600',
  },
  downloadPrompt: {
    backgroundColor: '#F0F7FF',
    borderBottomWidth: 2,
    borderBottomColor: '#0066FF',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  downloadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A202C',
    marginBottom: 8,
  },
  downloadDescription: {
    fontSize: 13,
    color: '#8E92A9',
    marginBottom: 16,
    lineHeight: 18,
  },
  downloadButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  downloadButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E92A9',
  },
  downloadButtonPrimary: {
    backgroundColor: '#0066FF',
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  downloadProgress: {
    fontSize: 11,
    color: '#fff',
    marginTop: 4,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A202C',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E92A9',
    textAlign: 'center',
  },
  typingContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  typingText: {
    fontSize: 12,
    color: '#8E92A9',
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#FFCDD2',
  },
  errorText: {
    fontSize: 13,
    color: '#C62828',
    textAlign: 'center',
  },
});

export default ChatScreen;
