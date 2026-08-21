# Firebase Setup Guide

This document explains how to properly configure Firebase for the CreatorLoop project.

## Security Important

**NEVER commit sensitive credentials to version control.** The `.env.local` file is already in `.gitignore` and should contain only placeholder values.

## Steps to Configure Firebase

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project" or select an existing project
3. Name it (e.g., "creatorloop-dev" for development)
4. Enable Google Analytics (optional)

### 2. Get Your Firebase Configuration

1. In the Firebase Console, go to **Project Settings** (gear icon)
2. Select the **General** tab
3. Scroll to "Your apps" section
4. Click on a Web app (or create one if needed)
5. Copy the Firebase config object with these fields:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`
   - `measurementId` (optional)

### 3. Enable Google Sign-In

1. In Firebase Console, go to **Authentication**
2. Click **Sign-in method**
3. Enable **Google** provider
4. Add your domain to authorized domains (e.g., `localhost:5173` for dev)

### 4. Set Environment Variables

Update your `.env.local` file with the real values from Firebase:

```env
# From Firebase Console > Project Settings
VITE_FIREBASE_API_KEY=your_actual_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcd1234
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Backend API
VITE_API_URL=http://localhost:8787
```

## Troubleshooting

### Error: "API key not valid"

**Cause**: The `VITE_FIREBASE_API_KEY` is using a placeholder value or is incorrect.

**Fix**:
1. Copy the exact `apiKey` from Firebase Console
2. Paste into `.env.local`
3. Restart the dev server

### Error: "Missing required environment variables"

**Cause**: One or more Firebase env vars are missing or have placeholder values.

**Fix**:
1. Ensure all VITE_FIREBASE_* variables are set in `.env.local`
2. Verify they match the values from Firebase Console exactly
3. Check for typos in variable names

### Error: "Authentication required" on API calls (401)

**Causes**:
1. Firebase is not configured (see above)
2. User is not authenticated
3. Backend API is not running
4. Bearer token is not being sent correctly

**Fix**:
1. Ensure Firebase is configured properly
2. Sign in with Google (should redirect to sign-in page)
3. Check that backend API is running at `VITE_API_URL`
4. Verify backend accepts Bearer tokens in Authorization header

### Error: "Sign in with Google not available"

**Cause**: Firebase auth wasn't initialized due to missing config.

**Fix**:
1. Complete all steps above
2. Restart dev server
3. Check browser console for specific error message
4. Verify Google Sign-In is enabled in Firebase Console

## Development Mode

For local development without Firebase, you can use dev auth:

```env
VITE_USE_DEV_AUTH=true
VITE_DEV_UID=dev-test-user
VITE_DEV_NAME=Dev Test User
```

**Note**: This is for development only and should never be used in production.

## Environment-Specific Setup

### Development

- Use a Firebase project named `creatorloop-dev`
- Enable localhost in authorized domains
- Use dev auth for testing

### Production

- Use a separate Firebase project named `creatorloop-prod`
- Use proper domain names in authorized domains
- Never use dev auth
- Use environment variables from Vercel/hosting provider

## Verifying Configuration

After setup, the app should:

1. Load without Firebase errors in console
2. Show "Sign in with Google" button on `/auth/signin`
3. Allow successful Google authentication
4. Redirect to dashboard after sign-in
5. Make authenticated API calls to backend
