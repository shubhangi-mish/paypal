from fastapi.testclient import TestClient
from services.api.app.main import app

client = TestClient(app)

def test_health():
    assert client.get("/health").json()["status"] == "ok"

def test_marketplace():
    robot = client.post("/api/v1/robots", json={"name":"TurtleBot A","owner":"Owner One","capability":"inspection","rate_usd":12}).json()
    mission = client.post("/api/v1/missions", json={"description":"Inspect warehouse zone A","task_type":"inspection","budget_usd":30}).json()
    bid = client.post(f"/api/v1/missions/{mission['id']}/bids", json={"robot_id":robot["id"],"price_usd":12}).json()
    award = client.post(f"/api/v1/missions/{mission['id']}/award/{bid['id']}")
    assert award.status_code == 200
    assert award.json()["status"] == "payment_pending"


def _awarded_mission():
    robot = client.post("/api/v1/robots", json={"name": "TurtleBot B", "owner": "Owner Two", "capability": "inspection", "rate_usd": 10}).json()
    mission = client.post("/api/v1/missions", json={"description": "Inspect warehouse zone B", "task_type": "inspection", "budget_usd": 25}).json()
    bid = client.post(f"/api/v1/missions/{mission['id']}/bids", json={"robot_id": robot["id"], "price_usd": 10}).json()
    client.post(f"/api/v1/missions/{mission['id']}/award/{bid['id']}")
    return mission


def test_bid_over_budget_rejected():
    robot = client.post("/api/v1/robots", json={"name": "TurtleBot C", "owner": "Owner Three", "capability": "inspection", "rate_usd": 50}).json()
    mission = client.post("/api/v1/missions", json={"description": "Inspect warehouse zone C", "task_type": "inspection", "budget_usd": 20}).json()
    r = client.post(f"/api/v1/missions/{mission['id']}/bids", json={"robot_id": robot["id"], "price_usd": 50})
    assert r.status_code == 400


def test_order_requires_paypal_credentials(monkeypatch):
    monkeypatch.delenv("PAYPAL_CLIENT_ID", raising=False)
    monkeypatch.delenv("PAYPAL_CLIENT_SECRET", raising=False)
    mission = _awarded_mission()
    r = client.post("/api/v1/payments/orders", json={"mission_id": mission["id"]})
    assert r.status_code == 503


def test_checkout_and_capture_with_mocked_paypal(monkeypatch):
    """PayPal HTTP is faked here; this verifies our state machine, not PayPal itself."""
    import services.api.app.main as m

    async def fake_token():
        return "https://paypal.test", "tok"

    class FakeResp:
        def __init__(self, body, code=201):
            self._b, self.status_code = body, code

        def json(self):
            return self._b

    class FakeClient:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, url, **kw):
            return FakeResp({"links": [{"rel": "approve", "href": "https://paypal.test/approve"}]}, 200)
        async def post(self, url, **kw):
            if url.endswith("/v2/checkout/orders"):
                return FakeResp({"id": "ORDER-1", "links": [{"rel": "approve", "href": "https://paypal.test/approve"}]})
            return FakeResp({"status": "COMPLETED", "purchase_units": [{"payments": {"captures": [{"id": "CAP-1"}]}}]}, 201)

    monkeypatch.setattr(m, "paypal_token", fake_token)
    monkeypatch.setattr(m.httpx, "AsyncClient", FakeClient)
    mission = _awarded_mission()
    order = client.post("/api/v1/payments/orders", json={"mission_id": mission["id"]}).json()
    assert order["approve_url"] == "https://paypal.test/approve"
    again = client.post("/api/v1/payments/orders", json={"mission_id": mission["id"]}).json()
    assert again["idempotent"] is True and again["order_id"] == "ORDER-1"
    assert again["approve_url"] == "https://paypal.test/approve"
    cap = client.post("/api/v1/payments/orders/ORDER-1/capture").json()
    assert cap["status"] == "CAPTURED"
    missions = {x["id"]: x for x in client.get("/api/v1/missions").json()}
    assert missions[mission["id"]]["status"] == "ready"


def test_system_and_payments_and_robot_patch():
    s = client.get("/api/v1/system").json()
    assert s["simulator"]["connected"] is False and "paypal" in s
    robot = client.post("/api/v1/robots", json={"name": "Patch Bot", "owner": "Owner P", "capability": "delivery", "rate_usd": 8, "model": "TurtleBot3 Burger"}).json()
    assert robot["model"] == "TurtleBot3 Burger" and robot["available"] is True and robot["capability_verified"] is False
    patched = client.patch(f"/api/v1/robots/{robot['id']}", json={"available": False}).json()
    assert patched["available"] is False
    assert isinstance(client.get("/api/v1/payments").json(), list)
