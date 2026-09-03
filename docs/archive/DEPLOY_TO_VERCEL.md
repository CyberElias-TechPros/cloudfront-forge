# CloudFront Forge - Vercel Deployment Guide

**Status**: Ready for deployment  
**Time**: 2026-08-21T04:28:52Z  
**Framework**: Vite + TanStack Start  

---

## 📋 Pre-Deployment Checklist

- [x] Vercel CLI installed (v59.3.0)
- [x] vercel.json created
- [x] Environment variables prepared
- [ ] GitHub repository created
- [ ] Code pushed to GitHub
- [ ] Vercel project configured
- [ ] Environment variables set in Vercel
- [ ] Deployment verified

---

## 🚀 Quick Deployment Steps

### Step 1: Push to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Deploy CloudFront Forge to Vercel"

# Add GitHub remote (replace with your repo)
git remote add origin https://github.com/YOUR-USERNAME/cloudfront-forge.git

# Push to GitHub
git push -u origin main
```

### Step 2: Connect to Vercel

**Option A: Via Vercel Dashboard (Easiest)**
1. Go to https://vercel.com/new
2. Click "Import Project"
3. Paste your GitHub repository URL
4. Click "Import"
5. Vercel will auto-detect Vite configuration
6. Click "Deploy"

**Option B: Via Vercel CLI**
```bash
vercel login
vercel
# Follow interactive prompts
```

### Step 3: Configure Environment Variables

In Vercel Dashboard (Project Settings → Environment Variables), add:

```
VITE_FIREBASE_API_KEY=YOUR_FIREBASE_WEB_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=creator-loop-ring.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=creator-loop-ring
VITE_FIREBASE_STORAGE_BUCKET=creator-loop-ring.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=365634472671
VITE_FIREBASE_APP_ID=1:365634472671:web:cfbd912ccc8563edf7b76a
VITE_FIREBASE_MEASUREMENT_ID=G-DB32W6M1R8
VITE_API_URL=https://your-backend-api.com
```

### Step 4: Deploy

```bash
# Production deployment
vercel --prod
```

---

## ✅ Post-Deployment Verification

### 1. Check Build Status
- Go to Vercel Dashboard
- Click your project
- Check "Deployments" tab
- Should show "READY" status

### 2. Test Application
- Click the deployment URL
- Navigate to /auth/signin
- Test Google Sign-In
- Verify dashboard loads

### 3. Check Console for Errors
- Open DevTools (F12)
- Go to Console tab
- Should see no auth errors
- Verify Firebase initialized

### 4. Test API Calls
- Open Network tab in DevTools
- Perform an action that calls API
- Should see Bearer token in Authorization header
- API should respond with data

---

## 🔐 Important Security Notes

### Authorized Domains in Firebase

After deploying to Vercel, add your domain to Firebase:

1. Go to Firebase Console → Authentication → Settings
2. Scroll to "Authorized domains"
3. Add your Vercel URL: `cloudfront-forge.vercel.app`
4. Wait 5 minutes for changes to propagate
5. Test sign-in again

### Environment Variables Security

- ✅ Never commit `.env.local` (already in .gitignore)
- ✅ Only set production values in Vercel Dashboard
- ✅ Use separate Firebase project for production
- ✅ Rotate keys periodically

---

## 📊 Deployment Configuration

### vercel.json
```json
{
  "name": "cloudfront-forge",
  "version": 2,
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": ".output",
  "installCommand": "npm install",
  "public": true,
  "env": {
    "VITE_FIREBASE_API_KEY": "@VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN": "@VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID": "@VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET": "@VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID": "@VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID": "@VITE_FIREBASE_APP_ID",
    "VITE_FIREBASE_MEASUREMENT_ID": "@VITE_FIREBASE_MEASUREMENT_ID",
    "VITE_API_URL": "@VITE_API_URL"
  },
  "regions": ["iad1"],
  "git": {
    "deploymentEnabled": true
  }
}
```

---

## 🛠️ Useful Vercel Commands

### Authentication
```bash
vercel login           # Log in to Vercel
vercel logout          # Log out
whoami                 # Check current user
```

### Project Management
```bash
vercel projects        # List all projects
vercel list            # List recent deployments
vercel status          # Check project status
vercel remove PROJECT  # Delete project
```

### Environment Variables
```bash
vercel env add KEY VALUE              # Add variable
vercel env rm KEY                     # Remove variable
vercel env pull                       # Download env vars
vercel env list                       # List variables
```

### Deployment
```bash
vercel                 # Preview deployment
vercel --prod          # Production deployment
vercel --target=production # Production
vercel inspect URL     # Inspect deployment
vercel logs            # View logs
```

---

## 🐛 Troubleshooting

### Build Fails

**Error**: "Cannot find module"
```bash
# Solution: Clear Vercel cache
vercel build --no-cache
```

**Error**: "Environment variable not found"
1. Go to Project Settings → Environment Variables
2. Add missing variables
3. Redeploy

### Sign-In Not Working

**Error**: Firebase error on deploy
1. Add your Vercel domain to Firebase authorized domains
2. Wait 5 minutes for propagation
3. Clear browser cache
4. Try again

**Error**: "cors policy" in console
1. Backend API must allow CORS from your Vercel domain
2. Check backend CORS configuration
3. Add Vercel domain to allowed origins

### API Calls Failing (401)

**Error**: Unauthorized
1. Verify `VITE_API_URL` is set correctly
2. Check backend is running and accessible
3. Verify Bearer token is being sent (Network tab)
4. Check token expiration

### Performance Issues

**Slow builds**:
- Check Dependencies → Analyze bundle size
- Optimize unused imports
- Use dynamic imports for heavy components

**Slow runtime**:
- Check Network tab for slow API calls
- Monitor Core Web Vitals in dashboard
- Consider caching strategies

---

## 📈 Monitoring & Analytics

### Vercel Dashboard

1. **Deployments** - View all deployments and history
2. **Analytics** - Monitor performance metrics
3. **Logs** - Check build and runtime logs
4. **Monitoring** - View error rates and uptime
5. **Settings** - Project configuration

### Performance Metrics

- **Build Time** - How long build takes
- **Bundle Size** - Overall size of deployment
- **First Contentful Paint** - Time to first content
- **Largest Contentful Paint** - Time to largest element
- **Cumulative Layout Shift** - Visual stability

---

## 🔄 Continuous Deployment

### Auto-Deploy from GitHub

1. Connect GitHub repository to Vercel
2. Select main branch
3. Enable "Automatic Deployments"
4. Every push to main auto-deploys
5. Preview deployments for PRs

### Deploy Settings

```bash
# View deployment settings
vercel projects inspect

# Update build command
vercel projects update --buildCommand "npm run build"

# Update output directory
vercel projects update --outputDirectory ".output"
```

---

## 🌐 Custom Domain Setup

### Add Custom Domain

1. Go to Vercel Dashboard → Settings → Domains
2. Enter your domain (e.g., creatorloop.app)
3. Choose DNS provider
4. Add DNS records (CNAME or A record)
5. Wait for verification

### DNS Configuration

Vercel will provide:
- CNAME record for www
- A record for root domain
- TXT record for verification

---

## 📞 Getting Help

### Vercel Support
- Documentation: https://vercel.com/docs
- Community: https://github.com/vercel/vercel/discussions
- Support: https://vercel.com/support

### Common Links
- Dashboard: https://vercel.com/dashboard
- New Project: https://vercel.com/new
- Settings: https://vercel.com/account/settings

---

## ✅ Deployment Checklist

**Before Deployment**:
- [ ] Code committed to GitHub
- [ ] All changes tested locally
- [ ] vercel.json created
- [ ] Environment variables ready
- [ ] Firebase project configured
- [ ] Backend API URL ready

**During Deployment**:
- [ ] Connect GitHub to Vercel
- [ ] Configure build settings
- [ ] Add environment variables
- [ ] Click Deploy
- [ ] Monitor build progress

**After Deployment**:
- [ ] Verify deployment status
- [ ] Test sign-in flow
- [ ] Check console for errors
- [ ] Verify API calls work
- [ ] Add domain to Firebase auth
- [ ] Set up custom domain (optional)

---

## 🎯 Next Steps

1. **Push to GitHub** - `git push origin main`
2. **Go to Vercel** - https://vercel.com/new
3. **Import Repository** - Select your GitHub repo
4. **Add Environment Variables** - Copy from above
5. **Deploy** - Click Deploy button
6. **Verify** - Test the live deployment
7. **Configure Firebase** - Add Vercel domain to authorized list

---

## 📝 Deployment Summary

| Item | Value |
|------|-------|
| Framework | Vite + TanStack Start |
| Build Command | npm run build |
| Output Directory | .output |
| Regions | iad1 (US East) |
| Environment Variables | 8 required |
| Firebase Project | creator-loop-ring |
| GitHub Integration | Auto-deploy |
| Custom Domain | Supported |

---

## 🚀 Ready to Deploy!

Your CloudFront Forge application is ready for production deployment on Vercel.

### Quick Deploy Command:
```bash
vercel --prod
```

### Or via Dashboard:
1. https://vercel.com/new
2. Import your GitHub repository
3. Add environment variables
4. Click Deploy

**Estimated Deploy Time**: 2-5 minutes

---

**Last Updated**: 2026-08-21T04:28:52Z  
**Status**: ✅ Ready for deployment  
**Next**: Push to GitHub and deploy to Vercel

🎉 **You're ready to go live!**
