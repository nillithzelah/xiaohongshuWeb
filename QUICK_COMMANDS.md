# 常用命令速查

## 部署相关

| 命令 | 说明 |
|------|------|
| `scripts\deploy-all.bat` | 一键部署前后端 |
| `scripts\deploy-backend.bat` | 只部署后端 |
| `scripts\deploy-frontend.bat` | 只部署前端 |
| `scripts\logs.bat` | 查看服务器日志 |

## 服务器操作

| 命令 | 说明 |
|------|------|
| `ssh wubug "pm2 list"` | 查看PM2进程状态 |
| `ssh wubug "pm2 restart xiaohongshu-api"` | 重启后端服务 |
| `ssh wubug "pm2 logs xiaohongshu-api --lines 50"` | 查看PM2日志 |

## 数据库操作

| 命令 | 说明 |
|------|------|
| `ssh wubug "mongodump --db=xiaohongshu_audit --out=/var/backups/mongo/$(date +%Y%m%d_%H%M%S)"` | 备份数据库 |
| `ssh wubug "mongosh mongodb://127.0.0.1:27017/xiaohongshu_audit"` | 连接数据库 |

## 本地开发

| 命令 | 说明 |
|------|------|
| `cd server && npm run dev` | 启动后端开发模式 |
| `cd admin && npm start` | 启动前端开发模式 |
| `cd admin && npm run build` | 构建前端 |
