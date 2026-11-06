# Instructions for coding agents

Read README.md, docs/PRODUCT.md, docs/ARCHITECTURE.md, docs/IMPLEMENTATION.md and docs/HACKATHON.md before editing.

Never claim an integration works without running tests. Do not mock payment success in live demos. Never animate browser positions as if they were Gazebo telemetry. Keep financial approval separate from agent recommendations. Use typed contracts, test changes, and update BUILD_STATUS.md.

## Workstreams
- Platform: PostgreSQL, auth, durable mission state, event outbox.
- Payments: PayPal Sandbox checkout, capture, verified webhooks, reconciliation.
- Robotics: ROS2 Jazzy + Gazebo Harmonic, TurtleBot3, Nav2, telemetry adapter.
- Intelligence: LangGraph mission/discovery/auction/negotiation/risk/recovery agents, OR-Tools.
- RL: Gymnasium economics, PPO training, baselines, seeded evaluation.
- Frontend: accessible two-sided marketplace, robot onboarding, mission control, earnings.
- QA: integration tests, security, docs, video and deployment.

## First milestone
Finish the actual PayPal sandbox checkout and durable robot/mission/bid flow, then connect Gazebo. Do not start with decorative agent dashboards.
