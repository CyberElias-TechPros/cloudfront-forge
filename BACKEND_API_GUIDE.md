# Backend API Connectivity Guide

This document explains how to verify and troubleshoot backend API connectivity for the CreatorLoop application.

## Quick Health Check

### Step 1: Verify Backend is Running

```bash
# Check if backend is listening on port 8787
curl -v http://localhost:8787/health

# Expected response (200 OK):
# { "status": "ok" }
```

### Step 2: Verify CORS Configuration

```bash
# Test CORS headers
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Authorization" \
     -X OPTIONS http://localhost:8787/api/v1/auth/me -v

# Look for these headers in response:
# access-control-allow-origin: http://localhost:5173
# access-control-allow-credentials: true
```

### Step 3: Test Authentication Endpoint

```bash
# Without token (should return 401)
curl -v http://localhost:8787/api/v1/auth/me

# With Bearer token
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     http://localhost:8787/api/v1/auth/me
```

## Environment Configuration

Ensure these are set in `.env.local`:

```env
VITE_API_URL=http://localhost:8787
```

## API Endpoints Overview

### Authentication Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | Bearer | Register new user |
| GET | `/api/v1/auth/me` | Bearer | Get current user |
| GET | `/api/v1/auth/permissions` | Bearer | Get user permissions |

### NGN Top-up Endpoints (naira point purchases)

Users buy credits by bank transfer to the payout account
(**Delgra Ltd**, **Moniepoint MFB**, account **6674684361**) and submit the
transfer reference. An admin approves (credits are issued) or rejects.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/topups` | Bearer | Credit packs, payout account, pending status |
| POST | `/api/v1/topups` | Bearer | Submit a completed transfer (`tierId`, `transferReference`) |
| GET | `/api/v1/topups/mine` | Bearer | The caller's top-up history |
| GET | `/api/v1/admin/topups?status=pending\|approved\|rejected` | Admin | Review queue |
| POST | `/api/v1/admin/topups/:id/approve` | Admin | Approve and issue credits |
| POST | `/api/v1/admin/topups/:id/reject` | Admin | Reject (optional `reason` in body) |

Notes:

- One pending request per user at a time; a transfer reference can only have
  one pending request (duplicate submissions return `409 CONFLICT`).
- Approve/reject are idempotent-safe: the status transition is an atomic
  conditional update, so concurrent reviews return `409 CONFLICT`.
- Approved top-ups are recorded in `credit_transactions` with
  `type = 'admin'` and `reference_id` set to the top-up request id.

### Expected Responses

#### Successful Response (200)
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "displayName": "User Name"
  }
}
```

#### Error Response (4xx/5xx)
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

## Common Issues and Solutions

### Issue: Cannot Connect to Backend

**Symptoms**:
- Connection refused errors
- Network timeout
- "Failed to fetch" in browser console

**Diagnosis**:
```bash
# Is the backend running?
lsof -i :8787

# Is it listening on all interfaces?
netstat -tlnp | grep 8787
```

**Solutions**:
1. Start the backend server:
   ```bash
   cd workers/api
   npm run dev
   ```

2. Verify it's listening:
   ```bash
   curl http://localhost:8787/health
   ```

3. Check firewall rules:
   ```bash
   # Windows
   netsh advfirewall firewall show rule name="port 8787"
   ```

### Issue: CORS Errors

**Symptoms**:
- Browser console: "Access to XMLHttpRequest blocked by CORS policy"
- Preflight request (OPTIONS) fails

**Diagnosis**:
```bash
# Check CORS headers
curl -i -X OPTIONS http://localhost:8787/api/v1/auth/me \
  -H "Origin: http://localhost:5173"
```

**Solutions**:

1. **Backend Configuration** - Add to your backend CORS middleware:
   ```javascript
   const corsOptions = {
     origin: [
       "http://localhost:5173",      // Dev frontend
       "http://localhost:3000",      // Alternative
       "https://yourdomain.com"      // Production
     ],
     credentials: true,
     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allowedHeaders: ["Content-Type", "Authorization"],
     exposedHeaders: ["Content-Length", "X-JSON-Response-Body"]
   };
   app.use(cors(corsOptions));
   ```

2. **Verify Request Headers**:
   ```javascript
   // Ensure Bearer token is sent
   Authorization: Bearer <valid_token>
   Content-Type: application/json
   ```

### Issue: 401 Unauthorized

**Symptoms**:
- All API calls return 401
- Error: "Authentication required"
- Backend logs show missing/invalid token

**Causes**:
1. No Bearer token in request
2. Token is expired
3. Token format is invalid
4. Backend doesn't trust the token issuer

**Diagnosis**:
```bash
# Check if token is being sent
curl -v http://localhost:8787/api/v1/auth/me

# With token
TOKEN="your_jwt_token"
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8787/api/v1/auth/me
```

**Solutions**:

1. **Verify Token Generation**:
   ```javascript
   // In frontend auth diagnostics
   const token = await getIdToken();
   console.log("Token available:", !!token);
   console.log("Token format:", token?.substring(0, 20) + "...");
   ```

2. **Check Token Signature**:
   - Verify Firebase/Auth service is properly configured
   - Decode token at [jwt.io](https://jwt.io) to inspect claims
   - Ensure `exp` (expiration) is in the future

3. **Backend Token Validation**:
   ```javascript
   // Verify backend is validating tokens correctly
   app.post('/api/v1/auth/verify', (req, res) => {
     const token = req.headers.authorization?.split(' ')[1];
     if (!token) {
       return res.status(401).json({ error: "No token" });
     }
     // Validate token with Firebase Admin SDK or your auth service
     admin.auth().verifyIdToken(token)
       .then(decodedToken => res.json({ valid: true, uid: decodedToken.uid }))
       .catch(err => res.status(401).json({ error: err.message }));
   });
   ```

### Issue: 500 Server Error

**Symptoms**:
- API returns 500 status
- Error: "Internal server error"
- No specific error details

**Diagnosis**:
1. Check backend logs:
   ```bash
   # View live logs (if using Cloudflare Workers)
   wrangler tail
   
   # Or check local server output
   npm run dev
   ```

2. Test specific endpoint:
   ```bash
   curl -X POST http://localhost:8787/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"email":"test@example.com"}'
   ```

**Solutions**:
1. Check backend error logs
2. Verify database connectivity
3. Ensure all required env vars are set on backend
4. Review recent backend code changes

### Issue: Timeouts

**Symptoms**:
- Requests hang indefinitely
- Network tab shows pending requests
- "Request timeout" errors

**Causes**:
1. Backend is slow or blocked
2. Network connectivity issues
3. Large request/response payloads
4. Connection pooling issues

**Diagnosis**:
```bash
# Check backend response time
time curl http://localhost:8787/health

# Monitor network
# Chrome DevTools > Network tab > Check Duration column
```

**Solutions**:
1. Increase timeout in API client (default 30s):
   ```typescript
   const apiClient = axios.create({
     baseURL: apiUrl,
     timeout: 60000, // 60 seconds
   });
   ```

2. Check backend performance:
   - Review database queries
   - Check for blocking operations
   - Monitor server resources (CPU, memory)

3. Verify network:
   ```bash
   ping localhost
   tracert localhost
   ```

## Testing API Integration

### Browser Console Testing

```javascript
// Test auth diagnostics
import { diagnoseAuth, getAuthStatus } from '@/lib/auth-diagnostics';

console.log("Auth diagnosis:", diagnoseAuth());
getAuthStatus().then(status => console.log("Auth status:", status));
```

### Using API Client Directly

```javascript
import { api } from '@/lib/api';

// Get current user
api.get('/api/v1/users/me/profile')
  .then(user => console.log("User:", user))
  .catch(err => console.error("Error:", err.message));

// Create community
api.post('/api/v1/communities', {
  name: 'Test Community',
  description: 'Test'
})
  .then(result => console.log("Created:", result))
  .catch(err => console.error("Error:", err.message));
```

### Curl Testing Examples

```bash
# Set token variable
TOKEN=$(curl -s http://localhost:3000/auth/token)

# Get user profile
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8787/api/v1/users/me/profile

# Create video
curl -X POST http://localhost:8787/api/v1/videos \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "youtubeUrl": "https://youtube.com/watch?v=dQw4w9WgXcQ",
       "communityId": "comm-123"
     }'

# Get leaderboard
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8787/api/v1/leaderboards
```

## Monitoring and Debugging

### Enable Debug Logging

In browser console:
```javascript
// Enable verbose logging
localStorage.setItem('DEBUG', '*');
location.reload();

// Or in code
import { getAuthStatus } from '@/lib/auth-diagnostics';
getAuthStatus().then(console.log);
```

### Network Tab Analysis

1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Make an API call
4. Click the request
5. Check:
   - **General**: Status code, URL, method
   - **Request Headers**: Authorization header present?
   - **Response**: Error message details
   - **Timing**: How long did it take?

### Backend Logging

For workers/api backend:
```javascript
// Add request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log("Auth header:", req.headers.authorization?.substring(0, 20) + "...");
  console.log("Body:", req.body);
  next();
});

// Add response logging
app.use((err, req, res, next) => {
  console.error(`Error on ${req.method} ${req.path}:`, err);
  res.status(500).json({ error: err.message });
});
```

## Performance Optimization

### API Client Caching

```typescript
// Add request caching
const cache = new Map();

apiClient.interceptors.request.use((config) => {
  if (config.method === 'get') {
    const cacheKey = `${config.method}:${config.url}`;
    if (cache.has(cacheKey)) {
      return Promise.reject(new axios.Cancel('Cache hit'));
    }
  }
  return config;
});

apiClient.interceptors.response.use((response) => {
  if (response.config.method === 'get') {
    const cacheKey = `${response.config.method}:${response.config.url}`;
    cache.set(cacheKey, response.data);
  }
  return response;
});
```

### Request Batching

```typescript
// Batch multiple requests
import axios from 'axios';

const requests = [
  api.get('/api/v1/users/me/profile'),
  api.get('/api/v1/credits'),
  api.get('/api/v1/xp'),
];

Promise.all(requests)
  .then(([profile, credits, xp]) => {
    console.log("All data loaded:", { profile, credits, xp });
  })
  .catch(err => console.error("Error:", err));
```

## Next Steps

1. **Verify Setup**:
   - Backend is running on correct port
   - CORS is properly configured
   - All env vars are set

2. **Test Endpoints**:
   - Use curl to test endpoints manually
   - Check response codes and content

3. **Monitor in Production**:
   - Set up error tracking (Sentry, LogRocket)
   - Monitor API response times
   - Log authentication failures

4. **Documentation**:
   - Keep API documentation updated
   - Document all endpoints and auth requirements
   - Update error messages for clarity

For additional help:
- See `FIREBASE_SETUP.md` for authentication issues
- See `ENV_CONFIGURATION.md` for environment setup
- Check backend repository for API documentation
