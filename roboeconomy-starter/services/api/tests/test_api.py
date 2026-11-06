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
