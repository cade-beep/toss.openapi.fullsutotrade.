# PR13N Runtime Confidence Matrix

This matrix evaluates specification alignments, runtime verification statuses, and remaining assumptions across the primary Toss OpenAPI endpoints, derived from [PR13M_ASSUMPTION_AUDIT.md](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/PR13M_ASSUMPTION_AUDIT.md), [REAL_API_EVIDENCE_LOG.md](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/REAL_API_EVIDENCE_LOG.md), and [PR13L_AUTHENTICATED_EVIDENCE_REQUIREMENTS.md](file:///c:/Users/김규호/Desktop/토스 자동매매 프로그램 v2(taste-skill)/PR13L_AUTHENTICATED_EVIDENCE_REQUIREMENTS.md).

---

## 1. Summary of Build & Release Readiness

> [!CAUTION]
> **No Endpoints are Currently Production Ready (`Production Ready = NO`)**:
> Due to the lack of valid production credentials, no successful `200 OK` responses have been executed against the live gateway. Consequently, runtime confidence for resource queries remains bounded by the official specification schemas (`50%`). 
> 
> **Critical Blockers**:
> The **Order Detail** endpoint has the lowest confidence score (`30%`) due to discrepancy assumptions:
> - `result.clientOrderId` is expected by client-side adapters but is not declared in the official Swagger schema for order details.
> - `result.executions` is assumed to be an array of executions, whereas the official spec dictates a singular `result.execution` summary object.

---

## 2. Runtime Confidence Matrix

| Target Endpoint | Spec Confidence | Runtime Confidence | Live Success Evidence? | Live Error Evidence? | Assumed Fields | Verified Fields | Production Ready |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- | :---: |
| **OAuth2 Token**<br>`/oauth2/token` | 100% | 90% | **NO** | **YES** | None. | `grant_type`, `client_id`, `client_secret` (Spec verified); `error`, `error_description` (Live verified); headers (Rate limit details, Request IDs) (Live verified). | **NO** |
| **Account Discovery**<br>`/api/v1/accounts` | 100% | 50% | **NO** | **YES** | None. | `result`, `result[].accountNo`, `result[].accountSeq`, `result[].accountType` (Spec verified); standard error envelope (Live verified). | **NO** |
| **Holdings**<br>`/api/v1/holdings` | 100% | 50% | **NO** | **YES** | None. | `result`, `result.totalPurchaseAmount`, `result.marketValue`, `result.profitLoss`, `result.items[]` details (Spec verified); standard error envelope (Live verified). | **NO** |
| **Buying Power**<br>`/api/v1/buying-power` | 100% | 50% | **NO** | **YES** | None. | `result.currency`, `result.cashBuyingPower` (Spec verified); standard error envelope (Live verified). | **NO** |
| **Order Create**<br>`/api/v1/orders` POST | 100% | 50% | **NO** | **YES** | None. | Body parameters (`symbol`, `side`, `orderType`, `quantity`, `price`), Response fields (`result.orderId`, `result.clientOrderId`) (Spec verified); standard error envelope (Live verified). | **NO** |
| **Order Detail**<br>`/api/v1/orders/{id}` | 80% | 30% | **NO** | **YES** | `result.clientOrderId`<br>`result.executions` | `result.orderId`, `result.symbol`, `result.status`, `result.execution` (singular summary metrics) (Spec verified); standard error envelope (Live verified). | **NO** |

---

## 3. Recommended Remediation Roadmap

1. **Obtain Sandbox Credentials**: To progress from `50%` to `100%` runtime verification, authenticated sandbox calls must be executed to gather real `200 OK` schema payloads.
2. **Reconcile Order Detail Adapter**:
   - The trading service adapter mapping order details must handle `result.execution` as a singular summary object instead of an array.
   - The adapter must fallback to tracking client order ID mappings locally (or in Supabase) if `result.clientOrderId` is indeed omitted from the server response.
