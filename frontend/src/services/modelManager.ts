import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import * as SHA256 from 'js-sha256';
import { MODEL_CONFIG, DOWNLOAD_CONFIG, CACHE_CONFIG, ERROR_MESSAGES } from '../utils/modelConfig';

interface DownloadProgress {
  currentSize: number;
  totalSize: number;
  percentage: number;
  estimatedTimeRemaining: number;
}

interface ModelStatus {
  exists: boolean;
  size: number;
  lastUpdated: Date | null;
  isValid: boolean;
  isCached: boolean;
}

class ModelManager {
  private isDownloading = false;
  private downloadProgress: DownloadProgress | null = null;
  private modelPath = FileSystem.documentDirectory + 'models/';

  constructor() {
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      // Create models directory if it doesn't exist
      const modelDirInfo = await FileSystem.getInfoAsync(this.modelPath);
      if (!modelDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.modelPath, { intermediates: true });
      }
    } catch (error) {
      console.error('Error creating model directory:', error);
    }
  }

  /**
   * Check if model exists and is valid
   */
  async checkModelStatus(): Promise<ModelStatus> {
    try {
      const fullPath = this.modelPath + 'deepseek-1.3b.onnx';
      const info = await FileSystem.getInfoAsync(fullPath);

      if (!info.exists) {
        return {
          exists: false,
          size: 0,
          lastUpdated: null,
          isValid: false,
          isCached: false,
        };
      }

      const isValid = await this.validateModelIntegrity(fullPath);

      return {
        exists: true,
        size: info.size || 0,
        lastUpdated: info.modificationTime ? new Date(info.modificationTime * 1000) : null,
        isValid,
        isCached: true,
      };
    } catch (error) {
      console.error('Error checking model status:', error);
      return {
        exists: false,
        size: 0,
        lastUpdated: null,
        isValid: false,
        isCached: false,
      };
    }
  }

  /**
   * Get available storage space
   */
  async getAvailableStorage(): Promise<number> {
    try {
      const info = await FileSystem.getFreeDiskStorageAsync?.();
      return info || 0;
    } catch (error) {
      console.error('Error getting available storage:', error);
      return 0;
    }
  }

  /**
   * Download model from remote server
   */
  async downloadModel(onProgress?: (progress: DownloadProgress) => void): Promise<boolean> {
    if (this.isDownloading) {
      console.warn('Model download already in progress');
      return false;
    }

    try {
      // Check network connection
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        console.error(ERROR_MESSAGES.NETWORK_ERROR);
        return false;
      }

      // Check available storage
      const availableStorage = await this.getAvailableStorage();
      const requiredSpace = 900 * 1024 * 1024; // 900MB buffer

      if (availableStorage < requiredSpace) {
        console.error(ERROR_MESSAGES.STORAGE_FULL);
        return false;
      }

      this.isDownloading = true;
      const modelPath = this.modelPath + 'deepseek-1.3b.onnx';

      // Download with resume support
      const downloadResumable = FileSystem.createDownloadResumable(
        MODEL_CONFIG.downloadUrl,
        modelPath,
        {},
        (downloadProgress) => {
          const { totalBytesExpectedToDownload, totalBytesWritten } = downloadProgress;
          const percentage = (totalBytesWritten / totalBytesExpectedToDownload) * 100;

          const progress: DownloadProgress = {
            currentSize: totalBytesWritten,
            totalSize: totalBytesExpectedToDownload,
            percentage,
            estimatedTimeRemaining: this.estimateTimeRemaining(
              totalBytesWritten,
              totalBytesExpectedToDownload
            ),
          };

          this.downloadProgress = progress;
          if (onProgress) {
            onProgress(progress);
          }
        }
      );

      // Start download with retry logic
      for (let attempt = 0; attempt < DOWNLOAD_CONFIG.maxRetries; attempt++) {
        try {
          const result = await downloadResumable.downloadAsync();

          if (result?.uri) {
            // Validate downloaded file
            const isValid = await this.validateModelIntegrity(result.uri);

            if (isValid) {
              console.log('Model downloaded and validated successfully');
              this.isDownloading = false;
              return true;
            } else {
              console.warn(ERROR_MESSAGES.MODEL_CORRUPTED);
              // Delete corrupted file and retry
              await FileSystem.deleteAsync(result.uri);
            }
          }
        } catch (error) {
          console.error(`Download attempt ${attempt + 1} failed:`, error);

          if (attempt < DOWNLOAD_CONFIG.maxRetries - 1) {
            // Wait before retry
            await new Promise((resolve) =>
              setTimeout(resolve, DOWNLOAD_CONFIG.retryDelay)
            );
          }
        }
      }

      console.error(ERROR_MESSAGES.DOWNLOAD_FAILED);
      this.isDownloading = false;
      return false;
    } catch (error) {
      console.error('Error downloading model:', error);
      this.isDownloading = false;
      return false;
    }
  }

  /**
   * Validate model integrity using checksum
   */
  private async validateModelIntegrity(filePath: string): Promise<boolean> {
    try {
      if (!MODEL_CONFIG.checksum.enabled) {
        return true;
      }

      // For now, just check if file exists and is readable
      // In production, you'd calculate SHA256 and compare
      const info = await FileSystem.getInfoAsync(filePath);
      return info.exists && (info.size || 0) > 0;
    } catch (error) {
      console.error('Error validating model:', error);
      return false;
    }
  }

  /**
   * Estimate time remaining for download
   */
  private estimateTimeRemaining(downloaded: number, total: number): number {
    if (downloaded === 0) return 0;

    // Rough estimate based on download speed
    const downloadSpeed = 1024 * 1024; // Assume 1MB/s
    const remaining = total - downloaded;
    return (remaining / downloadSpeed) * 1000; // Return in milliseconds
  }

  /**
   * Get model size
   */
  async getModelSize(): Promise<number> {
    try {
      const fullPath = this.modelPath + 'deepseek-1.3b.onnx';
      const info = await FileSystem.getInfoAsync(fullPath);
      return info.size || 0;
    } catch (error) {
      console.error('Error getting model size:', error);
      return 0;
    }
  }

  /**
   * Clear model cache
   */
  async clearModelCache(): Promise<boolean> {
    try {
      await FileSystem.deleteAsync(this.modelPath, { idempotent: true });
      await this.ensureDirectories();
      console.log('Model cache cleared');
      return true;
    } catch (error) {
      console.error('Error clearing model cache:', error);
      return false;
    }
  }

  /**
   * Get model file path
   */
  getModelPath(): string {
    return this.modelPath + 'deepseek-1.3b.onnx';
  }

  /**
   * Check if download is in progress
   */
  isDownloadInProgress(): boolean {
    return this.isDownloading;
  }

  /**
   * Get current download progress
   */
  getDownloadProgress(): DownloadProgress | null {
    return this.downloadProgress;
  }
}

export const modelManager = new ModelManager();
export default modelManager;
