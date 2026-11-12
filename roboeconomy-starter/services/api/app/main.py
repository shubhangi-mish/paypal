import os
import uuid
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Literal

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from services.api.app.database import Base, Bid, Mission, PaymentIntent, Robot, SessionLocal, WebhookEvent, engine, ensure_columns
from services.api.app.agents import router as agents_router, audit

load_dotenv(Path(__file__).resolve().parents[3] / ".env")
app = FastAPI(title="RoboEconomy API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()], allow_methods=["*"], allow_headers=["*"])
Base.metadata.create_all(engine)
ensure_columns()
app.include_router(agents_router)
def get_db():
    with SessionLocal() as session:
        yield session
def minor(v: Decimal) -> int:
    return int((v * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
def robot_out(x: Robot):
    return {"id":x.id,"name":x.name,"owner":x.owner,"capability":x.capability,"rate_usd":x.rate_minor / 100,"source":x.source,"status":x.status,"model":x.model,"available":x.available is not False,"min_price_usd":(x.min_price_minor/100 if x.min_price_minor else None),"capability_verified":False}
def mission_out(x: Mission):
    return {"id":x.id,"description":x.description,"task_type":x.task_type,"budget_usd":x.budget_minor / 100,"currency":x.currency,"status":x.status.lower(),"awarded_bid_id":x.awarded_bid_id,"created_at":x.created_at.isoformat() if x.created_at else None}

class RobotIn(BaseModel):
    name: str = Field(min_length=2)
    owner: str = Field(min_length=2)
    capability: Literal["inspection", "navigation", "delivery"] = "inspection"
    rate_usd: Decimal = Field(gt=0)
    source: Literal["simulated", "physical", "replay"] = "simulated"
    model: str | None = Field(default=None, max_length=120)
    min_price_usd: Decimal | None = Field(default=None, gt=0)

class RobotPatch(BaseModel):
    available: bool | None = None
    rate_usd: Decimal | None = Field(default=None, gt=0)
    min_price_usd: Decimal | None = Field(default=None, gt=0)

class MissionIn(BaseModel):
    description: str = Field(min_length=8)
    task_type: Literal["inspection", "navigation", "delivery"] = "inspection"
    budget_usd: Decimal = Field(gt=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)

class BidIn(BaseModel):
    robot_id: str
    price_usd: Decimal = Field(gt=0)

class OrderIn(BaseModel):
    mission_id: str

@app.get("/health")
def health():
    return {"status": "ok", "mode": "durable-sqlalchemy", "database": engine.url.get_backend_name()}

@app.get("/api/v1/robots")
def list_robots(db: Session = Depends(get_db)):
    return [robot_out(x) for x in db.scalars(select(Robot))]

@app.post("/api/v1/robots")
def add_robot(data: RobotIn, db: Session = Depends(get_db)):
    item = Robot(name=data.name, owner=data.owner, capability=data.capability, rate_minor=minor(data.rate_usd), source=data.source, model=data.model, min_price_minor=minor(data.min_price_usd) if data.min_price_usd else None)
    db.add(item); audit(db, "owner", "robot.registered", f"robot:{item.id}", {"name": item.name, "source": item.source}); db.commit()
    return robot_out(item)

@app.patch("/api/v1/robots/{robot_id}")
def patch_robot(robot_id: str, data: RobotPatch, db: Session = Depends(get_db)):
    robot = db.get(Robot, robot_id)
    if not robot:
        raise HTTPException(404, "Robot not found")
    if data.available is not None:
        robot.available = data.available
    if data.rate_usd is not None:
        robot.rate_minor = minor(data.rate_usd)
    if data.min_price_usd is not None:
        robot.min_price_minor = minor(data.min_price_usd)
    db.commit()
    return robot_out(robot)

@app.get("/api/v1/system")
def system_status():
    """Real configuration state for the UI. Nothing here is simulated."""
    return {
        "database": engine.url.get_backend_name(),
        "paypal": {
            "configured": bool(os.getenv("PAYPAL_CLIENT_ID") and os.getenv("PAYPAL_CLIENT_SECRET")),
            "environment": os.getenv("PAYPAL_ENV", "sandbox"),
            "webhook_configured": bool(os.getenv("PAYPAL_WEBHOOK_ID")),
        },
        "simulator": {"connected": False, "detail": "No Gazebo/ROS2 worker is reporting telemetry to this API."},
        "agents": {"implemented": True, "llm_configured": bool(os.getenv("LLM_API_KEY") or os.getenv("ANTHROPIC_API_KEY")), "decision_engine": "llm+validators" if (os.getenv("LLM_API_KEY") or os.getenv("ANTHROPIC_API_KEY")) else "rule-based+validators"},
    }

@app.get("/api/v1/payments")
def list_payments(db: Session = Depends(get_db)):
    out = []
    for p in db.scalars(select(PaymentIntent)):
        mission = db.get(Mission, p.mission_id)
        out.append({"id": p.id, "mission_id": p.mission_id, "mission": mission.description if mission else None,
                    "amount_usd": p.amount_minor / 100, "currency": p.currency, "status": p.status,
                    "paypal_order_id": p.paypal_order_id, "capture_id": p.capture_id,
                    "created_at": p.created_at.isoformat() if p.created_at else None})
    return out

@app.get("/api/v1/missions")
def list_missions(db: Session = Depends(get_db)):
    return [mission_out(x) for x in db.scalars(select(Mission))]

@app.post("/api/v1/missions")
def add_mission(data: MissionIn, db: Session = Depends(get_db)):
    item = Mission(description=data.description, task_type=data.task_type, budget_minor=minor(data.budget_usd), currency=data.currency.upper())
    db.add(item); audit(db, "customer", "mission.created", f"mission:{item.id}", {"budget_minor": item.budget_minor}); db.commit()
    return mission_out(item)

@app.get("/api/v1/missions/{mission_id}/bids")
def list_bids(mission_id: str, db: Session = Depends(get_db)):
    if not db.get(Mission, mission_id):
        raise HTTPException(404, "Mission not found")
    return [{"id":b.id,"mission_id":b.mission_id,"robot_id":b.robot_id,"price_usd":b.price_minor/100,"status":b.status.lower(),"team_id":b.team_id,"share_zones":b.share_zones} for b in db.scalars(select(Bid).where(Bid.mission_id == mission_id))]

@app.post("/api/v1/missions/{mission_id}/bids")
def add_bid(mission_id: str, data: BidIn, db: Session = Depends(get_db)):
    mission = db.get(Mission, mission_id)
    robot = db.get(Robot, data.robot_id)
    if not mission or not robot:
        raise HTTPException(404, "Mission or robot not found")
    if mission.status != "PUBLISHED" or robot.capability != mission.task_type:
        raise HTTPException(409, "Incompatible robot or closed mission")
    if minor(data.price_usd) > mission.budget_minor:
        raise HTTPException(400, "Bid exceeds budget")
    item = Bid(mission_id=mission_id, robot_id=robot.id, price_minor=minor(data.price_usd))
    db.add(item); db.commit()
    return {"id":item.id,"mission_id":item.mission_id,"robot_id":item.robot_id,"price_usd":item.price_minor/100,"status":item.status.lower()}

@app.post("/api/v1/missions/{mission_id}/award-team/{team_id}")
def award_team(mission_id: str, team_id: str, db: Session = Depends(get_db)):
    mission = db.get(Mission, mission_id)
    bids = list(db.scalars(select(Bid).where(Bid.mission_id == mission_id, Bid.team_id == team_id)))
    if not mission or not bids:
        raise HTTPException(404, "Mission or team not found")
    if mission.status != "PUBLISHED":
        raise HTTPException(409, "Already awarded")
    total = sum(b.price_minor for b in bids)
    if total > mission.budget_minor:
        raise HTTPException(400, "Team total exceeds budget")
    for b in bids:
        b.status = "AWARDED"
    mission.status = "PAYMENT_PENDING"; mission.awarded_bid_id = bids[0].id
    audit(db, "customer", "team.awarded", f"mission:{mission_id}", {"team_id": team_id, "bid_ids": [b.id for b in bids], "total_minor": total}); db.commit()
    return mission_out(mission)

@app.post("/api/v1/missions/{mission_id}/award/{bid_id}")
def award(mission_id: str, bid_id: str, db: Session = Depends(get_db)):
    mission, bid = db.get(Mission, mission_id), db.get(Bid, bid_id)
    if not mission or not bid or bid.mission_id != mission_id:
        raise HTTPException(404, "Mission or bid not found")
    if mission.status != "PUBLISHED":
        raise HTTPException(409, "Already awarded")
    if bid.team_id:
        raise HTTPException(409, "This offer is one share of a team plan; award the whole team instead")
    mission.status="PAYMENT_PENDING"; mission.awarded_bid_id=bid_id; bid.status="AWARDED"; audit(db, "customer", "bid.awarded", f"mission:{mission_id}", {"bid_id": bid_id, "price_minor": bid.price_minor}); db.commit()
    return mission_out(mission)

async def paypal_token():
    client_id = os.getenv("PAYPAL_CLIENT_ID")
    secret = os.getenv("PAYPAL_CLIENT_SECRET")
    if not client_id or not secret:
        raise HTTPException(503, "Configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET")
    base = "https://api-m.sandbox.paypal.com" if os.getenv("PAYPAL_ENV", "sandbox") == "sandbox" else "https://api-m.paypal.com"
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(f"{base}/v1/oauth2/token", auth=(client_id, secret), data={"grant_type": "client_credentials"})
    if r.status_code != 200:
        raise HTTPException(502, "PayPal OAuth failed")
    return base, r.json()["access_token"]

@app.post("/api/v1/payments/orders")
async def create_order(data: OrderIn, db: Session = Depends(get_db)):
    mission = db.get(Mission, data.mission_id)
    if not mission or mission.status != "PAYMENT_PENDING" or not mission.awarded_bid_id:
        raise HTTPException(409, "Mission is not awaiting payment")
    total = sum(b.price_minor for b in db.scalars(select(Bid).where(Bid.mission_id == mission.id, Bid.status == "AWARDED")))  # one bid, or every share of a team
    payment = db.scalar(select(PaymentIntent).where(PaymentIntent.mission_id == mission.id))
    if payment and payment.paypal_order_id:
        if payment.status == "CAPTURED":
            raise HTTPException(409, "This mission has already been paid")
        # Re-fetch the order so the buyer gets the approval link again instead of a dead end.
        base, token = await paypal_token()
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(f"{base}/v2/checkout/orders/{payment.paypal_order_id}", headers={"Authorization": f"Bearer {token}"})
        links = r.json().get("links", []) if r.status_code == 200 else []
        approve_url = next((l["href"] for l in links if l.get("rel") in ("approve", "payer-action")), None)
        if not approve_url:
            host = "www.sandbox.paypal.com" if os.getenv("PAYPAL_ENV", "sandbox") == "sandbox" else "www.paypal.com"
            approve_url = f"https://{host}/checkoutnow?token={payment.paypal_order_id}"
        return {"payment_intent_id": payment.id, "order_id": payment.paypal_order_id, "approve_url": approve_url, "status": payment.status, "idempotent": True}
    payment = payment or PaymentIntent(mission_id=mission.id, amount_minor=total, currency=mission.currency, request_id=str(uuid.uuid4()))
    db.add(payment); db.flush()
    base, token = await paypal_token()
    payload = {"intent": "CAPTURE", "purchase_units": [{"reference_id": mission.id, "amount": {"currency_code": payment.currency, "value": f"{payment.amount_minor / 100:.2f}"}}], "application_context": {"return_url": os.getenv("PAYPAL_RETURN_URL", "http://localhost:3000/?checkout=success"), "cancel_url": os.getenv("PAYPAL_CANCEL_URL", "http://localhost:3000/?checkout=cancelled")}}
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(f"{base}/v2/checkout/orders", headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "PayPal-Request-Id": payment.request_id}, json=payload)
    if r.status_code not in (200, 201):
        db.rollback()
        raise HTTPException(502, f"PayPal create order failed: {r.status_code}")
    body = r.json(); payment.paypal_order_id = body["id"]; payment.status = "BUYER_APPROVAL_PENDING"; audit(db, "system", "paypal.order_created", f"mission:{mission.id}", {"order_id": payment.paypal_order_id}); db.commit()
    approve_url = next((link["href"] for link in body.get("links", []) if link.get("rel") == "approve"), None)
    return {"payment_intent_id": payment.id, "order_id": payment.paypal_order_id, "approve_url": approve_url, "status": payment.status}

@app.post("/api/v1/payments/orders/{order_id}/capture")
async def capture_order(order_id: str, db: Session = Depends(get_db)):
    payment = db.scalar(select(PaymentIntent).where(PaymentIntent.paypal_order_id == order_id))
    if not payment:
        raise HTTPException(404, "Unknown payment order")
    base, token = await paypal_token()
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(f"{base}/v2/checkout/orders/{order_id}/capture", headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "PayPal-Request-Id": str(uuid.uuid4())}, json={})
    if r.status_code not in (200, 201):
        raise HTTPException(502, f"PayPal capture failed: {r.status_code}")
    body = r.json(); captures = body.get("purchase_units", [{}])[0].get("payments", {}).get("captures", [])
    if body.get("status") == "COMPLETED" and captures:
        payment.status = "CAPTURED"; payment.capture_id = captures[0].get("id")
        db.get(Mission, payment.mission_id).status = "READY"
    else:
        payment.status = "CAPTURE_PENDING"
    audit(db, "system", "paypal.capture_result", f"mission:{payment.mission_id}", {"order_id": order_id, "status": payment.status})
    db.commit()
    return {"order_id": order_id, "status": payment.status, "paypal": body}

@app.post("/api/v1/payments/webhook")
async def paypal_webhook(request: Request, db: Session = Depends(get_db), transmission_id: str | None = Header(None, alias="paypal-transmission-id")):
    """Signature verification and event-ID replay protection for PayPal webhooks."""
    event = await request.json(); event_id = event.get("id")
    if not event_id: raise HTTPException(400, "Missing PayPal event id")
    if db.get(WebhookEvent, event_id): return {"status": "duplicate"}
    base, token = await paypal_token()
    verification = {"auth_algo": request.headers.get("paypal-auth-algo"), "cert_url": request.headers.get("paypal-cert-url"), "transmission_id": transmission_id, "transmission_sig": request.headers.get("paypal-transmission-sig"), "transmission_time": request.headers.get("paypal-transmission-time"), "webhook_id": os.getenv("PAYPAL_WEBHOOK_ID"), "webhook_event": event}
    async with httpx.AsyncClient(timeout=20) as client:
        verified = await client.post(f"{base}/v1/notifications/verify-webhook-signature", headers={"Authorization":f"Bearer {token}","Content-Type":"application/json"}, json=verification)
    if verified.status_code != 200 or verified.json().get("verification_status") != "SUCCESS":
        raise HTTPException(400, "Invalid PayPal webhook signature")
    db.add(WebhookEvent(id=event_id, event_type=event.get("event_type", "unknown")))
    resource = event.get("resource", {}); order_id = resource.get("supplementary_data", {}).get("related_ids", {}).get("order_id")
    payment = db.scalar(select(PaymentIntent).where(PaymentIntent.paypal_order_id == order_id))
    if payment and event.get("event_type") == "PAYMENT.CAPTURE.COMPLETED":
        payment.status = "CAPTURED"; payment.capture_id = resource.get("id"); db.get(Mission, payment.mission_id).status = "READY"
    db.commit(); return {"status": "verified"}
