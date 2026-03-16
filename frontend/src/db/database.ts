import SQLite from 'react-native-sqlite-storage';
import { Message } from '../types';

SQLite.enablePromise(true);

const DB_NAME = 'sapy.db';

class SapyDatabase {
  private db: SQLite.SQLiteDatabase | null = null;

  async initializeTables() {
    try {
      this.db = await SQLite.openDatabase({
        name: DB_NAME,
        location: 'default',
      });

      console.log('Database initialized');
      await this.createTables();
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  private async createTables() {
    if (!this.db) return;

    const tables = [
      // User session
      `CREATE TABLE IF NOT EXISTS user_session (
        user_id TEXT PRIMARY KEY,
        email TEXT,
        phone TEXT,
        name TEXT,
        jwt_token TEXT,
        refresh_token TEXT,
        subscription_tier TEXT DEFAULT 'FREE',
        device_id TEXT,
        license_key TEXT,
        last_synced_at DATETIME
      )`,

      // Conversations
      `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced BOOLEAN DEFAULT 0
      )`,

      // Messages
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        sender_type TEXT CHECK(sender_type IN ('user', 'ai')),
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced BOOLEAN DEFAULT 0,
        tokens_used INTEGER,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      )`,

      // Daily usage
      `CREATE TABLE IF NOT EXISTS daily_usage (
        date TEXT PRIMARY KEY,
        messages_used INTEGER DEFAULT 0,
        messages_limit INTEGER,
        synced BOOLEAN DEFAULT 0
      )`,

      // Sync queue
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        action TEXT,
        payload TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced_at DATETIME
      )`,

      // Local cache
      `CREATE TABLE IF NOT EXISTS message_cache (
        query_hash TEXT PRIMARY KEY,
        response TEXT,
        model TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ttl INTEGER
      )`,
    ];

    for (const sql of tables) {
      try {
        await this.db.executeSql(sql);
      } catch (error) {
        console.error('Error creating table:', error);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // User Session Methods
  // ════════════════════════════════════════════════════════════════════════════

  async saveUserSession(session: any) {
    return this.db?.executeSql(
      `INSERT OR REPLACE INTO user_session (
        user_id, email, phone, name, jwt_token, refresh_token, 
        subscription_tier, device_id, license_key, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.user_id,
        session.email,
        session.phone,
        session.name,
        session.jwt_token,
        session.refresh_token,
        session.subscription_tier || 'FREE',
        session.device_id,
        session.license_key,
        new Date().toISOString(),
      ]
    );
  }

  async getUserSession() {
    const result = await this.db?.executeSql('SELECT * FROM user_session LIMIT 1');
    return result?.[0]?.rows.length ? result[0].rows.raw()[0] : null;
  }

  async clearUserSession() {
    return this.db?.executeSql('DELETE FROM user_session');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Conversation Methods
  // ════════════════════════════════════════════════════════════════════════════

  async createConversation(id: string, title: string) {
    return this.db?.executeSql(
      'INSERT INTO conversations (id, title) VALUES (?, ?)',
      [id, title]
    );
  }

  async getAllConversations() {
    const result = await this.db?.executeSql(
      'SELECT * FROM conversations ORDER BY updated_at DESC'
    );
    return result?.[0]?.rows.raw() || [];
  }

  async getConversation(id: string) {
    const result = await this.db?.executeSql(
      'SELECT * FROM conversations WHERE id = ?',
      [id]
    );
    return result?.[0]?.rows.length ? result[0].rows.raw()[0] : null;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Message Methods
  // ════════════════════════════════════════════════════════════════════════════

  async addMessage(message: any): Promise<Message> {
    const id = message.id || Date.now().toString();
    await this.db?.executeSql(
      `INSERT INTO messages (id, conversation_id, sender_type, content, created_at, synced)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        message.conversation_id,
        message.sender_type,
        message.content,
        message.created_at?.toISOString() || new Date().toISOString(),
        0,
      ]
    );
    return {
      id,
      conversation_id: message.conversation_id,
      sender_type: message.sender_type,
      content: message.content,
      created_at: message.created_at || new Date(),
    };
  }

  async getMessages(conversationId?: string): Promise<Message[]> {
    let result;
    if (conversationId) {
      result = await this.db?.executeSql(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
        [conversationId]
      );
    } else {
      result = await this.db?.executeSql(
        'SELECT * FROM messages ORDER BY created_at ASC'
      );
    }

    if (!result?.[0]?.rows.length) return [];

    return result[0].rows.raw().map((row: any) => ({
      id: row.id,
      conversation_id: row.conversation_id,
      sender_type: row.sender_type,
      content: row.content,
      created_at: new Date(row.created_at),
    }));
  }

  async markMessageSynced(messageId: string) {
    return this.db?.executeSql(
      'UPDATE messages SET synced = 1 WHERE id = ?',
      [messageId]
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Usage Methods
  // ════════════════════════════════════════════════════════════════════════════

  async recordMessageUsage(date: string, limit: number) {
    return this.db?.executeSql(
      `INSERT OR REPLACE INTO daily_usage (date, messages_used, messages_limit, synced)
       VALUES (?, COALESCE((SELECT messages_used FROM daily_usage WHERE date = ?), 0) + 1, ?, 0)`,
      [date, date, limit]
    );
  }

  async getTodayUsage() {
    const today = new Date().toISOString().split('T')[0];
    const result = await this.db?.executeSql(
      'SELECT * FROM daily_usage WHERE date = ?',
      [today]
    );
    return result?.[0]?.rows.length ? result[0].rows.raw()[0] : null;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Sync Queue Methods
  // ════════════════════════════════════════════════════════════════════════════

  async addToSyncQueue(action: string, payload: any) {
    const id = `${action}-${Date.now()}`;
    return this.db?.executeSql(
      'INSERT INTO sync_queue (id, action, payload, status) VALUES (?, ?, ?, ?)',
      [id, action, JSON.stringify(payload), 'pending']
    );
  }

  async getPendingSyncItems() {
    const result = await this.db?.executeSql(
      "SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC"
    );
    return result?.[0]?.rows.raw() || [];
  }

  async markSyncItemSynced(id: string) {
    return this.db?.executeSql(
      "UPDATE sync_queue SET status = 'synced', synced_at = ? WHERE id = ?",
      [new Date().toISOString(), id]
    );
  }

  async closeDatabase() {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}

export const database = new SapyDatabase();
export default database;
