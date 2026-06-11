import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "verify-*.ts",
    "services/trading/verify-*.ts",
    "services/**/verify-*.ts",
    "scratch/**",
    "services/queue/**",
    "services/risk/**",
    "services/ai/**",
    "services/market/**",
    "services/trading/circuit-breaker.ts",
    "services/trading/rate-limiter.ts",
    "services/trading/toss-api.ts",
    "services/trading/paper-trading-service.ts",
    "services/trading/mock-sandbox.ts",
    "app/api/orders/place/route.ts",
    "app/api/toss-proxy/route.ts",
    "app/api/webhooks/toss/route.ts",
  ]),
]);

export default eslintConfig;
