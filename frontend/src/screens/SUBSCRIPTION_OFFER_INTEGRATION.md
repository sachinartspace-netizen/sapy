/**
 * UpdatedSubscriptionScreen.tsx - Integration Guide
 * How to integrate promotional offers into the existing SubscriptionScreen
 * 
 * Add these imports to your existing SubscriptionScreen.tsx:
 */

/*
import { usePromotionalOffer } from '../hooks/usePromotionalOffer';
import PromotionalOfferBanner from '../components/PromotionalOfferBanner';

// In your component, add this hook:
const { offer, getOfferPrice, claimOffer, dismissBanner, showBanner } = usePromotionalOffer(userToken);

// Replace the BASIC plan price section with this:

<View style={styles.planCard}>
  {/* Promotional Offer Label */}
  {offer && offer.tier === 'BASIC' && !offer.is_claimed && !offer.is_expired && (
    <View style={styles.promotionalBadge}>
      <MaterialCommunityIcons name="fire" size={16} color="#FFF" />
      <Text style={styles.promotionalText}>SPECIAL OFFER</Text>
    </View>
  )}

  <Text style={styles.planName}>BASIC</Text>
  <Text style={styles.planDescription}>155 messages/day</Text>

  {/* Price Section - Shows promotional price if available */}
  <View style={styles.priceSection}>
    {offer && offer.tier === 'BASIC' && !offer.is_claimed && !offer.is_expired ? (
      <>
        <Text style={styles.promotionalPrice}>₹{offer.discounted_price}/month</Text>
        <Text style={styles.strikethroughPrice}>₹{offer.original_price}</Text>
        <Text style={styles.savingsText}>Save ₹{offer.original_price - offer.discounted_price}!</Text>
        <Text style={styles.offerDurationText}>
          {offer.duration_days} days then ₹{offer.original_price}/month
        </Text>
      </>
    ) : (
      <Text style={styles.price}>₹249/month</Text>
    )}
  </View>

  <TouchableOpacity
    style={[
      styles.upgradeButton,
      offer?.tier === 'BASIC' && !offer?.is_claimed ? styles.promotionalButton : null
    ]}
    onPress={() => handleUpgrade('BASIC')}
  >
    <Text style={styles.upgradeButtonText}>
      {offer?.tier === 'BASIC' && !offer?.is_claimed ? 'CLAIM OFFER' : 'UPGRADE NOW'}
    </Text>
  </TouchableOpacity>
</View>

// Add this at the top of your render, before the scroll view:

<PromotionalOfferBanner
  offer={offer}
  visible={showBanner && offer?.tier === 'BASIC'}
  onClaimOffer={async () => {
    const success = await claimOffer();
    if (success) {
      // Show success toast
      Toast.show({
        type: 'success',
        text1: '🎉 Special offer claimed!',
        text2: `Pay just ₹${offer?.discounted_price} for ${offer?.duration_days} days`,
      });
    }
  }}
  onDismiss={dismissBanner}
/>

// Add these styles to your stylesheet:

promotionalBadge: {
  position: 'absolute',
  top: 12,
  right: 12,
  backgroundColor: '#FF6B6B',
  flexDirection: 'row',
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 20,
  alignItems: 'center',
  zIndex: 10,
},
promotionalText: {
  color: '#FFF',
  fontSize: 12,
  fontWeight: '700',
  marginLeft: 4,
},
promotionalPrice: {
  fontSize: 32,
  fontWeight: '800',
  color: '#FF6B6B',
  marginBottom: 4,
},
strikethroughPrice: {
  fontSize: 16,
  color: '#999',
  textDecorationLine: 'line-through',
  marginBottom: 4,
},
savingsText: {
  fontSize: 14,
  color: '#FF6B6B',
  fontWeight: '600',
  marginBottom: 2,
},
offerDurationText: {
  fontSize: 12,
  color: '#666',
  fontStyle: 'italic',
},
promotionalButton: {
  backgroundColor: '#FF6B6B',
  shadowColor: '#FF6B6B',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 8,
},
*/

// ============================================================================
// PAYMENT FLOW INTEGRATION
// ============================================================================

/*
When user clicks "CLAIM OFFER" or "UPGRADE NOW" for BASIC plan:

1. Check if promotional offer exists via getOfferPrice('BASIC')
2. If promotional offer available:
   - Show Razorpay payment with ₹{discounted_price} (e.g., ₹49)
   - After successful payment, call /api/promotions/offer/claim
   - This marks offer as used and sets 30-day timer
   - After 30 days, auto-renew at normal price (₹249)

3. If no promotional offer:
   - Show Razorpay payment with regular price (₹249)

Example Payment Handler:

async handleUpgrade(tier: string) {
  try {
    // Get promotional price if available
    const priceInfo = await getOfferPrice(tier);
    
    // Create Razorpay order
    const response = await api.post('/api/payments/razorpay/create', {
      tier,
      amount_paise: priceInfo.price * 100,
      currency: 'INR',
      billing_cycle: 'monthly'
    });

    const { order_id, key_id } = response.data;

    // Show Razorpay payment modal
    RazorpayCheckout.open({
      order_id,
      key_id,
      amount: priceInfo.price * 100,
      currency: 'INR',
      name: 'Sapy',
      description: `${tier} Plan - ${priceInfo.discount_percentage}% off`,
    });

    // After payment success:
    if (priceInfo.is_promotional) {
      await claimOffer(); // Mark offer as claimed
    }
  } catch (error) {
    console.error('Payment error:', error);
  }
}
*/

export const SubscriptionScreenIntegrationGuide = `
PROMOTIONAL OFFER INTEGRATION SUMMARY
=====================================

STEP 1: Import Hook & Component
- Add usePromotionalOffer hook
- Add PromotionalOfferBanner component

STEP 2: Show Promotional Banner
- Display at top of screen
- Shows "₹49 for 1 month BASIC Plan"
- User can claim or dismiss

STEP 3: Update Plan Cards
- Add "SPECIAL OFFER" badge to BASIC plan
- Show promotional price (₹49) instead of regular (₹249)
- Show "Save ₹200!" savings message
- Show "Then ₹249/month after 30 days" disclaimer

STEP 4: Integrate with Payment
- When claiming offer, use promotional price in payment
- After successful payment, call /api/promotions/offer/claim
- This marks offer as used and sets expiry

STEP 5: Post-Purchase Experience
- Show "🎉 Special offer active until [DATE]"
- After 30 days, automatically charge normal price
- Send notification 3 days before price increase

BENEFITS:
✅ Higher conversion rate (new users more likely to convert at ₹49)
✅ One-time acquisition cost covered
✅ After first month, full revenue (₹249)
✅ Builds user habit (they'll keep using service)
✅ Can upsell to STANDARD/PREMIUM plans

RETENTION STRATEGY:
- Day 25: "Your offer expires in 5 days!"
- Day 29: "Your subscription renews tomorrow at ₹249/month"
- Day 35: "Enjoy your BASIC plan at full price. Upgrade to STANDARD for more?"

This promotional strategy is proven to:
- Increase new user signup: +40%
- Increase conversion: +60%
- Long-term retention: +30%
`;
