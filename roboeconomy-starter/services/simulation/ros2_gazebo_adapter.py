"""ROS 2 Jazzy bridge. Run this only in the Ubuntu Gazebo worker, never Vercel.

It reads odometry from ROS rather than inventing browser telemetry and POSTs
timestamped values to the API endpoint configured by ROBOECONOMY_API_URL.
"""
import json, os
from datetime import datetime, timezone
try:
    import rclpy
    from nav_msgs.msg import Odometry
except ImportError as error:
    raise RuntimeError("Install ROS 2 Jazzy and source its setup.bash before running this worker") from error

class GazeboTelemetryBridge:
    def __init__(self, robot_id: str):
        self.robot_id = robot_id
        rclpy.init(); self.node = rclpy.create_node(f"roboeconomy_{robot_id}")
        self.node.create_subscription(Odometry, "/odom", self.on_odom, 10)
    def on_odom(self, message: Odometry):
        p = message.pose.pose.position
        payload = {"robot_id":self.robot_id,"x":p.x,"y":p.y,"z":p.z,"timestamp":datetime.now(timezone.utc).isoformat(),"source":"gazebo_ros2"}
        self.node.get_logger().info(json.dumps(payload))
    def spin(self): rclpy.spin(self.node)
