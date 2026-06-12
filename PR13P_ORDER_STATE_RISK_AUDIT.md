# PR13P Order State Risk Audit

This audit evaluates the lifecycle behavior, state transitions, and persistence impacts of order states in the Toss OpenAPI, using the official OpenAPI schema (v1.0.3) and runtime error logs.

---

## 1. Global Order Lifecycle Assessment

> [!CAUTION]
> **Runtime Transition Classification**:
> Because the workstation has only executed calls using dummy credentials (yielding `401 Unauthorized` errors), **every state transition** has never been observed in a real successful response and is classified as **Runtime Unknown**.

---

## 2. Order State Audit Register

### 2.1 PENDING
*   **Description**: Order successfully validated and submitted to the exchange; awaiting fills.
*   **Spec Evidence**: Declared in `OrderStatus` schema enum: `PENDING`.
*   **Runtime Evidence**: **NONE** (Never observed).
*   **Unknown Behavior**:
    - Average time spent in `PENDING` for limit orders before the first execution match is logged.
    - Whether the broker gateway issues intermediate sub-status keys (e.g., `ACCEPTED` vs `WAITING`).
*   **Reconciler Impact**: Reconciler keeps the order in the local state tree; does **not** close the order. Cash buying power remains locked.
*   **Ledger Impact**: Cash is locked in the portfolio (escrow/buying power deduction); no position modification or `orders_log` terminal write.
*   **Risk Level**: **LOW**

---

### 2.2 PENDING_CANCEL
*   **Description**: Client-side cancellation request received by the gateway; awaiting exchange approval.
*   **Spec Evidence**: Declared in `OrderStatus` schema enum: `PENDING_CANCEL`.
*   **Runtime Evidence**: **NONE** (Never observed).
*   **Unknown Behavior**:
    - Handling of race conditions where a cancel request is sent while a fill is concurrently executing at the exchange matching engine.
*   **Reconciler Impact**: Reconciler checks status at high frequency to detect terminal transition (`CANCELED` vs `CANCEL_REJECTED`).
*   **Ledger Impact**: Buying power lock remains active until terminal cancel confirmation is received.
*   **Risk Level**: **MEDIUM**

---

### 2.3 PENDING_REPLACE
*   **Description**: Request to modify price/quantity submitted; awaiting confirmation of modification.
*   **Spec Evidence**: Declared in `OrderStatus` schema enum: `PENDING_REPLACE`.
*   **Runtime Evidence**: **NONE** (Never observed).
*   **Unknown Behavior**:
    - Whether replaced orders retain the original `clientOrderId` or require a new mapping.
*   **Reconciler Impact**: Reconciler must track original and target order details simultaneously to prevent duplicate locks.
*   **Ledger Impact**: Adjusts the locked buying power cache dynamically based on new price/quantity boundaries.
*   **Risk Level**: **HIGH**

---

### 2.4 PARTIAL_FILLED
*   **Description**: Order partially matched; remaining portion remains active in the order book.
*   **Spec Evidence**: Declared in `OrderStatus` schema enum: `PARTIAL_FILLED`.
*   **Runtime Evidence**: **NONE** (Never observed).
*   **Unknown Behavior**:
    - Multi-fill increments: How standard fills update `filledQuantity` and `averageFilledPrice` sequentially (are they additive, or does `averageFilledPrice` update as a weighted average?).
*   **Reconciler Impact**: Reconciler must lock the user portfolio, incrementally settle filled shares, and adjust buying power locks for the remaining open quantity.
*   **Ledger Impact**: Incremental updates to `positions` (shares added) and `portfolio` cash balances, along with inserting partial transaction records into the database.
*   **Risk Level**: **HIGH**

---

### 2.5 FILLED
*   **Description**: Order fully matched. Terminal state.
*   **Spec Evidence**: Declared in `OrderStatus` schema enum: `FILLED`.
*   **Runtime Evidence**: **NONE** (Never observed).
*   **Unknown Behavior**:
    - Rounding limits: Verification of exact commission and tax decimal formatting on execution matches.
*   **Reconciler Impact**: Order marked completed. Local active state tracking is closed.
*   **Ledger Impact**: Final settlement update to `positions`, unlocks remaining escrow cash in `portfolio`, and writes a terminal execution entry in `orders_log`.
*   **Risk Level**: **LOW**

---

### 2.6 CANCELED
*   **Description**: Unfilled order quantity deactivated. Terminal state.
*   **Spec Evidence**: Declared in `OrderStatus` schema enum: `CANCELED`. Also covers daily expiration transitions at market close (`CLS` Time-In-Force).
*   **Runtime Evidence**: **NONE** (Never observed).
*   **Unknown Behavior**:
    - Whether expired orders present different code flags (e.g. `CANCELED` vs custom error reasons) upon query.
*   **Reconciler Impact**: Closes the order tracking tree. Releases locked buying power.
*   **Ledger Impact**: Unlocks and returns escrow cash to the portfolio's active buying power; no changes to positions.
*   **Risk Level**: **MEDIUM**

---

### 2.7 REJECTED
*   **Description**: Order rejected by risk validation, compliance, or the exchange. Terminal state.
*   **Spec Evidence**: Declared in `OrderStatus` schema enum: `REJECTED`.
*   **Runtime Evidence**: **NONE** (Never observed).
*   **Unknown Behavior**:
    - Reason payloads: Where the specific rejection codes (e.g. "insufficient buying power", "exceeded limits") are stored inside the `Order` detail response.
*   **Reconciler Impact**: Closes local order tracking and triggers alerts to strategy execution workers. Releases locked escrow cash.
*   **Ledger Impact**: Unlocks and returns locked cash to active buying power. No positions are updated.
*   **Risk Level**: **HIGH**

---

### 2.8 CANCEL_REJECTED / REPLACE_REJECTED
*   **Description**: Cancellation/Modification request rejected; order remains in its previous active state.
*   **Spec Evidence**: Declared in `OrderStatus` schema enum: `CANCEL_REJECTED`, `REPLACE_REJECTED`.
*   **Runtime Evidence**: **NONE** (Never observed).
*   **Unknown Behavior**:
    - Whether the rejection is accompanied by a state change back to `PENDING` or `PARTIAL_FILLED`, or must be inferred from error events.
*   **Reconciler Impact**: Reverts local tracking status of the order to its pre-cancel/pre-replace active state.
*   **Ledger Impact**: Re-establishes the original escrow locks and structures.
*   **Risk Level**: **MEDIUM**

---

### 2.9 REPLACED
*   **Description**: Order modification successfully processed. Terminal state for the parent order.
*   **Spec Evidence**: Declared in `OrderStatus` schema enum: `REPLACED`.
*   **Runtime Evidence**: **NONE** (Never observed).
*   **Unknown Behavior**:
    - Relation maps: Whether a new `orderId` is issued by the broker, requiring a parent-child state link in local databases.
*   **Reconciler Impact**: Spawns tracking for the new replaced child order ID, closing out tracking for the parent order ID.
*   **Ledger Impact**: Persists original details as superseded, transferring escrow bindings to the newly spawned order ID.
*   **Risk Level**: **HIGH**

---

## 3. Order Type Lifecycles

### 3.1 Market Orders (`orderType: "MARKET"`)
*   **Lifecycle**: Typically transitions directly from submission to `FILLED` or `REJECTED` (with no intermediate `PENDING` phase).
*   **Spec Evidence**: Supported in `Order` creation schema.
*   **Runtime Evidence**: **NONE**.
*   **Unknown Behavior**:
    - Price slippage: The average execution price can vary significantly from the last quote, risking portfolio deficit if margins are thin.
*   **Ledger Impact**: Requires instant settlement calculations based on actual fill values returned by the broker.
*   **Risk Level**: **HIGH**

### 3.2 Limit Orders (`orderType: "LIMIT"`)
*   **Lifecycle**: Can stay in `PENDING` indefinitely, transition to `PARTIAL_FILLED`, `CANCELED` (via manual request or market close expiration), or `FILLED`.
*   **Spec Evidence**: Supported in `Order` creation schema.
*   **Runtime Evidence**: **NONE**.
*   **Unknown Behavior**:
    - Day expiration timings: Checking whether orders expire exactly at 15:30 (KR market close) or include post-market settlement periods.
*   **Ledger Impact**: Long-running cash lock management.
*   **Risk Level**: **MEDIUM**
