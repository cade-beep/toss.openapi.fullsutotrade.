import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptSecret } from '../toss-proxy/route';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: authData, error } = await supabase.auth.getUser(token);

  if (error || !authData.user) {
    return null;
  }

  return authData.user;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: creds, error } = await supabase
      .from('api_credentials')
      .select('account_id, is_simulation')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!creds) {
      return NextResponse.json({ exists: false }, { status: 200 });
    }

    return NextResponse.json({
      exists: true,
      accountId: creds.account_id || '',
      isSimulation: creds.is_simulation
    }, { status: 200 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { apiKey, secretKey, accountId } = body;

    if (!apiKey || !secretKey || !accountId) {
      return NextResponse.json({ error: 'Validation Error: API Key, Secret Key, and Account ID are all required.' }, { status: 400 });
    }

    const encryptedApiKey = encryptSecret(apiKey);
    const encryptedSecretKey = encryptSecret(secretKey);

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase
      .from('api_credentials')
      .upsert({
        user_id: user.id,
        encrypted_api_key: encryptedApiKey,
        encrypted_secret_key: encryptedSecretKey,
        account_id: accountId,
        is_simulation: false,
        updated_at: new Date().toISOString()
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase
      .from('api_credentials')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
