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
- [ ] LangGraph autonomous agents and OR-Tools optimization
- [~] RL: seeded held-out eval (200 seeds, synthetic dynamics) now reports random 1.13, greedy 3.55, oracle upper bound 3.89 mean net value; PPO not yet trained (needs PyTorch install); no Gazebo validation
- [~] Vercel deployment: live on Vercel with Supabase Postgres; register/mission/bid/award verified live; PayPal Sandbox order creation verified live (real order ID + approve URL); buyer approval + capture + webhook still unverified. Gazebo worker remains separate
