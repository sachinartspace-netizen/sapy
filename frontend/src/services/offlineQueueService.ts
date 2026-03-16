import { database } from '../db/database';
import { Message } from '../types';

export interface QueuedMessage {
  id: string;
  conversationId: string;
  content: string;
  role: 'user';
  timestamp: number;
  status: 'pending' | 'sent' | 'failed';
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  createdAt: number;
}

class OfflineQueueService {
  private isOnline: boolean = true;
  private retryInterval: NodeJS.Timeout | null = null;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 5000; // 5 seconds
  private readonly QUEUE_TABLE = 'message_queue';

  /**
   * Initialize queue service with network listener
   */
  async initialize(): Promise<void> {
    try {
      // Create queue table if it doesn't exist
      await this.createQueueTable();

      // Start retry listener
      this.startRetryListener();
    } catch (error) {
      console.error('Error initializing offline queue:', error);
    }
  }

  /**
   * Create message queue table
   */
  private async createQueueTable(): Promise<void> {
    try {
      const db = await database.getDatabase();
      if (db) {
        await db.execAsync(
          `CREATE TABLE IF NOT EXISTS ${this.QUEUE_TABLE} (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            content TEXT NOT NULL,
            role TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            retry_count INTEGER DEFAULT 0,
            max_retries INTEGER DEFAULT 3,
            last_error TEXT,
            created_at INTEGER NOT NULL
          );`
        );
      }
    } catch (error) {
      console.error('Error creating queue table:', error);
    }
  }

  /**
   * Add message to queue
   */
  async queueMessage(message: Omit<QueuedMessage, 'id' | 'status' | 'retryCount' | 'createdAt'>): Promise<string> {
    try {
      const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = Date.now();

      const queuedMessage: QueuedMessage = {
        id,
        conversationId: message.conversationId,
        content: message.content,
        role: message.role,
        timestamp: message.timestamp,
        status: 'pending',
        retryCount: 0,
        maxRetries: this.MAX_RETRIES,
        createdAt: now,
      };

      // Store in SQLite
      const db = await database.getDatabase();
      if (db) {
        await db.runAsync(
          `INSERT INTO ${this.QUEUE_TABLE} 
           (id, conversation_id, content, role, timestamp, status, retry_count, max_retries, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            queuedMessage.id,
            queuedMessage.conversationId,
            queuedMessage.content,
            queuedMessage.role,
            queuedMessage.timestamp,
            queuedMessage.status,
            queuedMessage.retryCount,
            queuedMessage.maxRetries,
            queuedMessage.createdAt,
          ]
        );
      }

      return id;
    } catch (error) {
      console.error('Error queueing message:', error);
      throw error;
    }
  }

  /**
   * Get all pending messages
   */
  async getPendingMessages(): Promise<QueuedMessage[]> {
    try {
      const db = await database.getDatabase();
      if (!db) return [];

      const result = await db.getAllAsync(
        `SELECT * FROM ${this.QUEUE_TABLE} WHERE status = 'pending' ORDER BY created_at ASC`
      );

      return (result as any[]).map(row => this.rowToQueuedMessage(row));
    } catch (error) {
      console.error('Error getting pending messages:', error);
      return [];
    }
  }

  /**
   * Mark message as sent
   */
  async markAsSent(messageId: string): Promise<void> {
    try {
      const db = await database.getDatabase();
      if (db) {
        await db.runAsync(
          `UPDATE ${this.QUEUE_TABLE} SET status = 'sent' WHERE id = ?`,
          [messageId]
        );
      }
    } catch (error) {
      console.error('Error marking message as sent:', error);
    }
  }

  /**
   * Mark message as failed
   */
  async markAsFailed(messageId: string, error: string, retryCount: number): Promise<void> {
    try {
      const db = await database.getDatabase();
      if (db) {
        const status = retryCount >= this.MAX_RETRIES ? 'failed' : 'pending';
        await db.runAsync(
          `UPDATE ${this.QUEUE_TABLE} SET status = ?, retry_count = ?, last_error = ? WHERE id = ?`,
          [status, retryCount, error, messageId]
        );
      }
    } catch (error) {
      console.error('Error marking message as failed:', error);
    }
  }

  /**
   * Remove message from queue
   */
  async removeFromQueue(messageId: string): Promise<void> {
    try {
      const db = await database.getDatabase();
      if (db) {
        await db.runAsync(
          `DELETE FROM ${this.QUEUE_TABLE} WHERE id = ?`,
          [messageId]
        );
      }
    } catch (error) {
      console.error('Error removing from queue:', error);
    }
  }

  /**
   * Clear all sent messages from queue
   */
  async clearSentMessages(): Promise<void> {
    try {
      const db = await database.getDatabase();
      if (db) {
        await db.runAsync(
          `DELETE FROM ${this.QUEUE_TABLE} WHERE status = 'sent'`
        );
      }
    } catch (error) {
      console.error('Error clearing sent messages:', error);
    }
  }

  /**
   * Set online status
   */
  setOnlineStatus(online: boolean): void {
    this.isOnline = online;
    if (online) {
      // Immediately try to send queued messages
      this.retryPendingMessages();
    }
  }

  /**
   * Start retry listener
   */
  private startRetryListener(): void {
    // Check for pending messages every 10 seconds
    this.retryInterval = setInterval(() => {
      if (this.isOnline) {
        this.retryPendingMessages();
      }
    }, 10000);
  }

  /**
   * Retry pending messages
   */
  private async retryPendingMessages(): Promise<void> {
    try {
      const pending = await this.getPendingMessages();

      if (pending.length === 0) return;

      // Emit retry event so ChatScreen can handle them
      console.log(`Retrying ${pending.length} pending messages...`);

      // Note: Actual retry logic is handled by ChatScreen
      // This just triggers the retry process
    } catch (error) {
      console.error('Error retrying messages:', error);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    failed: number;
    sent: number;
    total: number;
  }> {
    try {
      const db = await database.getDatabase();
      if (!db) {
        return { pending: 0, failed: 0, sent: 0, total: 0 };
      }

      const result = await db.getAllAsync(
        `SELECT status, COUNT(*) as count FROM ${this.QUEUE_TABLE} GROUP BY status`
      );

      const stats = {
        pending: 0,
        failed: 0,
        sent: 0,
        total: 0,
      };

      (result as any[]).forEach((row: any) => {
        stats.total += row.count;
        if (row.status === 'pending') stats.pending = row.count;
        if (row.status === 'failed') stats.failed = row.count;
        if (row.status === 'sent') stats.sent = row.count;
      });

      return stats;
    } catch (error) {
      console.error('Error getting queue stats:', error);
      return { pending: 0, failed: 0, sent: 0, total: 0 };
    }
  }

  /**
   * Clean up old failed messages (older than 7 days)
   */
  async cleanupOldMessages(daysOld: number = 7): Promise<void> {
    try {
      const db = await database.getDatabase();
      if (db) {
        const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
        await db.runAsync(
          `DELETE FROM ${this.QUEUE_TABLE} WHERE status = 'failed' AND created_at < ?`,
          [cutoffTime]
        );
      }
    } catch (error) {
      console.error('Error cleaning up old messages:', error);
    }
  }

  /**
   * Stop retry listener
   */
  destroy(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  /**
   * Helper: Convert database row to QueuedMessage
   */
  private rowToQueuedMessage(row: any): QueuedMessage {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      content: row.content,
      role: row.role,
      timestamp: row.timestamp,
      status: row.status,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      lastError: row.last_error,
      createdAt: row.created_at,
    };
  }
}

export const offlineQueueService = new OfflineQueueService();
export default offlineQueueService;
