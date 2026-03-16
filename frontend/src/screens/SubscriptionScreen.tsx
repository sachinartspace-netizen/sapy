import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { licenseService, SUBSCRIPTION_TIERS, SubscriptionTier } from '../services/licenseService';
import { messageLimitService } from '../services/messageLimitService';

type SubscriptionScreenProps = {
  navigation: StackNavigationProp<any>;
};

export const SubscriptionScreen: React.FC<SubscriptionScreenProps> = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const [currentTier, setCurrentTier] = useState<string>('FREE');
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usageInfo, setUsageInfo] = useState<any>(null);

  useEffect(() => {
    loadSubscriptionInfo();
  }, []);

  const loadSubscriptionInfo = async () => {
    try {
      const tier = licenseService.getCurrentTier();
      setCurrentTier(tier);

      const usage = await messageLimitService.getDailyUsage();
      setUsageInfo(usage);
    } catch (error) {
      console.error('Error loading subscription info:', error);
    }
  };

  const handleUpgradePress = (tier: string) => {
    if (tier === currentTier) {
      Alert.alert('Current Plan', `You're already on the ${tier} plan`);
      return;
    }

    setSelectedTier(tier);
    navigation.navigate('Payment', { tier });
  };

  const renderTierCard = (tier: SubscriptionTier) => {
    const isCurrentTier = tier.name === currentTier;
    const isSelected = tier.name === selectedTier;

    return (
      <TouchableOpacity
        key={tier.id}
        style={[
          styles.tierCard,
          isCurrentTier && styles.currentTierCard,
          isSelected && styles.selectedTierCard,
        ]}
        onPress={() => handleUpgradePress(tier.name)}
        disabled={isCurrentTier}
      >
        {isCurrentTier && (
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>CURRENT PLAN</Text>
          </View>
        )}

        {tier.name === 'PREMIUM' && !isCurrentTier && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>⭐ MOST POPULAR</Text>
          </View>
        )}

        <Text style={styles.tierName}>{tier.name}</Text>

        {/* Message limit */}
        <View style={styles.messageSection}>
          <Text style={styles.messageCount}>
            {tier.messagesPerDay === 999999
              ? '∞'
              : tier.messagesPerDay.toLocaleString()}
          </Text>
          <Text style={styles.messageLabel}>messages/day</Text>
        </View>

        {/* Price */}
        <View style={styles.priceSection}>
          {tier.priceUSD > 0 ? (
            <>
              <Text style={styles.priceUSD}>${tier.priceUSD.toFixed(2)}</Text>
              <Text style={styles.priceINR}>₹{tier.priceINR}</Text>
              <Text style={styles.pricePeriod}>/month</Text>
            </>
          ) : (
            <Text style={styles.priceLabel}>Always Free</Text>
          )}
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          {tier.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Text style={styles.featureIcon}>✓</Text>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* Button */}
        {!isCurrentTier && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              tier.name === 'PREMIUM' && styles.premiumButton,
            ]}
            onPress={() => handleUpgradePress(tier.name)}
          >
            <Text
              style={[
                styles.actionButtonText,
                tier.name === 'PREMIUM' && styles.premiumButtonText,
              ]}
            >
              {tier.priceUSD > 0 ? 'Upgrade Now' : 'Get Started'}
            </Text>
          </TouchableOpacity>
        )}

        {isCurrentTier && (
          <View style={styles.currentButton}>
            <Text style={styles.currentButtonText}>✓ Active</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Choose Your Plan</Text>
          <Text style={styles.headerSubtitle}>
            Unlock more features and chat without limits
          </Text>
        </View>

        {/* Current Usage */}
        {usageInfo && currentTier !== 'PREMIUM' && (
          <View style={styles.usageCard}>
            <Text style={styles.usageLabel}>Today's Usage</Text>
            <View style={styles.usageBar}>
              <View
                style={[
                  styles.usageProgress,
                  {
                    width: `${Math.min(usageInfo.percentageUsed, 100)}%`,
                    backgroundColor:
                      usageInfo.percentageUsed > 90
                        ? '#FF6B6B'
                        : usageInfo.percentageUsed > 70
                        ? '#FFA500'
                        : '#4CAF50',
                  },
                ]}
              />
            </View>
            <Text style={styles.usageText}>
              {usageInfo.messagesUsed} / {usageInfo.messagesLimit} messages used
            </Text>
            {usageInfo.percentageUsed > 70 && (
              <Text style={styles.warningText}>
                {usageInfo.remainingMessages} messages remaining today
              </Text>
            )}
          </View>
        )}

        {/* Subscription Tiers */}
        <View style={styles.tiersContainer}>
          {Object.values(SUBSCRIPTION_TIERS).map(renderTierCard)}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>What You Get</Text>

          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>📱</Text>
            <View>
              <Text style={styles.infoItemTitle}>Works Offline</Text>
              <Text style={styles.infoItemDesc}>
                Chat with AI anywhere, no internet needed
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>🔒</Text>
            <View>
              <Text style={styles.infoItemTitle}>Secure & Private</Text>
              <Text style={styles.infoItemDesc}>
                Your conversations stay on your device
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>⚡</Text>
            <View>
              <Text style={styles.infoItemTitle}>Lightning Fast</Text>
              <Text style={styles.infoItemDesc}>
                Instant responses with local AI
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>🎨</Text>
            <View>
              <Text style={styles.infoItemTitle}>Copy Code Easily</Text>
              <Text style={styles.infoItemDesc}>
                One-tap code copying like ChatGPT
              </Text>
            </View>
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>Common Questions</Text>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I switch plans anytime?</Text>
            <Text style={styles.faqAnswer}>
              Yes, you can upgrade or downgrade your plan at any time.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>When does my limit reset?</Text>
            <Text style={styles.faqAnswer}>
              Your message limit resets every day at midnight UTC.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Will the AI work offline?</Text>
            <Text style={styles.faqAnswer}>
              Yes! Sapy uses a local AI model that works completely offline on
              all devices.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Is my data safe?</Text>
            <Text style={styles.faqAnswer}>
              Absolutely. All your conversations are stored locally on your
              device. We never collect personal data.
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Payments securely processed with Razorpay (India) and Stripe (International)
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#718096',
    lineHeight: 20,
  },
  usageCard: {
    marginHorizontal: 20,
    marginVertical: 16,
    padding: 16,
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3182CE',
  },
  usageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#718096',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  usageBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  usageProgress: {
    height: '100%',
    borderRadius: 4,
  },
  usageText: {
    fontSize: 13,
    color: '#2D3748',
    fontWeight: '500',
  },
  warningText: {
    fontSize: 12,
    color: '#F56565',
    marginTop: 4,
  },
  tiersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  tierCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  currentTierCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0066FF',
  },
  selectedTierCard: {
    borderColor: '#0066FF',
  },
  currentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#0066FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  popularBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1A202C',
  },
  tierName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 16,
  },
  messageSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  messageCount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#0066FF',
  },
  messageLabel: {
    fontSize: 13,
    color: '#718096',
    marginTop: 4,
  },
  priceSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  priceUSD: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A202C',
  },
  priceINR: {
    fontSize: 16,
    color: '#718096',
    marginTop: 2,
  },
  pricePeriod: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  priceLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A202C',
  },
  featuresSection: {
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  featureIcon: {
    fontSize: 16,
    color: '#4CAF50',
    marginRight: 10,
    marginTop: 2,
  },
  featureText: {
    fontSize: 13,
    color: '#2D3748',
    flex: 1,
    lineHeight: 18,
  },
  actionButton: {
    backgroundColor: '#F5F7FA',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0066FF',
  },
  premiumButton: {
    backgroundColor: '#0066FF',
    borderColor: '#0066FF',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0066FF',
  },
  premiumButtonText: {
    color: '#FFFFFF',
  },
  currentButton: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  currentButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
  },
  infoSection: {
    marginHorizontal: 20,
    marginVertical: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  infoBullet: {
    fontSize: 28,
    marginRight: 12,
    width: 40,
  },
  infoItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A202C',
  },
  infoItemDesc: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
    lineHeight: 16,
  },
  faqSection: {
    marginHorizontal: 20,
    marginVertical: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  faqTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 16,
  },
  faqItem: {
    marginBottom: 16,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A202C',
    marginBottom: 6,
  },
  faqAnswer: {
    fontSize: 12,
    color: '#718096',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    fontSize: 11,
    color: '#A0AEC0',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default SubscriptionScreen;
