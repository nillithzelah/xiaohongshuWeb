const mongoose = require('mongoose');
const Device = require('./models/Device');

async function migrateDeviceInfluence() {
  try {
    console.log('🔄 开始设备影响力数据迁移...');

    // 连接数据库
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 获取所有设备
    const devices = await Device.find({});
    console.log(`📊 找到 ${devices.length} 条设备记录`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const device of devices) {
      try {
        // 检查influence字段是否已经是数组
        if (Array.isArray(device.influence)) {
          console.log(`⏭️ 设备 ${device.accountName} 已经是数组格式，跳过`);
          continue;
        }

        // 如果是字符串，转换为数组
        let newInfluence = [];
        if (typeof device.influence === 'string' && device.influence) {
          newInfluence = [device.influence];
        } else if (!device.influence) {
          // 如果没有影响力，默认设置为新号
          newInfluence = ['new'];
        }

        // 更新设备
        await Device.findByIdAndUpdate(device._id, {
          influence: newInfluence
        });

        migratedCount++;
        console.log(`✅ 设备 ${device.accountName}: ${device.influence || '空'} → [${newInfluence.join(', ')}]`);

      } catch (error) {
        console.error(`❌ 迁移设备 ${device.accountName} 失败:`, error.message);
        errorCount++;
      }
    }

    // 验证迁移结果
    const allDevices = await Device.find({});
    let arrayCount = 0;
    let stringCount = 0;
    let nullCount = 0;

    allDevices.forEach(device => {
      if (Array.isArray(device.influence)) {
        arrayCount++;
      } else if (typeof device.influence === 'string') {
        stringCount++;
      } else {
        nullCount++;
      }
    });

    console.log('\n📈 迁移结果统计:');
    console.log(`  成功迁移: ${migratedCount} 条`);
    console.log(`  迁移失败: ${errorCount} 条`);
    console.log(`  数组格式: ${arrayCount} 条`);
    console.log(`  字符串格式: ${stringCount} 条`);
    console.log(`  空值格式: ${nullCount} 条`);

    if (stringCount === 0) {
      console.log('✅ 所有设备影响力字段都已成功转换为数组格式');
    } else {
      console.log(`❌ 仍有 ${stringCount} 条设备使用字符串格式`);
    }

    await mongoose.disconnect();
    console.log('🎉 设备影响力数据迁移完成');

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  }
}

migrateDeviceInfluence();