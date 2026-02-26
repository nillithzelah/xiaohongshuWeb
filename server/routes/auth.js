const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const router = express.Router();

console.log('🔧 auth路由已加载');

// 登录速率限制 - 防止暴力破解
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 20, // 限制每个IP 15分钟内最多20次登录尝试
  message: { success: false, message: '登录尝试过多，请15分钟后再试' },
  skipSuccessfulRequests: false
});

// 手机号登录专用限流器 - 更宽松的限制（适用于小程序频繁授权场景）
const phoneLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 50, // 15分钟内最多50次
  message: { success: false, message: '手机号授权请求过于频繁，请稍后重试' },
  skipSuccessfulRequests: false
});

// JWT_SECRET 检查已在 middleware/auth.js 中完成，此处直接使用
const JWT_SECRET = process.env.JWT_SECRET;

// ==================== 登录失败次数限制 ====================
// 使用持久化存储，解决服务重启后记录丢失的问题
const {
  checkLoginLockout,
  recordLoginFailure,
  clearLoginAttempts,
  getRemainingAttempts,
  MAX_LOGIN_ATTEMPTS
} = require('../utils/loginAttemptsStore');

// 测试路由
router.get('/test-auth', (req, res) => {
  console.log('🎯 auth测试路由被调用');
  res.json({ success: true, message: 'auth路由工作正常' });
});

// 生成JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

// 刷新 Token 接口
router.post('/refresh-token', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: '未提供令牌' });
    }

    // 验证旧 token，允许过期（ignoreExpiration: true），但签名必须正确
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ success: false, message: '无效令牌' });
    }

    // 检查用户状态
    const user = await User.findById(decoded.userId);
    if (!user || user.is_deleted) {
      return res.status(401).json({ success: false, message: '用户不存在或已被禁用' });
    }

    // 生成新 token
    const newToken = generateToken(user._id);

    res.json({
      success: true,
      token: newToken
    });
  } catch (error) {
    console.error('❌ Token刷新错误:', error);
    res.status(401).json({ success: false, message: '刷新失败' });
  }
});

// 生成指定用户的JWT token（仅管理员可用，用于测试）
const generateUserToken = (userId, username) => {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
};

// 解密手机号（仅返回手机号，不做登录操作）
router.post('/decrypt-phone', async (req, res) => {
  try {
    const { code, encryptedData, iv } = req.body;

    console.log('📱 解密手机号请求');

    if (!code || !encryptedData || !iv) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    // 调用微信API获取session_key
    const https = require('https');
    const appId = process.env.WX_APP_ID || process.env.WECHAT_APP_ID || 'your_app_id';
    const appSecret = process.env.WX_APP_SECRET || process.env.WECHAT_APP_SECRET || 'your_app_secret';
    const wechatApiUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;

    const wechatData = await new Promise((resolve, reject) => {
      const request = https.get(wechatApiUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('解析微信API响应失败'));
          }
        });
      }).on('error', reject);

      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('微信API请求超时'));
      });
    });

    if (wechatData.errcode) {
      throw new Error(`微信API错误: ${wechatData.errmsg}`);
    }

    const sessionKey = wechatData.session_key;

    // 解密手机号
    const crypto = require('crypto');

    // 验证格式
    const sessionKeyBuffer = Buffer.from(sessionKey, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');
    const encryptedBuffer = Buffer.from(encryptedData, 'base64');

    // AES-128-CBC 解密
    const decipher = crypto.createDecipheriv('aes-128-cbc', sessionKeyBuffer, ivBuffer);
    decipher.setAutoPadding(true);

    let decrypted = decipher.update(encryptedBuffer, null, 'utf8');
    decrypted += decipher.final('utf8');

    const phoneData = JSON.parse(decrypted);
    const phoneNumber = phoneData.phoneNumber;

    console.log('✅ 解密手机号成功:', phoneNumber);

    res.json({
      success: true,
      phoneNumber: phoneNumber
    });

  } catch (error) {
    console.error('解密手机号错误:', error);
    res.status(500).json({ success: false, message: '解密手机号失败' });
  }
});

// 微信小程序登录/注册
router.post('/wechat-login', loginLimiter, async (req, res) => {
  try {
    const { code, encryptedData, iv, phoneNumber: requestPhoneNumber } = req.body;

    console.log('📡 微信登录请求参数:', {
      hasCode: !!code,
      hasEncryptedData: !!encryptedData,
      hasIv: !!iv,
      requestPhoneNumber,
      allParams: Object.keys(req.body)
    });

    if (!code) {
      return res.status(400).json({ success: false, message: '缺少code参数' });
    }

    // 临时模拟微信登录（生产环境需要调用真实微信API）
    const openid = `wx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session_key = `session_${Date.now()}`;

    let phoneNumber = null;

    // 如果提供了加密的手机号数据，尝试解密
    if (encryptedData && iv) {
      try {
        // 开发环境：优先使用直接传递的手机号参数
        if (req.body.phoneNumber) {
          phoneNumber = req.body.phoneNumber;
          console.log('📱 使用请求参数手机号:', phoneNumber);
        } else {
          // 生产环境：需要先通过code获取session_key，然后解密
          console.log('📱 开始解密手机号数据...');

          // 1. 通过code获取session_key（这里需要调用微信API）
          // 注意：小程序端已经通过wx.login获取了code，这里需要服务端调用微信API
          const https = require('https');
          const appId = process.env.WX_APP_ID || process.env.WECHAT_APP_ID || 'your_app_id';
          const appSecret = process.env.WX_APP_SECRET || process.env.WECHAT_APP_SECRET || 'your_app_secret';
          const wechatApiUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;

          console.log('📱 调用微信API获取session_key...');
          console.log('📱 环境变量状态:', {
            WX_APP_ID: process.env.WX_APP_ID ? '已配置' : '未配置',
            WECHAT_APP_ID: process.env.WECHAT_APP_ID ? '已配置' : '未配置',
            WX_APP_SECRET: process.env.WX_APP_SECRET ? '已配置' : '未配置',
            WECHAT_APP_SECRET: process.env.WECHAT_APP_SECRET ? '已配置' : '未配置',
            using_appId: appId,
            using_appSecret: appSecret ? '已配置' : '未配置',
            actual_appId_value: appId,
            actual_appSecret_length: appSecret ? appSecret.length : 0
          });

          console.log('📱 微信API完整URL:', wechatApiUrl);

          const wechatData = await new Promise((resolve, reject) => {
            const request = https.get(wechatApiUrl, (res) => {
              let data = '';
              res.on('data', (chunk) => data += chunk);
              res.on('end', () => {
                console.log('📱 微信API原始响应:', data);
                try {
                  resolve(JSON.parse(data));
                } catch (e) {
                  reject(new Error('解析微信API响应失败'));
                }
              });
            }).on('error', reject);

            // 设置30秒超时
            request.setTimeout(30000, () => {
              request.destroy();
              reject(new Error('微信API请求超时'));
            });
          });

          if (wechatData.errcode) {
            throw new Error(`微信API错误: ${wechatData.errmsg}`);
          }

          const sessionKey = wechatData.session_key;
          console.log('📱 获取到session_key: [REDACTED]'); // 【安全修复】脱敏敏感信息

          // 验证session_key格式
          if (!sessionKey || typeof sessionKey !== 'string') {
            throw new Error('无效的session_key格式');
          }

          // 解码session_key并验证长度（应为24字符base64，解码后16字节）
          let sessionKeyBuffer;
          try {
            sessionKeyBuffer = Buffer.from(sessionKey, 'base64');
            if (sessionKeyBuffer.length !== 16) {
              throw new Error(`session_key长度无效: 期望16字节，实际${sessionKeyBuffer.length}字节`);
            }
          } catch (bufferError) {
            throw new Error(`session_key base64解码失败: ${bufferError.message}`);
          }

          // 验证iv格式
          if (!iv || typeof iv !== 'string') {
            throw new Error('无效的iv格式');
          }

          let ivBuffer;
          try {
            ivBuffer = Buffer.from(iv, 'base64');
            if (ivBuffer.length !== 16) {
              throw new Error(`iv长度无效: 期望16字节，实际${ivBuffer.length}字节`);
            }
          } catch (ivError) {
            throw new Error(`iv base64解码失败: ${ivError.message}`);
          }

          // 2. 使用session_key解密手机号数据
          console.log('🔐 开始AES解密过程...');
          console.log('🔐 session_key长度:', sessionKey.length, '字符');
          console.log('🔐 iv (base64):', iv.substring(0, 10) + '...');
          console.log('🔐 encryptedData长度:', encryptedData.length);

          const crypto = require('crypto');
          const decipher = crypto.createDecipheriv('aes-128-cbc', sessionKeyBuffer, ivBuffer);
          decipher.setAutoPadding(true);

          console.log('🔐 创建decipher对象成功');

          // 记录解密步骤
          let encryptedBuffer;
          try {
            encryptedBuffer = Buffer.from(encryptedData, 'base64');
            console.log('🔐 encryptedData base64解码成功，长度:', encryptedBuffer.length);
          } catch (bufferError) {
            throw new Error(`encryptedData base64解码失败: ${bufferError.message}`);
          }

          let decrypted;
          try {
            decrypted = decipher.update(encryptedBuffer);
            console.log('🔐 decipher.update成功，中间结果长度:', decrypted.length);
          } catch (updateError) {
            throw new Error(`decipher.update失败: ${updateError.message}`);
          }

          let finalPart;
          try {
            finalPart = decipher.final();
            console.log('🔐 decipher.final成功，最终部分长度:', finalPart.length);
          } catch (finalError) {
            throw new Error(`decipher.final失败: ${finalError.message}`);
          }

          decrypted = Buffer.concat([decrypted, finalPart]);
          console.log('🔐 完整解密结果长度:', decrypted.length);

          let decryptedString;
          try {
            decryptedString = decrypted.toString('utf8');
            console.log('🔐 UTF8解码成功，字符串长度:', decryptedString.length);
            console.log('🔐 解密字符串预览:', decryptedString.substring(0, 100) + (decryptedString.length > 100 ? '...' : ''));
          } catch (stringError) {
            throw new Error(`UTF8解码失败: ${stringError.message}`);
          }

          let phoneData;
          try {
            phoneData = JSON.parse(decryptedString);
            console.log('🔐 JSON解析成功:', JSON.stringify(phoneData, null, 2));
          } catch (jsonError) {
            console.error('🔐 JSON解析失败，原始字符串:', decryptedString);
            throw new Error(`JSON解析失败: ${jsonError.message}`);
          }

          if (!phoneData.phoneNumber) {
            throw new Error('解密结果中没有phoneNumber字段');
          }

          phoneNumber = phoneData.phoneNumber;
          console.log('📱 成功解密手机号:', phoneNumber);
        }
      } catch (decryptError) {
        console.error('📱 手机号解密失败:', decryptError.message);
        console.error('📱 解密错误详情:', decryptError);

        // 【修复】手机号解密失败时，返回错误而不是继续登录
        // 这样前端可以区分"解密失败"和"用户确实没有手机号"
        return res.status(400).json({
          success: false,
          message: '手机号解密失败，请重新授权',
          errorCode: 'PHONE_DECRYPT_FAILED'
        });
      }
    }

    let user;

    // 【修复】必须要有手机号才能登录，防止解密失败导致的循环
    if (!phoneNumber) {
      console.warn('❌ 手机号解密失败或未获取，拒绝登录');
      return res.status(400).json({
        success: false,
        message: '无法获取手机号，请重新授权',
        errorCode: 'PHONE_NOT_OBTAINED'
      });
    }

    // 如果有手机号，优先通过手机号查找用户（实现手机号绑定）
    if (phoneNumber) {
      user = await User.findOne({
        phone: phoneNumber,
        role: 'part_time',
        is_deleted: { $ne: true }
      });

      if (user) {
        // 找到手机号对应的用户，更新openid（如果不同）
        if (user.openid !== openid) {
          user.openid = openid;
          await user.save();
          console.log('🔗 手机号绑定成功:', user.username, phoneNumber);
        } else {
          console.log('📱 手机号用户已存在:', user.username, phoneNumber);
        }
      } else {
        // 手机号不存在，拒绝登录
        console.log('❌ 手机号未注册，拒绝登录:', phoneNumber);
        return res.status(403).json({
          success: false,
          message: '该手机号尚未注册，请先通过账号密码注册或联系管理员'
        });
      }
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user.username, // 使用username作为id，与小程序兼容
        username: user.username,
        role: user.role,
        nickname: user.nickname, // 【修复】添加 nickname 字段，与其他接口保持一致
        phone: user.phone,
        points: user.points || 0,
        totalWithdrawn: user.wallet?.total_withdrawn || 0
      }
    });

  } catch (error) {
    console.error('微信登录错误:', error);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

// 管理员登录
// router.post('/login', (req, res) => {
//   console.log('🎯 收到登录请求:', req.body);
//   try {
//     const { username, password } = req.body;

//     // 临时模拟用户验证
//     const mockUsers = {
//       'test': { id: '507f1f77bcf86cd799439011', username: 'test', role: 'cs' },
//       'cs': { id: '507f1f77bcf86cd799439012', username: 'cs', role: 'cs' },
//       'boss': { id: '507f1f77bcf86cd799439013', username: 'boss', role: 'boss' },
//       'finance': { id: '507f1f77bcf86cd799439014', username: 'finance', role: 'finance' },
//       'sales': { id: '507f1f77bcf86cd799439015', username: 'sales', role: 'sales' },
//       'manager': { id: '507f1f77bcf86cd799439016', username: 'manager', role: 'manager' }
//     };

//     console.log('🔍 尝试登录用户:', username);
//     console.log('📋 可用用户:', Object.keys(mockUsers));

//     const user = mockUsers[username];
//     if (!user) {
//       return res.status(401).json({ success: false, message: '用户不存在' });
//     }

//     const token = generateToken(user.id);

//     res.json({
//       success: true,
//       token,
//       user: {
//         id: user.id,
//         username: user.username,
//         role: user.role
//       }
//     });

//   } catch (error) {
//     console.error('登录错误:', error);
//     res.status(500).json({ success: false, message: '登录失败' });
//   }
// });

// 临时简单登录路由 - 已禁用，避免与正式登录路由冲突
// router.post('/login', (req, res) => {
//   console.log('🎯 收到登录请求:', req.body);
//   res.json({
//     success: true,
//     token: 'test_token',
//     user: {
//       id: 'test_id',
//       username: req.body.username || 'test',
//       role: 'cs'
//     }
//   });
// });

// 管理员登录路由 (带登录次数限制)
router.post('/admin-login', async (req, res) => {
  try {
    console.log('🎯 收到管理员登录请求:', req.body);
    const { username, password } = req.body;

    if (!username || !password) {
      console.log('❌ 参数不完整');
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    // 清理用户名（去掉前后空格）
    const cleanUsername = username.trim();
    console.log('🧹 清理后的用户名:', cleanUsername);

    // ==================== 检查登录锁定状态 ====================
    const lockoutCheck = checkLoginLockout(cleanUsername);
    if (lockoutCheck.locked) {
      console.log(`🔒 账户 ${cleanUsername} 已锁定，剩余时间: ${lockoutCheck.remainingMinutes}分钟`);
      return res.status(429).json({
        success: false,
        message: lockoutCheck.message,
        locked: true,
        remainingMinutes: lockoutCheck.remainingMinutes
      });
    }

    // 从数据库查找用户
    console.log('🔍 开始数据库查询...');
    const user = await User.findOne({
      username: cleanUsername,
      is_deleted: { $ne: true }
    });
    console.log('📋 查询结果:', user ? { username: user.username, role: user.role, hasPassword: !!user.password } : '用户不存在');

    // 【安全修复】用户不存在时也记录失败，防止用户名枚举攻击
    // 注意：错误消息与密码错误时保持一致
    if (!user) {
      console.log('❌ 登录失败: 用户名或密码错误');
      // 记录登录失败（即使是不存在的用户，也要记录以防止枚举）
      const failureResult = recordLoginFailure(cleanUsername);
      console.log(`📝 登录失败记录: 剩余尝试次数 ${failureResult.remainingAttempts}`);
      return res.status(401).json({
        success: false,
        message: failureResult.message,
        remainingAttempts: failureResult.remainingAttempts
      });
    }

    // 检查用户角色是否为管理员角色
    const adminRoles = ['mentor', 'boss', 'finance', 'manager', 'hr', 'promoter'];
    console.log('🔍 检查角色:', user.role, '是否在', adminRoles);
    if (!adminRoles.includes(user.role)) {
      console.log('❌ 角色权限不足');
      return res.status(403).json({ success: false, message: '无管理员权限' });
    }

    // 验证密码
    console.log('🔐 开始密码验证...');
    let isPasswordValid = false;
    if (user.password) {
      // 如果用户有密码，验证密码
      console.log('🔐 用户有密码，开始bcrypt验证');
      isPasswordValid = await user.comparePassword(password);
      console.log(`🔐 bcrypt验证结果: ${isPasswordValid}`);
    } else {
      // 【安全修复】移除空密码登录逻辑，未设置密码的账户禁止登录
      console.log('❌ 用户未设置密码，拒绝登录');
      return res.status(403).json({
        success: false,
        message: '账户未设置密码，请联系管理员重置密码'
      });
    }

    if (!isPasswordValid) {
      console.log('❌ 密码验证失败');
      // 记录登录失败
      const failureResult = recordLoginFailure(cleanUsername);
      console.log(`📝 登录失败记录: 剩余尝试次数 ${failureResult.remainingAttempts}, 是否锁定: ${failureResult.shouldLock}`);

      return res.status(401).json({
        success: false,
        message: failureResult.message,
        remainingAttempts: failureResult.remainingAttempts,
        locked: failureResult.shouldLock,
        lockedUntil: failureResult.lockedUntil
      });
    }

    // ==================== 登录成功，清除失败记录 ====================
    clearLoginAttempts(cleanUsername);
    console.log(`✅ 登录成功，已清除 ${cleanUsername} 的失败记录`);

    // 生成token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    console.log('📤 发送登录成功响应');
    res.json({
      success: true,
      token,
      user: {
        id: user.username, // 【修复】统一使用 username 作为 id，与其他接口保持一致
        username: user.username,
        role: user.role,
        nickname: user.nickname,
        phone: user.phone, // 【修复】添加 phone 字段，与前端检查逻辑兼容
        points: user.points || 0,
        totalWithdrawn: user.wallet?.total_withdrawn || 0
      }
    });

  } catch (error) {
    console.error('❌ 管理员登录错误:', error);
    console.error('❌ 错误堆栈:', error.stack);
    res.status(500).json({ success: false, message: '登录失败，请稍后重试' });
  }
});

// 注册（仅管理员使用）
router.post('/register', authenticateToken, async (req, res) => {
  console.log('🎯 注册接口被调用 - 开始执行');
  try {
    const { username, password, role, nickname, phone, wechat, notes } = req.body;
    console.log('📝 收到注册请求:', { username, role, currentUser: req.user.username, currentUserRole: req.user.role });

    // 实施严格的RBAC权限控制
    const requestingUserRole = req.user.role;

    // 定义允许创建的角色映射
    const allowedRoles = {
      'boss': ['part_time', 'mentor', 'hr', 'manager', 'finance', 'promoter'], // 老板可以创建所有角色
      'manager': ['part_time', 'mentor', 'hr', 'promoter'], // 经理管理 兼职、带教、HR、引流人员
      'hr': ['part_time', 'lead'], // HR 负责招募 兼职 和 线索
      'mentor': ['part_time'], // 带教老师可以创建兼职用户
      'finance': [], // 财务禁止创建任何用户
      'promoter': [], // 引流人员禁止创建任何用户
      'part_time': [] // 兼职用户禁止创建任何用户
    };

    // 检查当前用户是否有权限创建用户
    if (!allowedRoles[requestingUserRole] || allowedRoles[requestingUserRole].length === 0) {
      console.log('❌ 权限不足:', requestingUserRole, '无权创建用户');
      return res.status(403).json({ success: false, message: '没有注册权限' });
    }

    // 检查要创建的角色是否在允许列表中
    if (!allowedRoles[requestingUserRole].includes(role)) {
      console.log('❌ 权限不足:', requestingUserRole, '不能创建', role, '角色');
      return res.status(403).json({ success: false, message: `无权创建 ${role} 角色用户` });
    }

    // 检查用户名是否已存在
    const existingUser = await User.findOne({
      username,
      is_deleted: { $ne: true }
    });

    if (existingUser) {
      return res.status(400).json({ success: false, message: '用户名已存在' });
    }

    // 创建新用户
    const newUser = new User({
      username,
      password: password || 'admin123', // 默认密码
      role: role || 'part_time',
      nickname: nickname || username,
      phone,
      wechat,
      notes,
      // 如果是创建兼职用户，自动设置培训状态为"已筛选"
      training_status: role === 'part_time' ? '已筛选' : null,
      // 如果当前用户是HR，自动设置hr_id
      hr_id: req.user.role === 'hr' ? req.user._id : null,
      // 如果提供了mentor_id，设置分配时间为注册时间之前
      mentor_id: req.body.mentor_id || null,
      assigned_to_mentor_at: req.body.mentor_id ? (() => {
        const registrationTime = new Date();
        const daysBefore = Math.floor(Math.random() * 7) + 1; // 1-7天
        return new Date(registrationTime.getTime() - daysBefore * 24 * 60 * 60 * 1000);
      })() : null,
      // 支付宝二维码存储在 wallet 对象中
      wallet: {
        alipay_account: req.body.integral_w || null,
        real_name: req.body.integral_z || null,
        alipay_qr_code: req.body.alipay_qr_code || null,
        total_withdrawn: 0
      }
    });

    await newUser.save();

    res.json({
      success: true,
      message: '注册成功',
      user: {
        id: newUser._id,
        username: newUser.username,
        role: newUser.role,
        nickname: newUser.nickname
      }
    });

  } catch (error) {
    console.error('注册错误:', error);
    // 返回详细错误信息用于调试
    const errorMessage = error.message || '注册失败';
    if (error.code === 11000) {
      // 唯一索引冲突
      res.status(400).json({ success: false, message: '用户名或邀请码已存在' });
    } else {
      res.status(500).json({ success: false, message: errorMessage });
    }
  }
});

// 生成指定用户的测试token（仅管理员可用）
router.post('/generate-user-token', authenticateToken, async (req, res) => {
  try {
    console.log('🎯 生成用户token请求:', req.body);
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少userId参数' });
    }

    // 权限检查：只允许管理员使用
    const adminRoles = ['boss', 'manager'];
    if (!adminRoles.includes(req.user.role)) {
      console.log('❌ 权限不足:', req.user.role, '尝试生成用户token');
      return res.status(403).json({ success: false, message: '只有管理员可以生成用户token' });
    }

    // 查找用户
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 生成用户token
    const token = generateUserToken(targetUser._id, targetUser.username);

    console.log('✅ 成功生成用户token:', targetUser.username);

    res.json({
      success: true,
      token,
      user: {
        id: targetUser._id,
        username: targetUser.username,
        role: targetUser.role,
        nickname: targetUser.nickname
      }
    });

  } catch (error) {
    console.error('生成用户token错误:', error);
    res.status(500).json({ success: false, message: '生成token失败' });
  }
});

// 手机号快速验证登录
router.post('/phone-login', phoneLoginLimiter, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: '缺少手机号' });
    }

    // 去除首尾空格
    const cleanPhone = phoneNumber.trim();

    console.log('📱 手机号登录请求:', cleanPhone);

    // 优先查找已有的兼职用户（通过手机号匹配）
    let user = await User.findOne({
      phone: cleanPhone,
      role: 'part_time', // 只匹配兼职用户
      is_deleted: { $ne: true }
    });

    if (user) {
      // 找到匹配的兼职用户，直接使用
      console.log('🔗 匹配到已有兼职用户:', user.username, phoneNumber);
    } else {
      // 没有找到匹配的兼职用户，拒绝自动创建（修复：防止用户名重复问题）
      console.log('❌ 手机号未注册，拒绝登录:', phoneNumber);
      return res.status(404).json({
        success: false,
        message: '该手机号未注册，请联系管理员获取注册链接',
        needRegister: true
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user.username, // 使用username作为id，与小程序兼容
        username: user.username,
        role: user.role,
        phone: user.phone,
        nickname: user.nickname,
        points: user.points,
        totalWithdrawn: user.wallet?.total_withdrawn || 0
      }
    });

  } catch (error) {
    console.error('手机号登录错误:', error);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

// 用户注册（第三方APK使用）
router.post('/user-register', async (req, res) => {
  try {
    const { phoneNumber, username, password, nickname, invitationCode } = req.body;

    // 去除首尾空格
    const cleanPhone = phoneNumber ? phoneNumber.trim() : '';
    const cleanUsername = username ? username.trim() : '';

    console.log('📝 用户注册请求:', { phoneNumber: cleanPhone, username: cleanUsername, nickname });

    // 参数验证
    if (!cleanPhone || !cleanUsername || !password) {
      return res.status(400).json({ success: false, message: '手机号、用户名和密码不能为空' });
    }

    // 检查手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({ success: false, message: '手机号格式不正确' });
    }

    // 检查用户名格式（字母数字下划线，4-20字符）
    const usernameRegex = /^[a-zA-Z0-9_]{4,20}$/;
    if (!usernameRegex.test(cleanUsername)) {
      return res.status(400).json({ success: false, message: '用户名格式不正确（4-20位字母数字下划线）' });
    }

    // 检查密码强度（至少6位）
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: '密码至少需要6位字符' });
    }

    // 检查手机号是否已被使用（包括已删除用户，防止重复创建）
    const existingPhoneUser = await User.findOne({ phone: cleanPhone });

    let user;

    if (existingPhoneUser) {
      // 手机号已存在，检查用户状态
      if (existingPhoneUser.is_deleted) {
        // 用户已删除，不允许用同一手机号重新注册
        return res.status(400).json({
          success: false,
          message: '该手机号已被使用（账号已删除），请联系管理员恢复'
        });
      }

      // 手机号存在，更新用户信息（无论是否已有账号）
      console.log('📱 手机号已存在，更新账号信息:', existingPhoneUser.username || '未设置');

      // 判断是否已有完整账号信息
      const hasAccount = existingPhoneUser.username && existingPhoneUser.password;

      // 检查用户名是否被其他用户占用（排除自己）
      const usernameTaken = await User.findOne({
        username: cleanUsername,
        _id: { $ne: existingPhoneUser._id }  // 排除当前用户自己
      });
      if (usernameTaken) {
        return res.status(400).json({ success: false, message: '用户名已被使用' });
      }

      if (hasAccount) {
        // 已有账号：更新兼职用户管理里的用户
        console.log('👤 已有账号，更新用户信息');

        existingPhoneUser.username = cleanUsername;  // 更新用户名
        existingPhoneUser.password = password;  // 更新密码
        if (nickname && nickname.trim()) {
          existingPhoneUser.nickname = nickname.trim();  // 更新昵称
        }

        // 处理邀请码（只在没有parent_id时设置）
        if (invitationCode && invitationCode.trim() && !existingPhoneUser.parent_id) {
          const parentUser = await User.findOne({
            username: invitationCode.trim(),
            is_deleted: { $ne: true }
          });
          if (parentUser) {
            existingPhoneUser.parent_id = parentUser._id;
            console.log('👨‍👩‍👧‍👦 通过邀请码设置上级用户:', parentUser.username);
          }
        }

      } else {
        // 无账号：分配带教老师里的线索用户，设置完整账号
        console.log('📋 线索用户，设置账号信息并保留系统设置');

        // 更新用户信息，保留HR设置的系统信息（微信、小红书、mentor_id等）
        existingPhoneUser.username = cleanUsername;
        existingPhoneUser.password = password;
        if (nickname && nickname.trim()) {
          existingPhoneUser.nickname = nickname.trim();
        } else {
          existingPhoneUser.nickname = existingPhoneUser.nickname || cleanUsername;
        }

        // 确保有角色
        if (!existingPhoneUser.role) {
          existingPhoneUser.role = 'part_time';
        }

        // 处理邀请码（只在没有parent_id时设置）
        if (invitationCode && invitationCode.trim() && !existingPhoneUser.parent_id) {
          const parentUser = await User.findOne({
            username: invitationCode.trim(),
            is_deleted: { $ne: true }
          });
          if (parentUser) {
            existingPhoneUser.parent_id = parentUser._id;
            console.log('👨‍👩‍👧‍👦 通过邀请码设置上级用户:', parentUser.username);
          }
        }

        console.log('🔄 线索用户账号设置完成，保留系统配置');
      }

      await existingPhoneUser.save();
      user = existingPhoneUser;
      console.log('👤 更新用户成功:', cleanUsername, cleanPhone);
    } else {
      // 手机号不存在，拒绝创建，提示联系HR
      console.log('❌ 手机号未在系统中存在，拒绝注册:', cleanPhone);
      return res.status(404).json({
        success: false,
        message: '该手机号尚未在系统中注册，请联系HR创建用户后再进行注册'
      });
    }

    // 自动登录，返回token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: '注册成功',
      token,
      user: {
        id: user.username,
        username: user.username,
        role: user.role,
        phone: user.phone,
        nickname: user.nickname,
        points: user.points || 0,
        totalWithdrawn: user.wallet?.total_withdrawn || 0
      }
    });

  } catch (error) {
    console.error('用户注册错误:', error);
    res.status(500).json({ success: false, message: '注册失败，请稍后重试' });
  }
});

// 检查手机号是否已注册
router.get('/check-phone', async (req, res) => {
  try {
    const { phoneNumber } = req.query;

    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: '手机号不能为空' });
    }

    // 去除首尾空格
    const cleanPhone = phoneNumber.trim();

    // 检查手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({ success: false, message: '手机号格式不正确' });
    }

    // 查找手机号是否已被注册
    const existingUser = await User.findOne({
      phone: cleanPhone,
      is_deleted: { $ne: true }
    });

    res.json({
      success: true,
      isRegistered: !!existingUser,
      message: existingUser ? '该手机号已被注册' : '该手机号可以注册'
    });

  } catch (error) {
    console.error('检查手机号错误:', error);
    res.status(500).json({ success: false, message: '检查失败，请稍后重试' });
  }
});

// 账号密码登录
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    // 去除首尾空格
    const cleanPhone = phoneNumber ? phoneNumber.trim() : '';

    console.log('🔐 账号密码登录请求:', cleanPhone);

    // 参数验证
    if (!cleanPhone || !password) {
      return res.status(400).json({ success: false, message: '手机号和密码不能为空' });
    }

    // 查找用户
    const user = await User.findOne({
      phone: cleanPhone,
      is_deleted: { $ne: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: '手机号或密码错误' });
    }

    // 验证密码
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: '手机号或密码错误' });
    }

    console.log('✅ 密码验证通过:', user.username);

    // 生成token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user.username,
        username: user.username,
        role: user.role,
        phone: user.phone,
        nickname: user.nickname,
        points: user.points,
        totalWithdrawn: user.wallet?.total_withdrawn || 0
      }
    });

  } catch (error) {
    console.error('账号密码登录错误:', error);
    res.status(500).json({ success: false, message: '登录失败，请稍后重试' });
  }
});

// 用户登出
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // 登出逻辑可以在这里添加一些清理工作
    // 比如记录登出日志、清理临时数据等

    console.log(`用户 ${req.user.username} 登出`);

    res.json({
      success: true,
      message: '登出成功'
    });

  } catch (error) {
    console.error('登出错误:', error);
    res.status(500).json({ success: false, message: '登出失败' });
  }
});

// 重新激活Cookie（管理员权限）
router.post('/reactivate-cookie', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const asyncAiReviewService = require('../services/asyncAiReviewService');

    console.log(`用户 ${req.user.username} (${req.user.role}) 请求重新激活Cookie`);

    // 重新激活Cookie
    asyncAiReviewService.reactivateCookie();

    // 获取当前Cookie状态
    const cookieStatus = asyncAiReviewService.getCookieStatus();

    res.json({
      success: true,
      message: 'Cookie已重新激活，AI审核服务已恢复',
      data: cookieStatus
    });

  } catch (error) {
    console.error('重新激活Cookie错误:', error);
    res.status(500).json({ success: false, message: '重新激活Cookie失败' });
  }
});

// 获取Cookie状态
router.get('/cookie-status', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const asyncAiReviewService = require('../services/asyncAiReviewService');

    const cookieStatus = asyncAiReviewService.getCookieStatus();

    res.json({
      success: true,
      data: cookieStatus
    });

  } catch (error) {
    console.error('获取Cookie状态错误:', error);
    res.status(500).json({ success: false, message: '获取Cookie状态失败' });
  }
});

module.exports = router;