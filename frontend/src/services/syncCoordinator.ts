import { offlineQueueService } from './offlineQueueService';
import { syncService } from './syncService';
import { cloudManager } from './cloudManager';
import NetInfo from '@react-native-community/netinfo';

export interface SyncCoordinatorStatus {
  isOnline: boolean;
  isSyncing: boolean;
  queuedMessages: number;
  lastSyncTime: number;
  syncErrors: number;
  status: 'idle' | 'syncing' | 'offline' | 'error';
}

class SyncCoordinator {
  private isOnline: boolean = true;
  private networkUnsubscribe: (() => void) | null = null;
  private syncInProgress: boolean = false;

  /**
   * Initialize sync coordinator
   */
  async initialize(): Promise<void> {
    try {
      // Initialize all services
      await offlineQueueService.initialize();
      await syncService.initialize();
      await cloudManager.initialize({
        autoSyncEnabled: true,
        syncInterval: 60000, // 1 minute
      });

      // Set up network listener
      this.setupNetworkListener();
    } catch (error) {
      console.error('Error initializing sync coordinator:', error);
    }
  }

  /**
   * Setup network status listener
   */
  private setupNetworkListener(): void {
    this.networkUnsubscribe = NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      console.log(`Network status: ${this.isOnline ? 'Online' : 'Offline'}`);

      // Update services
      offlineQueueService.setOnlineStatus(this.isOnline);

      // When coming back online, trigger sync
      if (!wasOnline && this.isOnline) {
        this.onNetworkRestored();
      }
    });
  }

  /**
   * Called when network is restored
   */
  private async onNetworkRestored(): Promise<void> {
    try {
      console.log('Network restored, starting sync...');

      // Retry any pending queued messages
      const pending = await offlineQueueService.getPendingMessages();
      if (pending.length > 0) {
        console.log(`Retrying ${pending.length} pending messages...`);
      }

      // Sync conversations
      await syncService.forceSync();

      console.log('Sync completed after network restoration');
    } catch (error) {
      console.error('Error during network restore sync:', error);
    }
  }

  /**
   * Handle sending a message (with offline queue support)
   */
  async handleMessageSend(
    conversationId: string,
    content: string,
    onSend: () => Promise<void>
  ): Promise<void> {
    try {
      // Try to send immediately if online
      if (this.isOnline) {
        try {
          await onSend();
          return;
        } catch (error) {
          console.warn('Send failed, queuing message:', error);
          // Fall through to queue
        }
      }

      // Queue the message for later
      const messageId = await offlineQueueService.queueMessage({
        conversationId,
        content,
        role: 'user',
        timestamp: Date.now(),
        maxRetries: 3,
      });

      console.log(`Message ${messageId} queued for later delivery`);
    } catch (error) {
      console.error('Error handling message send:', error);
      throw error;
    }
  }

  /**
   * Retry sending a queued message
   */
  async retrySendQueuedMessage(messageId: string, onSend: () => Promise<void>): Promise<boolean> {
    try {
      if (!this.isOnline) {
        console.log('Still offline, cannot retry');
        return false;
      }

      // Get the queued message
      const pending = await offlineQueueService.getPendingMessages();
      const message = pending.find(m => m.id === messageId);

      if (!message) {
        console.warn(`Message ${messageId} not found in queue`);
        return false;
      }

      // Try to send
      try {
        await onSend();
        await offlineQueueService.markAsSent(messageId);
        console.log(`Message ${messageId} sent successfully`);
        return true;
      } catch (error: any) {
        // Increment retry count
        const retryCount = message.retryCount + 1;
        await offlineQueueService.markAsFailed(
          messageId,
          error.message || 'Unknown error',
          retryCount
        );

        if (retryCount >= message.maxRetries) {
          console.error(
            `Message ${messageId} failed after ${retryCount} retries`
          );
          return false;
        }

        return false;
      }
    } catch (error) {
      console.error('Error retrying queued message:', error);
      return false;
    }
  }

  /**
   * Force sync all conversations
   */
  async forceSync(): Promise<void> {
    if (this.syncInProgress) {
      console.log('Sync already in progress');
      return;
    }

    try {
      this.syncInProgress = true;

      if (!this.isOnline) {
        console.log('Cannot sync, offline');
        return;
      }

      // Backup all conversations
      await syncService.backupAllConversations();

      // Download synced conversations
      await syncService.downloadSyncedConversations();

      console.log('Sync completed');
    } catch (error) {
      console.error('Error during force sync:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get coordinator status
   */
  async getStatus(): Promise<SyncCoordinatorStatus> {
    try {
      const queueStats = await offlineQueueService.getQueueStats();
      const cloudStatus = cloudManager.getSyncStatus();

      let status: 'idle' | 'syncing' | 'offline' | 'error' = 'idle';

      if (!this.isOnline) {
        status = 'offline';
      } else if (cloudStatus.isSyncing) {
        status = 'syncing';
      } else if (cloudStatus.syncErrors > 0) {
        status = 'error';
      }

      return {
        isOnline: this.isOnline,
        isSyncing: cloudStatus.isSyncing || this.syncInProgress,
        queuedMessages: queueStats.pending,
        lastSyncTime: cloudStatus.lastSyncTime,
        syncErrors: cloudStatus.syncErrors,
        status,
      };
    } catch (error) {
      console.error('Error getting coordinator status:', error);
      return {
        isOnline: this.isOnline,
        isSyncing: false,
        queuedMessages: 0,
        lastSyncTime: 0,
        syncErrors: 0,
        status: 'error',
      };
    }
  }

  /**
   * Clear old messages from queue
   */
  async cleanup(): Promise<void> {
    try {
      // Remove old failed messages (older than 7 days)
      await offlineQueueService.cleanupOldMessages(7);

      // Clear sent messages
      await offlineQueueService.clearSentMessages();

      console.log('Cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Check if online
   */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Destroy coordinator
   */
  destroy(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }

    offlineQueueService.destroy();
    syncService.destroy();
    cloudManager.destroy();
  }
}

export const syncCoordinator = new SyncCoordinator();
export default syncCoordinator;
