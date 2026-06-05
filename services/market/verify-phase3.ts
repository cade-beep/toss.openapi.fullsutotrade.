import { createClient } from '@supabase/supabase-js';
import { PaperTradingService } from '../trading/paper-trading-service';
import { RiskEngine } from '../risk/risk-engine';
import { MockMarketDataProvider } from './mock-market-data-provider';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const testEmail = process.env.TEST_USER_EMAIL;
const testPassword = process.env.TEST_USER_PASSWORD;

if (!supabaseUrl || !supabaseKey || !testEmail || !testPassword) {
  console.error("Missing required environment variables in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runPhase3Verification() {
  console.log("== Starting Phase 3 Market Data Verification ==");

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testEmail!,
    password: testPassword!
  });

  if (authError || !authData.user) {
    console.error("Auth failed:", authError?.message);
    process.exit(1);
  }

  console.log(`Authenticated as user: ${authData.user.id}`);

  // Instantiate the mock market data provider
  const marketData = new MockMarketDataProvider({
    'AAPL': 150000,
    'TSLA': 200000
  });

  const riskEngine = new RiskEngine(supabase);
  const tradingService = new PaperTradingService(supabase, riskEngine, marketData);

  console.log("\n[1] Submitting a MARKET Order without a price...");
  
  const orderRes = await tradingService.placeOrder({
    symbol: 'AAPL',
    side: 'BUY',
    type: 'MARKET',
    qty: 1
  });

  if (!orderRes.success || !orderRes.order) {
    console.error("Failed to place market order:", orderRes.error);
    process.exit(1);
  }

  console.log("Order submitted successfully:", orderRes.order.id);
  console.log("Captured Intent Price:", orderRes.order.price);

  // Wait for simulation to finish processing in DB
  await new Promise(resolve => setTimeout(resolve, 500));

  const dbOrder = await tradingService.getOrder(orderRes.order.id);
  console.log("DB Fill Status:", dbOrder?.status);
  console.log("DB Average Fill Price:", dbOrder?.avg_fill_price);

  console.log("\n[2] Checking Mark-to-Market Dynamic Valuation...");

  for (let i = 1; i <= 3; i++) {
    const balance = await tradingService.getAccountBalance();
    console.log(`\n--- Tick ${i} ---`);
    console.log(`Cash Balance: ${balance.cashBalance}`);
    console.log(`Total Portfolio Value: ${balance.totalPortfolioValue}`);
    console.log(`Unrealized PnL: ${balance.unrealizedPnL}`);
    
    // Fetch positions
    const positions = await tradingService.getPositions();
    const aaplPos = positions.find(p => p.symbol === 'AAPL');
    if (aaplPos) {
      console.log(`AAPL Current Price: ${aaplPos.currentPrice} (Avg Buy: ${aaplPos.avgBuyPrice})`);
    }

    await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s for random walk to tick
  }

  console.log("\nVerification Complete.");
}

runPhase3Verification().catch(console.error);
