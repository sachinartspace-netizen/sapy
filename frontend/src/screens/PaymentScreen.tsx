import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { licenseService, SUBSCRIPTION_TIERS } from '../services/licenseService';
import { razorpayService } from '../services/razorpayService';
import { stripeService } from '../services/stripeService';
import { api } from '../api/client';
import { getAuth } from '../utils/auth';

type PaymentScreenProps = {
  navigation: StackNavigationProp<any>;
};

export const PaymentScreen: React.FC<PaymentScreenProps> = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute<any>();
  
  const selectedTier = route.params?.tier || 'BASIC';
  const tierDetails = SUBSCRIPTION_TIERS[selectedTier];

  const [loading, setLoading] = useState(false);
  const [isIndian, setIsIndian] = useState(true); // Currency toggle
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'stripe'>('razorpay');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');

  useEffect(() => {
    // Detect user location for payment gateway
    detectUserLocation();
    // Get user info
    loadUserInfo();
  }, []);

  const detectUserLocation = async () => {
    try {
      // In production, use real geolocation
      // For now, use IP-based detection or user preference
      setIsIndian(true); // Default to Indian pricing
      setPaymentMethod('razorpay');
    } catch (error) {
      console.error('Error detecting location:', error);
    }
  };

  const loadUserInfo = async () => {
    try {
      const auth = await getAuth();
      if (auth) {
        setUserEmail(auth.email || '');
        setUserName(auth.name || 'User');
        setUserPhone(auth.phone || '');
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const handleRazorpayPayment = async () => {
    if (!termsAccepted) {
      Alert.alert('Please Accept Terms', 'You must accept the terms to proceed');
      return;
    }

    setLoading(true);
    try {
      const amount = tierDetails.priceINR * 100; // Razorpay uses paise (100 paise = 1 rupee)

      // Create order on backend
      const orderResponse = await api.createPaymentOrder({
        tier: selectedTier,
        amount,
        currency: 'INR',
        payment_method: 'razorpay',
      });

      if (!orderResponse.order_id) {
        throw new Error('Failed to create payment order');
      }

      // Initialize Razorpay if not already done
      if (!razorpayService.isInitialized()) {
        // Get Razorpay key from backend
        const keyResponse = await api.getRazorpayKey();
        await razorpayService.initialize(keyResponse.key_id);
      }

      // Process payment with Razorpay
      const paymentResult = await razorpayService.processPayment({
        amount,
        currency: 'INR',
        orderId: orderResponse.order_id,
        tier: selectedTier,
        userEmail,
        userName,
        userPhone,
        description: `Sapy ${selectedTier} Plan - ₹${tierDetails.priceINR}/month`,
      });

      if (paymentResult.success) {
        await handlePaymentSuccess(orderResponse.order_id);
      } else {
        await handlePaymentFailure(paymentResult.error || 'Payment failed');
      }
    } catch (error: any) {
      console.error('Error initiating Razorpay payment:', error);
      Alert.alert('Payment Error', error.message || 'Failed to process payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStripePayment = async () => {
    if (!termsAccepted) {
      Alert.alert('Please Accept Terms', 'You must accept the terms to proceed');
      return;
    }

    setLoading(true);
    try {
      const amount = Math.round(tierDetails.priceUSD * 100); // Stripe uses cents

      // Create order on backend
      const orderResponse = await api.createPaymentOrder({
        tier: selectedTier,
        amount,
        currency: 'USD',
        payment_method: 'stripe',
      });

      if (!orderResponse.order_id) {
        throw new Error('Failed to create payment order');
      }

      // Initialize Stripe if not already done
      if (!stripeService.isInitialized()) {
        // Get Stripe key from backend
        const keyResponse = await api.getStripeKey();
        await stripeService.initialize(keyResponse.publishable_key, keyResponse.secret_key);
      }

      // Process payment with Stripe
      const paymentResult = await stripeService.processPayment({
        amount,
        currency: 'USD',
        orderId: orderResponse.order_id,
        tier: selectedTier,
        userEmail,
        userName,
        description: `Sapy ${selectedTier} Plan - $${tierDetails.priceUSD}/month`,
        clientSecret: orderResponse.client_secret,
      });

      if (paymentResult.success) {
        await handlePaymentSuccess(orderResponse.order_id);
      } else {
        await handlePaymentFailure(paymentResult.error || 'Payment failed');
      }
    } catch (error: any) {
      console.error('Error initiating Stripe payment:', error);
      Alert.alert('Payment Error', error.message || 'Failed to process payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (orderId: string) => {
    try {
      // Verify payment on backend
      const verifyResponse = await api.verifyPayment({
        order_id: orderId,
        tier: selectedTier,
      });

      if (verifyResponse.success) {
        Alert.alert(
          'Payment Successful!',
          `Welcome to ${selectedTier} plan! 🎉\n\nYour subscription is now active.`,
          [
            {
              text: 'Done',
              onPress: () => {
                navigation.navigate('Chat');
              },
            },
          ]
        );
      } else {
        handlePaymentFailure(verifyResponse.message);
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      handlePaymentFailure('Payment verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentFailure = (reason: string) => {
    Alert.alert(
      'Payment Failed',
      `Your payment could not be processed.\n\nReason: ${reason}`,
      [
        {
          text: 'Try Again',
          onPress: () => setLoading(false),
        },
        {
          text: 'Cancel',
          onPress: () => {
            setLoading(false);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const price = isIndian ? tierDetails.priceINR : tierDetails.priceUSD;
  const currency = isIndian ? '₹' : '$';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Complete Payment</Text>
        </View>

        {/* Order Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>ORDER SUMMARY</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryItemName}>
              {selectedTier} Plan ({tierDetails.messagesPerDay === 999999 ? '∞' : tierDetails.messagesPerDay} messages/day)
            </Text>
            <Text style={styles.summaryItemPrice}>
              {currency}{price.toFixed(2)}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryBillingPeriod}>Monthly Billing</Text>
            <Text style={styles.summaryItemPrice}>{currency}{price.toFixed(2)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotal}>Total</Text>
            <Text style={styles.summaryTotalPrice}>
              {currency}{price.toFixed(2)}/month
            </Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoBoxIcon}>ℹ️</Text>
            <Text style={styles.infoBoxText}>
              Your subscription will renew automatically every month
            </Text>
          </View>
        </View>

        {/* Currency/Country Toggle */}
        <View style={styles.currencyCard}>
          <Text style={styles.currencyLabel}>Payment Region</Text>
          <View style={styles.currencyOptions}>
            <TouchableOpacity
              style={[styles.currencyButton, isIndian && styles.currencyButtonActive]}
              onPress={() => {
                setIsIndian(true);
                setPaymentMethod('razorpay');
              }}
            >
              <Text
                style={[
                  styles.currencyButtonText,
                  isIndian && styles.currencyButtonTextActive,
                ]}
              >
                🇮🇳 India (Razorpay)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.currencyButton, !isIndian && styles.currencyButtonActive]}
              onPress={() => {
                setIsIndian(false);
                setPaymentMethod('stripe');
              }}
            >
              <Text
                style={[
                  styles.currencyButtonText,
                  !isIndian && styles.currencyButtonTextActive,
                ]}
              >
                🌍 International (Stripe)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.paymentCard}>
          <Text style={styles.paymentTitle}>Secure Payment</Text>

          {paymentMethod === 'razorpay' ? (
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentMethod}>💳 Razorpay Payment</Text>
              <Text style={styles.paymentDesc}>
                Supports: UPI, Credit/Debit Cards, Net Banking, Wallets
              </Text>
              <View style={styles.paymentFeatures}>
                <Text style={styles.feature}>✓ 100% Secure (SSL Encrypted)</Text>
                <Text style={styles.feature}>✓ Multiple Payment Options</Text>
                <Text style={styles.feature}>✓ Instant Confirmation</Text>
                <Text style={styles.feature}>✓ 24/7 Customer Support</Text>
              </View>
            </View>
          ) : (
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentMethod}>💳 Stripe Payment</Text>
              <Text style={styles.paymentDesc}>
                Supports: Credit/Debit Cards, Apple Pay, Google Pay
              </Text>
              <View style={styles.paymentFeatures}>
                <Text style={styles.feature}>✓ Bank-Level Security</Text>
                <Text style={styles.feature}>✓ Trusted by Millions</Text>
                <Text style={styles.feature}>✓ Instant Confirmation</Text>
                <Text style={styles.feature}>✓ Multi-Currency Support</Text>
              </View>
            </View>
          )}
        </View>

        {/* Terms & Conditions */}
        <View style={styles.termsCard}>
          <View style={styles.termsCheckbox}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setTermsAccepted(!termsAccepted)}
            >
              {termsAccepted && <Text style={styles.checkmarkText}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.termsText}>
              I agree to the Terms of Service and cancellation policy
            </Text>
          </View>
        </View>

        {/* Benefits Section */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>What You Get</Text>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>✓</Text>
            <Text style={styles.benefitText}>
              {tierDetails.messagesPerDay === 999999
                ? 'Unlimited'
                : tierDetails.messagesPerDay}{' '}
              messages per day
            </Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>✓</Text>
            <Text style={styles.benefitText}>Offline AI access</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>✓</Text>
            <Text style={styles.benefitText}>Priority support</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>✓</Text>
            <Text style={styles.benefitText}>All premium features</Text>
          </View>
          {selectedTier === 'PREMIUM' && (
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>✓</Text>
              <Text style={styles.benefitText}>Early access to new features</Text>
            </View>
          )}
        </View>

        {/* Refund Policy */}
        <View style={styles.refundCard}>
          <Text style={styles.refundIcon}>🔄</Text>
          <Text style={styles.refundTitle}>Money-Back Guarantee</Text>
          <Text style={styles.refundDesc}>
            Not satisfied? Get a full refund within 7 days of purchase, no questions asked.
          </Text>
        </View>

        {/* Payment Button */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.payButton, !termsAccepted && styles.payButtonDisabled, loading && styles.payButtonLoading]}
            onPress={paymentMethod === 'razorpay' ? handleRazorpayPayment : handleStripePayment}
            disabled={!termsAccepted || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.payButtonText}>
                  Pay {currency}{price.toFixed(2)}/month
                </Text>
                <Text style={styles.payButtonSubtext}>Secure checkout</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Security Info */}
        <View style={styles.securityInfo}>
          <Text style={styles.securityIcon}>🔒</Text>
          <Text style={styles.securityText}>
            Your payment information is encrypted and secure. We never store your card details.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    fontSize: 14,
    color: '#0066FF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A202C',
    marginLeft: 16,
    flex: 1,
  },
  summaryCard: {
    marginHorizontal: 20,
    marginVertical: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#718096',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryItemName: {
    fontSize: 13,
    color: '#2D3748',
    fontWeight: '500',
    flex: 1,
  },
  summaryItemPrice: {
    fontSize: 13,
    color: '#2D3748',
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  summaryBillingPeriod: {
    fontSize: 13,
    color: '#718096',
  },
  summaryTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A202C',
  },
  summaryTotalPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0066FF',
  },
  infoBox: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoBoxIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  infoBoxText: {
    fontSize: 12,
    color: '#1E40AF',
    flex: 1,
    lineHeight: 16,
  },
  currencyCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  currencyLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#718096',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  currencyOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  currencyButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  currencyButtonActive: {
    borderColor: '#0066FF',
    backgroundColor: '#EFF6FF',
  },
  currencyButtonText: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '600',
  },
  currencyButtonTextActive: {
    color: '#0066FF',
  },
  paymentCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 12,
  },
  paymentInfo: {
    gap: 8,
  },
  paymentMethod: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A202C',
  },
  paymentDesc: {
    fontSize: 12,
    color: '#718096',
  },
  paymentFeatures: {
    marginTop: 8,
  },
  feature: {
    fontSize: 12,
    color: '#2D3748',
    marginBottom: 4,
  },
  termsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  termsCheckbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
    backgroundColor: '#FFFFFF',
  },
  checkmarkText: {
    color: '#0066FF',
    fontSize: 14,
    fontWeight: '700',
  },
  termsText: {
    fontSize: 12,
    color: '#2D3748',
    flex: 1,
    lineHeight: 16,
  },
  benefitsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  benefitIcon: {
    fontSize: 16,
    color: '#4CAF50',
    marginRight: 8,
    marginTop: 2,
  },
  benefitText: {
    fontSize: 12,
    color: '#2D3748',
    flex: 1,
    lineHeight: 16,
  },
  refundCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    alignItems: 'center',
  },
  refundIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  refundTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 6,
  },
  refundDesc: {
    fontSize: 12,
    color: '#78350F',
    textAlign: 'center',
    lineHeight: 16,
  },
  actionSection: {
    marginHorizontal: 20,
    marginVertical: 16,
  },
  payButton: {
    backgroundColor: '#0066FF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payButtonLoading: {
    justifyContent: 'center',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  payButtonSubtext: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  cancelButton: {
    backgroundColor: '#F5F7FA',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#718096',
  },
  securityInfo: {
    marginHorizontal: 20,
    marginBottom: 24,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  securityText: {
    fontSize: 11,
    color: '#1B5E20',
    flex: 1,
    lineHeight: 14,
  },
});

export default PaymentScreen;
