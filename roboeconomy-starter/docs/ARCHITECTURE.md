# Architecture

Next.js web -> FastAPI API -> services: marketplace, intelligence, payments, robot bridge -> PostgreSQL, Redis, audit/outbox.

Robot adapters: GazeboRobotAdapter (ROS2/Gazebo), PhysicalROS2Adapter (guarded), ReplayRobotAdapter (read-only), MockRobotAdapter (tests only).

Authoritative state: Gazebo/ROS2 for simulated physical movement, PayPal capture API and verified webhooks for money, PostgreSQL for application workflow, RL checkpoint for policy outputs. Never let the frontend synthesize physical telemetry.

Mission state: DRAFT -> PUBLISHED -> BIDDING -> AWARDED -> PAYMENT_PENDING -> READY -> RUNNING -> RECOVERING -> COMPLETED/FAILED/CANCELLED.

Payment state: PROPOSED -> APPROVAL_REQUIRED -> ORDER_CREATED -> BUYER_APPROVAL_PENDING -> CAPTURE_PENDING -> CAPTURED, with failure/reconciliation states. Separate mission and payment states.

Economic RL: fast Gymnasium environment trained on parameterized physical costs; held-out validation in Gazebo. LLM agents operate at mission/exception boundaries, not every physics tick.

Security: scoped robot credentials, outbound TLS bridge, operator emergency stop, RBAC, explicit financial approval, verified webhooks, idempotency, structured audit logs.
