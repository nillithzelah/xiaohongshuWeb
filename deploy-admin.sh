#!/bin/bash
# 小红书Web前端部署脚本
# 只部署admin前端，不涉及后端

echo "🚀 开始部署小红书Web前端..."

# 服务器配置
SERVER="wubug"
REMOTE_PATH="/var/www/xiaohongshu-web/admin/public"
SSH_KEY="$HOME/.ssh/id_rsa_new_server"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📋 部署信息:${NC}"
echo "服务器: $SERVER"
echo "远程路径: $REMOTE_PATH"
echo "SSH密钥: $SSH_KEY"
echo ""

# 检查本地admin目录
echo -e "${YELLOW}🔍 检查本地文件...${NC}"
if [ ! -d "admin" ]; then
    echo -e "${RED}❌ admin目录不存在${NC}"
    exit 1
fi
if [ ! -f "admin/package.json" ]; then
    echo -e "${RED}❌ admin/package.json不存在${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 本地文件检查通过${NC}"

# 连接测试
echo -e "${YELLOW}🔗 测试SSH连接...${NC}"
if ! ssh -i "$SSH_KEY" -o ConnectTimeout=10 -o BatchMode=yes $SERVER "echo 'SSH连接成功'" > /dev/null 2>&1; then
    echo -e "${RED}❌ SSH连接失败，请检查网络和密钥配置${NC}"
    exit 1
fi
echo -e "${GREEN}✅ SSH连接正常${NC}"

# 构建前端
echo -e "${YELLOW}🏗️ 构建前端应用...${NC}"
cd admin

# 安装依赖
echo "📦 安装依赖..."
if ! npm install; then
    echo -e "${RED}❌ 依赖安装失败${NC}"
    exit 1
fi

# 构建项目
echo "🔨 构建项目..."
if ! npm run build; then
    echo -e "${RED}❌ 构建失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 前端构建完成${NC}"
cd ..

# 备份服务器端文件
echo -e "${YELLOW}📋 备份服务器端文件...${NC}"
ssh -i "$SSH_KEY" $SERVER "cd /var/www/xiaohongshu-web/admin && cp -r public public.backup.\$(date +%Y%m%d_%H%M%S)"
echo -e "${GREEN}✅ 备份完成${NC}"

# 上传构建文件
echo -e "${YELLOW}📤 上传构建文件...${NC}"
if ! scp -i "$SSH_KEY" -r admin/build/* $SERVER:$REMOTE_PATH/; then
    echo -e "${RED}❌ 文件上传失败${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 文件上传完成${NC}"

# 验证部署
echo -e "${YELLOW}🔍 验证部署...${NC}"
ssh -i "$SSH_KEY" $SERVER << 'EOF'
echo "检查上传的文件..."
ls -la /var/www/xiaohongshu-web/admin/public/ | head -10

echo ""
echo "测试前端访问..."
curl -I https://www.wubug.cc/xiaohongshu/ 2>/dev/null | head -3
EOF

echo ""
echo -e "${GREEN}🎉 前端部署完成！${NC}"
echo ""
echo -e "${YELLOW}📍 访问地址:${NC}"
echo -e "   前端: https://www.wubug.cc/xiaohongshu/"
echo ""
echo -e "${YELLOW}⚠️ 注意事项:${NC}"
echo "   如果访问异常，请检查nginx日志: ssh $SERVER 'tail -20 /var/log/nginx/error.log'"