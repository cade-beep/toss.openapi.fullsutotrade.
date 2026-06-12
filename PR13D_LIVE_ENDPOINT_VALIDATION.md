# PR13D Live Endpoint Validation Report

This report documents the exact specification parameters, paths, headers, and schemas for every primary endpoint in the Toss Invest OpenAPI (v1.0.3) to serve as a strict implementation guide for future integration.

---

## 1. Authentication Endpoint
*   **Exact HTTP Method**: `POST`
*   **Exact URL Path**: `/oauth2/token`
*   **Required Headers**:
    - `Content-Type: application/x-www-form-urlencoded`
*   **Required Request Body Schema** (`OAuth2TokenRequest`):
    - `grant_type` (string, required, enum: `["client_credentials"]`)
    - `client_id` (string, required, description: "클라이언트 ID")
    - `client_secret` (string, required, description: "클라이언트 시크릿")
*   **Response Schema** (`OAuth2TokenResponse`):
    - BFF envelope is **not** used. Direct response:
      ```json
      {
        "access_token": "string (JWT format)",
        "token_type": "Bearer",
        "expires_in": "integer (int64)"
      }
      ```
*   **Official Source URL**: [Toss OpenAPI - Auth](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json) (path `/oauth2/token`)
*   **Status**: **VERIFIED**

---

## 2. Accounts Endpoint
*   **Exact HTTP Method**: `GET`
*   **Exact URL Path**: `/api/v1/accounts`
*   **Required Headers**:
    - `Authorization: Bearer {access_token}`
*   **Required Request Body Schema**: None (No body parameter)
*   **Response Schema**:
    - Standard successful `ApiResponse` envelope:
      ```json
      {
        "result": [
          {
            "accountNo": "string",
            "accountSeq": "integer (int64)",
            "accountType": "string (enum: [BROKERAGE, OVERSEAS_DERIVATIVES, PENSION_SAVINGS, RESHORING_INVESTMENT])"
          }
        ]
      }
      ```
*   **Official Source URL**: [Toss OpenAPI - Account](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json) (path `/api/v1/accounts`)
*   **Status**: **VERIFIED**

---

## 3. Holdings Endpoint
*   **Exact HTTP Method**: `GET`
*   **Exact URL Path**: `/api/v1/holdings`
*   **Required Headers**:
    - `Authorization: Bearer {access_token}`
    - `X-Tossinvest-Account: {accountSeq}` (integer)
*   **Required Request Body Schema**: None
*   **Query Parameters**:
    - `symbol` (string, optional, pattern: `^[A-Za-z0-9.\-]+$`, e.g. `"005930"` or `"AAPL"`)
*   **Response Schema**:
    - Standard `ApiResponse` envelope containing `HoldingsOverview`:
      ```json
      {
        "result": {
          "totalPurchaseAmount": {
            "krw": "string (decimal)",
            "usd": "string (decimal, nullable)"
          },
          "marketValue": {
            "amount": { "krw": "string", "usd": "string" },
            "amountAfterCost": { "krw": "string", "usd": "string" }
          },
          "profitLoss": {
            "amount": { "krw": "string", "usd": "string" },
            "amountAfterCost": { "krw": "string", "usd": "string" },
            "rate": "string (decimal)",
            "rateAfterCost": "string (decimal)"
          },
          "dailyProfitLoss": {
            "amount": { "krw": "string", "usd": "string" },
            "rate": "string (decimal)"
          },
          "items": [
            {
              "symbol": "string",
              "name": "string",
              "marketCountry": "string (enum: [KR, US])",
              "currency": "string (enum: [KRW, USD])",
              "quantity": "string (decimal)",
              "lastPrice": "string (decimal)",
              "averagePurchasePrice": "string (decimal)",
              "marketValue": {
                "purchaseAmount": "string (decimal)",
                "amount": "string (decimal)",
                "amountAfterCost": "string (decimal)"
              },
              "profitLoss": {
                "amount": "string (decimal)",
                "amountAfterCost": "string (decimal)",
                "rate": "string (decimal)",
                "rateAfterCost": "string (decimal)"
              },
              "dailyProfitLoss": {
                "amount": "string (decimal)",
                "rate": "string (decimal)"
              },
              "cost": {
                "commission": "string (decimal)",
                "tax": "string (decimal, nullable)"
              }
            }
          ]
        }
      }
      ```
*   **Official Source URL**: [Toss OpenAPI - Asset](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json) (path `/api/v1/holdings`)
*   **Status**: **VERIFIED**

---

## 4. Buying Power Endpoint
*   **Exact HTTP Method**: `GET`
*   **Exact URL Path**: `/api/v1/buying-power`
*   **Required Headers**:
    - `Authorization: Bearer {access_token}`
    - `X-Tossinvest-Account: {accountSeq}` (integer)
*   **Query Parameters**:
    - `currency` (string, required, enum: `["KRW", "USD"]`)
*   **Required Request Body Schema**: None
*   **Response Schema**:
    - Standard `ApiResponse` envelope containing `BuyingPowerResponse`:
      ```json
      {
        "result": {
          "currency": "string (enum: [KRW, USD])",
          "cashBuyingPower": "string (decimal)"
        }
      }
      ```
*   **Official Source URL**: [Toss OpenAPI - Order Info](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json) (path `/api/v1/buying-power`)
*   **Status**: **VERIFIED**

---

## 5. Order Create Endpoint
*   **Exact HTTP Method**: `POST`
*   **Exact URL Path**: `/api/v1/orders`
*   **Required Headers**:
    - `Authorization: Bearer {access_token}`
    - `X-Tossinvest-Account: {accountSeq}` (integer)
    - `Content-Type: application/json`
*   **Required Request Body Schema** (`OrderCreateRequest`):
    - One of the following two schemas must be matched:
      1.  **Quantity-based (`OrderCreateQuantityBased`)**:
          ```json
          {
            "clientOrderId": "string (optional, max 36 chars, regex: ^[a-zA-Z0-9\\-_]+$)",
            "symbol": "string (required, e.g. '005930')",
            "side": "string (required, enum: [BUY, SELL])",
            "orderType": "string (required, enum: [LIMIT, MARKET])",
            "timeInForce": "string (optional, enum: [DAY, CLS], default: 'DAY')",
            "quantity": "string (required, decimal string representation of integer quantity)",
            "price": "string (required if LIMIT, forbidden if MARKET, decimal string)"
          }
          ```
      2.  **Amount-based US Market Buy (`OrderCreateAmountBased`)**:
          ```json
          {
            "clientOrderId": "string (optional)",
            "symbol": "string (required, US ticker e.g. 'AAPL')",
            "side": "string (required, enum: [BUY])",
            "orderType": "string (required, enum: [MARKET])",
            "orderAmount": "string (required, decimal string representing purchase USD cash)"
          }
          ```
*   **Response Schema** (`OrderResponse`):
    - Standard `ApiResponse` envelope:
      ```json
      {
        "result": {
          "orderId": "string (server-assigned ID token)",
          "clientOrderId": "string (nullable)"
        }
      }
      ```
*   **Official Source URL**: [Toss OpenAPI - Order](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json) (path `/api/v1/orders` POST)
*   **Status**: **VERIFIED**

---

## 6. Order Detail Endpoint
*   **Exact HTTP Method**: `GET`
*   **Exact URL Path**: `/api/v1/orders/{orderId}` (where `{orderId}` is the server-assigned `orderId` token)
*   **Required Headers**:
    - `Authorization: Bearer {access_token}`
    - `X-Tossinvest-Account: {accountSeq}` (integer)
*   **Required Request Body Schema**: None
*   **Response Schema**:
    - Standard `ApiResponse` envelope containing `Order`:
      ```json
      {
        "result": {
          "orderId": "string",
          "symbol": "string",
          "side": "string (enum: [BUY, SELL])",
          "orderType": "string (enum: [LIMIT, MARKET])",
          "timeInForce": "string (enum: [DAY, CLS, OPG])",
          "status": "string (enum: [PENDING, PENDING_CANCEL, PENDING_REPLACE, PARTIAL_FILLED, FILLED, CANCELED, REJECTED, CANCEL_REJECTED, REPLACE_REJECTED, REPLACED])",
          "price": "string (decimal, nullable)",
          "quantity": "string (decimal)",
          "orderAmount": "string (decimal, nullable)",
          "currency": "string (enum: [KRW, USD])",
          "orderedAt": "string (date-time)",
          "canceledAt": "string (date-time, nullable)",
          "execution": {
            "filledQuantity": "string (decimal)",
            "averageFilledPrice": "string (decimal, nullable)",
            "filledAmount": "string (decimal, nullable)",
            "commission": "string (decimal, nullable)",
            "tax": "string (decimal, nullable)",
            "filledAt": "string (date-time, nullable)",
            "settlementDate": "string (date, nullable)"
          }
        }
      }
      ```
*   **Official Source URL**: [Toss OpenAPI - Order History](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json) (path `/api/v1/orders/{orderId}`)
*   **Status**: **VERIFIED**

---

## 7. Order List Endpoint
*   **Exact HTTP Method**: `GET`
*   **Exact URL Path**: `/api/v1/orders`
*   **Required Headers**:
    - `Authorization: Bearer {access_token}`
    - `X-Tossinvest-Account: {accountSeq}` (integer)
*   **Query Parameters**:
    - `status` (string, required, enum: `["OPEN", "CLOSED"]`)
      *(Note: status=CLOSED currently returns '400 closed-not-supported')*
    - `symbol` (string, optional)
    - `from` (string, date, optional)
    - `to` (string, date, optional)
    - `cursor` (string, optional)
    - `limit` (integer, optional)
*   **Required Request Body Schema**: None
*   **Response Schema**:
    - Standard `ApiResponse` envelope containing `PaginatedOrderResponse`:
      ```json
      {
        "result": {
          "orders": [
            {
              "orderId": "string",
              "symbol": "string",
              "side": "string (enum: [BUY, SELL])",
              "orderType": "string",
              "timeInForce": "string",
              "status": "string",
              "price": "string (nullable)",
              "quantity": "string",
              "orderAmount": "string (nullable)",
              "currency": "string",
              "orderedAt": "string (date-time)",
              "canceledAt": "string (nullable)",
              "execution": {
                "filledQuantity": "string",
                "averageFilledPrice": "string (nullable)",
                "filledAmount": "string (nullable)",
                "commission": "string (nullable)",
                "tax": "string (nullable)",
                "filledAt": "string (nullable)",
                "settlementDate": "string (nullable)"
              }
            }
          ],
          "nextCursor": "string (nullable)",
          "hasNext": "boolean"
        }
      }
      ```
*   **Official Source URL**: [Toss OpenAPI - Order History](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json) (path `/api/v1/orders` GET)
*   **Status**: **VERIFIED**
