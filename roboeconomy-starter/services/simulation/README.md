# ROS 2 / Gazebo worker

The `ros2_gazebo_adapter.py` bridge is executable on Ubuntu 24.04 with ROS 2
Jazzy, Gazebo Harmonic and `nav_msgs` installed. It subscribes to the real
`/odom` topic; it does not manufacture positions in the browser. Gazebo cannot
run on Vercel, so deploy this worker separately and expose its telemetry API to
the Vercel-hosted web/API application.
