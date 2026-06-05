import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TradingServiceFactory } from '../../../../services/trading/factory';
import { RiskEngine } from '../../../../services/risk/risk-engine';

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
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    // Initialize user-scoped database client using the public anon key and user JWT
    // to guarantee that all PostgREST operations enforce database-level Row Level Security (RLS)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication failed.' }, { status: 401 });
    }

    const user = authData.user;
    const body = await request.json();
    const { symbol, side, type, qty, price } = body;

    if (!symbol || !side || !type || !qty) {
      return NextResponse.json({ error: 'Invalid parameters: symbol, side, type, and qty are required.' }, { status: 400 });
    }

    // Stub auth getters to prevent redundant network calls in services while preserving context
    userClient.auth.getUser = async () => ({
      data: { user: { id: user.id } as any },
      error: null
    });
    userClient.auth.getSession = async () => ({
      data: { session: { access_token: token } as any },
      error: null
    });

    const mode = (process.env.NEXT_PUBLIC_TRADING_MODE || 'PAPER') as 'SIMULATION' | 'PAPER' | 'LIVE';
    console.log(`[UI Orders API] Placing manual order for user ${user.id} in mode ${mode}: ${side} ${qty} ${symbol}`);

    const riskEngine = new RiskEngine(userClient);
    const tradingService = TradingServiceFactory.getService(mode, userClient, riskEngine);

    const res = await tradingService.placeOrder({
      symbol,
      side,
      type,
      qty,
      price: price || 0
    });

    if (!res.success) {
      return NextResponse.json({ error: res.error || 'Order execution failed.' }, { status: 400 });
    }

    return NextResponse.json(res, { status: 200 });
  } catch (err: any) {
    console.error('[UI Orders API] Error placing order:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
