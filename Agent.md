# AGENTS.md

## Project Mission

Build a production-grade AI-powered trading platform using the upcoming Toss Open API.

The platform should provide a professional trading experience inspired by modern brokerage platforms, with a strong focus on usability, performance, reliability, and automation.

The goal is to create the best AI-assisted trading experience possible, not merely a working prototype.

---

## Engineer Mindset

Act as a principal software engineer with 10+ years of experience.

You are responsible for:

* Architecture
* Frontend
* Backend
* Infrastructure
* Security
* Performance
* Scalability

Write code as if you will personally maintain this project for the next five years.

Prefer production-quality solutions over shortcuts.

---

## Core Product

AI-powered trading platform

Primary features:

* Real-time market data
* Portfolio tracking
* Order management
* AI trading strategies
* Backtesting
* Trade history
* Watchlists
* Alerts
* Risk management
* Strategy analytics
* Multi-account support
* Automated execution through Toss Open API

---

## Frontend Philosophy

Design should be inspired by the usability and clarity of modern brokerage platforms.

Prioritize:

* Fast information scanning
* Minimal cognitive load
* Professional trading workflows
* Real-time responsiveness
* Mobile support
* Accessibility

Avoid:

* Generic AI-generated dashboards
* Template-style SaaS layouts
* Excessive gradients
* Decorative UI without purpose

---

## Taste Skill Requirements

Apply Taste Skill principles to all UI work.

Focus on:

* Typography
* Layout hierarchy
* Spacing systems
* Information density
* Interaction quality
* Professional visual polish

Every screen should feel intentional.

---

## Technology Preferences

Preferred stack:

* Next.js
* React
* TypeScript
* Tailwind
* Supabase
* PostgreSQL
* WebSocket streaming
* Server Actions
* Edge-ready architecture

Prefer existing project conventions before introducing new dependencies.

---

## Trading System Requirements

Critical requirements:

* Position management
* Stop loss support
* Take profit support
* Order validation
* Trade logging
* Strategy audit trail
* Error recovery
* Retry handling
* Rate limit protection

Never assume order execution succeeded.

Always verify execution results.

---

## Security Requirements

Treat all trading actions as high risk.

Requirements:

* Input validation
* Authentication
* Authorization
* Audit logs
* Secure secret management

Never expose API credentials.

Never hardcode secrets.

---

## AI Strategy Requirements

AI-generated strategies must be:

* Explainable
* Backtestable
* Measurable
* Auditable

Avoid black-box decisions whenever possible.

Always expose reasoning, metrics, and risk information.

---

## Multi-Agent Collaboration

This repository may be modified by multiple AI agents.

Before making changes:

1. Read existing code.
2. Read AGENTS.md.
3. Follow existing architecture.
4. Respect previous implementation decisions.

Do not rewrite large sections of working code without strong justification.

Prefer incremental improvements.

---

## Code Quality Standards

Required:

* Strict TypeScript
* Strong typing
* Reusable components
* Unit tests when appropriate
* Clear naming
* Modular architecture

Avoid:

* any types
* dead code
* duplicated logic
* premature optimization

---

## Final Rule

When multiple solutions are possible:

Choose the solution that best balances:

1. Reliability
2. Maintainability
3. Trading safety
4. User experience
5. Long-term scalability

Always optimize for a production-grade trading platform.
