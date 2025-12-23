@echo off
echo 🚀 开始构建和部署 Finance 前端...

echo 📦 进入 finance 目录...
cd finance

echo 🔧 安装依赖...
call npm install

echo 🏗️ 构建项目...
call npm run build

echo 📤 上传构建文件到服务器...
scp -i ~/.ssh/id_rsa_new_server -r build/* root@112.74.163.102:/var/www/finance/

echo ✅ Finance 前端部署完成！
echo 🌐 访问地址: https://www.wubug.cc/finance/

pause