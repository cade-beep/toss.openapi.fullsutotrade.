import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { brokerEventsQueue } from '../../../../services/queue/reconciler-queues';
import { getRedisClient } from '../../../../lib/redis';
import { decryptSecret } from '../../toss-proxy/route';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key';

// Initialize Supabase Client with service_role key to bypass RLS for dynamic secret loading
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize ioredis client for replay protection
let redis: Redis | null = null;
try {
  redis = getRedisClient();
} catch (err) {
  console.warn('[Webhook Redis] failed to initialize ioredis client:', err);
}


export async function POST(request: NextRequest) {
  try {
    // 1. Extract raw body and headers
    const rawBody = await request.text();
    const signature = request.headers.get('x-toss-signature');
    const timestampHeader = request.headers.get('x-toss-timestamp');

    if (!signature || !timestampHeader) {
      console.warn('[Webhook] Missing signature or timestamp headers.');
      return NextResponse.json({ error: 'Unauthorized: Missing headers' }, { status: 401 });
    }

    // 2. Validate timestamp drift (5 minutes limit)
    const timestamp = Number(timestampHeader);
    const now = Date.now();
    if (isNaN(timestamp) || Math.abs(now - timestamp) > 5 * 60 * 1000) {
      console.warn(`[Webhook] Rejecting due to timestamp drift. Server: ${now}, Webhook: ${timestamp}`);
      return NextResponse.json({ error: 'Unauthorized: Request timestamp expired' }, { status: 401 });
    }

    // Parse payload to get identifiers
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseErr) {
      console.warn('[Webhook] Failed to parse request body as JSON:', parseErr);
      return NextResponse.json({ error: 'Bad Request: Invalid JSON body' }, { status: 400 });
    }

    const { execution_id, client_order_id, broker_order_id, event_type, sequence_number, filled_qty, execution_price, raw_payload } = payload;
    
    if (!execution_id || !client_order_id || !broker_order_id || !event_type || sequence_number === undefined) {
      console.warn('[Webhook] Missing required fields in payload:', payload);
      return NextResponse.json({ error: 'Bad Request: Missing required parameters' }, { status: 400 });
    }

    // 3. Dynamic webhook secret loading
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('user_id')
      .eq('client_order_id', client_order_id)
      .single();

    if (orderError || !orderData) {
      console.warn(`[Webhook] Order ${client_order_id} not found. DB Error:`, orderError?.message);
      return NextResponse.json({ error: 'Unauthorized: Order not found' }, { status: 401 });
    }

    const { data: credsData, error: credsError } = await supabase
      .from('api_credentials')
      .select('encrypted_webhook_secret')
      .eq('user_id', orderData.user_id)
      .single();

    if (credsError || !credsData || !credsData.encrypted_webhook_secret) {
      console.warn(`[Webhook] Credentials or webhook secret not configured for user: ${orderData.user_id}`);
      return NextResponse.json({ error: 'Unauthorized: Credentials not configured' }, { status: 401 });
    }

    const webhookSecret = decryptSecret(credsData.encrypted_webhook_secret);
    if (!webhookSecret) {
      console.warn(`[Webhook] Webhook secret decryption returned empty string.`);
      return NextResponse.json({ error: 'Unauthorized: Invalid credentials configuration' }, { status: 401 });
    }

    // 4. Secure HMAC-SHA256 signature verification concatenated with timestamp: timestamp + "." + rawBody
    const computedPayload = `${timestampHeader}.${rawBody}`;
    const computedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(computedPayload)
      .digest('hex');

    // Timing-safe signature comparison using SHA-256 hashes of the signatures
    const computedHash = crypto.createHash('sha256').update(computedSignature).digest();
    const receivedHash = crypto.createHash('sha256').update(signature).digest();

    if (!crypto.timingSafeEqual(computedHash, receivedHash)) {
      console.warn('[Webhook] Timing-safe signature verification failed.');
      return NextResponse.json({ error: 'Unauthorized: Invalid signature' }, { status: 401 });
    }

    // 5. Replay Attack Protection with Redis Outage Graceful Handling
    if (!redis || redis.status !== 'ready') {
      console.error('[Webhook] Redis connection is not ready. Failing closed.');
      return NextResponse.json(
        { error: 'Service Unavailable: Redis offline' },
        { status: 503, headers: { 'Retry-After': '60' } }
      );
    }

    let redisSetResult;
    try {
      const redisKey = `webhook:execution:${execution_id}`;
      redisSetResult = await redis.set(redisKey, 'processed', 'EX', 600, 'NX');
    } catch (redisErr: any) {
      console.error('[Webhook] Redis deduplication command failed:', redisErr.message);
      return NextResponse.json(
        { error: 'Service Unavailable: Redis operation failed' },
        { status: 503, headers: { 'Retry-After': '60' } }
      );
    }

    // Deduplication check: if key already exists, return 202 Accepted to absorb broker retry
    if (redisSetResult !== 'OK') {
      console.warn(`[Webhook] Duplicate execution event detected: ${execution_id}. Discarding event.`);
      return NextResponse.json({ success: true, message: 'Event already processed' }, { status: 202 });
    }

    // 6. Enqueue to BullMQ
    const jobName = `event-${execution_id}`;
    await brokerEventsQueue.add(jobName, {
      event: {
        execution_id,
        client_order_id,
        broker_order_id,
        event_type,
        sequence_number,
        filled_qty: Number(filled_qty) || 0,
        execution_price: Number(execution_price) || 0,
        raw_payload: raw_payload || {},
      }
    });

    console.log(`[Webhook] Successfully enqueued event ${execution_id} for order ${client_order_id}`);
    
    return NextResponse.json({ success: true, message: 'Event accepted' }, { status: 202 });
  } catch (err: any) {
    console.error('[Webhook] Failed to process webhook:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

