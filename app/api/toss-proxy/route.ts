import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { tossTokenCache } from '../../../services/trading/toss-token-cache';
import { getLocalCredentials, saveLocalCredentials } from '../../../services/trading/local-credentials';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function isSupabaseConfigured() {
  return supabaseUrl && !supabaseUrl.includes('your-project-id') && supabaseKey && !supabaseKey.includes('dummy');
}

export async function POST(request: NextRequest) {
  try {
    // Validate credentials encryption key early in LIVE mode
    const isLiveMode = process.env.NEXT_PUBLIC_TRADING_MODE === 'LIVE' || process.env.TRADING_MODE === 'LIVE';
    if (isLiveMode) {
      const rawKey = process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY;
      if (!rawKey || rawKey.trim() === '' || 
          rawKey === 'default-dev-fallback-key-do-not-use-in-prod-12345' || 
          rawKey === 'dev-key-seed-do-not-use-in-live') {
        return NextResponse.json({ 
          error: 'ConfigurationError: TOSS_CREDENTIALS_ENCRYPTION_KEY is required and must not be a default/development key in LIVE mode.' 
        }, { status: 500 });
      }
    }

    // 1. Authenticate user context via JWT from request header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    let user: { id: string; email?: string } = { id: 'dev-user-123', email: 'trader@toss.im' };

    const useLocal = process.env.NEXT_PUBLIC_AUTH_ENABLED !== 'true' || !isSupabaseConfigured();

    if (!useLocal) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (serviceRoleKey && token === serviceRoleKey) {
        const workerUserId = request.headers.get('x-worker-user-id');
        if (!workerUserId) {
          return NextResponse.json({ error: 'Unauthorized: Missing x-worker-user-id header for worker request.' }, { status: 400 });
        }
        user = { id: workerUserId };
      } else {
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !authData.user) {
          return NextResponse.json({ error: 'Unauthorized: Authentication failed.' }, { status: 401 });
        }
        user = authData.user;
      }
    }
    const bodyPayload = await request.json();
    const { method, path, body } = bodyPayload;

    if (!method || !path) {
      return NextResponse.json({ error: 'Invalid proxy parameters.' }, { status: 400 });
    }

    // 2. Fetch encrypted credentials
    let creds: any = null;
    if (useLocal) {
      creds = getLocalCredentials();
    } else {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error: credsError } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (credsError) {
        if (credsError.code === 'PGRST116') {
          return NextResponse.json({ error: 'ConfigurationError: api_credentials record not found in database.' }, { status: 400 });
        }
        return NextResponse.json({ error: `SystemError: Database error loading api credentials: ${credsError.message}` }, { status: 500 });
      }
      creds = data;
    }

    if (!creds) {
      return NextResponse.json({ error: 'ConfigurationError: api_credentials record not found.' }, { status: 400 });
    }

    // Verify all required credential parts exist
    if (!creds.user_id) {
      return NextResponse.json({ error: 'ConfigurationError: Incomplete credentials record. Missing user_id account identifier.' }, { status: 400 });
    }
    if (!creds.encrypted_api_key) {
      return NextResponse.json({ error: 'ConfigurationError: Incomplete credentials record. Missing encrypted_api_key.' }, { status: 400 });
    }
    if (!creds.encrypted_secret_key) {
      return NextResponse.json({ error: 'ConfigurationError: Incomplete credentials record. Missing encrypted_secret_key.' }, { status: 400 });
    }

    let apiKey = '';
    let secretKey = '';
    try {
      apiKey = decryptSecret(creds.encrypted_api_key);
      secretKey = decryptSecret(creds.encrypted_secret_key);
    } catch (err: any) {
      return NextResponse.json({ error: `SystemError: Failed to decrypt credentials: ${err.message}` }, { status: 500 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'ConfigurationError: API Key is empty after decryption.' }, { status: 400 });
    }
    if (!secretKey) {
      return NextResponse.json({ error: 'ConfigurationError: Secret Key is empty after decryption.' }, { status: 400 });
    }

    const isSimulation = creds.is_simulation;

    // 3. Verify TOSS_API_URL and block simulation requests
    const tossApiUrl = process.env.TOSS_API_URL;
    if (!tossApiUrl) {
      return NextResponse.json({ error: 'ConfigurationError: TOSS_API_URL environment variable is not configured.' }, { status: 500 });
    }

    if (isSimulation) {
      return NextResponse.json({ error: 'NotImplementedError: Simulation mode is deactivated for production security.' }, { status: 501 });
    }

    // 4. Retrieve OAuth2 Token
    let accessToken = '';
    try {
      accessToken = await tossTokenCache.getToken(apiKey, secretKey);
    } catch (err: any) {
      return NextResponse.json({ error: `SystemError: OAuth2 token retrieval failed: ${err.message}` }, { status: 500 });
    }

    // 5. Resolve Account ID (Sequence)
    let accountId = creds.account_id || '';
    if (!accountId) {
      console.log(`[TossProxy] Account ID not found in database for user ${user.id}. Discovering via /api/v1/accounts...`);
      try {
        const accountsRes = await fetch(`${tossApiUrl}/api/v1/accounts`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!accountsRes.ok) {
          const errBody = await accountsRes.json().catch(() => ({}));
          throw new Error(errBody.error?.message || errBody.error || `HTTP ${accountsRes.status}`);
        }

        const accountsData = await accountsRes.json();
        const accountsList = accountsData.result || [];
        const brokerageAccount = accountsList.find((acc: any) => acc.accountType === 'BROKERAGE');

        if (!brokerageAccount) {
          return NextResponse.json({ error: 'ConfigurationError: No brokerage account found during discovery.' }, { status: 404 });
        }

        const discoveredSeq = brokerageAccount.accountSeq;
        if (discoveredSeq === undefined || discoveredSeq === null) {
          return NextResponse.json({ error: 'ConfigurationError: Discovered brokerage account is missing accountSeq.' }, { status: 500 });
        }

        accountId = String(discoveredSeq);

        // Persist to database or local credentials
        if (useLocal) {
          saveLocalCredentials({
            ...creds,
            account_id: accountId,
            updated_at: new Date().toISOString()
          });
          console.log(`[TossProxy] Successfully persisted local account_id: ${accountId}`);
        } else {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { error: updateError } = await supabase
            .from('api_credentials')
            .update({ account_id: accountId, updated_at: new Date().toISOString() })
            .eq('user_id', user.id);

          if (updateError) {
            console.error(`[TossProxy] Failed to persist account_id: ${updateError.message}`);
          } else {
            console.log(`[TossProxy] Successfully persisted account_id: ${accountId} for user ${user.id}`);
          }
        }
      } catch (err: any) {
        return NextResponse.json({ error: `SystemError: Account discovery failed: ${err.message}` }, { status: 500 });
      }
    }

    // 6. Forward signed request to Live Toss API
    console.log(`[TossProxy] Forwarding signed request to Toss API: ${method} ${path}`);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    // Inject X-Tossinvest-Account header for resource endpoints
    const isAuthOrDiscovery = path === '/oauth2/token' || path === '/api/v1/accounts';
    if (!isAuthOrDiscovery) {
      headers['X-Tossinvest-Account'] = accountId;
    }

    const res = await fetch(`${tossApiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error('[TossProxy] Proxy error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}


// Master key derivation using SHA-256 to ensure exactly 32 bytes (256 bits)
function getMasterKey(): Buffer {
  const rawKey = process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY;
  const isLiveMode = process.env.NEXT_PUBLIC_TRADING_MODE === 'LIVE' || process.env.TRADING_MODE === 'LIVE';
  
  if (isLiveMode) {
    if (!rawKey || rawKey.trim() === '') {
      throw new Error('ConfigurationError: TOSS_CREDENTIALS_ENCRYPTION_KEY is required in LIVE mode but not defined.');
    }
    if (rawKey === 'default-dev-fallback-key-do-not-use-in-prod-12345' || 
        rawKey === 'dev-key-seed-do-not-use-in-live') {
      throw new Error('ConfigurationError: Development encryption keys are forbidden in LIVE mode.');
    }
  }
  
  const encryptionKey = rawKey || 'default-dev-fallback-key-do-not-use-in-prod-12345';
  return crypto.createHash('sha256').update(encryptionKey).digest();
}

// Cryptographically encrypt a plaintext string using AES-256-GCM
export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

// Cryptographically decrypt a cipher string using AES-256-GCM (with legacy mock fallbacks)
export function decryptSecret(encrypted: string): string {
  if (!encrypted) return '';

  // Fallback for unencrypted mock API keys/secrets in dev database instances
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    const isLiveMode = process.env.NEXT_PUBLIC_TRADING_MODE === 'LIVE' || process.env.TRADING_MODE === 'LIVE';
    if (isLiveMode) {
      throw new Error('SystemError: Invalid encrypted secret format. Plaintext credentials are forbidden in LIVE mode.');
    }
    if (encrypted.startsWith('enc:')) {
      return encrypted.slice(4);
    }
    return encrypted;
  }
  
  const key = getMasterKey();
  const [ivHex, authTagHex, cipherTextHex] = parts;
  if (!ivHex || !authTagHex || !cipherTextHex) {
    throw new Error('Invalid encrypted secret format.');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(cipherTextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

