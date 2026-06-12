# REAL_API_EVIDENCE_LOG.md

This log captures live requests and response outputs retrieved directly from the official Toss OpenAPI environment (`https://openapi.tossinvest.com`).

*   **Log Generation Time**: 2026-06-12T00:43:46.868Z
*   **Credentials Status**: Running with dummy credential signatures to verify server route bindings and error schemas.

---

## OAuth2 Token

### 1. Request Metadata
*   **HTTP Method**: `POST`
*   **Target URL**: `https://openapi.tossinvest.com/oauth2/token`
*   **Request Headers**:
    ```json
    {
  "Content-Type": "application/x-www-form-urlencoded"
}
    ```
*   **Request Body**:
    ```json
    "grant_type=client_credentials&client_id=c_dummy_client_id_placeholder&client_secret=s_dummy_secret_placeholder"
    ```

### 2. Response Metadata
*   **HTTP Status**: `401 Unauthorized`
*   **Response Headers**:
    ```json
    {
  "cache-control": "no-cache, no-store, max-age=0, must-revalidate",
  "cf-cache-status": "DYNAMIC",
  "cf-ray": "a0a4d2bc98583170-ICN",
  "connection": "keep-alive",
  "content-encoding": "gzip",
  "content-type": "application/json;charset=UTF-8",
  "date": "Fri, 12 Jun 2026 00:43:46 GMT",
  "expires": "0",
  "server": "cloudflare",
  "set-cookie": "__cf_bm=dXYQHzZx6JYxmM5hf0jfBVt7eJ2MUCaj8TvRwSKUqdY-1781225026.0156603-1.0.1.1-C_ghcqAGpvjkUDzR5tMPv6myucFrk4_JsA7xGqibtP7u3Xn0nzboempvnrW7tBBMcaGQxNxpdtLmahglQ8LpL_jKU3rcR4V0LFeISa.az0Tn9OYRz9cacVGvfu_xhKtP; HttpOnly; SameSite=None; Secure; Path=/; Domain=tossinvest.com; Expires=Fri, 12 Jun 2026 01:13:46 GMT",
  "transfer-encoding": "chunked",
  "vary": "accept-encoding",
  "www-authenticate": "Basic realm=\"openapi\"",
  "x-envoy-upstream-service-time": "24",
  "x-ratelimit-limit": "5",
  "x-ratelimit-remaining": "4",
  "x-ratelimit-reset": "1",
  "x-request-id": "c0sDoBWqzjO3ghwY"
}
    ```
*   **Response Payload**:
    ```json
    {
  "error": "invalid_client",
  "error_description": "Client authentication failed: client_id"
}
    ```

---

## Account Discovery

### 1. Request Metadata
*   **HTTP Method**: `GET`
*   **Target URL**: `https://openapi.tossinvest.com/api/v1/accounts`
*   **Request Headers**:
    ```json
    {
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token_placeholder"
}
    ```

### 2. Response Metadata
*   **HTTP Status**: `401 Unauthorized`
*   **Response Headers**:
    ```json
    {
  "cache-control": "no-cache, no-store, max-age=0, must-revalidate",
  "cf-cache-status": "DYNAMIC",
  "cf-ray": "a0a4d2bd08b23170-ICN",
  "connection": "keep-alive",
  "content-length": "114",
  "content-type": "application/json",
  "date": "Fri, 12 Jun 2026 00:43:46 GMT",
  "expires": "0",
  "pragma": "no-cache",
  "referrer-policy": "no-referrer",
  "server": "cloudflare",
  "set-cookie": "__cf_bm=AbTKxpkVmXXJ.fHu0Bvgt0w1UG_vYn75DFp2DnqSnW0-1781225026.0887804-1.0.1.1-dQXG6y5HaT4yBzDSg6lzEac7_Nu3XVH7eXgZxv5RsfKHOQUpmrTQ_vxGddPlLAtiN8dYnr0aJxgIvxrpuEF6T1TlBeA8hBWhFbQxjPSCAA.B7v22J3Tc7RntijAB0piN; HttpOnly; SameSite=None; Secure; Path=/; Domain=tossinvest.com; Expires=Fri, 12 Jun 2026 01:13:46 GMT",
  "strict-transport-security": "max-age=31536000 ; includeSubDomains",
  "www-authenticate": "Bearer realm=\"openapi\", error=\"invalid_token\"",
  "x-content-type-options": "nosniff",
  "x-envoy-upstream-service-time": "3",
  "x-frame-options": "DENY",
  "x-request-id": "c50pGJB76GlC0Xmb",
  "x-xss-protection": "0"
}
    ```
*   **Response Payload**:
    ```json
    {
  "error": {
    "requestId": "c50pGJB76GlC0Xmb",
    "code": "invalid-token",
    "message": "유효하지 않은 토큰입니다."
  }
}
    ```

---

## Holdings

### 1. Request Metadata
*   **HTTP Method**: `GET`
*   **Target URL**: `https://openapi.tossinvest.com/api/v1/holdings`
*   **Request Headers**:
    ```json
    {
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token_placeholder",
  "X-Tossinvest-Account": "1"
}
    ```

### 2. Response Metadata
*   **HTTP Status**: `401 Unauthorized`
*   **Response Headers**:
    ```json
    {
  "cache-control": "no-cache, no-store, max-age=0, must-revalidate",
  "cf-cache-status": "DYNAMIC",
  "cf-ray": "a0a4d2bd894f3d69-ICN",
  "connection": "keep-alive",
  "content-length": "114",
  "content-type": "application/json",
  "date": "Fri, 12 Jun 2026 00:43:46 GMT",
  "expires": "0",
  "pragma": "no-cache",
  "referrer-policy": "no-referrer",
  "server": "cloudflare",
  "set-cookie": "__cf_bm=j9880mnzKy2OMhdi.mWnrpEw5xtt3RoPNW2YK2HZ.e0-1781225026.1691086-1.0.1.1-qxKbwyWhELsXy8re8EQqrTbuxXvgZgS4eOUtiCor7P.ubcDSrrpP4wPP9qYJVpO9Dv7I_L4o85ygDu6dOACIa50LXlF9tkFYa8tmc7U.H7VChJEHgiJZWllHRks6.7m1; HttpOnly; SameSite=None; Secure; Path=/; Domain=tossinvest.com; Expires=Fri, 12 Jun 2026 01:13:46 GMT",
  "strict-transport-security": "max-age=31536000 ; includeSubDomains",
  "www-authenticate": "Bearer realm=\"openapi\", error=\"invalid_token\"",
  "x-content-type-options": "nosniff",
  "x-envoy-upstream-service-time": "3",
  "x-frame-options": "DENY",
  "x-request-id": "cw1sPvaFe03mNYMX",
  "x-xss-protection": "0"
}
    ```
*   **Response Payload**:
    ```json
    {
  "error": {
    "requestId": "cw1sPvaFe03mNYMX",
    "code": "invalid-token",
    "message": "유효하지 않은 토큰입니다."
  }
}
    ```

---

## Buying Power

### 1. Request Metadata
*   **HTTP Method**: `GET`
*   **Target URL**: `https://openapi.tossinvest.com/api/v1/buying-power?currency=KRW`
*   **Request Headers**:
    ```json
    {
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token_placeholder",
  "X-Tossinvest-Account": "1"
}
    ```

### 2. Response Metadata
*   **HTTP Status**: `401 Unauthorized`
*   **Response Headers**:
    ```json
    {
  "cache-control": "no-cache, no-store, max-age=0, must-revalidate",
  "cf-cache-status": "DYNAMIC",
  "cf-ray": "a0a4d2bdc9643170-ICN",
  "connection": "keep-alive",
  "content-length": "114",
  "content-type": "application/json",
  "date": "Fri, 12 Jun 2026 00:43:46 GMT",
  "expires": "0",
  "pragma": "no-cache",
  "referrer-policy": "no-referrer",
  "server": "cloudflare",
  "set-cookie": "__cf_bm=q2E9wV5F7Wa.eP8HrtAjFhDPsLSkTIwU0AbEhapo5Ug-1781225026.2026458-1.0.1.1-FTXacwAa_bwXo8tw_xjvoi_tlKp0mUYlruSQHnSg.tfPjZ8CsX.Ti9BIPcdz374EKRuQXdKDVXKYntOJI8wCJ7DrSU5D6y1WL5LdpQflMtp8WzIV90fU29d4EtVjCnK6; HttpOnly; SameSite=None; Secure; Path=/; Domain=tossinvest.com; Expires=Fri, 12 Jun 2026 01:13:46 GMT",
  "strict-transport-security": "max-age=31536000 ; includeSubDomains",
  "www-authenticate": "Bearer realm=\"openapi\", error=\"invalid_token\"",
  "x-content-type-options": "nosniff",
  "x-envoy-upstream-service-time": "4",
  "x-frame-options": "DENY",
  "x-request-id": "cTJYAQgZELrMwsPD",
  "x-xss-protection": "0"
}
    ```
*   **Response Payload**:
    ```json
    {
  "error": {
    "requestId": "cTJYAQgZELrMwsPD",
    "code": "invalid-token",
    "message": "유효하지 않은 토큰입니다."
  }
}
    ```

---

## Order Create

### 1. Request Metadata
*   **HTTP Method**: `POST`
*   **Target URL**: `https://openapi.tossinvest.com/api/v1/orders`
*   **Request Headers**:
    ```json
    {
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token_placeholder",
  "X-Tossinvest-Account": "1",
  "Content-Type": "application/json"
}
    ```
*   **Request Body**:
    ```json
    {
  "clientOrderId": "test-order-999",
  "symbol": "005930",
  "side": "BUY",
  "orderType": "LIMIT",
  "quantity": "1",
  "price": "50000"
}
    ```

### 2. Response Metadata
*   **HTTP Status**: `401 Unauthorized`
*   **Response Headers**:
    ```json
    {
  "cache-control": "no-cache, no-store, max-age=0, must-revalidate",
  "cf-cache-status": "DYNAMIC",
  "cf-ray": "a0a4d2bdfa853d69-ICN",
  "connection": "keep-alive",
  "content-length": "114",
  "content-type": "application/json",
  "date": "Fri, 12 Jun 2026 00:43:46 GMT",
  "expires": "0",
  "pragma": "no-cache",
  "referrer-policy": "no-referrer",
  "server": "cloudflare",
  "set-cookie": "__cf_bm=YLEJkrDOocqwdZgbMvLmLIi616CJXkWp07efkZAXiC0-1781225026.2388802-1.0.1.1-AAWCwTPJOycmF3ADmgNozzm6lMDKSfESSvkeZJjCxudGvkETmdSIsIsLJlL4UPWmCnXlEwa2dkzNXnI9SdLkjrotDYh58WvmZLK53l6Km6t10G0bNqCl_BcTeULMk99.; HttpOnly; SameSite=None; Secure; Path=/; Domain=tossinvest.com; Expires=Fri, 12 Jun 2026 01:13:46 GMT",
  "strict-transport-security": "max-age=31536000 ; includeSubDomains",
  "www-authenticate": "Bearer realm=\"openapi\", error=\"invalid_token\"",
  "x-content-type-options": "nosniff",
  "x-envoy-upstream-service-time": "2",
  "x-frame-options": "DENY",
  "x-request-id": "cET2kjINNzmUwjHb",
  "x-xss-protection": "0"
}
    ```
*   **Response Payload**:
    ```json
    {
  "error": {
    "requestId": "cET2kjINNzmUwjHb",
    "code": "invalid-token",
    "message": "유효하지 않은 토큰입니다."
  }
}
    ```

---

## Order Detail

### 1. Request Metadata
*   **HTTP Method**: `GET`
*   **Target URL**: `https://openapi.tossinvest.com/api/v1/orders/0d5QIHjmtksbsmM-hBRAgP-ExI8iodGm9fAR5txelPfnMM8XQ_swoJdwL5RpGWMo`
*   **Request Headers**:
    ```json
    {
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token_placeholder",
  "X-Tossinvest-Account": "1"
}
    ```

### 2. Response Metadata
*   **HTTP Status**: `401 Unauthorized`
*   **Response Headers**:
    ```json
    {
  "cache-control": "no-cache, no-store, max-age=0, must-revalidate",
  "cf-cache-status": "DYNAMIC",
  "cf-ray": "a0a4d2be29f23170-ICN",
  "connection": "keep-alive",
  "content-length": "114",
  "content-type": "application/json",
  "date": "Fri, 12 Jun 2026 00:43:46 GMT",
  "expires": "0",
  "pragma": "no-cache",
  "referrer-policy": "no-referrer",
  "server": "cloudflare",
  "set-cookie": "__cf_bm=1JOI87IVQBN.oBrb3VzuEWXWJuS51qaGUSMV2QO.A1g-1781225026.274095-1.0.1.1-Xv3A_fM7xp4vEqeRUocDxDcMJvLgdNLQ.e2ZkyiLZQVhom4hBCnLjQIHJ46djDwomKirlAADb3HewKNaykOu5yjDAG22knRqOdn8O64ICOK46maK6CqZ_dT9qTP69EJL; HttpOnly; SameSite=None; Secure; Path=/; Domain=tossinvest.com; Expires=Fri, 12 Jun 2026 01:13:46 GMT",
  "strict-transport-security": "max-age=31536000 ; includeSubDomains",
  "www-authenticate": "Bearer realm=\"openapi\", error=\"invalid_token\"",
  "x-content-type-options": "nosniff",
  "x-envoy-upstream-service-time": "2",
  "x-frame-options": "DENY",
  "x-request-id": "ckoyycO3sPYX1UbH",
  "x-xss-protection": "0"
}
    ```
*   **Response Payload**:
    ```json
    {
  "error": {
    "requestId": "ckoyycO3sPYX1UbH",
    "code": "invalid-token",
    "message": "유효하지 않은 토큰입니다."
  }
}
    ```

---

