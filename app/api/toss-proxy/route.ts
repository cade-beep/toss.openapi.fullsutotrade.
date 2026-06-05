import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user context via JWT from request header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseKey);
    let user;

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
    const bodyPayload = await request.json();
    const { method, path, body } = bodyPayload;

    if (!method || !path) {
      return NextResponse.json({ error: 'Invalid proxy parameters.' }, { status: 400 });
    }

    // 2. Fetch encrypted credentials
    const { data: creds, error: credsError } = await supabase
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

    if (!creds) {
      return NextResponse.json({ error: 'ConfigurationError: api_credentials record not found in database.' }, { status: 400 });
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

    // 3. Generate HMAC Signature
    const timestamp = Date.now().toString();
    const rawPayloadString = body ? JSON.stringify(body) : '';
    const message = `${method}${path}${timestamp}${rawPayloadString}`;
    const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');

    // 4. Check if we should execute Mock Sandbox or forward to Real Toss API
    const tossApiUrl = process.env.TOSS_API_URL;
    
    if (!tossApiUrl || isSimulation) {
      // Direct Simulation Mode Response inside the secure proxy
      return handleMockBrokerResponse(method, path, body, user.id);
    }

    // Forward signed request to Live Toss API
    console.log(`[TossProxy] Forwarding signed request to Toss API: ${method} ${path}`);
    const headers = {
      'Content-Type': 'application/json',
      'X-TOSS-API-KEY': apiKey,
      'X-TOSS-SIGNATURE': signature,
      'X-TOSS-TIMESTAMP': timestamp,
    };

    const res = await fetch(`${tossApiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error('[TossProxy] Proxy error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

// Master key derivation using SHA-256 to ensure exactly 32 bytes (256 bits)
function getMasterKey(): Buffer {
  const rawKey = process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY || 'default-dev-fallback-key-do-not-use-in-prod-12345';
  const isLiveMode = process.env.NEXT_PUBLIC_TRADING_MODE === 'LIVE' || process.env.TRADING_MODE === 'LIVE';
  if (!process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY && isLiveMode) {
    throw new Error('ConfigurationError: TOSS_CREDENTIALS_ENCRYPTION_KEY is required in LIVE mode but not defined.');
  }
  return crypto.createHash('sha256').update(rawKey).digest();
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


// Simulates broker responses within the secure proxy scope
function handleMockBrokerResponse(method: string, path: string, body: any, userId: string) {
  console.log(`[TossProxy Mock] Simulating ${method} ${path} for user ${userId}`);

  if (path.startsWith('/v1/orders')) {
    if (method === 'POST') {
      const brokerOrderId = `TOSS-ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      return NextResponse.json({
        success: true,
        broker_order_id: brokerOrderId,
        status: 'ACCEPTED',
        client_oid: body?.client_oid || ''
      }, { status: 200 });
    }
    
    if (method === 'DELETE') {
      return NextResponse.json({
        success: true,
        message: 'Order cancelled successfully'
      }, { status: 200 });
    }

    if (method === 'GET') {
      const parts = path.split('/');
      const clientOrderId = parts[parts.length - 1] || 'mock-id';
      return NextResponse.json({
        success: true,
        broker_order_id: `BROKER-${clientOrderId}`,
        symbol: 'AAPL',
        side: '2', // Buy
        type: '02', // Limit
        qty: 10,
        price: 150000,
        status: 'FILLED',
        filled_qty: 10,
        avg_fill_price: 150000,
        sequence_number: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { status: 200 });
    }
  }

  if (path.startsWith('/v1/account/balance')) {
    return NextResponse.json({
      cash_balance: 10000000,
      purchasing_power: 10000000
    }, { status: 200 });
  }

  if (path.startsWith('/v1/account/positions')) {
    return NextResponse.json([
      { symbol: 'AAPL', qty: 10, avg_buy_price: 150000 },
      { symbol: 'TSLA', qty: 5, avg_buy_price: 250000 }
    ], { status: 200 });
  }

  return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
}
