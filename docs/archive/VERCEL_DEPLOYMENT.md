# Vercel Deployment Setup Guide

## Prerequisites

Before deploying to Vercel, you need:

1. **Vercel Account** - Sign up at https://vercel.com
2. **GitHub Account** - Push code to GitHub (Vercel integrates with GitHub)
3. **Vercel CLI** - Already installed ✅
4. **Git configured** - Already done ✅

## Step 1: Push Code to GitHub

First, push your code to a GitHub repository:

```bash
# Initialize git if needed
git init
git add .
git commit -m "Initial commit: CloudFront Forge frontend"
git remote add origin https://github.com/YOUR-USERNAME/cloudfront-forge.git
git branch -M main
git push -u origin main
```

## Step 2: Create vercel.json Configuration

Create a `vercel.json` file in the root directory with proper configuration:

```json
{
  "name": "cloudfront-forge",
  "version": 2,
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": ".output",
  "installCommand": "npm install",
  "env": [
    {
      "key": "VITE_FIREBASE_API_KEY",
      "description": "Firebase API Key",
      "value": "@vite_firebase_api_key"
    },
    {
      "key": "VITE_FIREBASE_AUTH_DOMAIN",
      "description": "Firebase Auth Domain",
      "value": "@vite_firebase_auth_domain"
    },
    {
      "key": "VITE_FIREBASE_PROJECT_ID",
      "description": "Firebase Project ID",
      "value": "@vite_firebase_project_id"
    },
    {
      "key": "VITE_FIREBASE_STORAGE_BUCKET",
      "description": "Firebase Storage Bucket",
      "value": "@vite_firebase_storage_bucket"
    },
    {
      "key": "VITE_FIREBASE_MESSAGING_SENDER_ID",
      "description": "Firebase Messaging Sender ID",
      "value": "@vite_firebase_messaging_sender_id"
    },
    {
      "key": "VITE_FIREBASE_APP_ID",
      "description": "Firebase App ID",
      "value": "@vite_firebase_app_id"
    },
    {
      "key": "VITE_FIREBASE_MEASUREMENT_ID",
      "description": "Firebase Measurement ID",
      "value": "@vite_firebase_measurement_id"
    },
    {
      "key": "VITE_API_URL",
      "description": "Backend API URL",
      "value": "@vite_api_url"
    }
  ]
}
```

## Step 3: Deploy via Vercel CLI

### Option A: Interactive Deployment (Recommended)

```bash
vercel login
# Log in to your Vercel account

vercel
# Follow the prompts to create a new project
```

### Option B: Connect GitHub (Easier)

1. Go to https://vercel.com/new
2. Click "Import Project"
3. Select your GitHub repository
4. Vercel will auto-detect it's a Vite project
5. Add environment variables (see Step 4)
6. Deploy!

## Step 4: Set Environment Variables in Vercel

Either in CLI or Vercel Dashboard:

```bash
# Via CLI
vercel env add VITE_FIREBASE_API_KEY
# Enter: YOUR_FIREBASE_WEB_API_KEY

vercel env add VITE_FIREBASE_AUTH_DOMAIN
# Enter: creator-loop-ring.firebaseapp.com

vercel env add VITE_FIREBASE_PROJECT_ID
# Enter: creator-loop-ring

vercel env add VITE_FIREBASE_STORAGE_BUCKET
# Enter: creator-loop-ring.firebasestorage.app

vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID
# Enter: 365634472671

vercel env add VITE_FIREBASE_APP_ID
# Enter: 1:365634472671:web:cfbd912ccc8563edf7b76a

vercel env add VITE_FIREBASE_MEASUREMENT_ID
# Enter: G-DB32W6M1R8

vercel env add VITE_API_URL
# Enter: https://your-api-url.com (or leave as http://localhost:8787 for dev)
```

## Step 5: Production Deployment

```bash
# Deploy to production
vercel --prod

# Or deploy from GitHub (auto-deploys on push)
git push origin main
```

## Step 6: Verify Deployment

After deployment:

1. Open your Vercel project URL
2. Test sign-in flow
3. Check console for errors
4. Verify API calls work

## Environment Variables Quick Reference

| Variable | Value |
|----------|-------|
| VITE_FIREBASE_API_KEY | YOUR_FIREBASE_WEB_API_KEY |
| VITE_FIREBASE_AUTH_DOMAIN | creator-loop-ring.firebaseapp.com |
| VITE_FIREBASE_PROJECT_ID | creator-loop-ring |
| VITE_FIREBASE_STORAGE_BUCKET | creator-loop-ring.firebasestorage.app |
| VITE_FIREBASE_MESSAGING_SENDER_ID | 365634472671 |
| VITE_FIREBASE_APP_ID | 1:365634472671:web:cfbd912ccc8563edf7b76a |
| VITE_FIREBASE_MEASUREMENT_ID | G-DB32W6M1R8 |
| VITE_API_URL | https://your-backend-api.com |

## Troubleshooting

### Build fails with "Command not found"

Solution: Ensure `npm install` is running before build. Vercel does this automatically, but check `package.json` scripts are correct.

### Environment variables not loading

Solution:
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Verify all variables are set
3. Redeploy after adding variables

### Firebase auth not working after deploy

Solution:
1. Add your Vercel domain to Firebase authorized domains
2. In Firebase Console → Authentication → Settings
3. Add your Vercel URL to Authorized domains (e.g., `cloudfront-forge.vercel.app`)

### API calls returning 401

Solution:
1. Verify `VITE_API_URL` is correct
2. Check backend API is running and accessible
3. Ensure Bearer token is being sent (check Network tab)

## Useful Vercel Commands

```bash
# List projects
vercel projects

# List deployments
vercel deployments

# View project settings
vercel projects inspect

# Set environment variables
vercel env add KEY VALUE

# Remove environment variable
vercel env rm KEY

# Pull environment from production
vercel env pull

# Preview deployment
vercel

# Production deployment
vercel --prod

# Check build logs
vercel logs

# Help
vercel help
```

## Custom Domain Setup

1. Go to Vercel Dashboard
2. Select your project
3. Go to Settings → Domains
4. Add your custom domain
5. Follow DNS configuration steps

## Auto-Deploy from GitHub

1. Connect GitHub repository in Vercel
2. Select main branch to deploy
3. Every push to main auto-deploys
4. Preview deployments for PRs

## Monitoring & Analytics

In Vercel Dashboard:
- View build logs
- Monitor performance
- Track analytics
- Check error logs

## Next Steps

1. ✅ Install Vercel CLI
2. ✅ Create vercel.json
3. → Push code to GitHub
4. → Deploy via Vercel
5. → Set environment variables
6. → Verify deployment
7. → Add custom domain (optional)

---

**Ready to deploy!** 🚀
