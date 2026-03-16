import RazorpayCheckout from 'react-native-razorpay';
import { api } from '../api/client';

export interface RazorpayPaymentOptions {
  amount: number; // in paise (100 paise = 1 rupee)
  currency: string; // "INR"
  orderId: string;
  tier: string;
  userEmail: string;
  userName: string;
  userPhone: string;
  description: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  signature?: string;
  error?: string;
  errorCode?: string;
}

class RazorpayService {
  private razorpayKeyId: string = '';
  private isInitialized: boolean = false;
  private paymentInProgress: boolean = false;

  /**
   * Initialize Razorpay service with API key
   */
  async initialize(razorpayKeyId: string): Promise<void> {
    try {
      this.razorpayKeyId = razorpayKeyId;
      this.isInitialized = true;
      console.log('Razorpay service initialized');
    } catch (error) {
      console.error('Error initializing Razorpay:', error);
      throw error;
    }
  }

  /**
   * Process payment with Razorpay
   */
  async processPayment(options: RazorpayPaymentOptions): Promise<PaymentResult> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Razorpay service not initialized',
        errorCode: 'RAZORPAY_NOT_INITIALIZED',
      };
    }

    if (this.paymentInProgress) {
      return {
        success: false,
        error: 'Payment already in progress',
        errorCode: 'PAYMENT_IN_PROGRESS',
      };
    }

    this.paymentInProgress = true;

    try {
      const paymentOptions = {
        description: options.description,
        image: 'https://example.com/logo.png', // Your app logo URL
        currency: options.currency,
        key: this.razorpayKeyId,
        amount: options.amount, // in paise
        order_id: options.orderId,
        name: 'Sapy',
        prefill: {
          email: options.userEmail,
          contact: options.userPhone,
          name: options.userName,
        },
        theme: {
          color: '#0066FF', // Sapy blue
        },
      };

      return new Promise((resolve) => {
        RazorpayCheckout.open(paymentOptions)
          .then((data) => {
            // Payment successful
            this.handlePaymentSuccess(data, options.tier, options.orderId)
              .then(result => resolve(result))
              .catch(error => {
                console.error('Error handling payment success:', error);
                resolve({
                  success: false,
                  error: error.message,
                  errorCode: 'HANDLE_SUCCESS_ERROR',
                });
              });
          })
          .catch((error) => {
            // Payment failed
            this.handlePaymentFailure(error, options.orderId)
              .then(result => resolve(result))
              .catch(err => {
                console.error('Error handling payment failure:', error);
                resolve({
                  success: false,
                  error: err.message,
                  errorCode: 'HANDLE_FAILURE_ERROR',
                });
              });
          });
      });
    } catch (error: any) {
      console.error('Error processing payment:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
        errorCode: 'PAYMENT_ERROR',
      };
    } finally {
      this.paymentInProgress = false;
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(
    data: any,
    tier: string,
    orderId: string
  ): Promise<PaymentResult> {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = data;

      console.log('Payment successful:', {
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
      });

      // Verify payment signature on backend
      const verifyResponse = await api.verifyRazorpayPayment({
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
        tier,
      });

      if (!verifyResponse.success) {
        return {
          success: false,
          error: 'Payment verification failed',
          errorCode: 'VERIFICATION_FAILED',
        };
      }

      // Store payment record
      await this.storePaymentRecord({
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        signature: razorpay_signature,
        tier,
        status: 'completed',
        amount: verifyResponse.amount,
      });

      return {
        success: true,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        signature: razorpay_signature,
      };
    } catch (error: any) {
      console.error('Error in handlePaymentSuccess:', error);
      throw error;
    }
  }

  /**
   * Handle payment failure
   */
  private async handlePaymentFailure(error: any, orderId: string): Promise<PaymentResult> {
    try {
      const errorCode = error.code || 'UNKNOWN';
      const errorMessage = error.message || 'Payment failed';

      console.log('Payment failed:', {
        code: errorCode,
        message: errorMessage,
      });

      // Store failed payment record
      await this.storePaymentRecord({
        orderId,
        status: 'failed',
        errorCode,
        errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        errorCode,
      };
    } catch (error: any) {
      console.error('Error in handlePaymentFailure:', error);
      throw error;
    }
  }

  /**
   * Store payment record in backend
   */
  private async storePaymentRecord(record: any): Promise<void> {
    try {
      await api.storePaymentRecord(record);
    } catch (error) {
      console.error('Error storing payment record:', error);
      // Don't throw - payment was successful, just couldn't store record
    }
  }

  /**
   * Refund a payment
   */
  async refundPayment(paymentId: string, amount: number): Promise<boolean> {
    try {
      const response = await api.refundRazorpayPayment({
        payment_id: paymentId,
        amount, // in paise
      });

      if (response.success) {
        // Store refund record
        await this.storePaymentRecord({
          paymentId,
          status: 'refunded',
          amount,
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error refunding payment:', error);
      return false;
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<any> {
    try {
      const response = await api.getRazorpayPaymentStatus(paymentId);
      return response;
    } catch (error) {
      console.error('Error getting payment status:', error);
      return null;
    }
  }

  /**
   * Check if Razorpay is available in the region
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await api.checkRazorpayAvailability();
      return response.available === true;
    } catch (error) {
      console.error('Error checking Razorpay availability:', error);
      return false;
    }
  }

  /**
   * Get Razorpay key ID (for frontend)
   */
  getKeyId(): string {
    return this.razorpayKeyId;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.isInitialized;
  }
}

export const razorpayService = new RazorpayService();
export default razorpayService;
