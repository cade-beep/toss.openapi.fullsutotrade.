# PR-13 Toss API Rewrite Implementation Plan

This planning document outlines the architecture, database migrations, and order of implementation for rewriting the Toss OpenAPI integration to achieve 100% compliance with the official developers' documentation.

---

## 1. Verified Compliance Mismatches

Based on [TOSS_API_COMPLIANCE_EVIDENCE.md](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/TOSS_API_COMPLIANCE_EVIDENCE.md), the following architectural mismatches are verified:
*   **OAuth2 vs HMAC Signatures**: Current code signs every request using custom HMAC headers (`X-TOSS-SIGNATURE`, etc.). The Toss API requires standard OAuth2 Client Credentials Grant tokens passed via `Authorization: Bearer`.
*   **Missing Account Header**: Current code does not supply the mandatory `X-Tossinvest-Account` header (which takes the integer `accountSeq`).
*   **Invalid Paths & Parameters**: Current endpoints are directed to paths like `/v1/orders` or `/v1/account/positions` with mismatched fields (e.g. `side: '2'` instead of `"BUY"`, `qty` instead of `quantity`).
*   **Non-existent Endpoints**: The current implementation attempts to query `/v1/account/balance` and `/v1/orders/executions`, neither of which exists in the official Toss Open API spec.
*   **Webhook Dependency**: The codebase contains a webhook listener (`/api/webhooks/toss`), but Toss Open API does not support webhook push events.

---

## 2. Technical Architecture Redesign

### 2.1 OAuth2 Token Architecture
*   **Centralized Storage**: Access tokens must be stored centrally (either in Redis or a Supabase table `toss_oauth_tokens`) along with their creation timestamp and `expires_in` value.
*   **Mutex Token Issuance**: Because the Toss API invalidates the previous access token immediately upon a new token request, concurrent worker processes must not call the token endpoint simultaneously. 
*   **Locking Strategy**: Implement a Redis-based distributed lock (`lock:toss-token-refresh`) or database advisory lock before requesting a token from `/oauth2/token`.
*   **Token Retrieval Logic**:
    ```typescript
    async function getValidToken(): Promise<string> {
      const cached = await getCachedToken();
      if (cached && !isNearExpiry(cached)) {
        return cached.token;
      }
      
      return acquireLock(async () => {
        // Double check cache inside the lock
        const freshCheck = await getCachedToken();
        if (freshCheck && !isNearExpiry(freshCheck)) return freshCheck.token;
        
        const tokenData = await callTossOAuthEndpoint();
        await saveTokenCache(tokenData);
        return tokenData.access_token;
      });
    }
    ```

### 2.2 Token Refresh Strategy
*   **Passive Pre-Refresh**: Periodically checks or validates the token's remaining lifespan before executing calls. If the token has less than 5 minutes remaining, it refreshes it proactively.
*   **Cooldown and Backoff**: Limits token issuance requests to maximum 5 per second (AUTH group rate limit) and applies exponential backoff in case of `429 rate-limit-exceeded` on the `/oauth2/token` endpoint.

### 2.3 Account Discovery Flow
*   When credentials are saved or updated, the system must trigger an automatic discovery process.
*   **Flow**:
    1. Call `GET /api/v1/accounts` using the newly issued OAuth2 token.
    2. Loop through the returned accounts array.
    3. Select the account where `accountType` is `"BROKERAGE"` (종합매매 계좌).
    4. Extract `accountSeq` (integer) and `accountNo` (string).
    5. Save `accountSeq` to the user's `api_credentials` record.

### 2.4 Order Placement Rewrite
*   **Endpoint Path**: `POST /api/v1/orders`
*   **Body Schema (Quantity-based)**:
    ```json
    {
      "clientOrderId": "UUID-or-Cid",
      "symbol": "005930",
      "side": "BUY", // "BUY" or "SELL"
      "orderType": "LIMIT", // "LIMIT" or "MARKET"
      "quantity": "10", // String decimal
      "price": "70000", // String decimal (omit for MARKET)
      "timeInForce": "DAY", // "DAY" or "CLS"
      "confirmHighValueOrder": false
    }
    ```
*   **ID Mapping**: In the successful response, extract the server-side `orderId` (found in `result.orderId`) and save it to the local order record as `broker_order_id`. This ID is required for all future status queries.

### 2.5 Order Query Rewrite
*   **Detail Path**: `GET /api/v1/orders/{orderId}` (where `{orderId}` is the server-assigned `orderId`).
*   **List Path**: `GET /api/v1/orders?status=OPEN`
*   **Response Handling**: Direct mapping of the Toss `Order` model attributes without custom code translations (such as converting `'2'` back to `"BUY"`). Remove the non-existent `sequence_number` mapping.

### 2.6 Holdings Synchronization Rewrite
*   **Endpoint Path**: `GET /api/v1/holdings`
*   **Response Processing**:
    1. Read the `result` envelope.
    2. Iterate over the `items` array.
    3. Parse properties (e.g. convert string-based `quantity` and `averagePurchasePrice` to numbers).

### 2.7 Buying Power Synchronization Rewrite
*   **Endpoint Path**: `GET /api/v1/buying-power?currency=KRW` (and optionally `currency=USD`)
*   **Execution**: Replace the call to the non-existent `/v1/account/balance` with a query to `/api/v1/buying-power`. Map `result.cashBuyingPower` to update client portfolio cash assets.

### 2.8 Polling-Based Reconciler Redesign
*   **Tier 1 (Open Order Sweeper)**:
    1. Periodically fetch active local orders (e.g., status is `PENDING`, `SUBMITTED`, or `PARTIALLY_FILLED`).
    2. Call `GET /api/v1/orders?status=OPEN` to list all currently open orders on the broker.
    3. Compare the local list with the broker list:
       - If a local order is **present** in the open list: Update its `filled_qty` and status based on the broker's list data.
       - If a local order is **missing** from the open list: It has settled (filled, canceled, or rejected). Immediately query `GET /api/v1/orders/{orderId}` to obtain its terminal state and dispatch a settlement event.
*   **Tier 2 (Connection Gap Sync)**:
    - Since there is no execution gap endpoint (`/api/v1/orders/executions`), Tier 2 will be replaced with a full state reconciliation. It will pull the complete open orders list and holdings page (`GET /api/v1/holdings`) at regular intervals (e.g., every 5 minutes) to reconcile cash balances and stock positions.

### 2.9 Webhook Removal Impact Analysis
*   **Removed Endpoints**: `app/api/webhooks/toss/route.ts` is deleted.
*   **BullMQ Changes**: The BullMQ queue `brokerEventsQueue` and its worker `reconciler-worker.ts` can be retired (or refactored to receive internally-produced polling reconciliation events).
*   **Trade Settlement**: Transition trade settlement to rely entirely on the polling-based reconciler. The reconciler will invoke `execute_trade_v2` directly via the Supabase client when a terminal transition is detected.

---

## 3. Database Migration Requirements

A database migration must be executed to prepare the schema:
1.  **Add `account_seq`**:
    ```sql
    ALTER TABLE public.api_credentials ADD COLUMN IF NOT EXISTS account_seq integer;
    ```
2.  **Retire Webhook Fields**: Remove the `encrypted_webhook_secret` column if no longer needed:
    ```sql
    ALTER TABLE public.api_credentials DROP COLUMN IF EXISTS encrypted_webhook_secret;
    ```

---

## 4. Impact Classifications

| Component | Impact | Description |
| :--- | :--- | :--- |
| **OAuth2 Token Handling** | **Critical** | Concurrent requests will trigger token invalidation without centralized locks. |
| **Order Placement** | **Critical** | Schema changes must be written exactly as specified or the API will return `400 BAD_REQUEST`. |
| **AccountSeq Migration** | **Critical** | All trade/asset APIs will reject requests with a `400 account-header-required` without it. |
| **Reconciler Worker** | **High** | Transitioning from webhook pushes to active polling requires careful state transition handling. |
| **Positions & Balance Sync** | **Medium** | Path changes and envelope parsing logic adjustments. |
| **Database Migrations** | **Medium** | Adding database columns and removing retired webhook credentials columns. |
| **Frontend UI** | **Low** | Modifying credential creation forms to request WTS ID/Secret instead of signature keys. |

---

## 5. Implementation Order

1.  **Phase 1: Database Schema Migration**
    *   Create migrations to add `account_seq` integer column to the `api_credentials` table.
2.  **Phase 2: Token Caching & Centralized Refresh Engine**
    *   Implement centralized access token caching in Redis or the database.
    *   Implement distributed locking mechanisms during token refresh to avoid concurrent request invalidations.
3.  **Phase 3: Credentials and Account Discovery Workflow**
    *   Update `app/api/credentials/route.ts` to execute Account Discovery using the new OAuth client upon credential registration.
    *   Store discovered `accountSeq` to `account_seq`.
4.  **Phase 4: API Client Refactoring (TossTradingService & Proxy)**
    *   Rewrite proxy request forwarding in `app/api/toss-proxy/route.ts` to attach OAuth2 token and `X-Tossinvest-Account`.
    *   Rewrite payload formatting for `placeOrder`, `getPositions` (holdings), and `getAccountBalance` (buying power).
5.  **Phase 5: Reconciler Engine Redesign**
    *   Rewrite active order sweeper to check open orders list.
    *   Query specific terminal order states via `/api/v1/orders/{orderId}` when missing from the open list.
6.  **Phase 6: Webhook Route & Worker Cleanup**
    *   Delete the webhook endpoint and remove webhook secrets from configurations.
7.  **Phase 7: Frontend and System Verification**
    *   Update credential entry UI forms.
    *   Validate end-to-end sandbox/paper and live trade lifecycles.

---

## 6. Estimated Files Affected

*   [supabase/migrations/20260611000000_pr13_toss_api_remediation.sql](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/supabase/migrations/20260611000000_pr13_toss_api_remediation.sql) `[NEW]`
*   [services/trading/toss-api.ts](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/services/trading/toss-api.ts) `[MODIFY]`
*   [app/api/toss-proxy/route.ts](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/app/api/toss-proxy/route.ts) `[MODIFY]`
*   [app/api/credentials/route.ts](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/app/api/credentials/route.ts) `[MODIFY]`
*   [services/queue/reconciler-scheduler.ts](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/services/queue/reconciler-scheduler.ts) `[MODIFY]`
*   [app/api/webhooks/toss/route.ts](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/app/api/webhooks/toss/route.ts) `[DELETE]`
