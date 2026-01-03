@echo off
ssh -f -N -L 27018:localhost:27017 wubug
echo MongoDB tunnel started on port 27018
echo You can now connect to MongoDB using: mongodb://127.0.0.1:27018/xiaohongshu_audit
pause