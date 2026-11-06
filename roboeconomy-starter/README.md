# RoboEconomy — PayPal AI Hackathon starter

Software-first marketplace for robot services, multi-agent negotiation, economic RL, Gazebo/ROS2 simulation and PayPal Sandbox payments.

## What is implemented
- FastAPI API with robot registration, mission creation, bidding, and bid selection using in-memory demo state.
- PayPal Sandbox OAuth, create-order, capture-order endpoints (requires credentials and a PayPal-approved order).
- Next.js frontend with two audience journeys, robot registration, mission creation and bid actions.
- Docker Compose for PostgreSQL and Redis (future persistence integration).
- Gymnasium economic environment and baseline policy; PPO training script if Stable-Baselines3 is installed.
- Typed adapter contracts and ROS2/Gazebo integration plan (not implemented).
- Architecture, security, roadmap, agent handoff prompts, hackathon checklist.

**Important:** This is an executable starter scaffold, not a completed hackathon project. No physics simulator, actual physical robot bridge, LangGraph agents, verified webhooks, or production persistence are implemented yet. The demo bidding logic is deterministic, not AI. Do not claim otherwise.

## Start locally
Prerequisites: Python 3.11+, Node 22+, pnpm, optional Docker.

```bash
cp .env.example .env
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r services/api/requirements.txt
uvicorn services.api.app.main:app --reload --port 8000
```

In a second terminal:
```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000 and API docs at http://localhost:8000/docs.

## PayPal
Populate `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in `.env` and start the backend from the repo root. `POST /api/v1/payments/orders` expects `{ "amount": "12.00", "currency": "USD" }`. The response contains an `approve` link for the buyer. Once the buyer approves, use `POST /api/v1/payments/orders/{order_id}/capture`. The payment is not considered verified until PayPal returns a completed capture. This starter does **not** have durable payment records or webhooks yet.

## Next build priorities
1. SQLAlchemy/Postgres migrations, accounts, role permissions and durable state.
2. Actual PayPal checkout UI, idempotency, signature-verified webhooks and reconciliation.
3. ROS2 Jazzy/Gazebo Harmonic worker with real TurtleBot3 simulation telemetry.
4. LangGraph agents, OR-Tools feasibility, negotiations and recovery.
5. PPO evaluation vs deterministic baselines and real Gazebo validation.
6. Public demo deployment, tests and 3-minute video.

See `docs/` and `AGENTS.md` for detailed handoff instructions.
