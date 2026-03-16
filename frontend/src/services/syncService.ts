import { database } from '../db/database';
import { api } from '../api/client';

export interface ConversationBackup {
  id: string;
  conversationId: string;
  messages: Array<{
    id: string;
    role: 'user' | 'ai';
    content: string;
    timestamp: number;
  }>;
  title: string;
  lastMessageAt: number;
  messageCount: number;
  size: number; // bytes
  hash: string; // SHA256 for conflict detection
  version: number;
  deviceId: string;
  createdAt: number;
  updatedAt: number;
}

class SyncService {
  private readonly SYNC_INTERVAL = 60000; // 60 seconds
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;
  private lastSyncTime: number = 0;

  /**
   * Initialize sync service
   */
  async initialize(): Promise<void> {
    try {
      this.startAutoSync();
    } catch (error) {
      console.error('Error initializing sync service:', error);
    }
  }

  /**
   * Backup a conversation to cloud
   */
  async backupConversation(conversationId: string): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync in progress, skipping backup');
      return;
    }

    try {
      this.isSyncing = true;

      // Get conversation from local database
      const conversation = await this.getConversationData(conversationId);
      if (!conversation) {
        console.warn(`Conversation ${conversationId} not found`);
        return;
      }

      // Create backup object
      const backup: ConversationBackup = {
        id: `backup-${Date.now()}`,
        conversationId,
        messages: conversation.messages,
        title: conversation.title,
        lastMessageAt: conversation.lastMessageAt,
        messageCount: conversation.messages.length,
        size: JSON.stringify(conversation).length,
        hash: this.calculateHash(JSON.stringify(conversation)),
        version: 1,
        deviceId: 'device-1', // Would get from device service
        createdAt: conversation.createdAt,
        updatedAt: Date.now(),
      };

      // Send to backend for backup
      await this.uploadBackup(backup);

      this.lastSyncTime = Date.now();
    } catch (error) {
      console.error('Error backing up conversation:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Backup all conversations
   */
  async backupAllConversations(): Promise<void> {
    try {
      this.isSyncing = true;

      // Get all conversations
      const db = await database.getDatabase();
      if (!db) return;

      const conversations = await db.getAllAsync(
        'SELECT DISTINCT conversation_id FROM messages'
      );

      for (const conv of conversations as any[]) {
        await this.backupConversation(conv.conversation_id);
      }

      this.lastSyncTime = Date.now();
    } catch (error) {
      console.error('Error backing up all conversations:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Download conversations from other devices
   */
  async downloadSyncedConversations(): Promise<ConversationBackup[]> {
    try {
      this.isSyncing = true;

      // Request synced conversations from backend
      const response = await api.getSyncedConversations();

      if (!response.conversations) {
        return [];
      }

      const conversations: ConversationBackup[] = response.conversations;

      // Merge with local conversations
      for (const backup of conversations) {
        await this.mergeConversation(backup);
      }

      this.lastSyncTime = Date.now();
      return conversations;
    } catch (error) {
      console.error('Error downloading synced conversations:', error);
      return [];
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Upload backup to server
   */
  private async uploadBackup(backup: ConversationBackup): Promise<void> {
    try {
      await api.uploadConversationBackup({
        conversation_id: backup.conversationId,
        messages: backup.messages,
        title: backup.title,
        hash: backup.hash,
        size: backup.size,
        version: backup.version,
      });
    } catch (error) {
      console.error('Error uploading backup:', error);
      throw error;
    }
  }

  /**
   * Merge downloaded conversation with local
   */
  private async mergeConversation(backup: ConversationBackup): Promise<void> {
    try {
      const db = await database.getDatabase();
      if (!db) return;

      // Get local version
      const localMessages = await db.getAllAsync(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at',
        [backup.conversationId]
      );

      if (localMessages.length === 0) {
        // No local version, insert all remote messages
        for (const msg of backup.messages) {
          await db.runAsync(
            `INSERT OR IGNORE INTO messages 
             (id, conversation_id, sender_type, content, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
              msg.id,
              backup.conversationId,
              msg.role === 'user' ? 'user' : 'ai',
              msg.content,
              msg.timestamp,
            ]
          );
        }
      } else {
        // Merge: add missing remote messages
        const localIds = new Set((localMessages as any[]).map(m => m.id));

        for (const msg of backup.messages) {
          if (!localIds.has(msg.id)) {
            await db.runAsync(
              `INSERT OR IGNORE INTO messages 
               (id, conversation_id, sender_type, content, created_at)
               VALUES (?, ?, ?, ?, ?)`,
              [
                msg.id,
                backup.conversationId,
                msg.role === 'user' ? 'user' : 'ai',
                msg.content,
                msg.timestamp,
              ]
            );
          }
        }
      }
    } catch (error) {
      console.error('Error merging conversation:', error);
    }
  }

  /**
   * Get conversation data
   */
  private async getConversationData(conversationId: string): Promise<any> {
    try {
      const db = await database.getDatabase();
      if (!db) return null;

      const messages = await db.getAllAsync(
        'SELECT id, sender_type, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at',
        [conversationId]
      );

      if (messages.length === 0) return null;

      return {
        conversationId,
        messages: (messages as any[]).map(m => ({
          id: m.id,
          role: m.sender_type === 'user' ? 'user' : 'ai',
          content: m.content,
          timestamp: new Date(m.created_at).getTime(),
        })),
        title: `Conversation ${conversationId.substring(0, 8)}`,
        lastMessageAt: new Date((messages as any[])[messages.length - 1].created_at).getTime(),
        createdAt: new Date((messages as any[])[0].created_at).getTime(),
      };
    } catch (error) {
      console.error('Error getting conversation data:', error);
      return null;
    }
  }

  /**
   * Start automatic sync
   */
  private startAutoSync(): void {
    this.syncTimer = setInterval(() => {
      if (!this.isSyncing) {
        this.backupAllConversations().catch(console.error);
      }
    }, this.SYNC_INTERVAL);
  }

  /**
   * Force sync
   */
  async forceSync(): Promise<void> {
    await this.backupAllConversations();
    await this.downloadSyncedConversations();
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    isSyncing: boolean;
    lastSyncTime: number;
    timeSinceLastSync: number;
  } {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      timeSinceLastSync: Date.now() - this.lastSyncTime,
    };
  }

  /**
   * Calculate SHA256 hash (simplified)
   */
  private calculateHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Stop sync service
   */
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
}

export const syncService = new SyncService();
export default syncService;
