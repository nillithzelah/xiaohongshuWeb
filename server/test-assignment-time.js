const mongoose = require('mongoose');
const User = require('./models/User');

// 连接数据库
async function connectDB() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    process.exit(1);
  }
}

// 测试分配时间功能
async function testAssignmentTime() {
  try {
    console.log('🔍 开始测试分配时间功能...');

    // 查找一个兼职用户
    const partTimeUser = await User.findOne({ role: 'part_time' });
    if (!partTimeUser) {
      console.log('⚠️ 未找到兼职用户，创建一个测试用户...');

      const testUser = await User.create({
        openid: `test_${Date.now()}`,
        username: `testuser_${Date.now()}`,
        password: '123456',
        name: '测试用户',
        role: 'part_time'
      });

      console.log('✅ 创建测试用户成功:', testUser._id);
      return;
    }

    console.log('📋 找到兼职用户:', {
      id: partTimeUser._id,
      username: partTimeUser.username,
      mentor_id: partTimeUser.mentor_id,
      assigned_to_mentor_at: partTimeUser.assigned_to_mentor_at
    });

    // 查找一个带教老师
    const mentor = await User.findOne({ role: 'mentor' });
    if (!mentor) {
      console.log('⚠️ 未找到带教老师，创建一个测试带教老师...');

      const testMentor = await User.create({
        openid: `mentor_${Date.now()}`,
        username: `mentor_${Date.now()}`,
        password: '123456',
        name: '测试带教老师',
        role: 'mentor'
      });

      console.log('✅ 创建测试带教老师成功:', testMentor._id);
      return;
    }

    console.log('👨‍🏫 找到带教老师:', {
      id: mentor._id,
      username: mentor.username,
      name: mentor.name
    });

    // 模拟分配操作
    console.log('🔄 模拟分配兼职用户给带教老师...');

    const beforeUpdate = new Date();
    const updatedUser = await User.findByIdAndUpdate(
      partTimeUser._id,
      {
        mentor_id: mentor._id,
        assigned_to_mentor_at: new Date()
      },
      { new: true }
    );

    const afterUpdate = new Date();

    console.log('✅ 分配成功!');
    console.log('📊 更新后的用户数据:', {
      id: updatedUser._id,
      username: updatedUser.username,
      mentor_id: updatedUser.mentor_id,
      assigned_to_mentor_at: updatedUser.assigned_to_mentor_at
    });

    // 验证分配时间是否正确设置
    if (updatedUser.assigned_to_mentor_at) {
      const assignmentTime = new Date(updatedUser.assigned_to_mentor_at);
      console.log('⏰ 分配时间:', assignmentTime.toLocaleString('zh-CN'));

      if (assignmentTime >= beforeUpdate && assignmentTime <= afterUpdate) {
        console.log('✅ 分配时间设置正确!');
      } else {
        console.log('⚠️ 分配时间可能不准确');
      }
    } else {
      console.log('❌ 分配时间未设置');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 主函数
async function main() {
  await connectDB();
  await testAssignmentTime();

  console.log('🏁 测试完成');
  process.exit(0);
}

main();