/**
 * PromotionalOfferBanner.tsx
 * Beautiful banner for showing new user promotional offers
 * Displays "₹49 for 1 month" instead of regular ₹249
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface PromotionalOffer {
  id: number;
  offer_type: string;
  original_price: number;
  discounted_price: number;
  discount_percentage: number;
  tier: string;
  duration_days: number;
  is_claimed: boolean;
  is_expired: boolean;
  offer_expires_at?: string;
}

interface PromotionalOfferBannerProps {
  offer: PromotionalOffer | null;
  onClaimOffer: () => void;
  onDismiss: () => void;
  visible: boolean;
}

const { width } = Dimensions.get('window');

const PromotionalOfferBanner: React.FC<PromotionalOfferBannerProps> = ({
  offer,
  onClaimOffer,
  onDismiss,
  visible,
}) => {
  const slideAnim = React.useRef(new Animated.Value(-200)).current;
  const [showBanner, setShowBanner] = useState(visible);

  useEffect(() => {
    if (visible && offer && !offer.is_claimed && !offer.is_expired) {
      setShowBanner(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowBanner(false));
    }
  }, [visible, offer]);

  if (!showBanner || !offer) {
    return null;
  }

  const savings = offer.original_price - offer.discounted_price;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.banner}>
        {/* Fire Icon */}
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name="fire"
            size={28}
            color="#FF6B6B"
          />
        </View>

        {/* Offer Content */}
        <View style={styles.contentContainer}>
          <Text style={styles.headline}>
            🎉 Special Offer for You!
          </Text>
          
          <View style={styles.priceContainer}>
            <Text style={styles.discountBadge}>
              {offer.discount_percentage}% OFF
            </Text>
            
            <View style={styles.priceRow}>
              <Text style={styles.discountedPrice}>
                ₹{offer.discounted_price}
              </Text>
              <Text style={styles.originalPrice}>
                ₹{offer.original_price}
              </Text>
            </View>
            
            <Text style={styles.offerDescription}>
              {offer.tier} Plan • {offer.duration_days} days • Save ₹{savings}
            </Text>
          </View>
        </View>

        {/* Claim Button */}
        <TouchableOpacity
          style={styles.claimButton}
          onPress={onClaimOffer}
          activeOpacity={0.8}
        >
          <Text style={styles.claimButtonText}>CLAIM</Text>
        </TouchableOpacity>

        {/* Close Button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onDismiss}
        >
          <MaterialCommunityIcons
            name="close"
            size={20}
            color="#666"
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  banner: {
    backgroundColor: '#FFF8F0',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  headline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
    marginBottom: 6,
  },
  priceContainer: {
    marginBottom: 4,
  },
  discountBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  discountedPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FF6B6B',
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    textDecorationLine: 'line-through',
  },
  offerDescription: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  claimButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  claimButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  closeButton: {
    padding: 4,
  },
});

export default PromotionalOfferBanner;
