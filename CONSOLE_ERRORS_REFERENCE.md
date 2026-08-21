# Console Errors Reference and Solutions

This document provides solutions for common console errors you may encounter in the CreatorLoop application.

## AdSense and Third-Party Script Errors

### Error: "adsbygoogle.js doesn't support data-adsbygoogle-loader attribute"

**Severity**: Low (warning)

**Cause**: AdSense script configuration issue, typically from third-party analytics or ad services.

**Solution**:
```html
<!-- Remove or fix AdSense script tag -->
<!-- Wrong: -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-xxx"
        data-adsbygoogle-loader></script>

<!-- Correct: -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-xxx"></script>
```

## Firebase and Authentication Errors

### Error: "Firebase: Error (auth/api-key-not-valid.-please-pass-a-valid-api-key.)"

**Severity**: High (blocks authentication)

**Cause**: Firebase API key is invalid, expired, or in placeholder format.

**Diagnosis**:
```javascript
// Check Firebase config
console.log("Firebase API Key:", import.meta.env.VITE_FIREBASE_API_KEY);
console.log("Is placeholder?:", 
  import.meta.env.VITE_FIREBASE_API_KEY?.includes('placeholder') ||
  import.meta.env.VITE_FIREBASE_API_KEY?.includes('your-')
);
```

**Solutions**:
1. Get valid API key from Firebase Console
2. Update `.env.local`:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSyD... (real key from Firebase)
   ```
3. Restart dev server
4. Clear browser cache/localStorage:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

### Error: "Authentication required" on API calls

**Severity**: High (blocks API access)

**Cause**: User is not authenticated or token is missing/invalid.

**Console Output**:
```
[useCurrentMember] API unavailable: Error: Authentication required
[useUserPermissions] API unavailable: Error: Authentication required
GET .../api/v1/auth/permissions 401 (Unauthorized)
GET .../api/v1/users/me/member 401 (Unauthorized)
```

**Diagnosis**:
```javascript
// Check authentication status
import { getAuthStatus, diagnoseAuth } from '@/lib/auth-diagnostics';

getAuthStatus().then(status => {
  console.log("Authenticated:", status.isAuthenticated);
  console.log("Has token:", status.hasToken);
  console.log("Issues:", status.issues);
});

console.log("Auth diagnosis:", diagnoseAuth());
```

**Solutions**:
1. **Sign in first**: Navigate to `/auth/signin` and sign in with Google
2. **Check Firebase config**: Verify `FIREBASE_SETUP.md` is followed
3. **Verify token**: 
   ```javascript
   const user = auth.currentUser;
   if (user) {
     user.getIdToken().then(token => console.log("Token:", token));
   }
   ```
4. **Check backend**: Ensure backend API is running and accepting tokens

### Error: "Google sign-in is not available"

**Severity**: High (blocks sign-in)

**Cause**: Firebase Auth is not initialized or Google provider not configured.

**Solutions**:
1. Check Firebase is configured: `FIREBASE_SETUP.md`
2. Enable Google Sign-In in Firebase Console:
   - Authentication > Sign-in method > Google (Enable)
3. Add domain to authorized list:
   - Authentication > Settings > Authorized domains
   - Add `localhost:5173` for development
4. Verify env vars are not placeholders:
   ```javascript
   const requiredVars = [
     'VITE_FIREBASE_API_KEY',
     'VITE_FIREBASE_AUTH_DOMAIN',
     'VITE_FIREBASE_PROJECT_ID',
   ];
   requiredVars.forEach(v => {
     const val = import.meta.env[v];
     console.log(`${v}:`, val?.includes('placeholder') ? '❌ INVALID' : '✓ SET');
   });
   ```

### Error: "Missing required environment variables"

**Severity**: High (blocks startup in dev)

**Cause**: One or more Firebase env vars are missing.

**Solutions**:
1. Copy template: `cp .env.example .env.local`
2. Fill in all Firebase values from Firebase Console
3. Check for typos in variable names
4. Restart dev server: `npm run dev`

## API Request Errors

### Error: "GET ... 401 (Unauthorized)"

**Severity**: High (API calls fail)

**Cause**: Bearer token not sent or invalid.

**Debug**:
```javascript
// Check request headers
apiClient.interceptors.request.use(config => {
  console.log("Request headers:", config.headers);
  return config;
});

// Should see: Authorization: Bearer eyJhbGc...
```

**Solutions**:
1. Verify user is authenticated
2. Check token is being retrieved: `src/lib/api.ts`
3. Verify backend accepts this token format
4. Check token expiration hasn't passed

### Error: "GET ... 400 (Bad Request)"

**Severity**: Medium (API request malformed)

**Cause**: Invalid request parameters or malformed data.

**Debug**:
```javascript
// Check request body
apiClient.interceptors.request.use(config => {
  console.log("Request URL:", config.url);
  console.log("Request data:", config.data);
  return config;
});
```

**Solutions**:
1. Verify endpoint URL is correct
2. Check request parameters match API spec
3. Validate data types (numbers, strings, arrays)
4. Check for special characters that need encoding

### Error: "GET ... 500 (Internal Server Error)"

**Severity**: High (backend error)

**Cause**: Backend error during request processing.

**Solutions**:
1. Check backend logs:
   ```bash
   # If using Cloudflare Workers
   wrangler tail
   
   # Or check local server output
   npm run dev
   ```
2. Verify backend env vars are set
3. Check database connectivity
4. Review recent backend code changes

## Network and CORS Errors

### Error: "Access to XMLHttpRequest blocked by CORS policy"

**Severity**: High (API calls blocked)

**Cause**: Backend CORS headers not configured properly.

**Console Output**:
```
Access to XMLHttpRequest at 'http://localhost:8787/api/v1/auth/me' 
from origin 'http://localhost:5173' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Solutions**:
1. **Backend CORS Setup** - Add to your backend:
   ```javascript
   import cors from 'cors';
   
   app.use(cors({
     origin: [
       'http://localhost:5173',
       'http://localhost:3000',
       'https://yourdomain.com'
     ],
     credentials: true,
     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
   }));
   ```

2. **Verify Preflight Response**:
   ```bash
   curl -i -X OPTIONS http://localhost:8787/api/v1/auth/me \
     -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET"
   
   # Should see CORS headers in response
   ```

3. **Check Request Headers**:
   - Content-Type should be `application/json`
   - Authorization should have `Bearer token`

### Error: "Failed to fetch" / Network timeout

**Severity**: High (API unreachable)

**Cause**: Backend not running or network connectivity issue.

**Debug**:
```bash
# Test backend is running
curl http://localhost:8787/health

# Check network connectivity
ping localhost
```

**Solutions**:
1. Start backend: `cd workers/api && npm run dev`
2. Verify it's listening: `lsof -i :8787`
3. Check `VITE_API_URL` in `.env.local`
4. Verify firewall allows connections
5. Check DNS resolution: `nslookup localhost`

## React and Component Errors

### Error: "React.lazy: Expected the result to be a promise"

**Severity**: Medium (lazy loading failed)

**Cause**: Incorrect dynamic import or component export.

**Solution**:
```javascript
// Wrong:
const MyComponent = lazy(() => import('./MyComponent'));

// Correct:
const MyComponent = lazy(() => import('./MyComponent').then(m => ({ default: m.MyComponent })));

// Or export default:
export default MyComponent;
```

### Error: "Cannot read property 'xxx' of undefined"

**Severity**: Medium (runtime error)

**Cause**: Accessing property on undefined/null value.

**Debug**:
```javascript
// Add defensive checks
const value = obj?.property?.nested?.value;

// Or with nullish coalescing
const value = obj?.property ?? 'default';

// With optional chaining
const result = obj?.method?.();
```

### Error: "Hydration mismatch between server and client"

**Severity**: Medium (SSR issue)

**Cause**: Server and client render different content.

**Solutions**:
1. Use `useEffect` for client-side only code:
   ```javascript
   useEffect(() => {
     // This runs only on client
   }, []);
   ```

2. Avoid accessing window in render:
   ```javascript
   // Wrong
   const isMobile = window.innerWidth < 768;
   
   // Correct
   const [isMobile, setIsMobile] = useState(false);
   useEffect(() => {
     setIsMobile(window.innerWidth < 768);
   }, []);
   ```

## Performance Warnings

### Warning: "Slow network is detected"

**Severity**: Low (informational)

**Cause**: Network latency detected by Chrome.

**Solution**: This is informational. Font fallbacks are used while resources load.

### Warning: "Each child in a list should have a unique key prop"

**Severity**: Low (performance, debugging)

**Cause**: Missing or duplicate keys in list rendering.

**Fix**:
```javascript
// Wrong
{items.map((item, index) => (
  <div key={index}>{item}</div>
))}

// Correct
{items.map(item => (
  <div key={item.id}>{item}</div>
))}
```

## Systematic Debugging Process

### Step 1: Identify the Error

```javascript
// Enable all logging
localStorage.setItem('DEBUG', '*');

// Or enable specific loggers
import debug from 'debug';
const log = debug('app:*');
```

### Step 2: Check Configuration

```javascript
// Verify all env vars
import { diagnoseAuth } from '@/lib/auth-diagnostics';
const diagnosis = diagnoseAuth();
console.table({
  firebaseConfigured: diagnosis.firebaseConfigured,
  authAvailable: diagnosis.authAvailable,
  issues: diagnosis.issues.join('; ')
});
```

### Step 3: Check Authentication

```javascript
// Verify auth status
import { getAuthStatus } from '@/lib/auth-diagnostics';
getAuthStatus().then(status => {
  console.table(status);
});
```

### Step 4: Check Network

Open DevTools Network tab:
- Check response status codes
- Verify Authorization headers
- Check response bodies for error messages
- Monitor timing for slow requests

### Step 5: Check Console

Look for patterns:
- All 401 errors? → Authentication issue
- All 500 errors? → Backend issue
- CORS errors? → Backend configuration issue
- Timeout errors? → Network or backend performance

## Clearing Cache and State

Sometimes errors persist due to cached data:

```javascript
// Clear all storage
localStorage.clear();
sessionStorage.clear();

// Clear cookies
document.cookie.split(";").forEach(c => {
  document.cookie = c.replace(/^ +/, "")
    .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
});

// Reload
location.reload();

// Or hard reload (Cmd/Ctrl + Shift + R)
```

## Browser DevTools Tips

### Network Tab
1. Right-click request → Copy as cURL
2. Check Status, Size, Time columns
3. Click response to see full error message
4. Filter by type: `is:from-cache`, `larger-than:1k`

### Console Tab
1. Use `console.table()` for structured data
2. Filter by level: Errors, Warnings, Info
3. Search with Ctrl+F
4. Right-click errors for search options

### Application Tab
1. Check LocalStorage for credentials
2. Check Cookies for auth tokens
3. Check IndexedDB for cached data
4. Review Service Worker for stale caches

## Error Reporting

When reporting errors, include:
1. Full error message and stack trace
2. Steps to reproduce
3. Environment (dev/staging/prod)
4. Browser and version
5. Network tab screenshot
6. Console output
7. `.env.local` settings (without secrets)

## Getting Help

If errors persist after troubleshooting:

1. **Check documentation**:
   - `FIREBASE_SETUP.md` - Firebase configuration
   - `ENV_CONFIGURATION.md` - Environment variables
   - `BACKEND_API_GUIDE.md` - API connectivity

2. **Enable debug mode**:
   ```javascript
   localStorage.setItem('DEBUG', '*');
   location.reload();
   ```

3. **Test in isolation**:
   ```bash
   # Test backend
   curl http://localhost:8787/health
   
   # Test auth
   curl http://localhost:8787/api/v1/auth/me
   ```

4. **Clear and restart**:
   ```bash
   # Clear cache
   rm -rf node_modules/.vite
   npm run dev
   ```

5. **Report the issue**:
   - Include full error message
   - Browser console output
   - Network tab details
   - Steps to reproduce
