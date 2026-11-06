# Build status

## Implemented starter
- [x] Repository scaffold and docs
- [x] FastAPI durable SQLAlchemy marketplace API (SQLite local fallback; PostgreSQL via DATABASE_URL)
- [x] Next.js basic UI
- [x] PayPal sandbox create/capture API integration (credentials required; untested against a live sandbox account)
- [x] Gymnasium environment and optional PPO script
- [x] Adapter interface

## Not implemented
- [~] Durable PostgreSQL persistence: models and production URL support implemented; Alembic/RBAC still pending
- [~] PayPal checkout: mission-bound idempotent order/capture records and webhook signature verification implemented; requires configured Sandbox credentials for live validation
- [~] Gazebo/ROS2: executable Jazzy odometry bridge added; full TurtleBot3/Nav2 world and API telemetry ingestion pending
- [ ] Physical robot pairing and secure bridge
- [ ] LangGraph autonomous agents and OR-Tools optimization
- [~] Seeded held-out RL evaluation script added; dependencies/checkpoint are absent locally, and no Gazebo validation has been claimed
- [~] Vercel deployment: Python serverless entrypoint and Vercel routing added; managed Postgres and separate Gazebo worker deployment remain required
