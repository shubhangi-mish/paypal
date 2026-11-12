"""Run from repository root: python -m services.rl.train   (then python -m services.rl.evaluate)"""
import json
from datetime import datetime, timezone
from pathlib import Path
from stable_baselines3 import PPO
from services.rl.economic_env import EconomicRobotEnv

STEPS = 100_000

if __name__ == "__main__":
    model = PPO("MlpPolicy", EconomicRobotEnv(), verbose=0, seed=42)
    model.learn(total_timesteps=STEPS)
    out = Path("rl_checkpoints"); out.mkdir(exist_ok=True)
    model.save(str(out / "economic_ppo_starter"))
    meta = {"algorithm": "PPO (stable-baselines3, MlpPolicy)", "total_timesteps": STEPS, "train_seed": 42,
            "trained_at": datetime.now(timezone.utc).isoformat(), "environment": "synthetic economic env; not Gazebo validated"}
    Path("docs/benchmarks").mkdir(parents=True, exist_ok=True)
    Path("docs/benchmarks/ppo_training.json").write_text(json.dumps(meta, indent=2))
    print("Saved checkpoint and training metadata.")
