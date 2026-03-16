# Sapy Payment Gateway Setup Guide

## Overview
Sapy supports two payment gateways:
- **Razorpay** for India (UPI, Cards, Net Banking, Wallets)
- **Stripe** for International markets (Cards, Apple Pay, Google Pay)

This guide walks through setting up both payment systems for production.

---

## Part 1: Razorpay Setup (India)

### Step 1: Create Razorpay Account

1. Go to [https://razorpay.com](https://razorpay.com)
2. Click "Sign Up" (top-right)
3. Create account with:
   - Email address
   - Phone number
   - Password
   - Accept terms
4. Verify email and phone via OTP

### Step 2: Complete Account Verification

1. Log in to Razorpay Dashboard
2. Go to **Settings** → **Account Details**
3. Update:
   - Business name: "Sapy"
   - Business type: "Technology/Software"
   - Business website: Your website URL
   - Address: Your address
4. Submit for verification (takes 2-4 hours)

### Step 3: Get API Keys

1. Go to **Settings** → **API Keys**
2. Under "Live" section (for production), you'll see:
   - **Key ID** (starts with `rzp_live_...`)
   - **Key Secret** (starts with `rzp_live_...`)
3. Copy and save both keys securely

**Never share Key Secret publicly!**

### Step 4: Enable Webhooks (Optional but Recommended)

1. Go to **Settings** → **Webhooks**
2. Click **Add New Webhook**
3. Enter your backend URL: `https://your-backend.com/webhooks/razorpay`
4. Select events:
   - `payment.authorized`
   - `payment.failed`
   - `payment.captured`
5. Save webhook secret securely

### Step 5: Test with Sandbox

Before going live:

1. Go to **Settings** → **API Keys**
2. Switch to "Test" mode
3. Use test credentials:
   - **Key ID**: `rzp_test_xxxxx` (shown on dashboard)
   - **Key Secret**: `xxxxx` (shown on dashboard)
4. Use test card: `4111 1111 1111 1111` (any future date, any CVV)

### Step 6: Store API Keys in Backend

In your Phase 2A backend (`.env` or secrets manager):

```
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxx
```

### Step 7: Verify in Sapy Frontend

When user initiates Razorpay payment:

1. Frontend calls backend: `GET /api/payment/razorpay-key`
2. Backend returns `Key ID` (NOT secret)
3. Frontend initializes `razorpayService.initialize(keyId)`
4. User sees Razorpay checkout modal
5. After payment, backend verifies with Key Secret

---

## Part 2: Stripe Setup (International)

### Step 1: Create Stripe Account

1. Go to [https://stripe.com](https://stripe.com)
2. Click "Start now"
3. Create account with:
   - Email address
   - Phone number
   - Password
4. Verify email via link

### Step 2: Complete Account Details

1. Go to **Settings** → **Account Details**
2. Fill in:
   - Business name: "Sapy"
   - Country: Your country (if multi-country, use HQ)
   - Business website: Your website
   - Industry: SaaS/Software
3. Save

### Step 3: Enable Products

1. Go to **Products** (left sidebar)
2. Click **Add Product**
3. Create products for each tier:
   - Name: "Sapy Basic Plan"
   - Price: $2.99
   - Billing period: Monthly
   - Repeat for STANDARD and PREMIUM

### Step 4: Get API Keys

1. Go to **Developers** → **API Keys** (left sidebar)
2. Under "Live" (for production):
   - **Publishable key** (starts with `pk_live_...`)
   - **Secret key** (starts with `sk_live_...`)
3. Copy and save both keys securely

**Never share Secret key publicly!**

### Step 5: Enable Webhooks

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your backend URL: `https://your-backend.com/webhooks/stripe`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.updated`
5. Save webhook signing secret securely

### Step 6: Test with Sandbox

Before going live:

1. Go to **Developers** → **API Keys**
2. Toggle to "Viewing Test Data"
3. Use test card: `4242 4242 4242 4242` (any future date, any CVC)
4. Test keys shown (start with `pk_test_` and `sk_test_`)

### Step 7: Store API Keys in Backend

In your Phase 2A backend (`.env` or secrets manager):

```
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=xxxxxxxxxxxxx
```

### Step 8: Connect Payment Methods

1. Go to **Settings** → **Payment Methods**
2. Enable:
   - ✅ Cards
   - ✅ Apple Pay
   - ✅ Google Pay
3. Save

---

## Part 3: Backend API Endpoints

Your Phase 2A backend needs these endpoints for payment handling:

### Razorpay Endpoints

```
GET /api/payment/razorpay-key
  → Returns: { key_id: "rzp_live_..." }

POST /api/payment/create-order (Razorpay)
  → Input: { amount, tier, currency: "INR" }
  → Returns: { order_id: "order_..." }

POST /api/payment/verify-razorpay
  → Input: { payment_id, order_id, signature, tier }
  → Returns: { success: true, message: "Payment verified" }

POST /api/webhooks/razorpay
  → Receives: Razorpay webhook events
  → Updates: User subscription in database
```

### Stripe Endpoints

```
GET /api/payment/stripe-key
  → Returns: { publishable_key: "pk_live_..." }

POST /api/payment/create-intent (Stripe)
  → Input: { amount, tier, currency: "USD" }
  → Returns: { client_secret: "pi_...", payment_intent_id: "pi_..." }

POST /api/payment/verify-stripe
  → Input: { payment_intent_id, client_secret, tier }
  → Returns: { success: true, message: "Payment verified" }

POST /api/webhooks/stripe
  → Receives: Stripe webhook events
  → Updates: User subscription in database
```

---

## Part 4: Integration with Sapy Frontend

### In PaymentScreen.tsx

```typescript
// When user taps "Pay"
const paymentResult = await razorpayService.processPayment({
  amount: tierDetails.priceINR * 100, // in paise
  currency: 'INR',
  orderId: orderResponse.order_id,
  tier: selectedTier,
  userEmail,
  userName,
  userPhone,
  description: `Sapy ${selectedTier} Plan`,
});

if (paymentResult.success) {
  // Payment successful
  // Subscription updated
  // Navigate to chat
  navigation.navigate('Chat');
} else {
  // Show error
  Alert.alert('Payment Failed', paymentResult.error);
}
```

### In razorpayService.ts

```typescript
// Initialize before processing
await razorpayService.initialize(keyId); // Key ID from backend

// Process payment
const result = await razorpayService.processPayment(options);

// Service handles:
// 1. Opening Razorpay checkout modal
// 2. User enters payment details
// 3. Razorpay processes payment
// 4. Backend verifies signature
// 5. Returns success/failure
```

---

## Part 5: Testing Checklist

### Razorpay Testing

- [ ] Create Razorpay test account
- [ ] Get test Key ID and Key Secret
- [ ] Set in backend `.env`
- [ ] Test card payment: `4111 1111 1111 1111`
- [ ] Test UPI: Enter any VPA like `success@razorpay`
- [ ] Test payment failure flow
- [ ] Test webhook receiving (webhook.site)
- [ ] Verify subscription created in database
- [ ] Switch to live keys after testing

### Stripe Testing

- [ ] Create Stripe test account
- [ ] Get test Publishable and Secret keys
- [ ] Set in backend `.env`
- [ ] Test card payment: `4242 4242 4242 4242`
- [ ] Test Apple Pay / Google Pay (if on mobile)
- [ ] Test payment failure flow
- [ ] Test webhook receiving (webhook.site)
- [ ] Verify subscription created in database
- [ ] Switch to live keys after testing

### Full Flow Testing

- [ ] User selects tier
- [ ] User taps "Pay"
- [ ] Payment screen shows order details
- [ ] User taps "Pay [amount]"
- [ ] Payment gateway opens (Razorpay/Stripe modal)
- [ ] User enters test payment details
- [ ] Payment processes
- [ ] Success page shown
- [ ] Subscription updated in database
- [ ] User returns to chat
- [ ] Message limit increased
- [ ] Sync works with new tier

---

## Part 6: Security Best Practices

### Never Do This ❌

- Store secret keys in frontend code
- Commit secret keys to GitHub
- Show secret keys in error messages
- Make API calls directly from frontend to Razorpay/Stripe
- Use same test keys in production

### Always Do This ✅

- Store secret keys in backend `.env` file
- Use `.gitignore` to exclude `.env`
- Verify signatures on backend
- Return only public keys to frontend
- Use HTTPS everywhere
- Rotate keys periodically
- Monitor for suspicious transactions
- Keep SDKs updated

---

## Part 7: Handle Payment Edge Cases

### Failed Payments

User payment fails → Message shown → User can:
- [ ] Try again immediately
- [ ] Try different payment method
- [ ] View subscription tiers again
- [ ] Come back later

### Interrupted Payments

App crashes during payment → User reopens app:
- [ ] Check backend for payment status
- [ ] If completed: Update subscription
- [ ] If incomplete: Show retry option
- [ ] If failed: Show error

### Refunds

User wants refund within 7 days:
- [ ] Call razorpayService.refundPayment(paymentId, amount)
- [ ] Backend processes refund
- [ ] Subscription downgraded
- [ ] Confirmation sent to user

---

## Part 8: Monitoring & Support

### Monitor Transactions

- Razorpay Dashboard: Payments section
- Stripe Dashboard: Payments section
- Look for failed payments
- Check failed webhook deliveries

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid Key" | Verify key format and expiry |
| "Payment failed" | Check backend logs for error |
| "Webhook not received" | Verify endpoint URL, check firewall |
| "Signature mismatch" | Verify you're using correct secret |
| "Order not found" | Check order creation on backend |

### Support Contacts

- **Razorpay Support**: https://razorpay.com/support
- **Stripe Support**: https://stripe.com/docs/support
- **Sapy Backend Logs**: Check your server logs

---

## Summary

1. **Get API Keys**
   - Razorpay: Key ID + Key Secret
   - Stripe: Publishable Key + Secret Key

2. **Store in Backend**
   - Save keys in `.env` file
   - Never expose secrets

3. **Implement Endpoints**
   - Create order
   - Verify payment
   - Handle webhooks

4. **Test with Sandbox**
   - Use test keys first
   - Test all payment methods
   - Test failure scenarios

5. **Go Live**
   - Switch to live keys
   - Monitor first transactions
   - Scale confidently

**You're now ready to accept payments in India (Razorpay) and internationally (Stripe)! 🎉**
