# PR13O Runtime Risk Register

This document registers the runtime integration hazards, type validations, nullability risks, and parsing hazards associated with migrating the automated trading workstation to the Toss OpenAPI. 

---

## 1. Global Runtime Assessment Constraints

> [!IMPORTANT]
> **Runtime Unknown Field Definition**:
> Because the workstation has only been verified using dummy credentials (resulting in `401 Unauthorized` errors), **every successful response field** defined in the OpenAPI schema is classified as **Runtime Unknown**.
> 
> Runtime risks focus strictly on potential runtime failures (e.g., type casting, null pointer exceptions, boundary limits), completely independent of spec confidence.

---

## 2. Runtime Risk Register by Endpoint

### 2.1 OAuth2 Token (`/oauth2/token` POST)

*   **Runtime Unknown Fields**:
    - `access_token`
    - `token_type`
    - `expires_in`
*   **Runtime Assumptions**:
    - The server returns standard `expires_in` values as numeric seconds (typically `86400`) rather than strings (e.g., `"86400"`).
    - The authentication flow does not enforce sliding expirations or short limits that invalidate active tokens within execution loops.
*   **Potential Parser Risks**:
    - **Envelope Bypass**: Unlike all other resource routes, this response is **not** wrapped in a `{ "result": ... }` envelope. Attempting to parse with a generic API client that extracts `data.result` will cause crashes.
*   **Potential Type Risks**:
    - String-to-number casting failures if `expires_in` is handled mathematically in database calculations without sanitization.
*   **Potential Nullability Risks**:
    - None (all core tokens are strictly required).
*   **Potential Breaking Risks**:
    - **Rate Limit Lockout**: The route has a documented rate limit of **5 requests per second**. Rapid reconnection loops or worker concurrency spikes will trigger `429 Too Many Requests` instantly.
*   **Risk Level**: **MEDIUM**

---

### 2.2 Account Discovery (`/api/v1/accounts` GET)

*   **Runtime Unknown Fields**:
    - `result` (envelope array)
    - `result[].accountNo`
    - `result[].accountSeq`
    - `result[].accountType`
*   **Runtime Assumptions**:
    - The sequence identifier `accountSeq` is a stable positive integer and does not change during active sessions.
    - Standard cash accounts are classified strictly as `accountType: "BROKERAGE"`.
*   **Potential Parser Risks**:
    - Envelope structure parser failure if the API client expects direct arrays rather than a `{ result: [...] }` wrapper.
*   **Potential Type Risks**:
    - **Safe Integer Limits**: `accountSeq` is specified as `int64`. If sequence IDs grow very large, they may exceed JavaScript's `Number.MAX_SAFE_INTEGER` (`9007199254740991`), causing truncation or duplicate key errors during comparison.
*   **Potential Nullability Risks**:
    - Empty list (`result: []`) if the user has no eligible trading accounts.
*   **Potential Breaking Risks**:
    - **Multi-Account Crash**: If the user has multiple accounts (e.g. reshoring, pensions), the application may select the wrong sequence ID or crash if it expects a single item limit.
*   **Risk Level**: **MEDIUM**

---

### 2.3 Holdings Retrieval (`/api/v1/holdings` GET)

*   **Runtime Unknown Fields**:
    - `result`
    - `result.totalPurchaseAmount` (and subfields `krw`, `usd`)
    - `result.marketValue` (and subfields `amount`, `amountAfterCost`)
    - `result.profitLoss` (and subfields `amount`, `amountAfterCost`, `rate`, `rateAfterCost`)
    - `result.dailyProfitLoss` (and subfields `amount`, `rate`)
    - `result.items[]` details (`symbol`, `name`, `marketCountry`, `currency`, `quantity`, `lastPrice`, `averagePurchasePrice`, profit/loss blocks, and `cost` blocks)
*   **Runtime Assumptions**:
    - Numeric values (prices, ratios, and quantities) are returned as string decimals (e.g., `"10.00"`) rather than numbers.
*   **Potential Parser Risks**:
    - **Deep Object Nesting**: Parser failures on complex nested structures like `result.marketValue.amount.krw`. Omission of any wrapper will cause "Cannot read property of undefined" crashes.
*   **Potential Type Risks**:
    - **Floating Point Loss**: Casting decimal string properties (like `averagePurchasePrice` or `quantity`) directly to JavaScript `number` types for math logic introduces rounding errors, leading to settlement discrepancies.
*   **Potential Nullability Risks**:
    - **Currency Nullability**: `usd` fields are nullable. If domestic trading only is active, USD property queries will return `null`.
    - **Tax Nullability**: `cost.tax` is nullable and may be omitted depending on market rules.
*   **Potential Breaking Risks**:
    - Database constraints violation when persisting fields with mismatched decimal scales (e.g., inserting scale-8 quantities into scale-4 tables).
*   **Risk Level**: **HIGH**

---

### 2.4 Buying Power Retrieval (`/api/v1/buying-power` GET)

*   **Runtime Unknown Fields**:
    - `result`
    - `result.currency`
    - `result.cashBuyingPower`
*   **Runtime Assumptions**:
    - Cash buying power matches the requested query currency parameters.
*   **Potential Parser Risks**:
    - Structure is flat and simple; negligible parser risk.
*   **Potential Type Risks**:
    - Direct type coercion of string decimal `cashBuyingPower` to floating-point numbers during order validation check leading to false margin validations.
*   **Potential Nullability Risks**:
    - None (buying power metrics are required).
*   **Potential Breaking Risks**:
    - Strategy execution blockage if validation logic cannot resolve string decimal parsing.
*   **Risk Level**: **MEDIUM**

---

### 2.5 Order Creation (`/api/v1/orders` POST)

*   **Runtime Unknown Fields**:
    - `result`
    - `result.orderId`
    - `result.clientOrderId`
*   **Runtime Assumptions**:
    - The server always echoes back the submitted `clientOrderId`.
*   **Potential Parser Risks**:
    - Mismatched JSON properties if request serializer sends float/number types instead of string decimal types.
*   **Potential Type Risks**:
    - **Regex Formats**: `clientOrderId` has strict constraints (regex `^[a-zA-Z0-9\-_]+$`, max 36 characters). Generating UUIDs with brackets, spaces, or unsupported symbols will result in `400 Bad Request` or `422 Unprocessable Entity` crashes.
*   **Potential Nullability Risks**:
    - `result.clientOrderId` will be `null` or missing in the response if not supplied in the request.
*   **Potential Breaking Risks**:
    - Order cancellation failure if client order references are lost because of null responses.
*   **Risk Level**: **HIGH**

---

### 2.6 Order Detail Retrieval (`/api/v1/orders/{orderId}` GET)

*   **Runtime Unknown Fields**:
    - All fields inside the `result` block (`orderId`, `symbol`, `status`, `price`, `quantity`, `orderedAt`, `canceledAt`, etc.) and the entire execution block.
*   **Runtime Assumptions**:
    - The server maps the execution status values reliably according to documented enums.
*   **Potential Parser Risks**:
    - **Executions Schema Crash (Discrepancy Critical)**: Legacy client code written based on PR13L assumes an array of executions (`result.executions[]`). However, the official Swagger schema specifies a singular `result.execution` summary object. Trying to query `executions` or call `map()` on the response will cause an immediate **runtime crash**.
    - **Missing Client Order ID**: Because `clientOrderId` is missing from the official schema, the reconciler cannot identify matching records using only the detail response payload.
*   **Potential Type Risks**:
    - Date parsing: `orderedAt`, `canceledAt`, and `filledAt` timestamps must parse timezone indicators correctly (e.g. ISO 8601 strings) without local offset bias.
*   **Potential Nullability Risks**:
    - `price`: Nullable (empty for market orders).
    - `orderAmount`: Nullable (empty for quantity-based orders).
    - `canceledAt`: Nullable (empty for active/filled orders).
    - **Execution Blocks Nullable**: All properties in the `execution` block (`filledQuantity`, `averageFilledPrice`, `commission`, `tax`, `filledAt`) are nullable and return `null` when order status is `PENDING`.
*   **Potential Breaking Risks**:
    - Reconciler loop failure leading to double-order creation or position tracking desynchronization.
*   **Risk Level**: **HIGH**
