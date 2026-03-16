# Sapy Deployment Guide

## Quick Deployment (30 minutes)

### Backend Deployment to Render

1. **Connect GitHub to Render**
   - Go to https://render.com
   - Click "New Web Service"
   - Connect your GitHub account
   - Select `sapy_phase2a` directory

2. **Configure Environment Variables**
   - Add these in Render Dashboard:
   ```
   RAZORPAY_KEY_ID=rzp_test_SRXk3kZ1jUKd4A
   RAZORPAY_KEY_SECRET=fdybQ4ZtAU5jSSMEE5w2bgJ9
   DATABASE_URL=sqlite:///./sapy.db
   JWT_SECRET_KEY=generate-a-random-string-here
   ENVIRONMENT=production
   CORS_ORIGINS=["*"]
   ```

3. **Deploy**
   - Render auto-deploys from git
   - You get a public URL like: `https://sapy-backend.onrender.com`

---

### Frontend Deployment to Vercel

1. **Connect GitHub to Vercel**
   - Go to https://vercel.com
   - Import your GitHub repo
   - Select `sapy_phase2b` as root directory

2. **Configure Build Settings**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Framework: `Expo`

3. **Environment Variables**
   - `EXPO_PUBLIC_API_URL=https://sapy-backend.onrender.com`

4. **Deploy**
   - Vercel auto-deploys from git
   - You get a public URL like: `https://sapy.vercel.app`

---

## Testing Endpoints

### Backend Health Check
```
GET https://sapy-backend.onrender.com/health
```

### Frontend Access
```
https://sapy.vercel.app
```

---

## After Deployment

1. **Share with Razorpay:** 
   - "My app is live at: https://sapy.vercel.app"
   - "Backend API: https://sapy-backend.onrender.com"
   - They can test anytime, from anywhere

2. **Test Payment Flow**
   - Use test card: `4111 1111 1111 1111`
   - Expiry: `12/25` | CVV: `123`
   - Razorpay accepts test payments instantly

3. **Switch to Live Keys** (Later)
   - Once Razorpay verifies, get live keys
   - Update environment variables in Render & Vercel
   - No code changes needed!

---

## Rollback (If Needed)

Both Render and Vercel allow instant rollback to previous deployments. Just click "Rollback" in the dashboard.

---

## Free Tier Limits

**Render:**
- 1 free web service
- Spins down after 15 mins of inactivity
- Auto-resumes when accessed

**Vercel:**
- Unlimited free deployments
- Instant access (no spindown)

---

## Next Steps

1. Push this code to GitHub
2. Deploy backend to Render
3. Deploy frontend to Vercel
4. Send URLs to Razorpay for testing
5. They verify → You get live keys
6. Update .env with live keys
7. Redeploy (automatic)
8. Launch on Play Store!
