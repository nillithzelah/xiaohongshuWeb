@echo off
REM 前端部署脚本 - Windows版本

set SERVER=wubug
set REMOTE_PATH=/var/www/xiaohongshu-web/admin/public

echo 🚀 开始部署前端...

REM 构建前端
echo 📦 构建 admin/...
cd admin
call npm run build
cd ..

REM 同步到服务器
echo 📤 同步到服务器...
scp -r admin\build\* %SERVER%:%REMOTE_PATH%/

echo ✅ 前端部署完成！
echo 📝 请刷新浏览器查看效果
