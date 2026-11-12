"""Agent layer: interpretation, discovery, bounded negotiation, risk review, recovery, explanation.

Honesty rules (see AGENTS.md):
- Every decision row records which engine produced it. "rule-based" means deterministic code, not an LLM.
  An LLM is used only when LLM_API_KEY / ANTHROPIC_API_KEY is configured, and only for interpretation and
  explanation text. LLM output never sets prices or awards anything.
- Prices, ownership, capability, availability and budget are enforced by deterministic validators.
- Agents only *recommend*. A human awards the bid and pays; nothing here moves money.
"""
import json
import os
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from services.api.app.database import AgentDecision, AgentRun, AuditLog, Bid, Mission, Robot, SessionLocal

router = APIRouter()
TASK_TYPES = ("inspection", "navigation", "delivery")
MAX_ROUNDS = 3
ZONE_MINUTES = 10  # ASSUMPTION: minutes one robot needs per zone. No telemetry exists, so this is a labelled planning constant, not a measurement.
DEFAULT_MIN_FRACTION = 0.75  # owner floor when the owner has not set one: 75% of listed rate


def get_db():
    with SessionLocal() as session:
        yield session


def audit(db: Session, actor: str, action: str, resource: str, detail: dict | None = None) -> None:
    db.add(AuditLog(actor=actor, action=action, resource=resource, detail=json.dumps(detail or {})))


def _llm_key() -> str | None:
    return os.getenv("LLM_API_KEY") or os.getenv("ANTHROPIC_API_KEY")


def _llm_model() -> str:
    return os.getenv("LLM_MODEL") or "claude-sonnet-5-5"


async def llm_text(system: str, user: str, max_tokens: int = 400) -> str | None:
    """One Anthropic Messages call. Returns None when no key is configured or the call fails."""
    key = _llm_key()
    if not key:
        return None
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={"model": _llm_model(), "max_tokens": max_tokens, "system": system, "messages": [{"role": "user", "content": user}]},
            )
        if r.status_code != 200:
            return None
        return "".join(b.get("text", "") for b in r.json().get("content", []) if b.get("type") == "text")
    except httpx.HTTPError:
        return None


class Recorder:
    """Writes ordered, auditable decision rows for one run."""

    def __init__(self, db: Session, mission_id: str, kind: str):
        self.db, self.mission_id, self.seq = db, mission_id, 0
        self.run = AgentRun(mission_id=mission_id, kind=kind)
        db.add(self.run)
        db.flush()

    def log(self, agent: str, action: str, engine: str, evidence: dict, explanation: str) -> None:
        self.seq += 1
        self.db.add(AgentDecision(run_id=self.run.id, mission_id=self.mission_id, seq=self.seq, agent=agent, action=action,
                                  engine=engine, evidence=json.dumps(evidence), explanation=explanation))
        audit(self.db, f"agent:{agent}", action, f"mission:{self.mission_id}", {"run_id": self.run.id, **evidence})


# ---------------------------------------------------------------- interpreter
def rule_interpret(text: str) -> dict:
    t = text.lower()
    task = next((k for k, words in {"delivery": ("deliver", "carry", "transport", "move"), "navigation": ("navigate", "go to", "waypoint", "patrol"),
                                   "inspection": ("inspect", "scan", "survey", "check", "report")}.items() if any(w in t for w in words)), None)
    zones = re.search(r"(\d+|one|two|three|four|five)\s+(?:warehouse\s+)?zones?", t)
    words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}
    mins = re.search(r"(\d+)\s*(?:min|minutes)", t)
    return {"task_type": task, "zones": (int(words.get(zones.group(1), zones.group(1))) if zones else None),
            "deadline_minutes": int(mins.group(1)) if mins else None, "urgent": any(w in t for w in ("urgent", "asap", "immediately"))}


async def interpret(description: str) -> tuple[dict, str]:
    spec, engine = rule_interpret(description), "rule-based"
    raw = await llm_text(
        "Extract a robot mission spec. Reply with ONLY compact JSON: "
        '{"task_type":"inspection|navigation|delivery|null","zones":int|null,"deadline_minutes":int|null,"urgent":bool}',
        description, 150)
    if raw:
        try:
            cand = json.loads(raw[raw.index("{"): raw.rindex("}") + 1])
            if cand.get("task_type") in (*TASK_TYPES, None):  # validator: reject anything outside the schema
                spec = {k: cand.get(k) for k in ("task_type", "zones", "deadline_minutes", "urgent")}
                engine = f"llm:{_llm_model()}"
        except (ValueError, json.JSONDecodeError):
            pass
    return spec, engine


# ---------------------------------------------------------------- negotiation
def owner_floor(robot: Robot) -> int:
    return robot.min_price_minor if robot.min_price_minor else int(round(robot.rate_minor * DEFAULT_MIN_FRACTION))


def negotiate(ask: int, floor: int, budget: int) -> dict:
    """Deterministic bounded concession protocol. The owner floor and buyer budget are hard limits."""
    rounds: list[dict] = []
    if floor > budget:
        return {"agreed": False, "price_minor": None, "rounds": rounds, "reason": "owner minimum price exceeds the mission budget"}
    buyer_cap = min(budget, ask)
    for r in range(1, MAX_ROUNDS + 1):
        offer = int(round(ask * 0.5 + (buyer_cap - ask * 0.5) * r / MAX_ROUNDS))
        counter = int(round(ask - (ask - floor) * r / MAX_ROUNDS))
        counter = max(counter, floor)
        rounds.append({"round": r, "buyer_offer_minor": offer, "robot_counter_minor": counter})
        if offer >= counter:
            price = max(counter, floor)
            assert floor <= price <= budget  # validator
            return {"agreed": True, "price_minor": price, "rounds": rounds, "reason": f"agreed in round {r}"}
    return {"agreed": False, "price_minor": None, "rounds": rounds, "reason": f"no agreement within {MAX_ROUNDS} rounds"}


def risk_flags(robot: Robot) -> list[str]:
    flags = ["capability not verified by a simulator or hardware test"]
    if robot.source != "physical":
        flags.append(f"robot is {robot.source}, not physical hardware")
    if robot.status == "registered-not-connected":
        flags.append("robot is registered but not connected to a live bridge")
    return flags


def usd(m: int) -> str:
    return f"${m / 100:.2f}"


async def explain(facts: str, fallback: str) -> tuple[str, str]:
    text = await llm_text("Explain this robot-marketplace decision to a non-technical customer in two sentences. Use only the given facts; do not add numbers.", facts, 160)
    return (text.strip(), f"llm:{_llm_model()}") if text else (fallback, "rule-based")


# ---------------------------------------------------------------- endpoints
def _bid_out(b: Bid):
    return {"id": b.id, "robot_id": b.robot_id, "price_usd": b.price_minor / 100, "status": b.status.lower(), "team_id": b.team_id, "share_zones": b.share_zones}


@router.post("/api/v1/missions/{mission_id}/agent-run")
async def agent_run(mission_id: str, db: Session = Depends(get_db)):
    mission = db.get(Mission, mission_id)
    if not mission:
        raise HTTPException(404, "Mission not found")
    if mission.status != "PUBLISHED":
        raise HTTPException(409, "Agents only negotiate for missions that are open for bids")
    rec = Recorder(db, mission_id, "auction")

    spec, eng = await interpret(mission.description)
    note = "interpretation matches the selected task type" if spec["task_type"] in (None, mission.task_type) else f"interpretation suggests '{spec['task_type']}' but the buyer selected '{mission.task_type}'; the buyer's choice is kept"
    rec.log("mission_interpreter", "interpreted_mission", eng, {"spec": spec, "task_type_used": mission.task_type}, note)

    robots = list(db.scalars(select(Robot)))
    candidates, excluded = [], []
    for r in robots:
        why = "capability mismatch" if r.capability != mission.task_type else "marked unavailable" if r.available is False else None
        (excluded.append({"robot": r.name, "reason": why}) if why else candidates.append(r))
    rec.log("discovery", "discovered_robots", "rule-based", {"candidates": [c.name for c in candidates], "excluded": excluded},
            f"{len(candidates)} robot(s) match '{mission.task_type}' and are available; {len(excluded)} excluded.")

    deals = []
    existing = {b.robot_id for b in db.scalars(select(Bid).where(Bid.mission_id == mission_id))}
    for r in candidates:
        floor, ask = owner_floor(r), r.rate_minor
        res = negotiate(ask, floor, mission.budget_minor)
        rec.log("negotiation", "negotiated_with_robot", "rule-based",
                {"robot": r.name, "ask_minor": ask, "owner_floor_minor": floor, "budget_minor": mission.budget_minor, **res},
                f"{r.name}: " + (f"agreed at {usd(res['price_minor'])} ({res['reason']}); owner floor {usd(floor)} respected." if res["agreed"] else f"no deal: {res['reason']}."))
        if res["agreed"]:
            deals.append((r, res["price_minor"]))
            if r.id not in existing:
                db.add(Bid(mission_id=mission_id, robot_id=r.id, price_minor=res["price_minor"]))

    ranked = sorted(deals, key=lambda d: d[1])
    rec.log("risk", "reviewed_risk", "rule-based", {"flags": {r.name: risk_flags(r) for r, _ in ranked}},
            "Risk flags are listed per robot. None are blocking, but capability is unverified until a simulator or hardware test exists." if ranked else "No agreed offers to review.")

    recommendation = None
    if ranked:
        best, price = ranked[0]
        fallback = f"Recommended {best.name} at {usd(price)}, the lowest agreed price within your {usd(mission.budget_minor)} budget and above the owner's minimum."
        text, eng2 = await explain(f"best={best.name}; price={usd(price)}; budget={usd(mission.budget_minor)}; offers={len(ranked)}", fallback)
        recommendation = {"robot_id": best.id, "robot": best.name, "price_usd": price / 100, "requires_approval": True}
        rec.log("explanation", "explained_recommendation", eng2, recommendation, text)
    else:
        rec.log("explanation", "no_recommendation", "rule-based", {}, "No robot reached an agreement within the budget and owner limits.")
    rec.run.summary = json.dumps({"offers": len(ranked), "recommendation": recommendation})
    db.commit()
    bids = [_bid_out(b) for b in db.scalars(select(Bid).where(Bid.mission_id == mission_id))]
    return {"run_id": rec.run.id, "recommendation": recommendation, "bids": bids}


# ---------------------------------------------------------------- coalition (team) planning
def allocate(zones: int, cap: int, per_zone_cost: dict[str, float]) -> dict[str, int] | None:
    """Minimum-cost split of `zones` across robots when each robot can cover at most `cap` zones in time.
    Costs are linear per zone, so filling the cheapest robots first is optimal. None if capacity is insufficient."""
    out, left = {}, zones
    for rid, _ in sorted(per_zone_cost.items(), key=lambda kv: kv[1]):
        if left <= 0:
            break
        n = min(cap, left)
        if n > 0:
            out[rid], left = n, left - n
    return out if left <= 0 else None


class TeamIn(BaseModel):
    zones: int | None = Field(default=None, ge=1, le=50)
    deadline_minutes: int | None = Field(default=None, ge=1, le=1440)


@router.post("/api/v1/missions/{mission_id}/team-run")
async def team_run(mission_id: str, data: TeamIn | None = None, db: Session = Depends(get_db)):
    """Coalition agent: split a multi-zone mission across several robots when one robot cannot finish by the deadline.
    Zones and deadline come from the mission text (or the buyer's override). Per-zone time is an assumption (ZONE_MINUTES)."""
    data = data or TeamIn()
    mission = db.get(Mission, mission_id)
    if not mission:
        raise HTTPException(404, "Mission not found")
    if mission.status != "PUBLISHED":
        raise HTTPException(409, "Agents only plan teams for missions that are open for bids")
    rec = Recorder(db, mission_id, "team")
    spec, eng = await interpret(mission.description)
    zones = data.zones or spec.get("zones")
    deadline = data.deadline_minutes or spec.get("deadline_minutes")
    src = "buyer override" if (data.zones or data.deadline_minutes) else "mission text"
    rec.log("mission_interpreter", "interpreted_mission", eng, {"spec": spec, "zones_used": zones, "deadline_used": deadline, "source": src},
            f"Zones: {zones or 'not found'}; deadline: {str(deadline) + ' min' if deadline else 'not found'} (from {src}).")

    def finish(summary: dict, status: str = "COMPLETED"):
        rec.run.status, rec.run.summary = status, json.dumps(summary)
        db.commit()
        return {"run_id": rec.run.id, **summary}

    if not zones or zones < 2 or not deadline:
        rec.log("coalition", "no_team_needed", "rule-based", {}, "A team needs a mission with at least 2 zones and a deadline. Provide them in the mission text or as an override.")
        return finish({"team": None, "reason": "needs zones >= 2 and a deadline"})
    cap = deadline // ZONE_MINUTES
    rec.log("coalition", "time_model", "rule-based", {"zone_minutes_assumed": ZONE_MINUTES, "max_zones_per_robot": cap, "solo_minutes": zones * ZONE_MINUTES},
            f"Assuming {ZONE_MINUTES} min per zone (an assumption, not measured), one robot covers at most {cap} zone(s) in {deadline} min; the job needs {zones * ZONE_MINUTES} min solo.")
    if cap < 1:
        rec.log("coalition", "infeasible", "rule-based", {}, f"Even one zone takes longer than {deadline} minutes under the time assumption.")
        return finish({"team": None, "reason": "deadline shorter than one zone"}, "FAILED")
    if cap >= zones:
        rec.log("coalition", "no_team_needed", "rule-based", {}, "One robot can cover every zone before the deadline, so a team is not needed. Use Run agents for the cheapest single robot.")
        return finish({"team": None, "reason": "one robot suffices"})

    pool = [r for r in db.scalars(select(Robot)) if r.capability == mission.task_type and r.available is not False]
    rec.log("discovery", "discovered_robots", "rule-based", {"candidates": [r.name for r in pool]}, f"{len(pool)} available robot(s) match '{mission.task_type}'.")
    deals: dict[str, dict] = {}
    while True:
        alloc = allocate(zones, cap, {r.id: r.rate_minor / zones for r in pool})
        if not alloc:
            rec.log("coalition", "no_feasible_team", "rule-based", {"robots": len(pool), "needed": -(-zones // cap)},
                    f"Not enough capacity: {len(pool)} robot(s) can cover at most {len(pool) * cap} of {zones} zones in time.")
            return finish({"team": None, "reason": "not enough robots to meet the deadline"}, "FAILED")
        failed = None
        for rid, n in alloc.items():
            r = next(x for x in pool if x.id == rid)
            frac = n / zones
            ask, floor, bud = int(round(r.rate_minor * frac)), int(round(owner_floor(r) * frac)), int(round(mission.budget_minor * frac))
            res = negotiate(ask, floor, bud)
            rec.log("negotiation", "negotiated_share", "rule-based", {"robot": r.name, "zones": n, "ask_minor": ask, "owner_floor_minor": floor, "budget_minor": bud, **res},
                    f"{r.name} for {n}/{zones} zones: " + (f"agreed at {usd(res['price_minor'])}; owner floor {usd(floor)} respected." if res["agreed"] else f"no deal: {res['reason']}; trying a different team."))
            if res["agreed"]:
                deals[rid] = {"robot": r, "zones": n, "price": res["price_minor"]}
            else:
                failed = rid
                break
        if failed is None:
            break
        pool = [r for r in pool if r.id != failed]
        deals.clear()

    total = sum(d["price"] for d in deals.values())
    assert total <= mission.budget_minor  # validator: each share is capped at its fraction of the budget
    team_id = str(uuid.uuid4())
    members = []
    for rid, d in deals.items():
        db.add(Bid(mission_id=mission_id, robot_id=rid, price_minor=d["price"], team_id=team_id, share_zones=d["zones"]))
        members.append({"robot_id": rid, "robot": d["robot"].name, "zones": d["zones"], "price_usd": d["price"] / 100})
    rec.log("risk", "reviewed_risk", "rule-based", {"flags": {d["robot"].name: risk_flags(d["robot"]) for d in deals.values()}, "team_risk": "a team has more points of failure and needs every member to finish"},
            "Capability is unverified for every member, and a team depends on all members finishing. Recovery can replace one after a failure.")
    team = {"team_id": team_id, "members": members, "total_usd": total / 100, "requires_approval": True}
    fallback = f"Recommended a team of {len(members)}: " + ", ".join(f"{m['robot']} ({m['zones']} zones, ${m['price_usd']:.2f})" for m in members) + f". Total {usd(total)} within your {usd(mission.budget_minor)} budget; one robot alone would need {zones * ZONE_MINUTES} min against your {deadline} min deadline."
    text, eng2 = await explain(f"team={members}; total={usd(total)}; budget={usd(mission.budget_minor)}; zones={zones}; deadline={deadline}min; solo_needs={zones * ZONE_MINUTES}min", fallback)
    rec.log("explanation", "explained_team", eng2, team, text)
    return finish({"team": team})


class FailureIn(BaseModel):
    failed_robot_id: str
    reason: str = Field(default="battery_low", pattern="^(battery_low|unavailable|fault)$")
    remaining_fraction: float = Field(default=0.5, gt=0, le=1)


@router.post("/api/v1/missions/{mission_id}/recovery")
async def recovery(mission_id: str, data: FailureIn, db: Session = Depends(get_db)):
    """Recovery agent. The failure is INJECTED by the caller (there is no simulator); the response says so."""
    mission = db.get(Mission, mission_id)
    if not mission or not mission.awarded_bid_id:
        raise HTTPException(404, "Mission has no awarded robot to recover from")
    awarded = db.get(Bid, mission.awarded_bid_id)
    failed = db.get(Robot, data.failed_robot_id)
    if not failed or awarded.robot_id != failed.id:
        raise HTTPException(409, "failed_robot_id is not the robot awarded to this mission")
    rec = Recorder(db, mission_id, "recovery")
    failed.available = False
    rec.log("monitor", "failure_injected", "operator-injected",
            {"robot": failed.name, "reason": data.reason, "source": "manual injection; no simulator or hardware telemetry"},
            f"{failed.name} reported '{data.reason}'. This failure was injected manually for the demo, not detected from telemetry.")
    remaining_budget = int(round(mission.budget_minor * data.remaining_fraction))  # share of the customer budget still unspent on that work
    subs = [r for r in db.scalars(select(Robot)) if r.id != failed.id and r.capability == mission.task_type and r.available is not False]
    rec.log("discovery", "found_substitutes", "rule-based", {"substitutes": [s.name for s in subs]}, f"{len(subs)} substitute robot(s) available.")
    offers = []
    for r in subs:
        ask = int(round(r.rate_minor * data.remaining_fraction))
        floor = int(round(owner_floor(r) * data.remaining_fraction))
        res = negotiate(ask, floor, remaining_budget)
        rec.log("negotiation", "negotiated_with_robot", "rule-based", {"robot": r.name, "ask_minor": ask, "owner_floor_minor": floor, "budget_minor": remaining_budget, **res},
                f"{r.name}: " + (f"offers to finish the remaining {int(data.remaining_fraction * 100)}% for {usd(res['price_minor'])}." if res["agreed"] else f"no deal: {res['reason']}."))
        if res["agreed"]:
            offers.append((r, res["price_minor"]))
    offers.sort(key=lambda o: o[1])
    proposal = None
    if offers:
        best, price = offers[0]
        proposal = {"substitute_robot_id": best.id, "substitute": best.name, "price_usd": price / 100, "remaining_fraction": data.remaining_fraction,
                    "requires_approval": True, "extra_payment_required": True}
        rec.log("recovery", "proposed_replacement", "rule-based", proposal,
                f"Proposed {best.name} to finish the remaining work for {usd(price)}. Needs your approval; any extra payment would go through a new PayPal checkout (not wired up yet).")
    else:
        rec.log("recovery", "no_replacement", "rule-based", {}, "No substitute could finish the work within the remaining budget and owner limits.")
    rec.run.status = "AWAITING_APPROVAL" if proposal else "FAILED"
    rec.run.summary = json.dumps({"proposal": proposal})
    db.commit()
    return {"run_id": rec.run.id, "proposal": proposal, "failure_source": "injected"}


@router.post("/api/v1/missions/{mission_id}/recovery/{run_id}/approve")
def approve_recovery(mission_id: str, run_id: str, db: Session = Depends(get_db)):
    run = db.get(AgentRun, run_id)
    if not run or run.mission_id != mission_id or run.kind != "recovery":
        raise HTTPException(404, "Recovery run not found")
    if run.status != "AWAITING_APPROVAL":
        raise HTTPException(409, f"Run is {run.status}")
    run.status = "APPROVED"
    audit(db, "customer", "recovery.approved", f"mission:{mission_id}", {"run_id": run_id, "proposal": json.loads(run.summary).get("proposal")})
    db.commit()
    return {"run_id": run_id, "status": run.status, "note": "Approval recorded. The additional payment and robot dispatch are not implemented."}


@router.get("/api/v1/missions/{mission_id}/decisions")
def decisions(mission_id: str, db: Session = Depends(get_db)):
    rows = db.scalars(select(AgentDecision).where(AgentDecision.mission_id == mission_id).order_by(AgentDecision.created_at, AgentDecision.seq))
    runs = {r.id: r for r in db.scalars(select(AgentRun).where(AgentRun.mission_id == mission_id))}
    return [{"id": d.id, "run_id": d.run_id, "run_kind": runs[d.run_id].kind, "run_status": runs[d.run_id].status, "seq": d.seq, "agent": d.agent, "action": d.action,
             "engine": d.engine, "evidence": json.loads(d.evidence), "explanation": d.explanation, "at": d.created_at.isoformat()} for d in rows]


@router.get("/api/v1/audit")
def audit_log(limit: int = 100, db: Session = Depends(get_db)):
    rows = db.scalars(select(AuditLog).order_by(AuditLog.ts.desc()).limit(min(limit, 500)))
    return [{"id": a.id, "at": a.ts.isoformat(), "actor": a.actor, "action": a.action, "resource": a.resource, "detail": json.loads(a.detail)} for a in rows]


@router.get("/api/v1/rl/benchmarks")
def rl_benchmarks():
    """Serves the committed, reproducible evaluation file. Returns available=False if none exists."""
    f = Path(__file__).resolve().parents[3] / "docs" / "benchmarks" / "rl_evaluation.json"
    if not f.exists():
        return {"available": False}
    return {"available": True, **json.loads(f.read_text(encoding="utf-8"))}
