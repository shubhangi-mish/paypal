# Detailed implementation roadmap

## P0: Real PayPal vertical slice
- Migrate in-memory state to SQLAlchemy 2 + Alembic/PostgreSQL.
- Add organizations, memberships, robots, capabilities, missions, bids, contracts, payment intents, PayPal transactions, agent runs, simulation runs, audit events.
- Use integer minor units and ISO currency; enforce tenant isolation.
- Implement backend PayPal OAuth, create order, buyer approval URL, capture, status lookup, webhook signature verification, replay protection, idempotency and reconciliation.
- E2E: register simulated robot -> create mission -> bid -> award -> PayPal sandbox approval -> capture -> persisted status.

## P1: Physical simulation
- Ubuntu 24.04 + ROS2 Jazzy + Gazebo Harmonic in separate worker.
- TurtleBot3 model, Nav2, world with three inspection zones and charging area.
- Publish /odom, battery model and task result; adapter streams time-stamped telemetry to FastAPI.
- Test mission success, unreachable goal, robot disconnect and recovery. Source all pose data from Gazebo.

## P2: Intelligence
- LangGraph: interpreter, discovery, auction, negotiation, coalition, risk, recovery, payment, explanation.
- Typed tool outputs; OR-Tools validates capacity, budget, deadline, travel feasibility.
- Independent owner policies, max rounds and timeout. Approval gate for spending.

## P3: RL
- Implement economic observation/action/reward environment.
- Train PPO using Stable-Baselines3, compare greedy and rule-based baselines across held-out seeds.
- Record completion, net value, cost, deadline violations, assistance, recovery and constraint violations.
- Validate trained decisions in fresh Gazebo runs.

## P4: Experience and submission
- Clean onboarding, marketplace, mission control, intelligence and earnings.
- AG Grid optional; Bryntum optional. Deploy API/web separately from Gazebo worker.
- README, open-source LICENSE, demo URL or complete setup, public YouTube video under 3 minutes.
