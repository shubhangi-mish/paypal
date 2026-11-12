# Build status

## Implemented starter
- [x] Repository scaffold and docs
- [x] FastAPI durable SQLAlchemy marketplace API (SQLite local fallback; PostgreSQL via DATABASE_URL)
- [x] Next.js app shell with 9 screens (Home, Marketplace, Missions, My Robots, Earnings, AI Agents, Simulation, Analytics, Settings) driven by real API data; empty/error/loading states; no sample data. Simulation, AI agents and robot images are explicitly shown as not implemented. Visually checked locally in headless Chrome at desktop width only
- [x] PayPal sandbox create/capture API integration (credentials required; untested against a live sandbox account)
- [x] API tests (5) cover marketplace flow, budget check, missing credentials, and checkout/capture state machine with PayPal HTTP mocked (mock only; not proof PayPal works)
- [x] Gymnasium environment and optional PPO script
- [x] Adapter interface

## Not implemented
- [~] Durable PostgreSQL persistence: models and production URL support implemented; Alembic/RBAC still pending
- [~] PayPal checkout: mission-bound idempotent order/capture records and webhook signature verification implemented; requires configured Sandbox credentials for live validation
- [~] Gazebo/ROS2: executable Jazzy odometry bridge added; full TurtleBot3/Nav2 world and API telemetry ingestion pending
- [ ] Physical robot pairing and secure bridge
- [~] Agents (rule-based engine, optional LLM for interpretation/explanation text when LLM_API_KEY is set; no LLM key configured so far): interpreter, discovery, 3-round negotiation bounded by owner floor and buyer budget, risk flags, recovery after an INJECTED failure, explanations, audit log. Verified live on Vercel. No LangGraph, no OR-Tools/coalitions, no LLM run yet
- [~] RL: seeded held-out eval (200 seeds, synthetic dynamics) now reports random 1.13, greedy 3.55, oracle upper bound 3.89 mean net value; PPO not yet trained (needs PyTorch install); no Gazebo validation
- [~] Vercel deployment: live on Vercel with Supabase Postgres; register/mission/bid/award verified live; PayPal Sandbox order creation verified live (real order ID + approve URL); buyer approval + capture + webhook still unverified. Gazebo worker remains separate

## RL result (synthetic environment, 500 held-out seeds, docs/benchmarks/rl_evaluation.json)
random 0.65, greedy 3.10, rule-based 3.35, PPO 3.45 (100k steps), oracle upper bound 3.55 mean net value (std err about 0.12-0.17).
PPO is not significantly better than the rule-based baseline (difference is within one standard error). Not connected to marketplace decisions; not Gazebo validated.

## Not done
Gazebo/ROS 2 simulation (no VM by decision), auth/roles, PayPal buyer-approval+capture and webhook delivery not yet observed live, extra payment for recovery, Alembic.
