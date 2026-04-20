#!/usr/bin/env node
/**
 * 从 URL 重新导入已删除的笔记
 *
 * 用法: node reimport-notes.js <noteId1> <noteId2> ...
 * 示例: node reimport-notes.js 697ec295000000000903a896 698482d4000000000c035fcd
 */

const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');
const DiscoveredNote = require('./models/DiscoveredNote');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

// 从 URL 中提取 noteId
function extractNoteId(noteUrl) {
  const match = noteUrl.match(/explore\/([a-f0-9]{24,})/);
  return match ? match[1] : null;
}

// 构建 xiaohongshu explore URL
function buildExploreUrl(noteId) {
  return `https://www.xiaohongshu.com/explore/${noteId}`;
}

// 使用浏览器环境提取笔记内容
async function fetchNoteContent(noteUrl) {
  const browserAutomation = require('./services/browser/BrowserAutomation');
  const automation = new browserAutomation({
    xiaohongshu: {
      cookie: process.env.XIAOHONGSHU_COOKIE || ''
    }
  });

  try {
    await automation.initialize();
    const page = await automation.getPage();

    console.log(`   🌐 正在访问: ${noteUrl}`);
    await page.goto(noteUrl, { waitUntil: 'networkidle2', timeout: 15000 });

    // 检查是否需要登录
    const isLoggedIn = await automation.checkIsLoggedIn();
    if (!isLoggedIn) {
      throw new Error('小红书Cookie已过期，需要更新');
    }

    // 检查笔记是否存在
    const isDeleted = await automation.checkNoteDeleted(noteUrl);
    if (isDeleted.isDeleted) {
      throw new Error(`笔记已被删除: ${isDeleted.reason}`);
    }

    // 提取内容
    const content = await page.evaluate(() => {
      let title = '';
      let author = '';
      let text = '';

      // 标题
      const titleSelectors = ['.title', '.note-title', 'h1', '[class*="title"]'];
      for (const selector of titleSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          title = el.textContent.trim();
          break;
        }
      }

      // 作者
      const authorSelectors = ['.author-name', '[class*="author"]', '[class*="user"] [class*="name"]'];
      for (const selector of authorSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          author = el.textContent.trim();
          break;
        }
      }

      // 正文
      const textSelectors = ['.note-text', '.content', '.desc', '[class*="note"] [class*="text"]', 'article'];
      for (const selector of textSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          text = el.textContent.trim();
          break;
        }
      }

      return { title, author, text };
    });

    await automation.close();

    return {
      title: content.title || '未命名笔记',
      author: content.author || '',
      text: content.text || ''
    };

  } catch (error) {
    await automation.close();
    throw error;
  }
}

// 直接创建笔记记录（无内容）
async function createNoteRecord(noteId, noteUrl) {
  const note = await DiscoveredNote.findOneAndUpdate(
    { noteId },
    {
      noteUrl,
      noteId,
      title: '未命名笔记',
      author: '',
      keyword: '',
      status: 'discovered',
      noteStatus: 'active',
      aiAnalysis: {
        is_genuine_victim_post: false,
        confidence_score: 0,
        reason: ''
      },
      discoverTime: new Date()
    },
    { upsert: true, new: true }
  );

  return note;
}

async function main() {
  const noteIds = process.argv.slice(2);

  if (noteIds.length === 0) {
    console.log('用法: node reimport-notes.js <noteId1> <noteId2> ...');
    console.log('示例: node reimport-notes.js 697ec295000000000903a896 698482d4000000000c035fcd');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('✅ 数据库连接成功\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📥 开始重新导入 ${noteIds.length} 条笔记`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = {
    success: [],
    failed: [],
    alreadyExists: []
  };

  for (let i = 0; i < noteIds.length; i++) {
    const noteId = noteIds[i].trim();
    const noteUrl = buildExploreUrl(noteId);

    console.log(`[${i + 1}/${noteIds.length}] ${noteId}`);

    // 检查是否已存在
    const existing = await DiscoveredNote.findOne({ noteId });
    if (existing) {
      console.log(`   ⏭️  笔记已存在，跳过\n`);
      results.alreadyExists.push(noteId);
      continue;
    }

    // 尝试抓取内容
    try {
      const content = await fetchNoteContent(noteUrl);
      console.log(`   📝 标题: ${content.title}`);
      console.log(`   👤 作者: ${content.author || '未知'}`);
      console.log(`   📄 内容长度: ${content.text.length} 字符`);

      // 创建笔记记录
      const note = await DiscoveredNote.findOneAndUpdate(
        { noteId },
        {
          noteUrl,
          noteId,
          title: content.title,
          author: content.author,
          keyword: '',
          status: 'discovered',
          noteStatus: 'active',
          aiAnalysis: {
            is_genuine_victim_post: false,
            confidence_score: 0,
            reason: ''
          },
          needsCommentHarvest: true,
          discoverTime: new Date()
        },
        { upsert: true, new: true }
      );

      console.log(`   ✅ 导入成功\n`);
      results.success.push({ noteId, title: content.title });

    } catch (error) {
      console.log(`   ❌ 导入失败: ${error.message}\n`);
      results.failed.push({ noteId, error: error.message });
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 导入结果统计');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 成功: ${results.success.length} 条`);
  console.log(`⏭️  已存在: ${results.alreadyExists.length} 条`);
  console.log(`❌ 失败: ${results.failed.length} 条`);

  if (results.failed.length > 0) {
    console.log('\n失败列表:');
    results.failed.forEach(r => {
      console.log(`  - ${r.noteId}: ${r.error}`);
    });
  }

  if (results.success.length > 0) {
    console.log('\n成功列表:');
    results.success.forEach(r => {
      console.log(`  - ${r.noteId}: ${r.title}`);
    });
  }

  console.log('');

  await mongoose.disconnect();
}

main().catch(error => {
  console.error('❌ 错误:', error);
  process.exit(1);
});
