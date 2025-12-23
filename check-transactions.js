const mongoose = require('mongoose');

// 连接数据库
async function checkTransactions() {
  try {
    console.log('🔍 正在连接数据库...');
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 定义Transaction模型（简化版）
    const transactionSchema = new mongoose.Schema({
      imageReview_id: mongoose.Schema.Types.ObjectId,
      user_id: mongoose.Schema.Types.ObjectId,
      amount: Number,
      type: String,
      status: String,
      createdAt: Date,
      paid_at: Date
    });

    const Transaction = mongoose.model('Transaction', transactionSchema, 'transactions');

    // 查询统计
    const pendingCount = await Transaction.countDocuments({ status: 'pending' });
    const paidCount = await Transaction.countDocuments({ status: 'paid' });
    const totalCount = await Transaction.countDocuments({});

    console.log('\n📊 交易记录统计:');
    console.log(`   待支付: ${pendingCount}`);
    console.log(`   已支付: ${paidCount}`);
    console.log(`   总计: ${totalCount}`);

    // 显示最近的交易记录
    console.log('\n📋 最近的交易记录:');
    const recentTransactions = await Transaction.find({})
      .sort({ createdAt: -1 })
      .limit(10);

    recentTransactions.forEach((t, i) => {
      console.log(`${i+1}. [${t.status}] ${t.type} - ¥${t.amount} - ${t.createdAt}`);
    });

    if (pendingCount === 0 && totalCount > 0) {
      console.log('\n⚠️ 没有待支付记录，可能所有交易都已完成支付');
    } else if (totalCount === 0) {
      console.log('\n⚠️ 数据库中没有任何交易记录');
    }

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    console.error('🔍 错误详情:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 数据库连接已关闭');
  }
}

checkTransactions();