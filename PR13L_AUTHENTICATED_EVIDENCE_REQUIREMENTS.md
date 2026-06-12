# PR13L Authenticated Evidence Requirements

This document defines the schema, request headers, HTTP status codes, and data type validation rules required for validating successful operations against the official Toss OpenAPI environment (`https://openapi.tossinvest.com`) after obtaining valid API credentials.

---

## 1. OAuth2 Token Request

### 1.1 Raw Request Signature
*   **Method**: `POST`
*   **URL**: `https://openapi.tossinvest.com/oauth2/token`
*   **Headers**:
    ```http
    Content-Type: application/x-www-form-urlencoded
    ```
*   **Body**:
    ```http
    grant_type=client_credentials&client_id={VALID_CLIENT_ID}&client_secret={VALID_CLIENT_SECRET}
    ```

### 1.2 Raw Response Envelope
*   **HTTP Status**: `200 OK`
*   **Headers**:
    ```http
    Content-Type: application/json;charset=UTF-8
    Cache-Control: no-cache, no-store, max-age=0, must-revalidate
    X-RateLimit-Limit: 5
    ```
*   **Payload**:
    ```json
    {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ0b3NzIiwiZXhwIjoxNzgxMzA4NDAwdQ.signature_data",
      "token_type": "Bearer",
      "expires_in": 86400
    }
    ```

### 1.3 Field Schema & Validation Rules
| Field Name | Type | Validation Criteria |
| :--- | :--- | :--- |
| `access_token` | `string` | Must be a non-empty, valid JWT format string (3 segments split by `.`). |
| `token_type` | `string` | Must be strictly equal to `"Bearer"`. |
| `expires_in` | `integer` | Must be a positive integer, typically `86400` (24 hours). |

---

## 2. Account Discovery

### 2.1 Raw Request Signature
*   **Method**: `GET`
*   **URL**: `https://openapi.tossinvest.com/api/v1/accounts`
*   **Headers**:
    ```http
    Authorization: Bearer {VALID_ACCESS_TOKEN}
    ```

### 2.2 Raw Response Envelope
*   **HTTP Status**: `200 OK`
*   **Headers**:
    ```http
    Content-Type: application/json;charset=UTF-8
    ```
*   **Payload**:
    ```json
    {
      "result": [
        {
          "accountNo": "1234567890",
          "accountSeq": 1,
          "accountType": "BROKERAGE"
        }
      ]
    }
    ```

### 2.3 Field Schema & Validation Rules
| Field Name | Type | Validation Criteria |
| :--- | :--- | :--- |
| `result` | `array` | Must be a non-empty array of account objects. |
| `result[].accountNo` | `string` | Alphanumeric account identifier. |
| `result[].accountSeq` | `integer` | Must be a positive integer, serving as the required sequence key. |
| `result[].accountType` | `string` | Must match valid type options (typically `"BROKERAGE"`). |

---

## 3. Holdings Retrieval

### 3.1 Raw Request Signature
*   **Method**: `GET`
*   **URL**: `https://openapi.tossinvest.com/api/v1/holdings`
*   **Headers**:
    ```http
    Authorization: Bearer {VALID_ACCESS_TOKEN}
    X-Tossinvest-Account: {VALID_ACCOUNT_SEQ}
    ```

### 3.2 Raw Response Envelope
*   **HTTP Status**: `200 OK`
*   **Headers**:
    ```http
    Content-Type: application/json;charset=UTF-8
    ```
*   **Payload**:
    ```json
    {
      "result": {
        "totalPurchaseAmount": {
          "currency": "KRW",
          "value": "50000.00"
        },
        "items": [
          {
            "symbol": "005930",
            "quantity": "1.00000000",
            "averagePurchasePrice": "50000.0000"
          }
        ]
      }
    }
    ```

### 3.3 Field Schema & Validation Rules
| Field Name | Type | Validation Criteria |
| :--- | :--- | :--- |
| `result.totalPurchaseAmount.currency` | `string` | Currency identifier (e.g., `"KRW"`, `"USD"`). |
| `result.totalPurchaseAmount.value` | `string` | Must be a valid decimal format string representing total purchase cash. |
| `result.items` | `array` | List of holdings objects. Can be empty if no stocks are held. |
| `result.items[].symbol` | `string` | Alphanumeric ticker symbol (e.g., `"005930"`, `"AAPL"`). |
| `result.items[].quantity` | `string` | **CRITICAL**: Must be a string representation of decimal. No floating-point. |
| `result.items[].averagePurchasePrice`| `string` | **CRITICAL**: Must be a string representation of decimal. No floating-point. |

---

## 4. Buying Power Retrieval

### 4.1 Raw Request Signature
*   **Method**: `GET`
*   **URL**: `https://openapi.tossinvest.com/api/v1/buying-power?currency=KRW`
*   **Headers**:
    ```http
    Authorization: Bearer {VALID_ACCESS_TOKEN}
    X-Tossinvest-Account: {VALID_ACCOUNT_SEQ}
    ```

### 4.2 Raw Response Envelope
*   **HTTP Status**: `200 OK`
*   **Headers**:
    ```http
    Content-Type: application/json;charset=UTF-8
    ```
*   **Payload**:
    ```json
    {
      "result": {
        "currency": "KRW",
        "cashBuyingPower": "10000000.00"
      }
    }
    ```

### 4.3 Field Schema & Validation Rules
| Field Name | Type | Validation Criteria |
| :--- | :--- | :--- |
| `result.currency` | `string` | Must match the requested currency query parameter (e.g., `"KRW"`). |
| `result.cashBuyingPower` | `string` | **CRITICAL**: Must be a string representation of decimal. No raw numbers. |

---

## 5. Order Creation

### 5.1 Raw Request Signature
*   **Method**: `POST`
*   **URL**: `https://openapi.tossinvest.com/api/v1/orders`
*   **Headers**:
    ```http
    Authorization: Bearer {VALID_ACCESS_TOKEN}
    X-Tossinvest-Account: {VALID_ACCOUNT_SEQ}
    Content-Type: application/json
    ```
*   **Body**:
    ```json
    {
      "clientOrderId": "test-order-abc-123",
      "symbol": "005930",
      "side": "BUY",
      "orderType": "LIMIT",
      "quantity": "1",
      "price": "60000"
    }
    ```

### 5.2 Raw Response Envelope
*   **HTTP Status**: `200 OK`
*   **Headers**:
    ```http
    Content-Type: application/json;charset=UTF-8
    ```
*   **Payload**:
    ```json
    {
      "result": {
        "orderId": "ord_toss_777abc",
        "clientOrderId": "test-order-abc-123"
      }
    }
    ```

### 5.3 Field Schema & Validation Rules
| Field Name | Type | Validation Criteria |
| :--- | :--- | :--- |
| `result.orderId` | `string` | Unique server-side identifier issued by Toss. Non-empty string. |
| `result.clientOrderId` | `string` | Must match the unique identifier sent in the request payload. |

---

## 6. Order Detail Retrieval

### 6.1 Raw Request Signature
*   **Method**: `GET`
*   **URL**: `https://openapi.tossinvest.com/api/v1/orders/ord_toss_777abc`
*   **Headers**:
    ```http
    Authorization: Bearer {VALID_ACCESS_TOKEN}
    X-Tossinvest-Account: {VALID_ACCOUNT_SEQ}
    ```

### 6.2 Raw Response Envelope
*   **HTTP Status**: `200 OK`
*   **Headers**:
    ```http
    Content-Type: application/json;charset=UTF-8
    ```
*   **Payload**:
    ```json
    {
      "result": {
        "orderId": "ord_toss_777abc",
        "clientOrderId": "test-order-abc-123",
        "symbol": "005930",
        "side": "BUY",
        "orderType": "LIMIT",
        "quantity": "1.00000000",
        "price": "60000.0000",
        "status": "FILLED",
        "executions": [
          {
            "executionId": "exec_001_xyz",
            "quantity": "1.00000000",
            "price": "60000.0000",
            "executedAt": "2026-06-12T09:44:00Z"
          }
        ]
      }
    }
    ```

### 6.3 Field Schema & Validation Rules
| Field Name | Type | Validation Criteria |
| :--- | :--- | :--- |
| `result.orderId` | `string` | Unique order identifier. |
| `result.clientOrderId` | `string` | Original client order ID. |
| `result.symbol` | `string` | Alphanumeric ticker symbol. |
| `result.side` | `string` | Must be `"BUY"` or `"SELL"`. |
| `result.orderType` | `string` | Must be `"LIMIT"` or `"MARKET"`. |
| `result.quantity` | `string` | Decimal format string of the ordered quantity. |
| `result.price` | `string` | Decimal format string of the ordered price. |
| `result.status` | `string` | Enums: `"PENDING"`, `"FILLED"`, `"PARTIALLY_FILLED"`, `"CANCELLED"`. |
| `result.executions` | `array` | List of trade matches. Empty array if status is `"PENDING"`. |
| `result.executions[].executionId` | `string` | Idempotent transaction execution identifier. |
| `result.executions[].quantity` | `string` | Decimal format string of matched quantity. |
| `result.executions[].price` | `string` | Decimal format string of match execution price. |
| `result.executions[].executedAt` | `string` | ISO 8601 UTC timestamp format. |
