import * as SecureStore from 'expo-secure-store';
import { api } from '../api/client';
import { getAuth } from '../utils/auth';

export interface License {
  id: string;
  userId: string;
  tier: 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM';
  expiryDate: Date;
  deviceId: string;
  licenseKey: string;
  isValid: boolean;
  createdAt: Date;
  signature: string;
}

export interface SubscriptionTier {
  id: string;
  name: 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM';
  messagesPerDay: number;
  priceUSD: number;
  priceINR: number;
  features: string[];
}

const SUBSCRIPTION_TIERS: { [key: string]: SubscriptionTier } = {
  FREE: {
    id: 'free',
    name: 'FREE',
    messagesPerDay: 55,
    priceUSD: 0,
    priceINR: 0,
    features: [
      '55 messages/day',
      'Offline AI access',
      'Basic features',
    ],
  },
  BASIC: {
    id: 'basic',
    name: 'BASIC',
    messagesPerDay: 155,
    priceUSD: 2.99,
    priceINR: 249,
    features: [
      '155 messages/day',
      'Offline AI access',
      'Priority support',
      'All basic features',
    ],
  },
  STANDARD: {
    id: 'standard',
    name: 'STANDARD',
    messagesPerDay: 555,
    priceUSD: 4.99,
    priceINR: 449,
    features: [
      '555 messages/day',
      'Offline AI access',
      'Priority support',
      'Advanced analytics',
      'All features',
    ],
  },
  PREMIUM: {
    id: 'premium',
    name: 'PREMIUM',
    messagesPerDay: 999999, // Unlimited
    priceUSD: 19.99,
    priceINR: 1699,
    features: [
      'Unlimited messages/day',
      'Offline AI access',
      'Priority support',
      'Advanced analytics',
      'Custom features',
      'Early access to new features',
    ],
  },
};

class LicenseService {
  private currentLicense: License | null = null;
  private readonly STORAGE_KEY = 'sapy_license';
  private readonly DEVICE_ID_KEY = 'sapy_device_id';

  /**
   * Initialize license service
   * Download and validate license on first login
   */
  async initialize(): Promise<License | null> {
    try {
      // Check if license already cached
      const cached = await this.getCachedLicense();
      if (cached && this.isLicenseValid(cached)) {
        this.currentLicense = cached;
        return cached;
      }

      // Try to download new license from server
      const license = await this.downloadLicense();
      if (license) {
        this.currentLicense = license;
        return license;
      }

      // If no server license, create FREE tier license
      const freeLicense = this.createFreeLicense();
      this.currentLicense = freeLicense;
      return freeLicense;
    } catch (error) {
      console.error('Error initializing license:', error);
      // Return free license as fallback
      const freeLicense = this.createFreeLicense();
      this.currentLicense = freeLicense;
      return freeLicense;
    }
  }

  /**
   * Download license from server
   */
  private async downloadLicense(): Promise<License | null> {
    try {
      const response = await api.generateLicense({
        device_info: await this.getDeviceInfo(),
      });

      if (response.license) {
        const license = this.parseLicense(response.license);
        await this.cacheLicense(license);
        return license;
      }

      return null;
    } catch (error) {
      console.error('Error downloading license:', error);
      return null;
    }
  }

  /**
   * Get cached license from secure storage
   */
  private async getCachedLicense(): Promise<License | null> {
    try {
      const cached = await SecureStore.getItemAsync(this.STORAGE_KEY);
      if (!cached) return null;

      const license = JSON.parse(cached);
      license.expiryDate = new Date(license.expiryDate);
      license.createdAt = new Date(license.createdAt);

      return license;
    } catch (error) {
      console.error('Error retrieving cached license:', error);
      return null;
    }
  }

  /**
   * Cache license in secure storage
   */
  private async cacheLicense(license: License): Promise<void> {
    try {
      const data = JSON.stringify(license);
      await SecureStore.setItemAsync(this.STORAGE_KEY, data);
    } catch (error) {
      console.error('Error caching license:', error);
    }
  }

  /**
   * Parse license from server response
   */
  private parseLicense(licenseData: any): License {
    return {
      id: licenseData.id,
      userId: licenseData.user_id,
      tier: licenseData.tier || 'FREE',
      expiryDate: new Date(licenseData.expiry_date),
      deviceId: licenseData.device_id,
      licenseKey: licenseData.license_key,
      isValid: !this.isLicenseExpired(new Date(licenseData.expiry_date)),
      createdAt: new Date(licenseData.created_at),
      signature: licenseData.signature,
    };
  }

  /**
   * Create a free tier license for new users
   */
  private createFreeLicense(): License {
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1); // Valid for 1 year

    return {
      id: `free-${Date.now()}`,
      userId: '',
      tier: 'FREE',
      expiryDate,
      deviceId: '',
      licenseKey: 'SAPY-FREE-LICENSE',
      isValid: true,
      createdAt: new Date(),
      signature: '',
    };
  }

  /**
   * Check if license is expired
   */
  private isLicenseExpired(expiryDate: Date): boolean {
    return new Date() > expiryDate;
  }

  /**
   * Validate license
   */
  private isLicenseValid(license: License): boolean {
    if (!license) return false;
    if (this.isLicenseExpired(license.expiryDate)) return false;
    return license.isValid;
  }

  /**
   * Get device info for license binding
   */
  private async getDeviceInfo(): Promise<any> {
    try {
      const deviceId = await this.getDeviceId();
      // In production, get actual device info
      return {
        device_id: deviceId,
        device_type: 'mobile',
        os_version: '14.0', // Would be actual OS version
      };
    } catch (error) {
      console.error('Error getting device info:', error);
      return {};
    }
  }

  /**
   * Get or create device ID
   */
  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await SecureStore.getItemAsync(this.DEVICE_ID_KEY);

      if (!deviceId) {
        // Create new device ID
        deviceId = `sapy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await SecureStore.setItemAsync(this.DEVICE_ID_KEY, deviceId);
      }

      return deviceId;
    } catch (error) {
      console.error('Error managing device ID:', error);
      return `sapy-${Date.now()}`;
    }
  }

  /**
   * Get current license
   */
  getCurrentLicense(): License | null {
    return this.currentLicense;
  }

  /**
   * Get current tier
   */
  getCurrentTier(): 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM' {
    return this.currentLicense?.tier || 'FREE';
  }

  /**
   * Get messages per day for current tier
   */
  getMessagesPerDay(): number {
    const tier = this.getCurrentTier();
    return SUBSCRIPTION_TIERS[tier]?.messagesPerDay || 55;
  }

  /**
   * Check if user can send message
   */
  canSendMessage(messagesUsedToday: number): boolean {
    const limit = this.getMessagesPerDay();
    return messagesUsedToday < limit;
  }

  /**
   * Get remaining messages for today
   */
  getRemainingMessages(messagesUsedToday: number): number {
    const limit = this.getMessagesPerDay();
    return Math.max(0, limit - messagesUsedToday);
  }

  /**
   * Get subscription tier details
   */
  getTierDetails(tier: 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM'): SubscriptionTier {
    return SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS['FREE'];
  }

  /**
   * Get all subscription tiers
   */
  getAllTiers(): SubscriptionTier[] {
    return Object.values(SUBSCRIPTION_TIERS);
  }

  /**
   * Check if license is expiring soon (within 7 days)
   */
  isExpiringSoon(): boolean {
    if (!this.currentLicense) return false;

    const daysUntilExpiry = Math.floor(
      (this.currentLicense.expiryDate.getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    );

    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  }

  /**
   * Days until expiry
   */
  getDaysUntilExpiry(): number {
    if (!this.currentLicense) return 0;

    return Math.floor(
      (this.currentLicense.expiryDate.getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    );
  }

  /**
   * Clear license (on logout)
   */
  async clearLicense(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(this.STORAGE_KEY);
      this.currentLicense = null;
    } catch (error) {
      console.error('Error clearing license:', error);
    }
  }
}

export const licenseService = new LicenseService();
export { SUBSCRIPTION_TIERS };
export default licenseService;
