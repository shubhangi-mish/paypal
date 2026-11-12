"""LLM paths with a fake model: proves validators clamp whatever the model says and fall back safely."""
import asyncio
import json

from services.api.app import agents


def _fake(offer, counter, accept=False):
    async def fake(system, user, max_tokens=400, model=None):
        if "BUYER" in system:
            return json.dumps({"offer_minor": offer, "message": "offer"})
        if "ROBOT OWNER" in system:
            return json.dumps({"accept": accept, "counter_minor": counter, "message": "counter"})
        return None
    return fake


def test_llm_negotiation_cannot_break_floor_or_budget(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "x")
    monkeypatch.setattr(agents, "llm_text", _fake(offer=999999, counter=1, accept=True))  # model tries to overpay and undercut
    res, eng = asyncio.run(agents.negotiate_smart("t", ask=1000, floor=800, budget=900))
    assert eng.startswith("llm") and res["agreed"] and 800 <= res["price_minor"] <= 900


def test_llm_garbage_falls_back_to_deterministic(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "x")

    async def junk(*a, **k):
        return "not json"
    monkeypatch.setattr(agents, "llm_text", junk)
    res, eng = asyncio.run(agents.negotiate_smart("t", ask=1000, floor=800, budget=900))
    assert eng == "rule-based" and res["agreed"]


def test_grounding_rejects_invented_claims_but_allows_unverified():
    assert not agents.grounded("This robot has better model verification.")
    assert not agents.grounded("More reliable and faster.")
    assert agents.grounded("Capability is unverified, so price decides.")


def test_buyer_cannot_concede_faster_than_schedule(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "x")
    monkeypatch.setattr(agents, "llm_text", _fake(offer=1000, counter=1000, accept=False))  # buyer jumps straight to the listed price
    res, _ = asyncio.run(agents.negotiate_smart("t", ask=1000, floor=700, budget=1000))
    assert res["rounds"][0]["buyer_offer_minor"] <= 667  # round 1 of 3: 500 + 500/3
