# Architecture Plan: Toss AI Trading Platform v2 (MVP)

This document establishes the official repository structure, system data flows, database schemas, and architectural design patterns for the Toss AI Trading Platform MVP, adhering to the principles defined in [Agent.md](file:///c:/Users/김규호/Desktop/토스%20자동매매%20프로그램%20v2(taste-skill)/Agent.md).

---

## 📂 Proposed Folder Structure

```
/
├── app/                          # Next.js App Router Pages & Route Handlers
│   ├── layout.tsx                # Root layout (Global CSS, Providers)
│   ├── page.tsx                  # Home landing / redirect
│   ├── dashboard/                # Main Trading Portal
│   │   ├── page.tsx              # Portfolio / Summary View
│   │   ├── watchlists/           # Watchlist View
│   │   ├── strategies/           # AI Strategy Manager & Backtesting
│   │   └── history/              # Trade history logs
│   └── api/                      # REST & WebSocket route handlers
│       ├── market-data/          # Stock price feed proxies
│       ├── orders/               # Trade placement and cancellation
│       └── strategies/           # AI strategy controls
│
├── components/                   # Reusable UI Components (Taste Skill styled)
│   ├── ui/                       # Atomic primitives (button, drawer, toast, dialog)
│   ├── dashboard/                # Domain-specific UI components
│   │   ├── portfolio-chart.tsx   # Asset valuation line / area chart
│   │   ├── position-table.tsx    # List of active positions & PnL
│   │   ├── order-terminal.tsx    # Buy/Sell form with validation
│   │   └── watchlist-sidebar.tsx # Sidebar for monitored tickers
│   ├── ai/                       # AI Strategy components
│   │   ├── strategy-card.tsx     # Bot overview (metrics, status toggle)
│   │   └── reasoning-view.tsx    # Explainable AI logic panel
│   └── layout/                   # Global components (navigation, layout shell)
│
├── lib/                          # Framework and client configurations
│   ├── supabase/                 # Supabase client, server, and middleware helpers
│   │   ├── client.ts             # Browser client
│   │   └── server.ts             # Server components client
│   ├── utils.ts                  # Utility functions (class merging, currency format)
│   └── crypto.ts                 # Encryption utilities for secure API keys
│
├── services/                     # Business logic and external API adaptors
│   ├── trading/                  # Trade execution service layer (Adapter Pattern)
│   │   ├── interface.ts          # TossTradingService base interface
│   │   ├── toss-api.ts           # Real Toss Open API implementation
│   │   ├── mock-sandbox.ts       # Simulation-mode brokerage service
│   │   └── index.ts              # Conditional exporter (based on SIMULATION_MODE)
│   ├── ai/                       # AI strategy execution logic
│   │   ├── strategy-engine.ts    # Computes and persists AI trade signals
│   │   └── backtester.ts         # Historical data trade simulator
│   └── market/                   # Real-time price stream managers
│       └── stream-manager.ts     # EventSource / WebSocket connection manager
│
├── supabase/                     # Supabase database configurations
│   ├── config.toml               # Local Supabase configuration
│   └── migrations/               # PostgreSQL migration files (SQL)
│
└── types/                        # TypeScript type definitions
    ├── trading.ts                # Order, holdings, account types
    ├── strategy.ts               # Signal, backtest, metrics types
    └── database.types.ts         # Generated Supabase DB types
```

---

## 🏗️ Core Design Patterns & Systems

### 1. Unified Trading Adapter (Service Layer)
We decoupling the trading execution engine from the actual Toss Broker API. Both live execution and mock trading map to a single interface `TossTradingService`.

```typescript
// services/trading/interface.ts
import { OrderRequest, OrderResponse, Position, AccountBalance } from '@/types/trading';

export interface TossTradingService {
  placeOrder(request: OrderRequest): Promise<OrderResponse>;
  cancelOrder(orderId: string): Promise<boolean>;
  getAccountBalance(): Promise<AccountBalance>;
  getPositions(): Promise<Position[]>;
  getMarketPrice(symbol: string): Promise<number>;
}
```
*   `MockTossService` reads market rates from the stream manager, validates the user's cash balance in Supabase, updates active database positions, and simulates realistic trade fills.
*   `LiveTossService` routes calls to the official Toss Open API REST endpoints, validates rate limits, and signs requests using credentials stored securely.

---

### 2. Order Execution & State Machine
Every order is tracked within a persistent state machine in the database to prevent double execution, transaction leaks, and phantom orders.

```
                  ┌──────────────┐
                  │   PENDING    │ (Order created in local DB)
                  └──────┬───────┘
                         │
                  ┌──────▼───────┐
                  │  SUBMITTED   │ (Sent to broker/mock exchange)
                  └──────┬───────┘
                         │
         ┌───────────────┼───────────────┐
   ┌─────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
   │   FILLED   │  │  REJECTED  │  │ CANCELLED  │ (Terminal states)
   └────────────┘  └────────────┘  └────────────┘
```
*   **Safety Lock:** Before changing an order state to `FILLED` or `REJECTED`, the service must execute a database-level row-lock (`SELECT ... FOR UPDATE`) on the user's portfolio to ensure synchronized cash/position adjustments.
*   **Reconciliation Worker:** A background worker monitors orders in the `SUBMITTED` state that haven't been resolved within 30 seconds, query the broker API, and update the state.

---

### 3. Explainable AI Signaling Engine
AI-generated trading signals must store structured metadata to make their decisions transparent.

```typescript
// types/strategy.ts
export interface AISignal {
  id: string;
  strategyId: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidenceScore: number; // 0.0 to 1.0
  reasoning: {
    indicatorsUsed: { name: string; value: string; condition: string }[];
    marketSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    textSummary: string; // Expose in UI reasoning panel
  };
  riskMetrics: {
    stopLossPrice: number;
    takeProfitPrice: number;
    estimatedSlippage: number;
  };
  timestamp: string;
}
```

---

## 🗄️ Supabase/PostgreSQL Database Schema

### Table: `users`
Tracks user credentials and metadata.
```sql
CREATE TABLE users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `api_credentials`
Stores encrypted credentials for API authentication.
```sql
CREATE TABLE api_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  broker_name TEXT DEFAULT 'toss' NOT NULL,
  encrypted_api_key TEXT NOT NULL, -- Encrypted using pg_sodium or AES-GCM
  encrypted_secret_key TEXT NOT NULL,
  is_simulation BOOLEAN DEFAULT TRUE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `portfolios`
Main balance tracker for individual users.
```sql
CREATE TABLE portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  cash_balance NUMERIC(16, 4) DEFAULT 10000000.0000 NOT NULL, -- Initial mock balance: 10M KRW
  purchasing_power NUMERIC(16, 4) DEFAULT 10000000.0000 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `positions`
Tracks active securities held by portfolios.
```sql
CREATE TABLE positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  qty NUMERIC(12, 4) DEFAULT 0.0000 NOT NULL,
  avg_buy_price NUMERIC(16, 4) DEFAULT 0.0000 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, symbol)
);
```

### Table: `orders`
The transaction ledger for mock and live orders.
```sql
CREATE TYPE order_status AS ENUM ('PENDING', 'SUBMITTED', 'FILLED', 'REJECTED', 'CANCELLED');
CREATE TYPE order_side AS ENUM ('BUY', 'SELL');
CREATE TYPE order_type AS ENUM ('MARKET', 'LIMIT');

CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  side order_side NOT NULL,
  type order_type NOT NULL,
  qty NUMERIC(12, 4) NOT NULL,
  price NUMERIC(16, 4), -- NULL for MARKET orders
  status order_status DEFAULT 'PENDING' NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `ai_strategies`
Defines active bot strategy instances.
```sql
CREATE TABLE ai_strategies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE NOT NULL,
  allocation_pct NUMERIC(5, 2) DEFAULT 0.00 NOT NULL, -- Portfolio percentage allocated to this bot
  config JSONB DEFAULT '{}'::jsonb NOT NULL, -- Strategy specific config variables
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `ai_signals`
Auditable log of signals generated by bots.
```sql
CREATE TABLE ai_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  strategy_id UUID REFERENCES ai_strategies(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL,
  confidence NUMERIC(4, 3) NOT NULL,
  reasoning JSONB NOT NULL,
  risk_metrics JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔒 Security & Access Controls

1.  **Row Level Security (RLS):** All tables (portfolios, orders, positions, strategies) will have `ENABLE ROW LEVEL SECURITY` checked. The RLS policy will look like:
    ```sql
    CREATE POLICY "Users can only access their own portfolio" ON portfolios
      FOR ALL USING (auth.uid() = user_id);
    ```
2.  **PgSodium / Vault Encryption:** Encrypt `api_credentials` on insertion. The Node.js server handles encryption key loading via Environment Variables, ensuring no plain-text brokerage secrets sit in database table blocks.
3.  **Sanitized Outputs:** API route handlers returning positions, order logs, or trade history will automatically strip any credential keys or system trace IDs before shipping data payload to browser clients.
