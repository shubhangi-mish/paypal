# Product requirements

## Users
Robot owner: register and pair robot, verify capabilities, set minimum prices and availability, accept or delegate bids, connect eligible merchant PayPal account, monitor missions, track actual captured earnings.
Customer: describe mission in plain language, compare feasible bids, approve contract and PayPal checkout, monitor execution, see evidence and completion.
Developer: implement RobotAdapter, configure ROS2/robot fleet gateway, monitor connectivity and permissions.

## Essential screens
1. Home: Hire a Robot / Earn With My Robot.
2. Connect: select Gazebo/ROS2/Open-RMF/replay; show exact pairing and validation steps.
3. Marketplace: mission request, bid comparison, acceptance.
4. Mission control: authoritative Gazebo telemetry, task progress, failure recovery.
5. Intelligence lab: agent decisions, constraints, PPO vs baseline evaluations.
6. Earnings: estimated vs captured payments clearly separated.

## Canonical demo
Customer requests a warehouse inspection. Independently owned simulated mobile robots bid. Customer pays approved provider through PayPal sandbox. TurtleBot3 Gazebo simulation executes navigation mission. Failure triggers agent reallocation and human approval of any extra expense. Show actual simulator telemetry and payment capture status. Do not claim TurtleBot3 can pick up boxes without an attachment.

## Core value
An economic coordination layer for independently owned machines, rather than just fleet scheduling or an AI checkout wrapper.
