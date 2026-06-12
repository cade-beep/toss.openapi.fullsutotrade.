# PR13R Transition Evidence Gap Analysis

This analysis maps the gaps between order status behaviors declared in the OpenAPI spec and real-world runtime behavior. For each of the 10 order statuses, it defines what is proven by the OpenAPI schema, what remains unproven, the runtime evidence required, and the specific test orders needed to collect that evidence.

---

## 1. Status Evidence Gap Registry

### 1.1 PENDING
*   **What is proven by OpenAPI schema**: The enum value `PENDING` is valid. The schema returns standard parameters (e.g., `symbol`, `quantity`, `price`).
*   **What is NOT proven**: The timing latency before acceptance, and whether null/empty fields (e.g., `canceledAt`, `execution` sub-properties) are returned as `null` or completely omitted from the payload keys.
*   **What runtime evidence is still required**: A successful `200 OK` response payload containing `"status": "PENDING"`.
*   **What test order is needed**: Place a limit buy order for 1 share of a highly liquid stock (e.g. Samsung Electronics `005930`) with a price set **10% below** the current market price. This forces the order to stay open in the exchange queue.

---

### 1.2 PENDING_CANCEL
*   **What is proven by OpenAPI schema**: The enum value `PENDING_CANCEL` is valid.
*   **What is NOT proven**: Whether the gateway actually exposes this intermediate state to client queries or transitions directly to `CANCELED` too quickly for polling to observe.
*   **What runtime evidence is still required**: A successful response payload containing `"status": "PENDING_CANCEL"`.
*   **What test order is needed**: Place a far-out limit buy order (set 10% below market price). Send a cancel request, and query/poll the order detail endpoint immediately at high frequency (e.g. 50ms intervals) before the broker issues final confirmation.

---

### 1.3 PENDING_REPLACE
*   **What is proven by OpenAPI schema**: The enum value `PENDING_REPLACE` is valid.
*   **What is NOT proven**: Polling visibility and state duration before modification is acknowledged.
*   **What runtime evidence is still required**: A successful response payload containing `"status": "PENDING_REPLACE"`.
*   **What test order is needed**: Place a far-out limit buy order. Send a replace request modifying the price (e.g. from -10% below market to -9% below market). Poll `/api/v1/orders/{orderId}` immediately at high frequency during the transition.

---

### 1.4 PARTIAL_FILLED
*   **What is proven by OpenAPI schema**: The enum value `PARTIAL_FILLED` is valid.
*   **What is NOT proven**: Multi-fill calculations: how the `execution` summary object behaves during incremental matches (does `averageFilledPrice` recalculate correctly, and does it trigger multiple updates?).
*   **What runtime evidence is still required**: A successful response payload containing `"status": "PARTIAL_FILLED"` with active matches.
*   **What test order is needed**: Place a limit buy order for a relatively illiquid stock, or a large volume order slightly below the ask price, so that matches occur in fragments across multiple counter-parties.

---

### 1.5 FILLED
*   **What is proven by OpenAPI schema**: The enum value `FILLED` is valid.
*   **What is NOT proven**: Verification of the singular `execution` summary object structure. Exact scale and precision formatting of commission and tax properties on completed trades.
*   **What runtime evidence is still required**: A successful response payload containing `"status": "FILLED"` with execution details.
*   **What test order is needed**: Place a market buy order for 1 share of a liquid stock during market hours. The order matches instantly, allowing verification of the final execution block.

---

### 1.6 CANCELED
*   **What is proven by OpenAPI schema**: The enum value `CANCELED` is valid.
*   **What is NOT proven**: Timezone rules (e.g., KST vs UTC offsets) and format strings of `canceledAt`.
*   **What runtime evidence is still required**: A successful response payload containing `"status": "CANCELED"`.
*   **What test order is needed**: Place a limit buy order set 10% below market price. Wait 2 seconds, send a delete request to `/api/v1/orders/{orderId}`, and fetch the final order detail payload.

---

### 1.7 REJECTED
*   **What is proven by OpenAPI schema**: The enum value `REJECTED` is valid.
*   **What is NOT proven**: Location of rejection reasons (is there a text explanation or a machine-readable reject code inside the order payload?).
*   **What runtime evidence is still required**: A successful response payload containing `"status": "REJECTED"`.
*   **What test order is needed**: Attempt to place a limit buy order with an invalid price (e.g., a price that violates the tick size rules of the exchange, or an extreme amount exceeding limit constraints).

---

### 1.8 CANCEL_REJECTED
*   **What is proven by OpenAPI schema**: The enum value `CANCEL_REJECTED` is valid.
*   **What is NOT proven**: Transition behavior: does the order automatically revert back to its pre-cancel status (`PENDING` or `PARTIAL_FILLED`) immediately after the reject event is registered?
*   **What runtime evidence is still required**: A successful response payload containing `"status": "CANCEL_REJECTED"`.
*   **What test order is needed**: Place a market buy order that matches instantly (transitioning to `FILLED`). Attempt to send a cancellation request to the gateway for the completed order ID.

---

### 1.9 REPLACE_REJECTED
*   **What is proven by OpenAPI schema**: The enum value `REPLACE_REJECTED` is valid.
*   **What is NOT proven**: State reversion behaviors.
*   **What runtime evidence is still required**: A successful response payload containing `"status": "REPLACE_REJECTED"`.
*   **What test order is needed**: Place a market buy order that matches instantly. Attempt to send a modification request to the gateway for the completed order ID.

---

### 1.10 REPLACED
*   **What is proven by OpenAPI schema**: The enum value `REPLACED` is valid.
*   **What is NOT proven**: Order ID links: does the parent order's status transition to `REPLACED` while a new child order is registered with a separate active ID?
*   **What runtime evidence is still required**: A successful response payload containing `"status": "REPLACED"`.
*   **What test order is needed**: Place a far-out limit buy order. Send a replace request to modify the order price. Once the replacement request is processed successfully, query the parent order detail to verify the status is indeed `REPLACED`.
