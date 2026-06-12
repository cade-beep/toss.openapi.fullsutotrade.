# Toss API Compliance Evidence Audit Report

This report presents evidence of compliance and discrepancies between the actual implementation in this repository and the official Toss Open API specifications (retrieved from `https://developers.tossinvest.com/docs`).

---

## 1. OAuth Flow

*   **Toss Documentation URL**: [Toss OpenAPI Docs Overview - Auth](https://openapi.tossinvest.com/openapi-docs/overview.md#auth--oauth-20)
*   **Documentation Excerpt**:
    > "모든 API는 OAuth 2.0 Client Credentials Grant로 발급받은 access token을 사용합니다."
    > 
    > **POST /oauth2/token** — OAuth 2.0 액세스 토큰 발급 (Client Credentials Grant)
    > 요청 본문은 `application/x-www-form-urlencoded` 으로 전송합니다.
    > 발급된 token 은 다른 모든 API 의 `Authorization: Bearer {access_token}` 헤더에 사용합니다.
*   **Source File**: [app/api/toss-proxy/route.ts](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/app/api/toss-proxy/route.ts)
*   **Source Line Numbers**: `L89-L94` and `L107-L118`
*   **Why Current Implementation Differs**:
    The proxy implements a custom HMAC-SHA256 signature mechanism. It signs requests with an API secret key and sets custom headers (`X-TOSS-API-KEY`, `X-TOSS-SIGNATURE`, `X-TOSS-TIMESTAMP`) instead of executing the standard Client Credentials flow to retrieve a token via `POST /oauth2/token` and transmitting it in the `Authorization: Bearer` header.
*   **Required Code Change**:
    Rewrite `getAuthToken` (or proxy token management) to exchange `client_id` and `client_secret` via `POST /oauth2/token` (using `application/x-www-form-urlencoded` body), store the returned token, and attach `Authorization: Bearer {token}` to outgoing Toss API requests.

---

## 2. Account Header

*   **Toss Documentation URL**: [Toss OpenAPI Docs Overview - 개요](https://openapi.tossinvest.com/openapi-docs/overview.md#개요)
*   **Documentation Excerpt**:
    > "계좌·자산 및 주문 카테고리는 OAuth 2.0 토큰에 더해 계좌 식별 헤더 `X-Tossinvest-Account` 를 함께 전달해야 합니다."
    > 
    > **X-Tossinvest-Account** (in Header, integer format):
    > "API 요청 시 사용할 계좌의 accountSeq. `GET /api/v1/accounts` 응답의 `accountSeq` 값을 사용합니다."
*   **Source File**: [app/api/toss-proxy/route.ts](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/app/api/toss-proxy/route.ts)
*   **Source Line Numbers**: `L107-L118` (see also [services/trading/toss-api.ts](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/services/trading/toss-api.ts) `L60-L68`)
*   **Why Current Implementation Differs**:
    The code completely omits the `X-Tossinvest-Account` header. It neither passes it from `toss-api.ts` to the proxy, nor appends it in the final forwarded headers to the Toss API server. The database stores `account_id` as a text value, but the API requires the `accountSeq` integer.
*   **Required Code Change**:
    1. Modify `TossTradingService` to supply the `X-Tossinvest-Account` header parameter matching the user's `accountSeq` integer when calling the proxy.
    2. Update `app/api/toss-proxy/route.ts` to capture the header and include it as `X-Tossinvest-Account: {accountSeq}` when calling orders, assets, or holdings endpoints.

---

## 3. Order Placement Endpoint

*   **Toss Documentation URL**: [Toss OpenAPI Spec - Create Order](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json) (under path `"/api/v1/orders"` post)
*   **Documentation Excerpt**:
    > **POST /api/v1/orders**
    > Schema: `OrderCreateRequest`
    > ```json
    > {
    >   "clientOrderId": "my-order-001",
    >   "symbol": "005930",
    >   "side": "BUY", // enum: ["BUY", "SELL"]
    >   "orderType": "LIMIT", // enum: ["LIMIT", "MARKET"]
    >   "quantity": "10", // string (decimal)
    >   "price": "70000" // string (decimal)
    > }
    > ```
    > Response:
    > ```json
    > {
    >   "result": {
    >     "orderId": "0d5Q...",
    >     "clientOrderId": "my-order-001"
    >   }
    > }
    > ```
*   **Source File**: [services/trading/toss-api.ts](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/services/trading/toss-api.ts)
*   **Source Line Numbers**: `L163-L170`
*   **Why Current Implementation Differs**:
    *   It hits `/v1/orders` instead of `/api/v1/orders`.
    *   Payload key-values are mismatched:
        - Sends `side` as `'2'` or `'1'` (instead of `"BUY"` or `"SELL"`).
        - Sends `type` as `'02'` or `'01'` (instead of `orderType` as `"LIMIT"` or `"MARKET"`).
        - Sends `qty` instead of `quantity`.
        - Sends `client_oid` instead of `clientOrderId`.
        - Sends raw numeric price instead of string-serialized decimal.
    *   It ignores the returned `result.orderId` from the broker, utilizing the client order ID (`cid`) as the main identifier.
*   **Required Code Change**:
    Adjust `placeOrder` payload formatting to strictly align with the `OrderCreateRequest` schema, update the target path to `/api/v1/orders`, and map `result.orderId` from the response to the saved `broker_order_id` record.

---

## 4. Order Query Endpoint

*   **Toss Documentation URL**: [Toss OpenAPI Spec - Order History](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json) (under paths `"/api/v1/orders"` and `"/api/v1/orders/{orderId}"`)
*   **Documentation Excerpt**:
    > **GET /api/v1/orders/{orderId}** — 주문 상세 조회 (모든 상태)
    > Returns: `{ "result": <Order> }`
    > 
    > **GET /api/v1/orders** — 주문 목록 조회 (대기중 주문)
    > Query parameters: `status=OPEN`
*   **Source File**: [services/trading/toss-api.ts](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/services/trading/toss-api.ts)
*   **Source Line Numbers**: `L275-L300` (in `fetchOrderFromBroker`)
*   **Why Current Implementation Differs**:
    *   It requests `/v1/orders/${clientOrderId}` directly using the client-side order ID in the path. The Toss API does not support fetching orders by client order ID in the path; it requires the server-side opaque `orderId` (`"/api/v1/orders/{orderId}"`).
    *   Response mapping logic maps `'2'`/`'1'` to `side` and `'02'`/`'01'` to `type`, whereas the actual response returns `"BUY"`/ `"SELL"` and `"LIMIT"`/ `"MARKET"`.
    *   Attempts to read `sequence_number` which does not exist in the official `Order` schema.
*   **Required Code Change**:
    Use the true server-returned `orderId` for path querying (`/api/v1/orders/{orderId}`). Correct the field parsing logic to match the schema properties (e.g., mapping `orderType` and `status` strings without translating numeric codes).

---

## 5. Holdings Endpoint

*   **Toss Documentation URL**: [Toss OpenAPI Spec - Asset](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json) (under path `"/api/v1/holdings"`)
*   **Documentation Excerpt**:
    > **GET /api/v1/holdings** — 보유 주식 조회
    > Returns: `HoldingsOverview` wrapped in `result`.
    > ```json
    > {
    >   "result": {
    >     "items": [
    >       {
    >         "symbol": "005930",
    >         "quantity": "100",
    >         "averagePurchasePrice": "65000"
    >       }
    >     ]
    >   }
    > }
    > ```
*   **Source File**: [services/trading/toss-api.ts](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/services/trading/toss-api.ts)
*   **Source Line Numbers**: `L234-L248` (in `getPositions`)
*   **Why Current Implementation Differs**:
    *   It requests the invalid path `/v1/account/positions` instead of `/api/v1/holdings`.
    *   It processes the response as a raw array directly, missing the envelope (`result.items`).
    *   It expects keys `p.qty` and `p.avg_buy_price` instead of `p.quantity` and `p.averagePurchasePrice` (returned as strings).
*   **Required Code Change**:
    Update target path to `/api/v1/holdings` with correct headers, extract array from `result.items`, and map properties from `quantity` and `averagePurchasePrice`.

---

## 6. Balance Endpoint

*   **Toss Documentation URL**: [Toss OpenAPI Docs Overview - 기능 목록](https://openapi.tossinvest.com/openapi-docs/overview.md#기능-목록)
*   **Documentation Excerpt**:
    (There is no endpoint for general account balance. The only endpoints for funds information are `GET /api/v1/buying-power` and `GET /api/v1/accounts`.)
*   **Source File**: [services/trading/toss-api.ts](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/services/trading/toss-api.ts)
*   **Source Line Numbers**: `L218-L232` (in `getAccountBalance`)
*   **Why Current Implementation Differs**:
    The codebase attempts to query `GET /v1/account/balance` expecting a `cash_balance` field, which is unsupported.
*   **Required Code Change**:
    Since a dedicated balance endpoint is not provided by the Toss Open API, the implementation must use `GET /api/v1/buying-power?currency=KRW` (and `currency=USD`) to fetch the cash buying power as a proxy for the account cash balance.

---

## 7. Execution Lookup Endpoint

*   **Toss Documentation URL**: [Toss OpenAPI Spec - Paths](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json)
*   **Documentation Excerpt**:
    *   **UNVERIFIED**: No execution lookup endpoint (e.g. `/api/v1/executions` or `/api/v1/fills`) exists in the Toss OpenAPI documentation.
    *   Execution updates are embedded inside the `execution` field of the `Order` object returned by `GET /api/v1/orders/{orderId}`.
*   **Source File**: N/A
*   **Source Line Numbers**: N/A
*   **Why Current Implementation Differs**:
    N/A (Marked as **UNVERIFIED / UNSUPPORTED**).
*   **Required Code Change**:
    Rely on the order detail query `/api/v1/orders/{orderId}` to extract `execution` statistics (`filledQuantity`, `averageFilledPrice`, `filledAt`) rather than trying to lookup executions via a standalone endpoint.

---

## 8. Webhook Support / No-Webhook Support

*   **Toss Documentation URL**: [Toss OpenAPI Spec Overview - Market Data](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json)
*   **Documentation Excerpt**:
    > "웹 소켓은 추후 지원 예정입니다"
    > (No webhook registration or callback settings are described in the documentation.)
*   **Source File**: [app/api/webhooks/toss/route.ts](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/app/api/webhooks/toss/route.ts)
*   **Source Line Numbers**: `L1-L156` (entire file)
*   **Why Current Implementation Differs**:
    The codebase implements a webhook handler at `/api/webhooks/toss` expecting events pushed from the broker. However, the Toss Open API does not support webhooks.
*   **Required Code Change**:
    1. Deprecate the `/api/webhooks/toss` endpoint.
    2. Implement a polling mechanism (e.g. using the reconciler worker) that regularly requests `GET /api/v1/orders?status=OPEN` to synchronize execution fills and order state.
