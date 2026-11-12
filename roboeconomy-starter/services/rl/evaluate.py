"""Seeded held-out evaluation on the SYNTHETIC economic environment. Not Gazebo-validated.

Run from repo root:  python -m services.rl.evaluate
Writes docs/benchmarks/rl_evaluation.json (committed; served by GET /api/v1/rl/benchmarks).
Training uses seed 42 with an unseeded RNG stream; evaluation uses fixed seeds 1000-1499.
"""
import json
import random
import statistics
from datetime import datetime, timezone
from pathlib import Path

from services.rl.economic_env import EconomicRobotEnv

EVAL_SEEDS = list(range(1000, 1500))
OUT = Path("docs/benchmarks/rl_evaluation.json")
CKPT = Path("rl_checkpoints/economic_ppo_starter")


def greedy(obs):
    battery, distance, _, _ = obs
    return 1 if battery >= distance * .75 else 2


def rule_based(obs):
    """Fixed thresholds: reject low-value work, hand off when too far, charge when battery is short."""
    battery, distance, value, handoff = obs
    if value < 0.25:
        return 0
    if battery >= distance * .75:
        return 1
    if battery + .5 >= distance * .75 and value * 10 - distance * 2 - 2.5 > 0:
        return 2
    return 3 if value * 10 - handoff * 6 - 1 > 0 else 0


def oracle(obs):
    """Upper bound: tries every action on a copy of the state. Not deployable."""
    best, best_r = 0, float("-inf")
    for a in range(4):
        env = EconomicRobotEnv(); env.reset(); env.state = obs.copy()
        r = env.step(a)[1]
        if r > best_r:
            best, best_r = a, r
    return best


def random_policy(obs):
    return random.Random(hash(tuple(float(x) for x in obs))).randrange(4)


def evaluate(policy, seeds=EVAL_SEEDS):
    scores, failures, rejects = [], 0, 0
    for seed in seeds:
        env = EconomicRobotEnv(); obs, _ = env.reset(seed=seed)
        a = policy(obs); _, reward, _, _, _ = env.step(a)
        scores.append(reward); failures += reward == -8.0; rejects += a == 0
    n = len(scores)
    return {"episodes": n, "mean_net_value": round(statistics.fmean(scores), 4), "std": round(statistics.pstdev(scores), 4),
            "stderr": round(statistics.pstdev(scores) / n ** .5, 4), "failed_attempt_rate": round(failures / n, 4), "reject_rate": round(rejects / n, 4)}


if __name__ == "__main__":
    results = {"random": evaluate(random_policy), "greedy": evaluate(greedy), "rule_based": evaluate(rule_based), "oracle_upper_bound": evaluate(oracle)}
    meta = {"generated_at": datetime.now(timezone.utc).isoformat(), "eval_seeds": f"{EVAL_SEEDS[0]}-{EVAL_SEEDS[-1]}", "dynamics": "synthetic; not Gazebo validated",
            "note": "One-step decision environment (reject/solo/charge/handoff). Failed attempt = chose an infeasible action (-8)."}
    try:
        from stable_baselines3 import PPO
        model = PPO.load(str(CKPT))
        results["ppo"] = evaluate(lambda o: int(model.predict(o, deterministic=True)[0]))
        meta["ppo_training"] = json.loads(Path("docs/benchmarks/ppo_training.json").read_text())
    except (ImportError, FileNotFoundError, ValueError):
        results["ppo"] = {"available": False, "reason": "train a checkpoint first: python -m services.rl.train"}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"meta": meta, "results": results}, indent=2))
    for k, v in results.items():
        print(f"{k:20s}", v.get("mean_net_value", v), "+/-", v.get("stderr", ""))
