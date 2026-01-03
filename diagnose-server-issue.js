/**
 * 小红书投诉管理系统 - 服务器问题诊断脚本
 * 用于检查生产环境中的常见问题
 */

const mongoose = require('mongoose');
const Complaint = require('./server/models/Complaint');
const User = require('./server/models/User');

console.log('🔍 开始诊断服务器问题...\n');

// 1. 检查数据库连接
async function checkDatabaseConnection() {
  console.log('1️⃣ 检查数据库连接...');
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';
    console.log(`   数据库连接字符串: ${MONGODB_URI}`);
    
    await mongoose.connect(MONGODB_URI, { 
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000 
    });
    
    console.log('   ✅ 数据库连接成功');
    return true;
  } catch (error) {
    console.error('   ❌ 数据库连接失败:', error.message);
    return false;
  }
}

// 2. 检查投诉集合
async function checkComplaintsCollection() {
  console.log('\n2️⃣ 检查投诉集合...');
  try {
    const count = await Complaint.countDocuments();
    console.log(`   投诉总数: ${count}`);
    
    if (count === 0) {
      console.log('   ⚠️  警告: 投诉集合为空，这可能导致前端显示错误');
    } else {
      console.log('   ✅ 投诉集合正常');
    }
    
    // 尝试获取一些样本数据
    const sample = await Complaint.findOne().populate('userId', 'username');
    if (sample) {
      console.log(`   样本投诉: ${sample.content.substring(0, 30)}...`);
    }
    
    return true;
  } catch (error) {
    console.error('   ❌ 检查投诉集合失败:', error.message);
    return false;
  }
}

// 3. 检查用户集合
async function checkUsersCollection() {
  console.log('\n3️⃣ 检查用户集合...');
  try {
    const count = await User.countDocuments();
    console.log(`   用户总数: ${count}`);
    
    // 检查管理员用户
    const adminCount = await User.countDocuments({ role: { $in: ['boss', 'manager'] } });
    console.log(`   管理员用户数: ${adminCount}`);
    
    if (adminCount === 0) {
      console.log('   ❌ 错误: 没有管理员用户，无法访问投诉管理功能');
    } else {
      console.log('   ✅ 用户集合正常');
    }
    
    return true;
  } catch (error) {
    console.error('   ❌ 检查用户集合失败:', error.message);
    return false;
  }
}

// 4. 检查环境变量
function checkEnvironmentVariables() {
  console.log('\n4️⃣ 检查环境变量...');
  
  const requiredVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'PORT'
  ];
  
  let allGood = true;
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`   ✅ ${varName}: 配置正确`);
    } else {
      console.log(`   ❌ ${varName}: 未配置`);
      allGood = false;
    }
  });
  
  return allGood;
}

// 5. 模拟API请求
async function simulateApiRequest() {
  console.log('\n5️⃣ 模拟API请求...');
  try {
    // 模拟获取投诉列表的逻辑
    const { page = 1, limit = 10 } = { page: 1, limit: 10 };
    const skip = (page - 1) * limit;
    
    const complaints = await Complaint.find({})
      .populate('userId', 'username nickname phone')
      .populate('respondedBy', 'username nickname')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Complaint.countDocuments({});
    
    console.log(`   ✅ API请求成功: 返回${complaints.length}条投诉`);
    console.log(`   分页信息: 页码${page}, 每页${limit}, 总数${total}`);
    
    return true;
  } catch (error) {
    console.error('   ❌ API请求失败:', error.message);
    console.error('   错误堆栈:', error.stack);
    return false;
  }
}

// 运行所有诊断
async function runDiagnostics() {
  console.log('========================================');
  console.log('小红书投诉管理系统 - 服务器诊断工具');
  console.log('========================================\n');
  
  const results = [];
  
  // 检查环境变量
  results.push({
    name: '环境变量检查',
    passed: checkEnvironmentVariables()
  });
  
  // 检查数据库连接
  const dbConnected = await checkDatabaseConnection();
  results.push({
    name: '数据库连接',
    passed: dbConnected
  });
  
  if (dbConnected) {
    // 只有在数据库连接成功时才进行其他检查
    results.push({
      name: '投诉集合检查',
      passed: await checkComplaintsCollection()
    });
    
    results.push({
      name: '用户集合检查',
      passed: await checkUsersCollection()
    });
    
    results.push({
      name: 'API请求模拟',
      passed: await simulateApiRequest()
    });
  }
  
  // 输出诊断结果
  console.log('\n========================================');
  console.log('诊断结果总结:');
  console.log('========================================');
  
  results.forEach(result => {
    const status = result.passed ? '✅ 通过' : '❌ 失败';
    console.log(`${status}: ${result.name}`);
  });
  
  const allPassed = results.every(r => r.passed);
  if (allPassed) {
    console.log('\n🎉 所有检查通过！服务器应该正常工作。');
  } else {
    console.log('\n⚠️ 发现问题！请根据以上结果进行修复。');
  }
  
  // 关闭数据库连接
  await mongoose.connection.close();
  console.log('\n✅ 数据库连接已关闭');
  process.exit(allPassed ? 0 : 1);
}

// 运行诊断
runDiagnostics().catch(error => {
  console.error('❌ 运行诊断时出现错误:', error);
  process.exit(1);
});