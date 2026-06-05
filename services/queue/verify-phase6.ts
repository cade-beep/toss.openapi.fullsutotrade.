import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Mock database execution for testing offline environments
class MockDbEngine {
  public orders = new Map<string, any>();
  public executionEvents = new Set<string>();

  constructor() {
    // Seed initial state
    this.orders.set('ORD-TEST-100', {
      client_order_id: 'ORD-TEST-100',
      status: 'PENDING',
      qty: 10,
      filled_qty: 0,
      avg_fill_price: 0,
      last_sequence_number: 0
    });
  }

  // Simulates execute_trade_v2 RPC logic
  public executeTradeV2Mock(params: {
    execution_id: string;
    client_order_id: string;
    event_type: string;
    fill_qty: number;
    fill_price: number;
    sequence_number: number;
    raw_payload: any;
  }) {
    const order = this.orders.get(params.client_order_id);
    if (!order) {
      throw new Error('Order not found.');
    }

    // 1. Sequence check
    if (params.sequence_number <= order.last_sequence_number) {
      return { success: true, message: 'Stale event discarded.', sequence_number: params.sequence_number };
    }

    // 2. Terminal state guard
    if (['FILLED', 'CANCELLED', 'REJECTED'].includes(order.status)) {
      throw new Error(`Cannot update order in terminal state: ${order.status}`);
    }

    // 3. Idempotency Check
    if (this.executionEvents.has(params.execution_id)) {
      return { success: true, message: 'Execution already processed.', execution_id: params.execution_id };
    }

    // 4. Branching logic
    if (params.event_type === 'ACK') {
      order.status = 'SUBMITTED';
    } else if (params.event_type === 'CANCEL') {
      order.status = 'CANCELLED';
    } else if (params.event_type === 'REJECT') {
      order.status = 'REJECTED';
    } else if (['PARTIAL_FILL', 'FULL_FILL'].includes(params.event_type)) {
      const totalCost = params.fill_qty * params.fill_price;
      const oldFilled = order.filled_qty;
      const oldAvg = order.avg_fill_price;

      order.filled_qty = oldFilled + params.fill_qty;
      order.avg_fill_price = Math.round((oldFilled * oldAvg + totalCost) / order.filled_qty);
      order.status = order.filled_qty >= order.qty ? 'FILLED' : 'PARTIALLY_FILLED';
    }

    order.last_sequence_number = params.sequence_number;
    this.executionEvents.add(params.execution_id);
    this.orders.set(params.client_order_id, order);

    return { success: true, client_order_id: params.client_order_id };
  }
}

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING RECONCILER 6 RULES VERIFY");
  console.log("=========================================");

  const mock = new MockDbEngine();

  // Test 1: Monotonic sequence check (Stale event discard)
  {
    // Seed sequence number to 10
    mock.executeTradeV2Mock({
      execution_id: 'EXEC-1',
      client_order_id: 'ORD-TEST-100',
      event_type: 'ACK',
      fill_qty: 0,
      fill_price: 0,
      sequence_number: 10,
      raw_payload: {}
    });

    // Send stale sequence 9
    const res = mock.executeTradeV2Mock({
      execution_id: 'EXEC-2',
      client_order_id: 'ORD-TEST-100',
      event_type: 'PARTIAL_FILL',
      fill_qty: 3,
      fill_price: 150000,
      sequence_number: 9,
      raw_payload: {}
    });

    console.log("Test 1 (Stale Sequence Discard):", 
      res.success && res.message === 'Stale event discarded.' ? "✅ PASS" : "❌ FAIL"
    );
  }

  // Test 2: Terminal state guard
  {
    // Send full fill at sequence 15
    mock.executeTradeV2Mock({
      execution_id: 'EXEC-3',
      client_order_id: 'ORD-TEST-100',
      event_type: 'FULL_FILL',
      fill_qty: 10,
      fill_price: 150000,
      sequence_number: 15,
      raw_payload: {}
    });

    const order = mock.orders.get('ORD-TEST-100');
    let threw = false;
    try {
      // Send a new fill event after order is FILLED (sequence 16)
      mock.executeTradeV2Mock({
        execution_id: 'EXEC-4',
        client_order_id: 'ORD-TEST-100',
        event_type: 'PARTIAL_FILL',
        fill_qty: 1,
        fill_price: 150000,
        sequence_number: 16,
        raw_payload: {}
      });
    } catch (err) {
      threw = true;
    }

    console.log("Test 2 (Terminal State Guard):", 
      threw && order.status === 'FILLED' ? "✅ PASS" : "❌ FAIL"
    );
  }

  // Test 3: Non-fill event branching (ACK, CANCEL, REJECT)
  {
    const orderId = 'ORD-TEST-200';
    mock.orders.set(orderId, {
      client_order_id: orderId,
      status: 'PENDING',
      qty: 10,
      filled_qty: 0,
      avg_fill_price: 0,
      last_sequence_number: 0
    });

    // Test CANCEL branching
    mock.executeTradeV2Mock({
      execution_id: 'EXEC-CANCEL-1',
      client_order_id: orderId,
      event_type: 'CANCEL',
      fill_qty: 0,
      fill_price: 0,
      sequence_number: 5,
      raw_payload: {}
    });

    const order = mock.orders.get(orderId);
    console.log("Test 3 (Non-Fill CANCEL Branching):", 
      order.status === 'CANCELLED' && order.last_sequence_number === 5 ? "✅ PASS" : "❌ FAIL"
    );
  }

  // Test 4: Idempotency (Duplicate execution_id prevention)
  {
    const orderId = 'ORD-TEST-300';
    mock.orders.set(orderId, {
      client_order_id: orderId,
      status: 'PENDING',
      qty: 10,
      filled_qty: 0,
      avg_fill_price: 0,
      last_sequence_number: 0
    });

    // First execution
    mock.executeTradeV2Mock({
      execution_id: 'EXEC-DUP-999',
      client_order_id: orderId,
      event_type: 'ACK',
      fill_qty: 0,
      fill_price: 0,
      sequence_number: 1,
      raw_payload: {}
    });

    // Second execution with same ID
    const res = mock.executeTradeV2Mock({
      execution_id: 'EXEC-DUP-999',
      client_order_id: orderId,
      event_type: 'PARTIAL_FILL',
      fill_qty: 5,
      fill_price: 150000,
      sequence_number: 2,
      raw_payload: {}
    });

    console.log("Test 4 (Idempotent Execution Prevention):", 
      res.success && res.message === 'Execution already processed.' ? "✅ PASS" : "❌ FAIL"
    );
  }
}

runTests().catch(console.error);
