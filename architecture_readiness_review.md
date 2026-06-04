# Architecture Readiness Review

This document provides a comprehensive, highly critical architecture readiness review of the Toss Automated Trading Workstation v2. The review encompasses all proposed architecture documents, including the TradingService, PaperTradingService, Risk Engine, MarketDataProvider, Strategy Worker, Broker Order Mapping, and Toss Adapter Skeleton.

The primary objective is to expose hidden risks, identify cross-document contradictions, and evaluate production readiness before any implementation begins.

---

## 1. Critical Findings

*   **C1: Supabase Locking Bottleneck on High-Frequency Trades**
    *   **Risk:** The Broker Order Mapping architecture mandates `FOR UPDATE` locking in the order of `Portfolio -> Position -> Order` within the `execute_trade_v2` RPC. While this prevents deadlocks and race conditions, locking the `Portfolio` table for *every* execution event creates a massive serialization bottleneck. If multiple strategy workers fire concurrently across multiple positions, they will all contend for the same single Portfolio row lock.
    *   **Impact:** Deadlocks are avoided, but throughput is hard-capped. System will exhibit high latency and potential timeouts under load.
*   **C2: Missing Strategy Worker Orchestration & Lifecycle**
    *   **Risk:** The "Strategy Worker Architecture" states workers produce order intents, but no document specifies *where* or *how* these workers run (e.g., Vercel background functions, long-running Node.js daemon, AWS ECS, Inngest). If they are serverless, standard Next.js API routes will timeout after 10-60 seconds, killing active strategies.
    *   **Impact:** Core AI strategy generation cannot function in a standard serverless environment without a defined orchestration layer.
*   **C3: Supabase Decryption Architecture Contradiction**
    *   **Risk:** The Toss Adapter architecture specifies using `pg_sodium` for credential storage, but states "The Node.js server retrieves and decrypts the credentials in memory". `pg_sodium` encrypts and decrypts *inside* the PostgreSQL database instance. Extracting the raw key to decrypt in Node.js contradicts `pg_sodium`'s design.
    *   **Impact:** Security vulnerability or impossible implementation.

---

## 2. High Findings

*   **H1: Polling vs. WebSocket Reconciliation Gap**
    *   **Risk:** The Toss Adapter relies on WebSockets for execution reports. If the WS drops, the architecture suggests an "End-of-Day (EOD)" true-up. In live trading, flying blind until EOD is unacceptable. A real-time REST polling fallback must instantly engage the moment the WS connection drops.
*   **H2: Distributed Rate Limiting Requirements**
    *   **Risk:** The Toss Adapter specifies a Token Bucket for rate limiting "in-memory for MVP". If the application is deployed to Vercel (which spins up multiple isolated Edge/Serverless instances), an in-memory bucket is useless. Rate limits will be exceeded instantly.
*   **H3: Paper Mode vs. Live Mode State Divergence**
    *   **Risk:** Paper Mode simulates fills synchronously or via a simple timeout, whereas Live Mode pushes fills into a `broker_execution_events` table and a Reconciler Queue. This divergence means Paper Mode does not actually test the asynchronous queue processor, defeating the purpose of Paper Mode as a pre-live safety net.

---

## 3. Medium Findings

*   **M1: Missing Idempotency Key in Risk Engine**
    *   **Risk:** The Risk Engine sits before the `TradingService`. If the Risk Engine approves a trade, but the `TradingService` network request times out, the Strategy Worker might retry. Without a deterministic `client_order_id` generated *by the Strategy Worker* and passed through the Risk Engine, the retry will be evaluated as a brand-new order.
*   **M2: MarketDataProvider Fan-Out Architecture**
    *   **Risk:** Routing Toss Market Data WebSockets through the Next.js server to fan out to clients via SSE is notoriously difficult to scale on serverless platforms (Vercel has connection limits and limits SSE duration).
*   **M3: Replay Attack / Event Duplication**
    *   **Risk:** If Toss delivers the same Webhook execution event twice, the system relies on the Reconciler Queue. The Broker Order Mapping needs a strict `UNIQUE` constraint on `(broker_order_id, execution_id, execution_status)` to bounce duplicate events at the database level.

---

## 4. Low Findings

*   **L1: Enum Translation Maintenance**
    *   **Risk:** Hardcoding Toss enum values (e.g., `01` for market) inside the adapter makes it brittle to API changes.
*   **L2: Supabase Realtime Quotas**
    *   **Risk:** Heavy reliance on Supabase Realtime for UI updates regarding positions and orders might hit concurrent connection limits on lower Supabase pricing tiers.
*   **L3: UI Error Propagation**
    *   **Risk:** How Toss-specific errors (e.g., `MarketClosedError`) bubble up from the `execute_trade` RPC back to the user's UI is not deeply specified.

---

## 5. Missing Architecture Components

1.  **Job Orchestrator Architecture:** A dedicated document defining how Strategy Workers are scheduled, executed, monitored, and scaled (e.g., BullMQ, Temporal, Inngest, or a dedicated container).
2.  **Telemetry & Audit Architecture:** How are we tracking the latency between a Strategy Signal -> Risk Engine -> Toss Adapter -> Fill? We need a centralized logging/tracing system (e.g., Datadog, Grafana) distinct from Supabase transactional tables.
3.  **Vault / Secrets Management Flow:** Explicit architectural flow for how API keys are encrypted at rest, transmitted, and injected into the execution context securely.

---

## 6. Recommended Design Corrections

1.  **Refactor Settlement RPC:** Modify `execute_trade_v2` to batch portfolio updates, or use an append-only ledger for the portfolio balance (calculating current balance via SUM) to remove the `Portfolio` row-lock bottleneck during high-throughput execution phases.
2.  **Unified Async Pipeline:** Force `PaperTradingService` to use the exact same Reconciler Queue and `broker_execution_events` ingestion pipeline as the `TossTradingService`. Paper mode should mock the *network*, not the *internal system architecture*.
3.  **Dedicated Poller Fallback:** Add a `StateReconciliationWorker` that routinely polls Toss `/orders/active` every 5-10 seconds to detect any state drift not captured by WebSockets.
4.  **Redis-Backed Rate Limiting:** Mandate Redis (e.g., Upstash) for the Token Bucket rate limiter from Day 1. Do not use in-memory rate limiting.

---

## 7. Implementation Readiness Score

**Score: 65 / 100**

**Justification:** The domain abstractions (`TradingService`, Broker Mapping) are excellent and enforce correct logical boundaries. However, the operational execution (how workers run, how locks scale, how rate limits are shared across instances) contains critical flaws that will cause immediate failures upon implementation.

---

## 8. Production Readiness Score

**Score: 40 / 100**

**Justification:** While the logical safety nets (Risk Engine, Idempotency) are well thought out, a production trading system cannot operate with an ambiguous Strategy Worker lifecycle, severe DB locking bottlenecks, and an undefined credential decryption flow.

---

## 9. Recommended Next Milestone

**STOP IMPLEMENTATION.**

Before writing code, execute the following milestone:
**Milestone: Infrastructure & Concurrency Remediation**

1.  Define the **Strategy Worker Orchestration Architecture** (Decide on serverless vs. long-running containers).
2.  Redesign the **Secrets Management Architecture** to resolve the `pg_sodium` vs. Node.js decryption contradiction.
3.  Design the **Ledger-Based Portfolio Settlement Architecture** to replace the row-locking bottleneck.
