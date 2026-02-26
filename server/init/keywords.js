/**
 * 关键词初始化脚本
 *
 * 将 keywords.js 配置文件中的关键词导入到数据库
 *
 * 使用方法：
 * node server/init/keywords.js
 */

const mongoose = require('mongoose');
const SearchKeyword = require('../models/SearchKeyword');
const { KEYWORD_CONFIGS } = require('../config/keywords');

// 数据库连接
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

// 将关键词配置转换为数据库格式
function convertConfigToKeywords() {
  const keywords = [];

  KEYWORD_CONFIGS.forEach(config => {
    config.keywords.forEach(keyword => {
      // 根据分类确定优先级
      let priority = 1;
      switch (config.category) {
        case '减肥诈骗':
        case '护肤诈骗':
        case '祛斑诈骗':
          priority = 1;
          break;
        case '丰胸诈骗':
        case '医美诈骗':
        case '增高诈骗':
          priority = 2;
          break;
        case '通用维权':
          priority = 3;
          break;
        default:
          priority = 1;
      }

      keywords.push({
        keyword,
        category: config.category,
        priority
      });
    });
  });

  return keywords;
}

// 初始化关键词
async function initKeywords() {
  try {
    console.log('🔗 连接数据库...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 数据库连接成功');

    console.log('📋 准备导入关键词...');

    // 转换配置
    const keywordsToImport = convertConfigToKeywords();
    console.log(`📊 共有 ${keywordsToImport.length} 个关键词待导入`);

    // 统计
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const kw of keywordsToImport) {
      try {
        await SearchKeyword.findOneAndUpdate(
          { keyword: kw.keyword },
          kw,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        successCount++;
      } catch (e) {
        if (e.code === 11000) {
          skipCount++;
        } else {
          errorCount++;
          console.error(`❌ 导入失败 [${kw.keyword}]:`, e.message);
        }
      }
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 导入完成:`);
    console.log(`   ✅ 成功: ${successCount}`);
    console.log(`   🔄 跳过: ${skipCount} (已存在)`);
    console.log(`   ❌ 失败: ${errorCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 显示数据库中的统计
    const total = await SearchKeyword.countDocuments();
    const active = await SearchKeyword.countDocuments({ status: 'active' });

    console.log(`📈 数据库统计:`);
    console.log(`   总计: ${total}`);
    console.log(`   活跃: ${active}`);

  } catch (error) {
    console.error('❌ 初始化失败:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 数据库连接已关闭');
  }
}

// 执行初始化
initKeywords().then(() => {
  console.log('✅ 初始化完成');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 执行失败:', error);
  process.exit(1);
});
