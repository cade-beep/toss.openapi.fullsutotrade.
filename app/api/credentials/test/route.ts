import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, secretKey, accountId } = body;

    if (!apiKey || !secretKey || !accountId) {
      return NextResponse.json({ error: 'Validation Error: API Key, Secret Key, and Account ID are all required.' }, { status: 400 });
    }

    if (apiKey.length < 10) {
      return NextResponse.json({ error: 'Validation Error: Invalid API Key length.' }, { status: 400 });
    }

    const tossApiUrl = process.env.TOSS_API_URL;
    if (!tossApiUrl) {
      return NextResponse.json({ error: 'ConfigurationError: TOSS_API_URL environment variable is not configured.' }, { status: 500 });
    }

    // Live connection test via Toss API Balance endpoint
    const timestamp = Date.now().toString();
    const rawPayloadString = '';
    const message = `GET/v1/account/balance${timestamp}${rawPayloadString}`;
    const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'X-TOSS-API-KEY': apiKey,
      'X-TOSS-SIGNATURE': signature,
      'X-TOSS-TIMESTAMP': timestamp,
    };

    const res = await fetch(`${tossApiUrl}/v1/account/balance`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json({ error: `ConnectionError: ${errorData.error || `Broker returned HTTP ${res.status}`}` }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `ConnectionError: Failed to reach broker API: ${errorMsg}` }, { status: 400 });
  }
}
