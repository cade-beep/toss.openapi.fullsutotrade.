# Stabilization Pass & Component Modularization Walkthrough

We have completed the **Stabilization Pass** and **Component Modularization** for the simplified MVP architecture of the Toss AI Trading Platform v2. No external server/Supabase API bindings or live Toss Broker connections are implemented, relying on rich mock data, local storage cache, and client-side simulations.

The Next.js 16 build is fully verified, compiling with **zero type or syntax warnings** in 5.8 seconds.

---

## 📁 Repository Folder Structure

```
/
├── app/                          # Next.js App Router
│   ├── globals.css               # CSS variables and Tailwind imports
│   ├── layout.tsx                # Root layout configuration
│   └── page.tsx                  # Home wrapper (WorkstationProvider wrapper)
├── components/                   # Modular Dashboard UI Components
│   ├── ui/                       # Reusable visual components
│   │   └── dialog.tsx            # Alert / Confirmation Modal for Panic Sell
│   ├── layout/                   # Global workstation layouts
│   │   ├── header.tsx            # Header toolbar with Panic Sell modal trigger
│   │   └── footer.tsx            # Audit executions log & system ledger
│   └── dashboard/                # Main panel widgets
│       ├── ai-strategies.tsx     # AI Bot toggles and signal reasoning log
│       ├── market-chart.tsx      # SVG stock chart & market detail info
│       ├── order-ticket.tsx      # Buy/Sell market/limit order ticket
│       ├── portfolio.tsx         # Account valuation & cash metrics
│       ├── positions.tsx         # Positions holding table with quick close
│       ├── watchlist.tsx         # Watchlist ticker management & add form
│       └── workstation-dashboard.tsx # Main dashboard workspace grid layout
├── lib/                          # Framework configuration & context
│   └── context/
│       └── workstation-context.tsx # React Context provider managing global state
├── services/                     # Trading, AI, and Market service adapters
│   ├── ai/                       # Bot strategy & backtesting services
│   ├── market/                   # Live stock prices stream adapters
│   └── trading/                  # Toss Open API & Sandbox trading service adapters
└── types/                        # TypeScript type definitions
```

---

## 📄 Completed Stabilization Key Items

### 1. Reusable Component Division & Workstation Context
*   **[lib/context/workstation-context.tsx](file:///c:/Users/김규호/Desktop/토스%20자동매매%20프로그램%20v2(taste-skill)/lib/context/workstation-context.tsx):** Split the state logic into a unified `WorkstationProvider` React Context. This isolates all state definitions, local storage syncing, mock timers, and order execution helpers in one file.
*   **Subpanel Modularization:** Separated the 1,000+ line `app/page.tsx` file into 10 highly maintainable, focused components (Header, Footer, Portfolio, Watchlist, Chart, Positions, Order Entry, Bots, Confirmation Dialog, and Dashboard Layout).
*   **Re-render Optimization:** Decoupled states using context selectors. Input fields in `order-ticket.tsx` and watchlists forms are isolated, reducing input lag caused by 2.5-second price ticks.

### 2. Panic Sell Confirmation Modal
*   **[components/ui/dialog.tsx](file:///c:/Users/김규호/Desktop/토스%20자동매매%20프로그램%20v2(taste-skill)/components/ui/dialog.tsx):** Created a reusable, terminal-styled `ConfirmationDialog` modal with a blurred backdrop and warning banner.
*   **Safety Integration:** The "PANIC SELL ALL" button in the Header now triggers this confirmation warning modal to prevent accidental portfolio liquidation.

### 3. Clean Imports & Strict Type Safety
*   Removed all unused React imports (such as `useRef` and duplicate `useEffect` hooks) to ensure strict production lint and build compliance.
*   Fixed context interfaces to import standard model components from `types/trading` and `types/strategy`.

### 4. UI Refinement & Information Density Pass
*   **Geist Sans Typography:** Integrated Next.js `Geist Sans` at the body root of `globals.css` for a beautiful, premium, modern typeface hierarchy.
*   **Reduced Chart Dominance:** Compacted the stock chart height to `h-[220px]` and SVG graph to `h-28` to let the Positions panel expand dynamically.
*   **Positions Focus:** Set the Positions panel to `flex-1` to maximize vertical viewport space for active position tracking.
*   **Aesthetic & Color Harmonization:**
    *   Transitioned bright/excessive borders to a subtle dark `border-zinc-900` grid.
    *   Used custom-themed colors (`#00d287` for BUY, `#f43f5e` for SELL) with dynamic chart coloring (grows green/red depending on performance).
    *   Replaced solid active side selectors in the Order Ticket with ghost-tinted selectors (`bg-emerald-950/15` and `bg-[#f43f5e]/15`).
*   **AI Prominence:** AI Bot control cards display glowing green status tags (`RUNNING` / `STANDBY`). AI Signal cards are containerized in color-coded boxes and present a monospaced confidence bar (`[■■■■■■■□□□]`) for high visual quality.

