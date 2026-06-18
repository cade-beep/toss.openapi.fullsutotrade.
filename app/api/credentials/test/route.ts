import { NextRequest, NextResponse } from 'next/server';
import { tossTokenCache } from '@/services/trading/toss-token-cache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, secretKey, accountId } = body;

    if (!apiKey || !secretKey) {
      return NextResponse.json({ error: 'Validation Error: API Key and Secret Key are required.' }, { status: 400 });
    }

    if (apiKey.length < 10) {
      return NextResponse.json({ error: 'Validation Error: Invalid API Key length.' }, { status: 400 });
    }

    const tossApiUrl = process.env.TOSS_API_URL;
    if (!tossApiUrl) {
      return NextResponse.json({ error: 'ConfigurationError: TOSS_API_URL environment variable is not configured.' }, { status: 500 });
    }

    // 1. Get OAuth2 Token
    let accessToken = '';
    try {
      accessToken = await tossTokenCache.getToken(apiKey, secretKey);
    } catch (err: unknown) {
      return NextResponse.json({ error: `ConnectionError: OAuth2 token retrieval failed: ${(err as Error).message}` }, { status: 400 });
    }

    // 2. Discover Account Sequence if not provided
    let finalAccountId = accountId || '';
    if (!finalAccountId) {
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
        const brokerageAccount = accountsList.find((acc: { accountType: string; accountSeq?: string | number }) => acc.accountType === 'BROKERAGE');

        if (!brokerageAccount) {
          return NextResponse.json({ error: 'ConfigurationError: No brokerage account found during discovery.' }, { status: 404 });
        }

        const discoveredSeq = brokerageAccount.accountSeq;
        if (discoveredSeq === undefined || discoveredSeq === null) {
          return NextResponse.json({ error: 'ConfigurationError: Discovered brokerage account is missing accountSeq.' }, { status: 500 });
        }

        finalAccountId = String(discoveredSeq);
      } catch (err: unknown) {
        return NextResponse.json({ error: `ConnectionError: Automatic account discovery failed: ${(err as Error).message}` }, { status: 400 });
      }
    }

    // 3. Verify connection using `/api/v1/buying-power` (the actual buying power endpoint)
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'X-Tossinvest-Account': finalAccountId
    };

    const res = await fetch(`${tossApiUrl}/api/v1/buying-power?currency=KRW`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      let errMsg = '';
      if (errorData.error) {
        if (typeof errorData.error === 'object') {
          errMsg = errorData.error.message || JSON.stringify(errorData.error);
        } else {
          errMsg = String(errorData.error);
        }
      } else if (errorData.message) {
        errMsg = String(errorData.message);
      } else {
        errMsg = `Broker returned HTTP ${res.status}`;
      }
      return NextResponse.json({ error: `ConnectionError: ${errMsg}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Connection Verified successfully!',
      accountId: finalAccountId
    }, { status: 200 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `ConnectionError: Failed to reach broker API: ${errorMsg}` }, { status: 400 });
  }
}
