#!/bin/bash
# 完整部署脚本 - 前后端一起部署

echo "========================================"
echo "     🚀 小红书项目完整部署"
echo "========================================"
echo ""

echo "[1/2] 部署后端..."
bash scripts/deploy-backend.sh
echo ""

echo "[2/2] 部署前端..."
bash scripts/deploy-frontend.sh
echo ""

echo "========================================"
echo "     ✅ 部署完成！"
echo "========================================"
echo ""
echo "📝 检查清单:"
echo "   1. 刷新浏览器"
echo "   2. 测试关键功能"
echo "   3. 查看日志: npm run logs"
echo ""
