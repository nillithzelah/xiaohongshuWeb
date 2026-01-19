@echo off
REM 后端部署脚本 - Windows版本

set SERVER=wubug
set REMOTE_PATH=/var/www/xiaohongshu-web

echo 🚀 开始部署后端...

REM 同步路由文件
echo 📦 同步 routes/...
scp server\routes\*.js %SERVER%:%REMOTE_PATH%/server/routes/

REM 同步服务文件
echo 📦 同步 services/...
scp server\services\*.js %SERVER%:%REMOTE_PATH%/server/services/

REM 同步模型文件
echo 📦 同步 models/...
scp server\models\*.js %SERVER%:%REMOTE_PATH%/server/models/

REM 重启服务
echo 🔄 重启 PM2 服务...
ssh %SERVER% "pm2 restart xiaohongshu-api"

REM 等待服务启动
timeout /t 2 /nobreak >nul

REM 检查服务状态
echo 📊 检查服务状态...
ssh %SERVER% "pm2 list | grep xiaohongshu-api"

echo ✅ 后端部署完成！
