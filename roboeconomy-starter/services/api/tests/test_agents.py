from fastapi.testclient import TestClient
from services.api.app.agents import negotiate, rule_interpret
from services.api.app.main import app

client = TestClient(app)


def test_negotiation_respects_owner_floor_and_budget():
    r = negotiate(ask=1200, floor=900, budget=3000)
    assert r["agreed"] and 900 <= r["price_minor"] <= 3000 and len(r["rounds"]) <= 3
    assert not negotiate(ask=1200, floor=900, budget=800)["agreed"]  # floor above budget: never agrees


def test_rule_interpreter():
    s = rule_interpret("Urgent: inspect three warehouse zones within 15 minutes")
    assert s == {"task_type": "inspection", "zones": 3, "deadline_minutes": 15, "urgent": True}


def _setup(floor_a=None):
    a = client.post("/api/v1/robots", json={"name": "Agent A", "owner": "Org 1", "capability": "inspection", "rate_usd": 20, "min_price_usd": floor_a}).json()
    b = client.post("/api/v1/robots", json={"name": "Agent B", "owner": "Org 2", "capability": "inspection", "rate_usd": 16}).json()
    m = client.post("/api/v1/missions", json={"description": "Inspect three warehouse zones within 15 minutes", "task_type": "inspection", "budget_usd": 40}).json()
    return a, b, m


def test_agent_run_then_recovery_flow():
    a, b, m = _setup()
    run = client.post(f"/api/v1/missions/{m['id']}/agent-run").json()
    assert run["recommendation"]["requires_approval"] is True
    bids = client.get(f"/api/v1/missions/{m['id']}/bids").json()
    assert bids and all(x["price_usd"] <= 40 for x in bids)
    rec_robot = run["recommendation"]["robot_id"]
    bid = next(x for x in bids if x["robot_id"] == rec_robot)
    assert client.post(f"/api/v1/missions/{m['id']}/award/{bid['id']}").status_code == 200
    # recovery: failure is injected, substitute proposed, human approval required
    rv = client.post(f"/api/v1/missions/{m['id']}/recovery", json={"failed_robot_id": rec_robot}).json()
    assert rv["failure_source"] == "injected" and rv["proposal"]["substitute_robot_id"] != rec_robot
    ok = client.post(f"/api/v1/missions/{m['id']}/recovery/{rv['run_id']}/approve")
    assert ok.status_code == 200 and client.post(f"/api/v1/missions/{m['id']}/recovery/{rv['run_id']}/approve").status_code == 409
    d = client.get(f"/api/v1/missions/{m['id']}/decisions").json()
    assert {x["agent"] for x in d} >= {"mission_interpreter", "discovery", "negotiation", "risk", "explanation", "monitor", "recovery"}
    assert all(x["engine"] for x in d)
    actions = [x["action"] for x in client.get("/api/v1/audit").json()]
    assert "bid.awarded" in actions and "recovery.approved" in actions


def test_agent_run_rejected_for_awarded_mission():
    a, b, m = _setup()
    run = client.post(f"/api/v1/missions/{m['id']}/agent-run").json()
    bid = client.get(f"/api/v1/missions/{m['id']}/bids").json()[0]
    client.post(f"/api/v1/missions/{m['id']}/award/{bid['id']}")
    assert client.post(f"/api/v1/missions/{m['id']}/agent-run").status_code == 409
