import { database } from '../db/database';
import { licenseService } from './licenseService';

export interface DailyUsage {
  date: string;
  messagesUsed: number;
  messagesLimit: number;
  remainingMessages: number;
  percentageUsed: number;
}

class MessageLimitService {
  /**
   * Check if user can send a message
   */
  async canSendMessage(): Promise<{
    canSend: boolean;
    remainingMessages: number;
    dailyLimit: number;
    reason?: string;
  }> {
    try {
      const usage = await this.getDailyUsage();

      const canSend = usage.remainingMessages > 0;
      const reason = !canSend
        ? `Daily limit of ${usage.messagesLimit} messages reached. Please upgrade or try again tomorrow.`
        : undefined;

      return {
        canSend,
        remainingMessages: usage.remainingMessages,
        dailyLimit: usage.messagesLimit,
        reason,
      };
    } catch (error) {
      console.error('Error checking message limit:', error);
      // Allow message if there's an error (graceful degradation)
      return {
        canSend: true,
        remainingMessages: 100,
        dailyLimit: 100,
      };
    }
  }

  /**
   * Record a message usage
   */
  async recordMessageUsage(): Promise<DailyUsage> {
    try {
      const today = this.getTodayDateString();
      const limit = licenseService.getMessagesPerDay();

      // Increment usage in database
      await database.recordMessageUsage(today, limit);

      // Get updated usage
      return this.getDailyUsage();
    } catch (error) {
      console.error('Error recording message usage:', error);
      throw error;
    }
  }

  /**
   * Get daily usage statistics
   */
  async getDailyUsage(): Promise<DailyUsage> {
    try {
      const today = this.getTodayDateString();
      const limit = licenseService.getMessagesPerDay();

      // Get usage from database
      const usage = await database.getTodayUsage();

      const messagesUsed = usage?.messages_used || 0;
      const remainingMessages = Math.max(0, limit - messagesUsed);
      const percentageUsed = Math.round((messagesUsed / limit) * 100);

      return {
        date: today,
        messagesUsed,
        messagesLimit: limit,
        remainingMessages,
        percentageUsed,
      };
    } catch (error) {
      console.error('Error getting daily usage:', error);
      // Return default usage on error
      const limit = licenseService.getMessagesPerDay();
      return {
        date: this.getTodayDateString(),
        messagesUsed: 0,
        messagesLimit: limit,
        remainingMessages: limit,
        percentageUsed: 0,
      };
    }
  }

  /**
   * Check if approaching limit (80% or more)
   */
  async isApproachingLimit(): Promise<boolean> {
    try {
      const usage = await this.getDailyUsage();
      return usage.percentageUsed >= 80;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get usage percentage
   */
  async getUsagePercentage(): Promise<number> {
    try {
      const usage = await this.getDailyUsage();
      return usage.percentageUsed;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get usage string for display (e.g., "45 / 155")
   */
  async getUsageString(): Promise<string> {
    try {
      const usage = await this.getDailyUsage();
      return `${usage.messagesUsed} / ${usage.messagesLimit}`;
    } catch (error) {
      return '0 / 55';
    }
  }

  /**
   * Reset daily usage (call at midnight or manually)
   */
  async resetDailyUsage(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayString = this.formatDate(yesterday);

      // Delete yesterday's usage from database
      // In production, would archive this data
      console.log(`Resetting usage for ${yesterdayString}`);
    } catch (error) {
      console.error('Error resetting daily usage:', error);
    }
  }

  /**
   * Get upgrade message for when limit is reached
   */
  getUpgradeMessage(): string {
    const currentTier = licenseService.getCurrentTier();

    const messages: { [key: string]: string } = {
      FREE:
        'You\'ve reached your daily limit (55 messages). Upgrade to BASIC for 155 messages/day or PREMIUM for unlimited messages!',
      BASIC:
        'You\'ve reached your daily limit (155 messages). Upgrade to STANDARD for 555 messages/day or PREMIUM for unlimited messages!',
      STANDARD:
        'You\'ve reached your daily limit (555 messages). Upgrade to PREMIUM for unlimited messages!',
      PREMIUM:
        'Something went wrong with your subscription. Please contact support.',
    };

    return messages[currentTier] || messages['FREE'];
  }

  /**
   * Helper: Get today's date string (YYYY-MM-DD)
   */
  private getTodayDateString(): string {
    return this.formatDate(new Date());
  }

  /**
   * Helper: Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Reset all usage data (admin function)
   */
  async resetAllUsage(): Promise<void> {
    try {
      // This would delete all usage records
      // Only call on user request or app reset
      console.log('Resetting all usage data');
    } catch (error) {
      console.error('Error resetting all usage:', error);
    }
  }
}

export const messageLimitService = new MessageLimitService();
export default messageLimitService;
