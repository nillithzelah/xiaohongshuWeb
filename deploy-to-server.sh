#!/bin/bash
# 小红书Web项目部署脚本
# 部署到现有服务器，不覆盖原有项目

echo "🚀 开始部署小红书Web项目到服务器..."

# 服务器配置
SERVER="root@112.74.163.102"
REMOTE_PATH="/var/www/xiaohongshu-web"
SERVER_DB="xiaohongshu_audit_prod"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📋 部署信息:${NC}"
echo "服务器: $SERVER"
echo "远程路径: $REMOTE_PATH"
echo "数据库: $SERVER_DB"
echo ""

# 检查本地文件
echo -e "${YELLOW}🔍 检查本地文件...${NC}"
if [ ! -d "server" ]; then
    echo -e "${RED}❌ server目录不存在${NC}"
    exit 1
fi
if [ ! -d "admin" ]; then
    echo -e "${RED}❌ admin目录不存在${NC}"
    exit 1
fi
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json不存在${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 本地文件检查通过${NC}"

# 连接测试
echo -e "${YELLOW}🔗 测试SSH连接...${NC}"
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes $SERVER "echo 'SSH连接成功'" > /dev/null 2>&1; then
    echo -e "${RED}❌ SSH连接失败，请检查网络和密钥配置${NC}"
    exit 1
fi
echo -e "${GREEN}✅ SSH连接正常${NC}"

# 创建远程目录
echo -e "${YELLOW}📁 创建远程目录...${NC}"
ssh $SERVER "mkdir -p $REMOTE_PATH"
echo -e "${GREEN}✅ 远程目录创建完成${NC}"

# 上传文件
echo -e "${YELLOW}📤 上传项目文件...${NC}"

# 上传主要文件
echo "上传根目录文件..."
scp package.json docker-compose.yml $SERVER:$REMOTE_PATH/

# 上传服务端代码
echo "上传服务端代码..."
scp -r server/ $SERVER:$REMOTE_PATH/

# 上传前端代码
echo "上传前端代码..."
scp -r admin/ $SERVER:$REMOTE_PATH/

echo -e "${GREEN}✅ 文件上传完成${NC}"

# 服务器端部署
echo -e "${YELLOW}🔧 开始服务器端部署...${NC}"

ssh $SERVER << EOF
cd $REMOTE_PATH

echo "📦 安装后端依赖..."
npm install

echo "⚙️ 配置生产环境..."
cat > server/.env.production << EOL
MONGODB_URI=mongodb://127.0.0.1:27017/${SERVER_DB}
JWT_SECRET=xiaohongshu_prod_jwt_secret_2025
PORT=3001

# 阿里云OSS配置
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket_name
OSS_REGION=your_region

# 微信小程序配置
WX_APP_ID=your_app_id
WX_APP_SECRET=your_app_secret
EOL

echo "🏗️ 构建前端应用..."
cd admin
npm install
npm run build
cd ..

echo "📋 创建PM2配置文件..."
cat > ecosystem.config.js << EOL
module.exports = {
  apps: [{
    name: 'xiaohongshu-web',
    script: 'server/server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    cwd: '$REMOTE_PATH'
  }]
};
EOL

echo "🚀 启动服务..."
pm2 stop xiaohongshu-web 2>/dev/null || true
pm2 delete xiaohongshu-web 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo "✅ 后端部署完成！"
EOF

echo -e "${GREEN}✅ 后端部署完成${NC}"

# Nginx配置更新
echo -e "${YELLOW}🌐 更新Nginx配置...${NC}"

ssh $SERVER << 'EOF'
# 备份当前配置
cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)

# 检查是否已有xiaohongshu配置
if ! grep -q "location /xiaohongshu/" /etc/nginx/sites-available/default; then
    # 添加小红书项目配置
    sed -i '/location \/ {/a\
    # 小红书项目 (子路径)\
    location /xiaohongshu/ {\
        proxy_pass http://localhost:3001;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        \
        # 处理路径重写\
        rewrite ^/xiaohongshu/(.*) /$1 break;\
    }\
    ' /etc/nginx/sites-available/default
    
    echo "✅ Nginx配置已更新"
else
    echo "ℹ️ Nginx配置已存在，跳过更新"
fi

# 测试配置
nginx -t
if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo "✅ Nginx重载成功"
else
    echo "❌ Nginx配置错误，请检查配置"
    exit 1
fi
EOF

echo -e "${GREEN}✅ Nginx配置更新完成${NC}"

# 部署验证
echo -e "${YELLOW}🔍 部署验证...${NC}"

# 检查PM2服务
echo "检查PM2服务状态..."
ssh $SERVER "pm2 list | grep xiaohongshu-web || echo '服务未运行'"

# 检查端口监听
echo "检查端口监听..."
ssh $SERVER "netstat -tlnp | grep :3001 || echo '端口3001未监听'"

# 检查Nginx配置
echo "检查Nginx配置..."
ssh $SERVER "nginx -t && echo 'Nginx配置正确' || echo 'Nginx配置错误'"

echo ""
echo -e "${GREEN}🎉 小红书Web项目部署完成！${NC}"
echo ""
echo -e "${YELLOW}📍 访问地址:${NC}"
echo -e "   前端: https://www.wubug.cc/xiaohongshu/"
echo -e "   API:  https://www.wubug.cc/xiaohongshu/api/"
echo ""
echo -e "${YELLOW}🔧 管理命令:${NC}"
echo -e "   查看日志: ssh $SERVER 'pm2 logs xiaohongshu-web'"
echo -e "   重启服务: ssh $SERVER 'pm2 restart xiaohongshu-web'"
echo -e "   停止服务: ssh $SERVER 'pm2 stop xiaohongshu-web'"
echo ""
echo -e "${YELLOW}⚠️ 注意事项:${NC}"
echo "   1. 首次访问可能需要等待应用启动"
echo "   2. 如果访问异常，请检查PM2和Nginx日志"
echo "   3. 数据库需要单独初始化或迁移数据"