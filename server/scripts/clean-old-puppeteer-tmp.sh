#!/bin/bash
#############################################
# Puppeteer 旧临时目录清理脚本（智能版）
# 用途：只清理超过一定时间未访问的临时目录
#       避免删除正在使用的目录
#
# 使用：添加到 crontab
#   每小时清理一次：0 * * * * /root/scripts/clean-old-puppeteer-tmp.sh
#
# 配置：
#   OLDER_THAN: 目录至少多久未访问才删除（分钟）
#               默认 120 分钟（2小时）
#############################################

TMP_DIR="/tmp"
LOG_FILE="/var/www/xiaohongshu-web/logs/clean-puppeteer-tmp.log"
OLDER_THAN=120  # 分钟，至少2小时未访问的目录才删除

# 创建日志目录
mkdir -p "$(dirname "$LOG_FILE")"

# 记录日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 检查磁盘使用率
check_disk() {
    df / | tail -1 | awk '{print $5}' | sed 's/%//'
}

# 清理旧的 Puppeteer 临时目录
clean_old_puppeteer_tmp() {
    log "开始清理超过 ${OLDER_THAN} 分钟未访问的 Puppeteer 临时目录..."

    local deleted_count=0
    local total_freed=0

    # 查找所有 puppeteer_dev_profile-* 目录
    for dir in "$TMP_DIR"/puppeteer_dev_profile-*; do
        if [ -d "$dir" ]; then
            # 获取目录最后访问时间（分钟数）
            local last_access=$(stat -c "%X" "$dir")  # Unix timestamp
            local current_time=$(date +%s)
            local diff_minutes=$(( (current_time - last_access) / 60 ))

            # 如果超过阈值，删除
            if [ "$diff_minutes" -gt "$OLDER_THAN" ]; then
                # 计算目录大小
                local size=$(du -sm "$dir" | cut -f1)

                rm -rf "$dir"
                deleted_count=$((deleted_count + 1))
                total_freed=$((total_freed + size))

                log "  删除: $(basename "$dir") (${size}M, ${diff_minutes}分钟未访问)"
            else
                log "  跳过: $(basename "$dir") (${diff_minutes}分钟前访问，正在使用中)"
            fi
        fi
    done

    log "删除了 $deleted_count 个旧目录，释放 ${total_freed}M 空间"
}

# 检查磁盘使用率
disk_usage=$(check_disk)
log "当前磁盘使用率: ${disk_usage}%"

# 执行清理
clean_old_puppeteer_tmp

# 再次检查磁盘使用率
disk_usage_after=$(check_disk)
log "清理后磁盘使用率: ${disk_usage_after}%"

log "清理完成"
log "----------------------------------------"
