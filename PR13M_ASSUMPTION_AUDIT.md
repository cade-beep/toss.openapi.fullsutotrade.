# PR13M Assumption Audit

This audit evaluates the response and schema examples documented in [PR13D](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/PR13D_LIVE_ENDPOINT_VALIDATION.md), [PR13G](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/PR13G_REAL_API_PROOF_REQUIREMENTS.md), and [PR13L](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/PR13L_AUTHENTICATED_EVIDENCE_REQUIREMENTS.md). Each field is classified based on verification from live responses, official OpenAPI specifications, or structural assumptions.

---

## 1. Summary of Discrepancies and Assumptions

> [!WARNING]
> **Key Discrepancies Identified**:
> 1. **Order Detail Executions Schema**: PR13L assumes an `executions` array (`result.executions[]`). However, the official OpenAPI spec (v1.0.3) defines a singular `execution` object (`result.execution`) holding aggregated execution data (e.g., `averageFilledPrice`, `filledQuantity`).
> 2. **Client Order ID in Order Detail**: PR13L assumes `clientOrderId` is returned in the Order Detail response (`result.clientOrderId`). The official OpenAPI spec for the Order Detail response does not declare `clientOrderId` under the response payload schema.

---

## 2. Field Audit Registry

### 2.1 OAuth2 Token Request & Response (`/oauth2/token`)

| Endpoint | Field Name | Classification | Evidence Source | Confidence Score |
| :--- | :--- | :--- | :--- | :--- |
| OAuth2 Token | `grant_type` (Request) | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/oauth2/token` POST | 100 |
| OAuth2 Token | `client_id` (Request) | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/oauth2/token` POST | 100 |
| OAuth2 Token | `client_secret` (Request) | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/oauth2/token` POST | 100 |
| OAuth2 Token | `access_token` (Response) | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/oauth2/token` Response | 100 |
| OAuth2 Token | `token_type` (Response) | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/oauth2/token` Response | 100 |
| OAuth2 Token | `expires_in` (Response) | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/oauth2/token` Response | 100 |
| OAuth2 Token | `error` (Error Response) | `VERIFIED_BY_LIVE_RESPONSE` | `REAL_API_EVIDENCE_LOG.md` (HTTP 401 Payload) | 100 |
| OAuth2 Token | `error_description` (Error Response) | `VERIFIED_BY_LIVE_RESPONSE` | `REAL_API_EVIDENCE_LOG.md` (HTTP 401 Payload) | 100 |
| OAuth2 Token | `x-ratelimit-limit` (Header) | `VERIFIED_BY_LIVE_RESPONSE` | `REAL_API_EVIDENCE_LOG.md` Headers | 100 |
| OAuth2 Token | `x-ratelimit-remaining` (Header) | `VERIFIED_BY_LIVE_RESPONSE` | `REAL_API_EVIDENCE_LOG.md` Headers | 100 |
| OAuth2 Token | `x-ratelimit-reset` (Header) | `VERIFIED_BY_LIVE_RESPONSE` | `REAL_API_EVIDENCE_LOG.md` Headers | 100 |
| OAuth2 Token | `x-request-id` (Header) | `VERIFIED_BY_LIVE_RESPONSE` | `REAL_API_EVIDENCE_LOG.md` Headers | 100 |
| OAuth2 Token | `www-authenticate` (Header) | `VERIFIED_BY_LIVE_RESPONSE` | `REAL_API_EVIDENCE_LOG.md` Headers | 100 |

---

### 2.2 Account Discovery (`/api/v1/accounts`)

| Endpoint | Field Name | Classification | Evidence Source | Confidence Score |
| :--- | :--- | :--- | :--- | :--- |
| Account Discovery | `result` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/accounts` Response | 100 |
| Account Discovery | `result[].accountNo` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/accounts` Response | 100 |
| Account Discovery | `result[].accountSeq` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/accounts` Response | 100 |
| Account Discovery | `result[].accountType` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/accounts` Response | 100 |
| Account Discovery | `error` (Error Response) | `VERIFIED_BY_LIVE_RESPONSE` | `REAL_API_EVIDENCE_LOG.md` (HTTP 401 Envelope) | 100 |
| Account Discovery | `error.requestId` | `VERIFIED_BY_LIVE_RESPONSE` | `REAL_API_EVIDENCE_LOG.md` (HTTP 401 Envelope) | 100 |
| Account Discovery | `error.code` | `VERIFIED_BY_LIVE_RESPONSE` | `REAL_API_EVIDENCE_LOG.md` (HTTP 401 Envelope) | 100 |
| Account Discovery | `error.message` | `VERIFIED_BY_LIVE_RESPONSE` | `REAL_API_EVIDENCE_LOG.md` (HTTP 401 Envelope) | 100 |

---

### 2.3 Holdings Retrieval (`/api/v1/holdings`)

| Endpoint | Field Name | Classification | Evidence Source | Confidence Score |
| :--- | :--- | :--- | :--- | :--- |
| Holdings | `result` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/holdings` Response | 100 |
| Holdings | `result.totalPurchaseAmount` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/holdings` Response | 100 |
| Holdings | `result.totalPurchaseAmount.krw` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/holdings` Response | 100 |
| Holdings | `result.totalPurchaseAmount.usd` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/holdings` Response | 100 |
| Holdings | `result.marketValue` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/holdings` Response | 100 |
| Holdings | `result.profitLoss` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/holdings` Response | 100 |
| Holdings | `result.items` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/holdings` Response | 100 |
| Holdings | `result.items[].symbol` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/holdings` Response | 100 |
| Holdings | `result.items[].name` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/holdings` Response | 100 |
| Holdings | `result.items[].marketCountry` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/holdings` Response | 100 |
| Holdings | `result.items[].currency` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/holdings` Response | 100 |
| Holdings | `result.items[].quantity` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/holdings` Response | 100 |
| Holdings | `result.items[].lastPrice` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/holdings` Response | 100 |
| Holdings | `result.items[].averagePurchasePrice`| `VERIFIED_BY_OFFICIAL_SPEC`| OpenAPI Spec: `/api/v1/holdings` Response | 100 |
| Holdings | `result.items[].cost` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/holdings` Response | 100 |

---

### 2.4 Buying Power Retrieval (`/api/v1/buying-power`)

| Endpoint | Field Name | Classification | Evidence Source | Confidence Score |
| :--- | :--- | :--- | :--- | :--- |
| Buying Power | `result` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/buying-power` | 100 |
| Buying Power | `result.currency` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/buying-power` | 100 |
| Buying Power | `result.cashBuyingPower` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/buying-power` | 100 |

---

### 2.5 Order Creation (`/api/v1/orders` POST)

| Endpoint | Field Name | Classification | Evidence Source | Confidence Score |
| :--- | :--- | :--- | :--- | :--- |
| Order Create | `clientOrderId` (Request) | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders` Request | 100 |
| Order Create | `symbol` (Request) | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders` Request | 100 |
| Order Create | `side` (Request) | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders` Request | 100 |
| Order Create | `orderType` (Request) | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders` Request | 100 |
| Order Create | `timeInForce` (Request) | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders` Request | 100 |
| Order Create | `quantity` (Request) | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders` Request | 100 |
| Order Create | `price` (Request) | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders` Request | 100 |
| Order Create | `orderAmount` (Request) | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders` Request | 100 |
| Order Create | `result` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders` Response | 100 |
| Order Create | `result.orderId` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders` Response | 100 |
| Order Create | `result.clientOrderId` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders` Response | 100 |

---

### 2.6 Order Detail Retrieval (`/api/v1/orders/{orderId}`)

| Endpoint | Field Name | Classification | Evidence Source | Confidence Score |
| :--- | :--- | :--- | :--- | :--- |
| Order Detail | `result` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.orderId` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.clientOrderId` | `ASSUMED` | Assumed in PR13L; missing from OpenAPI Spec | 30 |
| Order Detail | `result.symbol` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.side` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.orderType` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.timeInForce` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.status` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.price` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.quantity` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.orderAmount` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.currency` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.orderedAt` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.canceledAt` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.execution` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.execution.filledQuantity` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.execution.averageFilledPrice` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.execution.filledAmount` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.execution.commission` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.execution.tax` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.execution.filledAt` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.execution.settlementDate` | `VERIFIED_BY_OFFICIAL_SPEC` | OpenAPI Spec: `/api/v1/orders/{orderId}` | 100 |
| Order Detail | `result.executions` | `ASSUMED` | Assumed array layout in PR13L; Spec specifies singular `result.execution` | 10 |
