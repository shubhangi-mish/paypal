"""Small real Gymnasium training environment; economic dynamics are synthetic, not Gazebo calibrated."""
import gymnasium as gym
import numpy as np
from gymnasium import spaces

class EconomicRobotEnv(gym.Env):
    metadata = {"render_modes": []}
    def __init__(self):
        super().__init__()
        self.action_space = spaces.Discrete(4)  # reject, solo, charge, handoff
        self.observation_space = spaces.Box(0, 1, shape=(4,), dtype=np.float32)
        self.state = np.zeros(4, dtype=np.float32)
        self.steps = 0
    def _obs(self):
        return self.state.copy()
    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self.steps = 0
        self.state = self.np_random.uniform(0.1, 0.95, size=4).astype(np.float32)
        return self._obs(), {}
    def step(self, action):
        battery, distance, value, handoff_price = map(float, self.state)
        required = distance * 0.75
        if action == 0: reward = 0.0
        elif action == 1: reward = value * 10 - distance * 2 if battery >= required else -8.0
        elif action == 2: reward = value * 10 - distance * 2 - 2.5 if battery + 0.5 >= required else -8.0
        else: reward = value * 10 - handoff_price * 6 - 1.0
        self.steps += 1
        return self._obs(), float(reward), True, False, {"economic_action": int(action), "synthetic_dynamics": True}
