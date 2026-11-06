"""Seeded, held-out evaluation. It never labels synthetic results as Gazebo data."""
import json
from pathlib import Path
from services.rl.economic_env import EconomicRobotEnv

def greedy(observation):
    battery, distance, _, _ = observation
    return 1 if battery >= distance * .75 else 2

def evaluate(policy, seeds=range(100, 120)):
    scores=[]
    for seed in seeds:
        env=EconomicRobotEnv(); obs,_=env.reset(seed=seed); _,reward,_,_,_=env.step(policy(obs)); scores.append(reward)
    return {"episodes":len(scores),"mean_net_value":sum(scores)/len(scores),"seeds":list(seeds),"dynamics":"synthetic; not Gazebo validated"}

if __name__ == "__main__":
    results={"greedy":evaluate(greedy)}
    try:
        from stable_baselines3 import PPO
        model=PPO.load("rl_checkpoints/economic_ppo_starter")
        results["ppo"]=evaluate(lambda obs:int(model.predict(obs, deterministic=True)[0]))
    except (ImportError, FileNotFoundError): results["ppo"]={"available":False,"reason":"train checkpoint before PPO evaluation"}
    Path("rl_checkpoints").mkdir(exist_ok=True)
    Path("rl_checkpoints/evaluation.json").write_text(json.dumps(results,indent=2))
    print(json.dumps(results,indent=2))
