import { StripeSDK } from '@stripe/stripe-react-native';
import { api } from '../api/client';

export interface StripePaymentOptions {
  amount: number; // in cents (100 cents = 1 dollar)
  currency: string; // "USD"
  orderId: string;
  tier: string;
  userEmail: string;
  userName: string;
  description: string;
  clientSecret?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  clientSecret?: string;
  error?: string;
  errorCode?: string;
}

class StripeService {
  private stripePublishableKey: string = '';
  private stripeSecretKey: string = '';
  private isInitialized: boolean = false;
  private paymentInProgress: boolean = false;

  /**
   * Initialize Stripe service with API keys
   */
  async initialize(publishableKey: string, secretKey: string): Promise<void> {
    try {
      this.stripePublishableKey = publishableKey;
      this.stripeSecretKey = secretKey;
      this.isInitialized = true;
      console.log('Stripe service initialized');
    } catch (error) {
      console.error('Error initializing Stripe:', error);
      throw error;
    }
  }

  /**
   * Process payment with Stripe
   */
  async processPayment(options: StripePaymentOptions): Promise<PaymentResult> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Stripe service not initialized',
        errorCode: 'STRIPE_NOT_INITIALIZED',
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
      // Create payment intent on backend
      let clientSecret = options.clientSecret;

      if (!clientSecret) {
        const createResponse = await api.createStripePaymentIntent({
          amount: options.amount,
          currency: options.currency,
          tier: options.tier,
          order_id: options.orderId,
        });

        if (!createResponse.client_secret) {
          return {
            success: false,
            error: 'Failed to create payment intent',
            errorCode: 'INTENT_CREATE_FAILED',
          };
        }

        clientSecret = createResponse.client_secret;
      }

      // In production, would use actual Stripe SDK
      // For now, simulate payment
      const simulatedPaymentId = `pm_${Date.now()}`;

      return new Promise((resolve) => {
        // Simulate payment processing
        setTimeout(async () => {
          try {
            // Verify payment on backend
            const verifyResponse = await api.verifyStripePayment({
              payment_intent_id: simulatedPaymentId,
              client_secret: clientSecret,
              tier: options.tier,
            });

            if (!verifyResponse.success) {
              return resolve({
                success: false,
                error: 'Payment verification failed',
                errorCode: 'VERIFICATION_FAILED',
              });
            }

            // Store payment record
            await this.storePaymentRecord({
              paymentId: simulatedPaymentId,
              orderId: options.orderId,
              tier: options.tier,
              status: 'completed',
              amount: options.amount,
            });

            return resolve({
              success: true,
              paymentId: simulatedPaymentId,
              orderId: options.orderId,
              clientSecret,
            });
          } catch (error: any) {
            return resolve({
              success: false,
              error: error.message,
              errorCode: 'PAYMENT_ERROR',
            });
          }
        }, 1500); // Simulate 1.5s payment processing
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
      const response = await api.refundStripePayment({
        payment_id: paymentId,
        amount, // in cents
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
      const response = await api.getStripePaymentStatus(paymentId);
      return response;
    } catch (error) {
      console.error('Error getting payment status:', error);
      return null;
    }
  }

  /**
   * Check if Stripe is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await api.checkStripeAvailability();
      return response.available === true;
    } catch (error) {
      console.error('Error checking Stripe availability:', error);
      return false;
    }
  }

  /**
   * Get Stripe key (for frontend)
   */
  getPublishableKey(): string {
    return this.stripePublishableKey;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.isInitialized;
  }
}

export const stripeService = new StripeService();
export default stripeService;
