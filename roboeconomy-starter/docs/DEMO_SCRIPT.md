# RoboEconomy demo script (voiceover)

Target: under 3 minutes for YouTube. The full screen recording covers every feature and runs longer, so speed up the quiet parts or cut scenes marked (optional). Everything shown is real: live site, real PayPal Sandbox checkout. Do not call anything a simulation result, a physical robot, or an LLM decision unless it is one.

**0:00 Problem (Home)**
"Robots are getting capable, but there is no simple way to hire one. Owners have idle robots, businesses have tasks, and nobody to negotiate or settle payment. RoboEconomy is a marketplace where robots are hired, AI agents negotiate, and PayPal settles the payment."

**0:15 Owner lists robots (My Robots)**
"A robot owner lists a robot with its capability, hourly price, and a minimum price agents may accept. These robots are registered, not connected to hardware, and the app says so."

**0:30 Marketplace**
"Customers browse robots. Each shows its source (simulated, replay or physical), and capability is marked unverified until a simulator or hardware test confirms it, which is the next step beyond this MVP."

**0:40 Mission and agents (Missions, then AI Agents)**
"A customer publishes a mission with a budget. The agents interpret it, find matching robots, and negotiate with each owner over up to three rounds. A buyer agent and an owner agent trade offers. The owner's minimum price and the customer's budget are hard limits enforced in code, whatever the model says. The page shows every step, its engine, and an explanation. Agents only recommend. The customer decides."

**1:10 Award and recovery (AI Agents)**
"After awarding a robot, we trigger a battery failure by hand. In the full product a simulator such as Gazebo would report it, but that needs an Ubuntu machine and cloud hosting, which was not feasible for this MVP, so the failure is labelled as injected. A recovery agent finds a substitute, negotiates a price for the remaining work, and asks the customer to approve. The approval goes into the audit log."

**1:35 Teams (Missions)**
"For a bigger job, four zones in twenty minutes, one robot cannot finish. The coalition agent splits the zones across robots at minimum total cost, assuming ten minutes per zone, and negotiates each share. One click awards the whole team."

**1:55 PayPal checkout**
"Now real PayPal Sandbox checkout. One order covers the team total. The buyer approves in PayPal, and the app captures the payment. Nothing is mocked."

**2:20 Earnings**
"Only payments PayPal confirms count as earnings. Costs are not tracked, and we do not pretend otherwise."

**2:30 Intelligence lab (AI Agents, scroll)**
"Here is the audit log of every action. And the RL benchmark: PPO trained in a synthetic environment against random, greedy and rule-based baselines. PPO scores 3.45 against 3.35 for rule-based, which is within noise, so we do not claim it wins, and it is not wired into live decisions."

**2:45 Honest limits (Simulation, Settings)**
"The idea extends to real robots. Gazebo or another robotics simulator can plug in here to supply live telemetry and detect failures. It needs Ubuntu and cloud compute, which was out of reach for a self-funded hackathon MVP, so this page stays honestly empty instead of showing fake positions. The marketplace, agents, negotiation, teams and PayPal payments you just saw are the working core. Settings shows the true system status."

**2:55 Close**
"RoboEconomy: robots hired, agents negotiating, PayPal settling, every step auditable."

## Disclosure lines for the submission form
- PayPal: Orders v2 create and capture, webhook signature verification, Sandbox only.
- AI: OpenAI `gpt-4.1-mini` for interpretation, negotiation turns, risk review, choosing among offers and explanations, bounded by code validators. Claude Code was used to build the project.
- RL: PPO in a synthetic environment; not significantly better than the rule-based baseline.
- Not done: Gazebo/ROS 2 or hardware, user accounts, recovery payment and dispatch.
