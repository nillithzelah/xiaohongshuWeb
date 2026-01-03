const axios = require('axios');

// 测试设备审核历史记录功能
async function testDeviceReviewHistory() {
  console.log('🧪 开始测试设备审核历史记录功能...\n');

  try {
    // 1. 测试API是否返回审核状态字段
    console.log('1️⃣ 测试API返回数据结构...');
    const response = await axios.get('http://localhost:5000/xiaohongshu/api/client/device/my-list', {
      headers: {
        'Authorization': 'Bearer YOUR_TEST_TOKEN' // 需要替换为实际token
      }
    });

    if (response.data.success) {
      console.log('✅ API调用成功');
      const devices = response.data.devices;

      if (devices.length > 0) {
        const device = devices[0];
        console.log('📋 设备数据结构检查:');
        console.log('  - accountName:', !!device.accountName);
        console.log('  - status:', !!device.status);
        console.log('  - reviewStatus:', !!device.reviewStatus);
        console.log('  - reviewReason:', device.reviewReason !== undefined);
        console.log('  - reviewedAt:', device.reviewedAt !== undefined);

        // 检查是否有被拒绝的设备
        const rejectedDevices = devices.filter(d => d.reviewStatus === 'rejected');
        if (rejectedDevices.length > 0) {
          console.log('✅ 发现被拒绝的设备:', rejectedDevices.length, '个');
          rejectedDevices.forEach(device => {
            console.log('  - 账号:', device.accountName);
            console.log('  - 拒绝原因:', device.reviewReason || '无');
          });
        } else {
          console.log('ℹ️ 没有找到被拒绝的设备（这是正常的，如果没有实际的拒绝记录）');
        }
      } else {
        console.log('ℹ️ 用户没有设备记录');
      }
    } else {
      console.log('❌ API返回失败:', response.data.message);
    }

  } catch (error) {
    console.log('❌ 测试失败:', error.message);
    console.log('💡 请确保：');
    console.log('  1. 服务器正在运行 (npm start)');
    console.log('  2. MongoDB连接正常');
    console.log('  3. 使用有效的JWT token');
  }
}

// 运行测试
testDeviceReviewHistory();