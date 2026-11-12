# RoboEconomy

A marketplace where robot owners list robots, customers publish missions, AI agents negotiate prices and teams, and PayPal Sandbox handles payment. Built for the PayPal AI Hackathon 2026.

**Live demo:** https://roboeconomy.vercel.app (PayPal Sandbox only; no real money)

## How it works
1. **Owner** registers a robot (capability, hourly price, optional minimum price agents may accept).
2. **Customer** publishes a mission ("Inspect four warehouse zones within 20 minutes", budget $60).
3. **Agents** (Agents page) interpret the mission, discover matching robots, negotiate, review risk and recommend. For multi-zone jobs one robot cannot finish in time, a **team planner** splits the zones across robots at minimum cost and negotiates each share.
4. **Customer approves**: awards a robot or a whole team, then pays through **PayPal Sandbox** (one order for the total).
5. **Recovery**: after a failure is injected on the awarded robot, the recovery agent proposes a substitute for the remaining work; the customer approves.
6. Every action and agent decision is written to an **audit log**.

## PayPal usage
- OAuth, Orders v2 create (idempotent `PayPal-Request-Id`), buyer approval redirect, capture on return.
- Webhook endpoint with signature verification and event-ID de-duplication.
- Money is stored as integer minor units. A mission is only marked paid after PayPal returns a completed capture.
- Agents never move money. Payments are customer-approved checkouts. There is no escrow and no automatic split settlement between robot owners; a team mission is one order, and per-robot amounts are bookkeeping only.

## AI usage
- **LLM (OpenAI, default `gpt-4.1-mini`)**: mission interpretation, buyer and robot-owner negotiation agents (turn by turn), risk review, choosing among offers, plain-language explanations. Active only when `OPENAI_API_KEY` is set; each decision records which engine produced it.
- **Hard validators in code** bound every LLM output: owner minimum price, buyer budget, listed price, a concession schedule for the buyer, "choose only an existing offer", and a grounding filter that rejects explanations claiming robot qualities we have no data for. If the model fails or returns bad output, that step falls back to deterministic logic.
- **Team planner**: the zone split is a calculated minimum-cost allocation (exactly solvable at this scale), not an LLM. It assumes **10 minutes per zone**, a labelled planning assumption, not a measurement.
- **Reinforcement learning**: PPO (Stable-Baselines3) trained in a **synthetic** one-step economic environment, evaluated on 500 held-out seeds against random, greedy, rule-based and oracle baselines (`docs/benchmarks/`). Result: PPO 3.45 vs rule-based 3.35, within about one standard error, so **not a significant win**. The policy is not connected to marketplace decisions.

AI tools used to build this project: Claude Code (Anthropic) for code, tests and documentation; OpenAI models inside the running product as described above.

## Limitations (read before judging)
- **No Gazebo/ROS 2 and no physical robot.** There is no simulator or hardware integration, so the hackathon's functional device demonstration is **not met**. The Simulation page says so. Nothing is presented as telemetry.
- Robot failures are **injected manually** and labelled as such.
- Robot capability is **unverified**; every robot is flagged accordingly.
- No user accounts or roles: all data is visible to everyone and the customer awards bids. Owner approval and ownership checks are not implemented.
- Recovery approval is recorded in the audit log only; the extra payment and robot dispatch are not implemented.
- LLM negotiation quality depends on the model. A small model concedes quickly, which is why the buyer's concession schedule is enforced in code.
- Demo robots and missions in the live database are test data.

## Run locally
Prerequisites: Python 3.11+, Node 22+.
```bash
cp .env.example .env            # set DATABASE_URL (SQLite works), PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, optional OPENAI_API_KEY
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn services.api.app.main:app --reload --port 8000
cd apps/web && npm install && npm run dev            # http://localhost:3000
```
Tests: `python -m pytest services/api/tests -q`. RL: `python -m services.rl.train` then `python -m services.rl.evaluate`.

## Deploy (Vercel)
Root `vercel.json` builds the Next.js app and serves the FastAPI app as a Python function (`api/index.py`). Environment variables: `DATABASE_URL` (Postgres, e.g. Supabase transaction pooler), `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_RETURN_URL`, `PAYPAL_CANCEL_URL`, `CORS_ORIGINS`, optional `OPENAI_API_KEY`. Secrets are server-side only and never committed.

## Status and docs
`BUILD_STATUS.md` is the honest, current list of what is done and not done. `AGENTS.md` has the rules for contributors. See `docs/` for architecture and the hackathon checklist.
