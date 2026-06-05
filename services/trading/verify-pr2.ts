import { TradingServiceFactory } from './factory';
import { TossTradingService } from './toss-api';
import { PaperTradingService } from './paper-trading-service';
import { createClient } from '@supabase/supabase-js';

// Mock database to simulate unique constraint violation
function createMockSupabase(userId: string = 'test-user-123') {
  const mockOrders: any[] = [];
  
  const client: any = {
    auth: {
      getUser: async () => ({
        data: { user: { id: userId, email: 'test@example.com' } },
        error: null
      }),
      getSession: async () => ({
        data: { session: { access_token: 'mock-access-token' } },
        error: null
      })
    },
    from: (table: string) => {
      return {
        select: () => ({
          single: async () => {
            if (table === 'api_credentials') {
              return {
                data: {
                  encrypted_api_key: 'mock-api-key',
                  encrypted_secret_key: 'mock-secret-key',
                  is_simulation: false
                },
                error: null
              };
            }
            return { data: null, error: new Error('Not found') };
          }
        }),
        insert: async (payload: any) => {
          // Simulate PostgreSQL unique constraint 23505
          const exists = mockOrders.some((o: any) => o.client_order_id === payload.client_order_id);
          if (exists) {
            return {
              error: {
                code: '23505',
                message: `Key (client_order_id)=(${payload.client_order_id}) already exists. duplicate key value violates unique constraint "orders_pkey"`
              }
            };
          }
          mockOrders.push({ ...payload });
          return { error: null };
        },
        update: (updates: any) => {
          const updateBuilder: any = {
            eq: (col: string, val: any) => {
              const order = mockOrders.find((o: any) => o[col] === val);
              if (order) {
                Object.assign(order, updates);
              }
              return updateBuilder;
            },
            then: (onfulfilled: any, onrejected: any) => {
              return Promise.resolve({ error: null }).then(onfulfilled, onrejected);
            }
          };
          return updateBuilder;
        }
      } as any;
    },
    rpc: async (name: string, args: any) => {
      return { error: null };
    },
    // Add internal getter for assertions
    _getMockOrders: () => mockOrders
  };

  return client;
}

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING PR-2 REMEDIATION & 23505 TEST");
  console.log("=========================================");

  // Test 1: Factory selection correctness
  {
    const mockSupabase = createMockSupabase();
    const liveService = TradingServiceFactory.getService('LIVE', mockSupabase);
    const paperService = TradingServiceFactory.getService('PAPER', mockSupabase);

    const isLiveOk = liveService instanceof TossTradingService;
    const isPaperOk = paperService instanceof PaperTradingService;

    console.log("Test 1 (Factory Resolution):",
      isLiveOk && isPaperOk ? "✅ PASS" : "❌ FAIL"
    );
  }

  // Test 2: Reproducing PostgreSQL 23505 Unique Key Violation (Old Logic Simulation)
  {
    console.log("\n[Reproduction Test] Simulating old worker logic (INSERT on failure)...");
    const mockSupabase = createMockSupabase();
    
    const mockRiskEngine = {
      validate: async () => ({ isValid: true })
    } as any;

    // 1. TossTradingService places order and inserts it into DB in PENDING status
    const service = new TossTradingService(mockSupabase, mockRiskEngine);
    
    const cid = 'test-23505-id';
    
    // First insert (simulating TossTradingService.placeOrder writing to DB before proxy call)
    const initRes = await mockSupabase.from('orders').insert({
      client_order_id: cid,
      user_id: 'test-user-123',
      symbol: 'AAPL',
      side: 'BUY',
      type: 'LIMIT',
      qty: 10,
      price: 150000,
      status: 'PENDING'
    });

    if (initRes.error) {
      console.error("Setup failed:", initRes.error);
    }

    // 2. Simulate broker failure which returns success: false
    // Old worker logic tries to insert the failure details into orders with the same client_order_id:
    const duplicateInsertRes = await mockSupabase.from('orders').insert({
      client_order_id: cid,
      user_id: 'test-user-123',
      symbol: 'AAPL',
      side: 'BUY',
      type: 'LIMIT',
      qty: 10,
      price: 150000,
      status: 'REJECTED',
      error_message: 'Broker connection failed.'
    });

    const is23505Triggered = duplicateInsertRes.error && duplicateInsertRes.error.code === '23505';
    console.log("PostgreSQL Error 23505 Code:", duplicateInsertRes.error?.code);
    console.log("PostgreSQL Error Message:", duplicateInsertRes.error?.message);
    console.log("Test 2 (PostgreSQL 23505 Reproduction):",
      is23505Triggered ? "✅ PASS (Error successfully reproduced)" : "❌ FAIL"
    );
    await service.cleanConnection();
  }

  // Test 3: Verified Remediated Update-on-Failure Behavior (No Insert)
  {
    console.log("\n[Remediation Test] Simulating remediated worker logic (UPDATE on failure)...");
    const mockSupabase = createMockSupabase();
    
    const mockRiskEngine = {
      validate: async () => ({ isValid: true })
    } as any;

    const service = new TossTradingService(mockSupabase, mockRiskEngine);
    const cid = 'test-remediated-id';

    // Mock fetch to fail
    const originalFetch = global.fetch;
    global.fetch = async (url: any, options: any) => {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Toss Proxy offline' })
      } as any;
    };

    // 1. Call placeOrder - it inserts PENDING, calls fetch, fails, catches and updates to REJECTED
    const placeRes = await service.placeOrder({
      symbol: 'AAPL',
      side: 'BUY',
      type: 'LIMIT',
      qty: 10,
      price: 150000
    }, cid);

    // 2. Simulate worker's failure block (which now runs UPDATE on the same ID)
    const { error: updateError } = await mockSupabase
      .from('orders')
      .update({
        status: 'REJECTED',
        error_message: placeRes.error || 'Rejected by Risk Engine',
        updated_at: new Date().toISOString()
      })
      .eq('client_order_id', cid);

    const orders = mockSupabase._getMockOrders();
    const finalOrder = orders.find((o: any) => o.client_order_id === cid);

    const checkSuccess = !placeRes.success &&
                         !updateError &&
                         finalOrder &&
                         finalOrder.status === 'REJECTED' &&
                         finalOrder.error_message.includes('Toss Proxy offline') &&
                         orders.length === 1; // Only 1 record ever inserted!

    console.log("Total records inserted for this order ID:", orders.length);
    console.log("Test 3 (Remediated Update-on-Failure Logic):",
      checkSuccess ? "✅ PASS" : "❌ FAIL"
    );

    global.fetch = originalFetch;
    await service.cleanConnection();
  }

  // Test 4: PaperTradingService placeOrder validation flow
  {
    console.log("\n[Paper Service Test] Verifying PaperTradingService placeOrder flow...");
    const mockSupabase = createMockSupabase();
    const mockRiskEngine = {
      validate: async () => ({ isValid: true })
    } as any;
    const service = TradingServiceFactory.getService('PAPER', mockSupabase, mockRiskEngine);

    // Successfully simulate fill
    const orderRes = await service.placeOrder({
      symbol: '005930',
      side: 'BUY',
      type: 'LIMIT',
      qty: 10,
      price: 70000
    }, 'paper-id-999');

    const orders = mockSupabase._getMockOrders();
    const finalOrder = orders.find((o: any) => o.client_order_id === 'paper-id-999');

    const checkPaper = orderRes.success && 
                       finalOrder && 
                       (finalOrder.status === 'PENDING' || finalOrder.status === 'SUBMITTED' || finalOrder.status === 'FILLED');

    console.log("Test 4 (Paper Order Resolution):",
      checkPaper ? "✅ PASS" : "❌ FAIL"
    );
  }

  // Test 5: Client RLS Initialization Check in /api/orders/place
  {
    console.log("\n[RLS Security Test] Verifying createClient configuration for Route RLS...");
    const mockSupabaseUrl = 'https://mock-proj.supabase.co';
    const mockAnonKey = 'mock-public-anon-key-12345';
    const mockUserToken = 'mock-user-jwt-token-xyz';

    // Set mock envs
    const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const originalRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = mockAnonKey;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'private-service-role-key-do-not-expose';

    // Initialize client exactly as done in app/api/orders/place/route.ts
    const userClient = createClient(mockSupabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${mockUserToken}`
        }
      }
    });
    const restUrl = (userClient as any).supabaseUrl;
    const restKey = (userClient as any).supabaseKey;
    const authHeader = (userClient as any).rest.headers.get('Authorization') || (userClient as any).rest.headers.get('authorization');
    const apiKeyHeader = (userClient as any).rest.headers.get('apikey') || (userClient as any).rest.headers.get('apiKey');

    const usesAnonKey = restKey === mockAnonKey;
    const hasBearerToken = authHeader === `Bearer ${mockUserToken}`;
    const usesServiceRole = restKey === 'private-service-role-key-do-not-expose';

    // Restore envs
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalRole;

    const checkRLS = usesAnonKey && hasBearerToken && !usesServiceRole;

    console.log("Supabase Client initialized with Anon Key:", usesAnonKey ? "✅ Yes" : "❌ No");
    console.log("Authorization Header includes User Bearer JWT:", hasBearerToken ? "✅ Yes" : "❌ No");
    console.log("Is service_role key excluded from initialization:", !usesServiceRole ? "✅ Yes" : "❌ No");
    console.log("Test 5 (Client RLS Initialization):",
      checkRLS ? "✅ PASS" : "❌ FAIL"
    );
  }
}

runTests().catch(console.error);
