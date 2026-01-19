#!/bin/bash

# 同步所有修复后的模型文件到服务器
echo "开始同步模型文件到服务器..."

# 模型文件列表
models=(
    "server/models/TaskConfig.js"
    "server/models/User.js"
    "server/models/DeviceNoteHistory.js"
    "server/models/Device.js"
    "server/models/Complaint.js"
    "server/models/CommentLimit.js"
    "server/models/AuditLog.js"
    "server/models/ImageReview.js"
)

# 同步每个文件
for model in "${models[@]}"; do
    echo "同步 $model..."
    scp "$model" wubug:/var/www/xiaohongshu-web/"$model"
    if [ $? -eq 0 ]; then
        echo "✅ $model 同步成功"
    else
        echo "❌ $model 同步失败"
    fi
done

echo "所有模型文件同步完成！"