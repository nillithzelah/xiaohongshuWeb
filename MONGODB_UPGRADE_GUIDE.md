# MongoDB 升级指南 (从 3.6.8 到 4.4.x)

## 📋 升级概述

**当前状态**: MongoDB 3.6.8 (2018年版本)
**目标版本**: MongoDB 4.4.x (兼容现代Node.js驱动)

## ⚠️ 重要提醒

1. **备份数据**: 升级前务必备份重要数据
2. **测试环境**: 建议先在测试环境验证
3. **停机时间**: 升级过程中服务会中断

## 🚀 升级步骤

### 步骤1: 停止当前MongoDB服务

```bash
# 停止MongoDB服务
sudo systemctl stop mongod

# 验证服务已停止
sudo systemctl status mongod
```

### 步骤2: 备份数据 (重要!)

```bash
# 创建备份目录
sudo mkdir -p /var/backups/mongodb

# 备份数据目录
sudo cp -r /var/lib/mongodb /var/backups/mongodb/backup_$(date +%Y%m%d_%H%M%S)

# 或者使用mongodump (如果服务还在运行)
# mongodump --out /var/backups/mongodb/dump_$(date +%Y%m%d_%H%M%S)
```

### 步骤3: 添加MongoDB 4.4官方仓库

```bash
# 导入MongoDB GPG密钥
wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | sudo apt-key add -

# 添加MongoDB 4.4仓库 (Ubuntu 18.04 Bionic)
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.4 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.4.list

# 更新包列表
sudo apt update
```

### 步骤4: 安装MongoDB 4.4

```bash
# 安装MongoDB 4.4 (指定版本以确保兼容性)
sudo apt install -y mongodb-org=4.4.29 mongodb-org-server=4.4.29 mongodb-org-shell=4.4.29 mongodb-org-mongos=4.4.29 mongodb-org-tools=4.4.29

# 锁定版本防止意外升级
echo "mongodb-org hold" | sudo dpkg --set-selections
echo "mongodb-org-server hold" | sudo dpkg --set-selections
echo "mongodb-org-shell hold" | sudo dpkg --set-selections
echo "mongodb-org-mongos hold" | sudo dpkg --set-selections
echo "mongodb-org-tools hold" | sudo dpkg --set-selections
```

### 步骤5: 启动新版本MongoDB

```bash
# 启动MongoDB服务
sudo systemctl start mongod

# 设置开机自启
sudo systemctl enable mongod

# 检查服务状态
sudo systemctl status mongod
```

### 步骤6: 验证升级

```bash
# 检查MongoDB版本 (应该显示4.4.x)
mongod --version

# 连接到MongoDB并检查数据
mongo --eval "db.adminCommand('ismaster')"

# 检查数据库列表
mongo --eval "show dbs"
```

### 步骤7: 重启应用服务

```bash
# 重启Node.js应用
pm2 restart xiaohongshu-api

# 检查应用日志
pm2 logs xiaohongshu-api --lines 20
```

## 🔍 故障排除

### 问题1: 服务启动失败

```bash
# 查看详细错误日志
sudo journalctl -u mongod -n 50

# 检查配置文件
sudo cat /etc/mongod.conf

# 检查数据目录权限
sudo ls -la /var/lib/mongodb
```

### 问题2: 应用仍无法连接

```bash
# 检查MongoDB是否监听在正确端口
sudo netstat -tlnp | grep 27017

# 测试连接
mongo --eval "db.stats()"
```

### 问题3: 数据恢复

如果需要从备份恢复数据：

```bash
# 停止MongoDB
sudo systemctl stop mongod

# 恢复数据目录
sudo cp -r /var/backups/mongodb/backup_20231206_143000/* /var/lib/mongodb/

# 修复权限
sudo chown -R mongodb:mongodb /var/lib/mongodb

# 启动MongoDB
sudo systemctl start mongod
```

## 📊 版本对比

| 特性 | MongoDB 3.6.8 | MongoDB 4.4.x |
|------|---------------|---------------|
| 发布年份 | 2018 | 2020 |
| Wire Version | 6 | 8 |
| Node.js驱动兼容性 | ❌ | ✅ |
| 性能 | 基础 | 增强 |
| 安全特性 | 基础 | 增强 |

## 🎯 验证成功标准

升级完成后，应该满足以下条件：

1. ✅ `mongod --version` 显示 4.4.x
2. ✅ `sudo systemctl status mongod` 显示 active (running)
3. ✅ 应用日志不再显示 wire version 错误
4. ✅ 前端页面能正常加载数据

## 📞 技术支持

如果升级过程中遇到问题，请提供：
1. 错误日志 (`pm2 logs xiaohongshu-api`)
2. MongoDB日志 (`sudo journalctl -u mongod -n 50`)
3. 系统信息 (`uname -a` 和 `lsb_release -a`)

---

**执行顺序**: 按步骤1-7依次执行，每步执行前备份当前状态。