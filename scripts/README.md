# 自动化部署脚本

## Windows 使用方法

```bash
# 部署后端
scripts\deploy-backend.bat

# 部署前端
scripts\deploy-frontend.bat

# 完整部署（前后端）
scripts\deploy-all.bat

# 查看日志（最近50行）
scripts\logs.bat

# 查看日志（指定行数）
scripts\logs.bat 100
```

## Linux/Mac 使用方法

```bash
# 部署后端
npm run deploy:backend

# 部署前端
npm run deploy:frontend

# 完整部署（前后端）
npm run deploy:all

# 查看日志
npm run logs
```

## 脚本说明

| 脚本 | 功能 |
|------|------|
| `deploy-backend.bat` | 同步后端代码到服务器并重启PM2 |
| `deploy-frontend.bat` | 构建前端并同步到服务器 |
| `deploy-all.bat` | 一键部署前后端 |
| `logs.bat` | 查看服务器最新日志 |

## 注意事项

1. 确保已配置服务器SSH别名 `wubug`
2. Windows需要安装 Git Bash 或 WSL
3. 首次使用可能需要输入SSH密码
