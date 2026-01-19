@echo off
REM 查看服务器日志脚本

set SERVER=wubug
set LINES=50

if "%1" neq "" set LINES=%1

echo 📋 查看最近 %LINES% 行日志...
ssh %SERVER% "tail -n %LINES% /root/logs/out-3.log"
