/**
 * 数据库索引创建脚本
 *
 * 为优化查询性能，为关键集合添加必要的索引
 *
 * 运行方式：
 *   node server/scripts/create-indexes.js
 *
 * 注意：
 * - 索引创建需要时间，请在低峰期执行
 * - 大集合创建索引可能锁定数据库
 * - 生产环境建议使用 { background: true } 选项
 */

const mongoose = require('mongoose');

// 从环境变量获取 MongoDB URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

/**
 * 索引定义
 *
 * 每个索引包含：
 * - model: Mongoose 模型名称（文件名）
 * - indexes: 索引配置数组
 *   - fields: 索引字段（Mongoose 格式）
 *   - options: 索引选项（unique, sparse, background 等）
 */
const INDEX_DEFINITIONS = [
  // ==================== TaskQueue 索引 ====================
  {
    model: 'TaskQueue',
    indexes: [
      {
        fields: { status: 1, createdAt: -1 },
        options: { name: 'status_createdAt_idx', background: true }
      },
      {
        fields: { clientId: 1, status: 1 },
        options: { name: 'clientId_status_idx', background: true }
      },
      {
        fields: { taskType: 1, status: 1 },
        options: { name: 'taskType_status_idx', background: true }
      },
      {
        fields: { priority: -1, createdAt: 1 },
        options: { name: 'priority_createdAt_idx', background: true }
      }
    ]
  },

  // ==================== ImageReview 索引 ====================
  {
    model: 'ImageReview',
    indexes: [
      {
        fields: { userId: 1, status: 1, createdAt: -1 },
        options: { name: 'userId_status_createdAt_idx', background: true }
      },
      {
        fields: { noteUrl: 1 },
        options: { name: 'noteUrl_idx', background: true }
      },
      {
        fields: { status: 1, createdAt: -1 },
        options: { name: 'status_createdAt_idx', background: true }
      },
      {
        fields: { imageType: 1, status: 1 },
        options: { name: 'imageType_status_idx', background: true }
      },
      {
        fields: { 'aiParsedNoteInfo.author': 1, status: 1 },
        options: { name: 'author_status_idx', background: true }
      }
    ]
  },

  // ==================== Device 索引 ====================
  {
    model: 'Device',
    indexes: [
      {
        fields: { reviewStatus: 1, createdAt: -1 },
        options: { name: 'reviewStatus_createdAt_idx', background: true }
      },
      {
        fields: { assignedUser: 1, reviewStatus: 1 },
        options: { name: 'assignedUser_reviewStatus_idx', background: true }
      },
      {
        fields: { accountName: 1 },
        options: { name: 'accountName_idx', background: true, sparse: true }
      },
      {
        fields: { status: 1, assignedUser: 1 },
        options: { name: 'status_assignedUser_idx', background: true }
      }
    ]
  },

  // ==================== DiscoveredNote 索引 ====================
  {
    model: 'DiscoveredNote',
    indexes: [
      {
        fields: { status: 1, discoverTime: -1 },
        options: { name: 'status_discoverTime_idx', background: true }
      },
      {
        fields: { noteUrl: 1 },
        options: { name: 'noteUrl_idx', unique: true, background: true }
      },
      {
        fields: { noteStatus: 1, commentsHarvested: 1 },
        options: { name: 'noteStatus_commentsHarvested_idx', background: true }
      },
      {
        fields: { harvestPriority: 1, commentsHarvestedAt: 1 },
        options: { name: 'harvestPriority_commentsHarvestedAt_idx', background: true }
      },
      {
        fields: { shortUrl: 1 },
        options: { name: 'shortUrl_idx', sparse: true, background: true }
      }
    ]
  },

  // ==================== CommentLead 索引 ====================
  {
    model: 'CommentLead',
    indexes: [
      {
        fields: { noteUrl: 1, createdAt: -1 },
        options: { name: 'noteUrl_createdAt_idx', background: true }
      },
      {
        fields: { status: 1, createdAt: -1 },
        options: { name: 'status_createdAt_idx', background: true }
      },
      {
        fields: { author: 1, createdAt: -1 },
        options: { name: 'author_createdAt_idx', background: true }
      }
    ]
  },

  // ==================== CommentBlacklist 索引 ====================
  {
    model: 'CommentBlacklist',
    indexes: [
      {
        fields: { noteUrl: 1, author: 1 },
        options: { name: 'noteUrl_author_idx', unique: true, background: true }
      },
      {
        fields: { createdAt: -1 },
        options: { name: 'createdAt_idx', background: true }
      }
    ]
  },

  // ==================== User 索引 ====================
  {
    model: 'User',
    indexes: [
      {
        fields: { parent_id: 1, is_deleted: 1 },
        options: { name: 'parent_id_is_deleted_idx', background: true }
      },
      {
        fields: { mentor_id: 1, is_deleted: 1 },
        options: { name: 'mentor_id_is_deleted_idx', background: true }
      },
      {
        fields: { role: 1, is_deleted: 1 },
        options: { name: 'role_is_deleted_idx', background: true }
      },
      {
        fields: { username: 1 },
        options: { name: 'username_idx', unique: true, background: true }
      }
    ]
  },

  // ==================== Transaction 索引 ====================
  {
    model: 'Transaction',
    indexes: [
      {
        fields: { userId: 1, type: 1, createdAt: -1 },
        options: { name: 'userId_type_createdAt_idx', background: true }
      },
      {
        fields: { user_id: 1, type: 1, status: 1 },
        options: { name: 'user_id_type_status_idx', background: true }
      },
      {
        fields: { type: 1, status: 1, createdAt: -1 },
        options: { name: 'type_status_createdAt_idx', background: true }
      }
    ]
  },

  // ==================== CommentLimit 索引 ====================
  {
    model: 'CommentLimit',
    indexes: [
      {
        fields: { noteUrl: 1, author: 1 },
        options: { name: 'noteUrl_author_idx', background: true }
      },
      {
        fields: { expiresAt: 1 },
        options: { name: 'expiresAt_idx', background: true, expireAfterSeconds: 0 }
      }
    ]
  },

  // ==================== SystemConfig 索引 ====================
  {
    model: 'SystemConfig',
    indexes: [
      {
        fields: { key: 1 },
        options: { name: 'key_idx', unique: true, background: true }
      }
    ]
  }
];

/**
 * 为单个模型创建索引
 */
async function createIndexesForModel(Model, modelName, indexDefinitions) {
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  console.log(`\n📋 处理模型: ${modelName}`);

  // 获取现有索引
  const existingIndexes = await Model.collection.getIndexes();
  const existingIndexNames = Object.keys(existingIndexes).filter(
    name => name !== '_id_' // 排除默认的 _id 索引
  );

  for (const def of indexDefinitions) {
    const indexName = def.options.name || JSON.stringify(def.fields);

    try {
      // 检查索引是否已存在
      if (existingIndexNames.includes(indexName)) {
        console.log(`  ⏭️  跳过已存在的索引: ${indexName}`);
        skippedCount++;
        continue;
      }

      // 创建索引
      await Model.collection.createIndex(def.fields, def.options);
      console.log(`  ✅ 创建索引: ${indexName}`);
      createdCount++;

    } catch (error) {
      if (error.code === 85 || error.code === 86) {
        // 索引已存在（不同错误码）
        console.log(`  ⏭️  跳过已存在的索引: ${indexName}`);
        skippedCount++;
      } else {
        console.error(`  ❌ 创建索引失败 [${indexName}]:`, error.message);
        errorCount++;
      }
    }
  }

  return { createdCount, skippedCount, errorCount };
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始创建数据库索引...\n');
  console.log(`📍 连接数据库: ${MONGODB_URI.replace(/\/\/[^@]+@/, '//***@')}`);

  try {
    // 连接数据库
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 数据库连接成功');

    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // 处理每个模型的索引
    for (const def of INDEX_DEFINITIONS) {
      try {
        // 动态加载模型
        const Model = mongoose.model(def.model);
        const result = await createIndexesForModel(Model, def.model, def.indexes);

        totalCreated += result.createdCount;
        totalSkipped += result.skipped;
        totalErrors += result.errorCount;

      } catch (error) {
        if (error.name === 'MissingSchemaError') {
          console.log(`\n⚠️  模型不存在，跳过: ${def.model}`);
        } else {
          console.error(`\n❌ 处理模型 [${def.model}] 失败:`, error.message);
          totalErrors++;
        }
      }
    }

    // 输出统计
    console.log('\n' + '='.repeat(50));
    console.log('📊 索引创建统计:');
    console.log(`  ✅ 新创建: ${totalCreated}`);
    console.log(`  ⏭️  已存在跳过: ${totalSkipped}`);
    console.log(`  ❌ 失败: ${totalErrors}`);
    console.log('='.repeat(50));

    if (totalErrors === 0) {
      console.log('\n🎉 索引创建完成！');
    } else {
      console.log('\n⚠️  部分索引创建失败，请检查错误信息');
    }

  } catch (error) {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 数据库连接已关闭');
  }
}

// 运行脚本
if (require.main === module) {
  main().catch(error => {
    console.error('未捕获的错误:', error);
    process.exit(1);
  });
}

module.exports = { INDEX_DEFINITIONS, createIndexesForModel };
