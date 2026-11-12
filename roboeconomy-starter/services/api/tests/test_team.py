from fastapi.testclient import TestClient
from services.api.app.agents import allocate
from services.api.app.main import app

client = TestClient(app)


def test_allocate_fills_cheapest_first_within_capacity():
    assert allocate(3, 2, {"a": 10, "b": 5, "c": 7}) == {"b": 2, "c": 1}


def test_allocate_none_when_capacity_short():
    assert allocate(5, 1, {"a": 1, "b": 2}) is None


def _mk():
    for n, rate, floor in (("T1", 20, 15), ("T2", 18, None), ("T3", 30, None)):
        client.post("/api/v1/robots", json={"name": n, "owner": "Org", "capability": "inspection", "rate_usd": rate, "min_price_usd": floor})
    return client.post("/api/v1/missions", json={"description": "Inspect three warehouse zones within 20 minutes", "task_type": "inspection", "budget_usd": 60}).json()["id"]


def test_team_plan_award_and_single_payment_total():
    mid = _mk()
    r = client.post(f"/api/v1/missions/{mid}/team-run", json={})
    assert r.status_code == 200
    team = r.json()["team"]
    assert team and len(team["members"]) == 2 and sum(m["zones"] for m in team["members"]) == 3
    assert team["total_usd"] <= 60
    bids = client.get(f"/api/v1/missions/{mid}/bids").json()
    assert all(b["team_id"] == team["team_id"] for b in bids)
    assert client.post(f"/api/v1/missions/{mid}/award/{bids[0]['id']}").status_code == 409
    assert client.post(f"/api/v1/missions/{mid}/award-team/{team['team_id']}").json()["status"] == "payment_pending"


def test_no_team_when_one_robot_suffices():
    _mk()
    mid = client.post("/api/v1/missions", json={"description": "Inspect two zones within 60 minutes", "task_type": "inspection", "budget_usd": 60}).json()["id"]
    assert client.post(f"/api/v1/missions/{mid}/team-run", json={}).json()["team"] is None
