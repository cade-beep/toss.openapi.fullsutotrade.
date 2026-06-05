import { createClient } from '@supabase/supabase-js';
import { PaperTradingService } from './paper-trading-service';
import * as fs from 'fs';
import * as path from 'path';

try {
  const envPath = path.resolve(__dirname, '../../.env.local');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    for (const line of envConfig.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.length > 0 && value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    }
  }
} catch (e) {
  // Ignore
}


async function verify() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const testUserId = process.env.TEST_USER_ID || 'your-test-user-id'; // Set this to a valid UUID

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    return;
  }

  // Create a service client or authenticated client depending on environment
  // We'll mock the auth.getUser() by overriding the method for testing if using ANON key without session.
  // In a real environment, you'd use a service_role key to bypass RLS, or authenticate via email/password.
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('--- Phase 2 Paper Trading Engine Verification ---');

  // Override auth.getUser just for the local test script to inject a test user ID.
  supabase.auth.getUser = async () => ({
    data: { user: { id: testUserId } as any },
    error: null
  });

  const paperService = new PaperTradingService(supabase);

  console.log('\n1. Fetching Initial Balances...');
  const initialBalance = await paperService.getAccountBalance();
  console.log(initialBalance);

  console.log('\n2. Submitting BUY Order (Simulated 50-200ms fill)...');
  const response = await paperService.placeOrder({
    symbol: 'AAPL',
    side: 'BUY',
    type: 'MARKET',
    qty: 10,
    price: 150 // $1,500 total cost
  });

  if (!response.success) {
    console.error('Order failed:', response.error);
    return;
  }

  const cid = response.order!.id;
  console.log('Order Submitted:', cid);

  console.log('\n3. Waiting for asynchronous fill settlement (500ms)...');
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\n4. Verifying Order Status...');
  const order = await paperService.getOrder(cid);
  console.log(`Status: ${order?.status}, Filled Qty: ${order?.filled_qty}, Avg Fill: ${order?.avg_fill_price}`);

  if (order?.status === 'FILLED') {
    console.log('✅ Fill Simulation Successful!');
  } else {
    console.error('❌ Fill Simulation Failed or Delayed!');
  }

  console.log('\n5. Fetching New Balances...');
  const newBalance = await paperService.getAccountBalance();
  console.log(`Cash Balance: ${newBalance.cashBalance}`);
  if (newBalance.cashBalance < initialBalance.cashBalance) {
    console.log('✅ Ledger Settlement Successful (Balance Deducted)!');
  }

  console.log('\n6. Fetching Positions...');
  const positions = await paperService.getPositions();
  console.log(positions);

  console.log('\n--- Verification Complete ---');
}

// Run the script
// execute with: npx ts-node verify-phase2.ts
verify().catch(console.error);
