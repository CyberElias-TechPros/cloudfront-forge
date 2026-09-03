# Environment Variables Configuration Guide

This document provides step-by-step instructions for properly configuring environment variables for the CreatorLoop application across different environments.

## Overview

The application uses environment variables for:
- Firebase authentication configuration
- Backend API endpoint configuration
- Development/testing features
- Deployment-specific settings

## File Structure

```
.env.example          # Template with all required variables (committed to git)
.env.local            # Local development overrides (NOT committed - in .gitignore)
.env.production       # Production values (managed by hosting provider)
```

## Development Setup

### Step 1: Copy the Template

```bash
cp .env.example .env.local
```

### Step 2: Configure Firebase

Edit `.env.local` and fill in Firebase values from [Firebase Console](https://console.firebase.google.com/):

```env
# From Firebase Console > Project Settings > General
VITE_FIREBASE_API_KEY=your_actual_api_key_from_firebase
VITE_FIREBASE_AUTH_DOMAIN=creatorloop-dev.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=creatorloop-dev
VITE_FIREBASE_STORAGE_BUCKET=creatorloop-dev.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012345678
VITE_FIREBASE_APP_ID=1:123456789012345678:web:abc123def456ghi789
VITE_FIREBASE_MEASUREMENT_ID=G-ABCDEFGHIJ
```

### Step 3: Configure Backend API

```env
# Local development (backend running on port 8787)
VITE_API_URL=http://localhost:8787

# Or for remote backend
VITE_API_URL=https://api-dev.example.com
```

### Step 4: Optional Development Features

```env
# Enable dev auth (local testing without Firebase)
VITE_USE_DEV_AUTH=false  # Set to 'true' only for testing

# Dev user credentials (only used if VITE_USE_DEV_AUTH=true)
VITE_DEV_UID=dev-test-user
VITE_DEV_NAME=Dev Test User

# App branding
VITE_APP_NAME=CreatorLoop
```

## Environment-Specific Configuration

### Development

**File**: `.env.local`

**Purpose**: Local machine development with live reload

**Requirements**:
- Firebase dev project credentials
- Local backend running at `http://localhost:8787`
- All VITE_* variables populated

**Example**:
```env
VITE_FIREBASE_API_KEY=AIzaSyD...
VITE_FIREBASE_AUTH_DOMAIN=creatorloop-dev.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=creatorloop-dev
VITE_FIREBASE_STORAGE_BUCKET=creatorloop-dev.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_API_URL=http://localhost:8787
```

### Staging

**File**: Environment variables set in hosting provider

**Purpose**: Pre-production testing

**Requirements**:
- Firebase staging project
- Staging backend API URL
- All variables from provider dashboard

**Provider Setup** (Vercel, Netlify, etc.):
```
VITE_FIREBASE_API_KEY=staging-key-value
VITE_FIREBASE_PROJECT_ID=creatorloop-staging
VITE_API_URL=https://api-staging.creatorloop.com
```

### Production

**File**: Environment variables set in hosting provider

**Purpose**: Live production deployment

**Requirements**:
- Firebase production project
- Production backend API URL
- Proper security headers
- All variables must be valid and tested

**Critical Settings**:
```env
VITE_FIREBASE_API_KEY=prod-key-value
VITE_FIREBASE_PROJECT_ID=creatorloop-prod
VITE_API_URL=https://api.creatorloop.com
VITE_USE_DEV_AUTH=false  # MUST be false or omitted
```

## Variable Reference

### Firebase Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_FIREBASE_API_KEY` | Yes | Firebase API Key | `AIzaSyD...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain | `app.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID | `my-project` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Firebase storage bucket | `app.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | FCM sender ID | `123456789012` |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase app ID | `1:123456789:web:abc...` |
| `VITE_FIREBASE_MEASUREMENT_ID` | No | Google Analytics ID | `G-ABCDEFGHIJ` |

### API Configuration

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `VITE_API_URL` | Yes | Backend API endpoint | `http://localhost:8787` |

### Development Configuration

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `VITE_USE_DEV_AUTH` | No | Enable dev auth mode | `false` |
| `VITE_DEV_UID` | No | Dev user ID | `dev-local` |
| `VITE_DEV_NAME` | No | Dev user display name | `Dev User` |

### App Configuration

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `VITE_APP_NAME` | No | Application name | `CreatorLoop` |

## Validation Checklist

Before running the application, verify:

- [ ] `.env.local` exists and is in `.gitignore`
- [ ] All `VITE_FIREBASE_*` variables are filled with real values (not placeholders)
- [ ] `VITE_API_URL` points to a running backend
- [ ] No values contain the strings "placeholder" or "your-"
- [ ] Firebase project is created and authentication is enabled
- [ ] Google Sign-In is enabled in Firebase Console
- [ ] Backend API is running and accepting requests
- [ ] `VITE_USE_DEV_AUTH` is `false` in production

## Troubleshooting

### Error: "Missing required environment variables"

**Solution**:
1. Check `.env.local` exists
2. Verify all `VITE_FIREBASE_*` variables are set
3. Restart dev server: `npm run dev`

### Error: "API key not valid"

**Solution**:
1. Get fresh API key from Firebase Console
2. Replace value in `.env.local`
3. Check for extra spaces or special characters
4. Restart dev server

### Error: "Cannot connect to API"

**Solution**:
1. Verify `VITE_API_URL` is correct
2. Ensure backend is running: `curl $VITE_API_URL/health`
3. Check firewall/network connectivity
4. Verify CORS is configured on backend

### Dev auth not working

**Solution**:
1. Set `VITE_USE_DEV_AUTH=true`
2. Ensure `VITE_DEV_UID` is set
3. Verify it's development mode (not production build)
4. Check browser localStorage for dev session

## Setting Variables in Hosting Providers

### Vercel

1. Go to Project Settings > Environment Variables
2. Add each variable with appropriate environment (Development, Preview, Production)
3. Restart deployments after adding variables

```bash
vercel env add VITE_FIREBASE_API_KEY
vercel env add VITE_API_URL
```

### Netlify

1. Go to Site settings > Build & deploy > Environment
2. Click "Edit variables"
3. Add each variable

```bash
netlify env:set VITE_FIREBASE_API_KEY your_key_value
```

### GitHub Actions (if used for CI/CD)

1. Go to Settings > Secrets and variables > Actions
2. Add repository secrets for sensitive values
3. Reference in workflow files

```yaml
env:
  VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
```

## Security Best Practices

1. **Never commit `.env.local`** - Already in `.gitignore`
2. **Never share API keys** - Treat as secrets
3. **Rotate keys regularly** - Update Firebase keys quarterly
4. **Use different projects per environment** - Dev, staging, prod
5. **Restrict Firebase API keys** - Limit to specific domains/services
6. **Use environment-specific credentials** - Never reuse production keys
7. **Audit environment access** - Log who accessed sensitive variables

## Next Steps

1. Complete the Firebase setup from `FIREBASE_SETUP.md`
2. Set all variables in `.env.local`
3. Start development server: `npm run dev`
4. Verify authentication works
5. Check backend API connectivity

For additional help, see:
- `FIREBASE_SETUP.md` - Firebase configuration details
- `.env.example` - All available variables
