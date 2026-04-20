#!/bin/bash
#############################################
# Puppeteer 临时文件清理脚本
# 用途：定期清理 /tmp 中的 Puppeteer 临时目录
#       避免磁盘堆积导致磁盘满
#
# 使用：添加到 crontab
#   每小时清理一次：0 * * * * /root/scripts/clean-puppeteer-tmp.sh
#   每6小时清理一次：0 */6 * * * /root/scripts/clean-puppeteer-tmp.sh
#############################################

TMP_DIR="/tmp"
LOG_FILE="/var/www/xiaohongshu-web/logs/clean-puppeteer-tmp.log"
DISK_ALERT_THRESHOLD=80  # 磁盘使用率超过此值时记录告警

# 创建日志目录
mkdir -p "$(dirname "$LOG_FILE")"

# 记录日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 检查磁盘使用率
check_disk() {
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    echo "$disk_usage"
}

# 清理 Puppeteer 临时目录
clean_puppeteer_tmp() {
    log "开始清理 Puppeteer 临时目录..."

    # 查找所有 puppeteer_dev_profile-* 目录
    local count_before=$(ls -d "$TMP_DIR"/puppeteer_dev_profile-* 2>/dev/null | wc -l)
    log "发现 $count_before 个 Puppeteer 临时目录"

    if [ "$count_before" -gt 0 ]; then
        # 删除所有 puppeteer_dev_profile-* 目录
        rm -rf "$TMP_DIR"/puppeteer_dev_profile-*
        log "已删除 $count_before 个 Puppeteer 临时目录"
    else
        log "没有发现需要清理的 Puppeteer 临时目录"
    fi

    # 查找所有 xiaohongshu-clients 目录
    local client_dirs=$(find "$TMP_DIR"/xiaohongshu-clients -type d -name "Default" 2>/dev/null)
    if [ -n "$client_dirs" ]; then
        log "发现 xiaohongshu-clients 用户数据目录（保留，由客户端管理）"
    fi
}

# 检查磁盘使用率
disk_usage=$(check_disk)
log "当前磁盘使用率: ${disk_usage}%"

if [ "$disk_usage" -ge "$DISK_ALERT_THRESHOLD" ]; then
    log "⚠️  警告：磁盘使用率超过 ${DISK_ALERT_THRESHOLD}%"
fi

# 执行清理
clean_puppeteer_tmp

# 再次检查磁盘使用率
disk_usage_after=$(check_disk)
log "清理后磁盘使用率: ${disk_usage_after}%"

# 计算释放的空间
local disk_freed=$((disk_usage - disk_usage_after))
if [ "$disk_freed" -gt 0 ]; then
    log "✅ 释放了约 ${disk_freed}% 磁盘空间"
fi

log "清理完成"
log "----------------------------------------"
