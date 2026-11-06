"""Run from repository root: python -m services.rl.train"""
from pathlib import Path
from stable_baselines3 import PPO
from services.rl.economic_env import EconomicRobotEnv

if __name__ == "__main__":
    model = PPO("MlpPolicy", EconomicRobotEnv(), verbose=1, seed=42)
    model.learn(total_timesteps=15000)
    out = Path("rl_checkpoints")
    out.mkdir(exist_ok=True)
    model.save(str(out / "economic_ppo_starter"))
    print("Saved starter synthetic-environment PPO checkpoint. NOT validated in Gazebo.")
