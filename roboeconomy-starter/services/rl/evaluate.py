"""Seeded, held-out evaluation. It never labels synthetic results as Gazebo data."""
import json
from pathlib import Path
from services.rl.economic_env import EconomicRobotEnv

def greedy(observation):
    battery, distance, _, _ = observation
    return 1 if battery >= distance * .75 else 2

def oracle(observation):
    """Upper bound: tries every action on a copy of the state. Not a deployable policy."""
    best, best_r = 0, float("-inf")
    for a in range(4):
        env = EconomicRobotEnv(); env.reset(); env.state = observation.copy()
        r = env.step(a)[1]
        if r > best_r: best, best_r = a, r
    return best

def random_policy(observation):
    import random
    return random.Random(hash(tuple(float(x) for x in observation))).randrange(4)

def evaluate(policy, seeds=range(100, 300)):
    scores=[]
    for seed in seeds:
        env=EconomicRobotEnv(); obs,_=env.reset(seed=seed); _,reward,_,_,_=env.step(policy(obs)); scores.append(reward)
    return {"episodes":len(scores),"mean_net_value":sum(scores)/len(scores),"seeds":list(seeds),"dynamics":"synthetic; not Gazebo validated"}

if __name__ == "__main__":
    results={"random":evaluate(random_policy),"greedy":evaluate(greedy),"oracle_upper_bound":evaluate(oracle)}
    try:
        from stable_baselines3 import PPO
        model=PPO.load("rl_checkpoints/economic_ppo_starter")
        results["ppo"]=evaluate(lambda obs:int(model.predict(obs, deterministic=True)[0]))
    except (ImportError, FileNotFoundError): results["ppo"]={"available":False,"reason":"train checkpoint before PPO evaluation"}
    Path("rl_checkpoints").mkdir(exist_ok=True)
    Path("rl_checkpoints/evaluation.json").write_text(json.dumps(results,indent=2))
    print(json.dumps(results,indent=2))
