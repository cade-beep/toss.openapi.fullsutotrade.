# Implementation Roadmap v1

This document outlines the final, sequenced implementation roadmap for the Toss Automated Trading Workstation v2. It synthesizes all approved architecture designs—including the Infrastructure & Concurrency Remediation Plan—into a structured delivery plan.

The focus is exclusively on implementation sequencing, dependencies, and risk management. No architectural redesigns occur within this roadmap.

---

## Phase 1 - Core Data Layer

**Objectives:** Resolve database locking bottlenecks by establishing the Append-Only Ledger model and securely storing credentials.
*   **Deliverables:**
    *   Create `portfolio_ledger` and `position_ledger` tables.
    *   Refactor the `execute_trade` RPC to append ledger entries instead of updating mutable rows.
    *   Create PostgreSQL Materialized Views for rolling up balances.
    *   Configure `pg_sodium` for secure credential storage.
*   **Dependencies:** Supabase environment initialized.
*   **Risks:** Materialized view refresh latency under high insert volume.
*   **Estimated Complexity:** Medium

---

## Phase 2 - Paper Trading Engine

**Objectives:** Establish the foundational trading pipeline using simulated execution, validating the exact same ingestion architecture as live mode.
*   **Deliverables:**
    *   `TradingService` interface definitions.
    *   `PaperTradingService` mock adapter.
    *   Synchronous fill simulation (pre-queue).
*   **Dependencies:** Phase 1 (Core Data Layer).
*   **Risks:** Drifting from the asynchronous queue architecture designed for Live mode.
*   **Estimated Complexity:** Low

---

## Phase 3 - Market Data Layer

**Objectives:** Provide reliable, real-time pricing to the UI, Risk Engine, and future Strategy Workers.
*   **Deliverables:**
    *   `MarketDataProvider` abstraction.
    *   WebSocket integration (initially mocked or standard crypto stream, later Toss).
    *   Throttled UI fan-out (1Hz) using Supabase Realtime or Next.js SSE.
*   **Dependencies:** None (can be developed in parallel).
*   **Risks:** Supabase Realtime connection limit throttling.
*   **Estimated Complexity:** Medium

---

## Phase 4 - Risk Engine

**Objectives:** Implement pre-trade validation to prevent catastrophic drawdowns or invalid orders.
*   **Deliverables:**
    *   Risk Engine middleware layer.
    *   Idempotency enforcement via `client_order_id`.
    *   Validation checks (Max Drawdown, Position Limits, Sufficient Funds).
*   **Dependencies:** Phase 1 (Balances) and Phase 3 (Market Prices).
*   **Risks:** Added latency during high-velocity trading environments.
*   **Estimated Complexity:** High

---

## Phase 5 - Strategy Workers

**Objectives:** Deploy the execution environment for AI agents outside of the Vercel serverless boundary.
*   **Deliverables:**
    *   Provision Redis (Upstash) and a dedicated long-running worker container (Render/Railway).
    *   Setup BullMQ cluster for job orchestration.
    *   Implement the Strategy Worker lifecycle (Start, Stop, AI Loop, Push Intent to Risk Engine).
*   **Dependencies:** Phase 4 (Risk Engine).
*   **Risks:** Distributed system complexity; Redis connection instability.
*   **Estimated Complexity:** High

---

## Phase 6 - Broker Mapping

**Objectives:** Implement the asynchronous execution reconciliation pipeline.
*   **Deliverables:**
    *   Fast Next.js `/api/webhooks/toss` endpoint to dump events into Redis.
    *   BullMQ Reconciler Queue worker.
    *   Pipeline connecting the BullMQ worker to the `execute_trade` ledger RPC.
*   **Dependencies:** Phase 1 (Ledger RPC) and Phase 5 (BullMQ Infrastructure).
*   **Risks:** Database bloat from execution events; handling of out-of-order webhook delivery.
*   **Estimated Complexity:** High

---

## Phase 7 - Toss Adapter

**Objectives:** Finalize the live market execution integration.
*   **Deliverables:**
    *   `TossTradingService` implementation mapping to Toss enums.
    *   Supabase Edge Function (Toss Proxy) to securely decrypt `pg_sodium` keys and sign HTTP requests.
    *   Toss-specific opossum Circuit Breaker and rate limiting.
*   **Dependencies:** Phase 6 (Broker Mapping) and Phase 1 (`pg_sodium` setup).
*   **Risks:** Undocumented Toss Open API behaviors; strict rate limit bans.
*   **Estimated Complexity:** Very High

---

## Beta Release Criteria

To graduate the workstation to a Beta release (Paper Trading Focus), the following criteria must be met:
1.  **Durable Simulation:** Paper trading operates continuously for >7 days with zero database drift between simulated Toss balances and local ledgers.
2.  **Worker Stability:** BullMQ Strategy Workers successfully recover from simulated Redis crashes without dropping jobs.
3.  **Performance:** The Reconciler Queue processes incoming webhook events into the `execute_trade` RPC in under 100ms.
4.  **Testing:** 100% unit test coverage on the Risk Engine and `execute_trade` RPC logic.

---

## Production Release Criteria

To graduate the workstation to Production (Live Toss Capital Focus), the following criteria must be met:
1.  **Security Audit:** The Supabase Edge Function securely proxies Toss keys without exposing them to Next.js or Worker runtimes, verified via code audit.
2.  **Concurrency Validation:** Load testing demonstrates zero Supabase `FOR UPDATE` lock contention errors under simulated 1,000 TPS volume due to the ledger architecture.
3.  **Latency SLA:** End-to-end latency from Strategy Signal -> Risk Engine -> Toss Proxy -> Live Toss -> Webhook Ingestion -> DB Ledger Settlement is < 500ms.
4.  **Live Connectivity:** Successful execution, cancellation, and partial fill resolution using a live Toss Developer API key (using real but minimal capital).
