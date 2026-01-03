#!/bin/bash

# 小红书投诉管理系统 - 服务器日志检查脚本
# 用于诊断生产环境中的500错误问题

echo "🔍 小红书投诉管理系统 - 服务器日志检查"
echo "========================================"
echo ""

# 检查是否有SSH密钥
if [ ! -f "$HOME/.ssh/id_rsa_new_server" ]; then
    echo "❌ 错误: 未找到SSH密钥文件 ~/.ssh/id_rsa_new_server"
    echo "请确保密钥文件存在并有正确的权限"
    exit 1
fi

# 设置正确的权限
chmod 600 "$HOME/.ssh/id_rsa_new_server"

echo "✅ SSH密钥准备就绪"
echo ""

# 连接到服务器并检查日志
echo "🔐 连接到服务器 www.wubug.cc..."
ssh -i "$HOME/.ssh/id_rsa_new_server" root@www.wubug.cc << 'EOF'

echo "📋 服务器信息"
echo "========================"
uname -a
echo ""

echo "📊 系统状态"
echo "========================"
uptime
df -h
echo ""

echo "🔍 检查Node.js进程"
echo "========================"
ps aux | grep node
echo ""

echo "📝 检查PM2状态"
echo "========================"
pm2 list
echo ""

echo "📁 检查项目目录"
echo "========================"
ls -la /var/www/xiaohongshu/api/
echo ""

echo "📄 检查Nginx错误日志"
echo "========================"
echo "最近50行Nginx错误日志:"
tail -n 50 /var/log/nginx/error.log
echo ""

echo "📄 检查PM2日志"
echo "========================"
echo "最近100行PM2日志:"
pm2 logs xiaohongshu-api --lines 100
echo ""

echo "📄 检查MongoDB状态"
echo "========================"
sudo systemctl status mongod
echo ""

echo "📄 检查数据库连接"
echo "========================"
mongo --host localhost --port 27017 --eval "db.adminCommand('ping')"
echo ""

echo "📄 检查投诉集合"
echo "========================"
mongo --host localhost --port 27017 --eval "use xiaohongshu_audit; db.complaints.find().limit(3)"
echo ""

echo "📄 检查环境变量"
echo "========================"
cat /var/www/xiaohongshu/api/.env
echo ""

echo "🎯 测试API连接"
echo "========================"
curl -X GET "http://localhost:3001/xiaohongshu/api/complaints" \
  -H "Authorization: Bearer test_token_placeholder" \
  -H "Content-Type: application/json" \
  -v
echo ""

echo "📋 诊断完成"
echo "========================"
EOF

echo "✅ 日志检查完成"
echo ""
echo "📝 如果发现问题，请根据日志信息进行修复"
echo "常见问题包括:"
echo "  1. 数据库连接失败"
echo "  2. 环境变量配置错误"
echo "  3. 文件权限问题"
echo "  4. 缺少依赖包"
echo ""
echo "💡 建议: 检查日志中的具体错误消息，然后修复相应的问题"
