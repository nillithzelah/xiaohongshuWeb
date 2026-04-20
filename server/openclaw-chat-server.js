/**
 * OpenClaw 聊天桥接服务
 * 独立的 Express 服务，桥接前端和 OpenClaw Gateway
 */

const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = 5002; // 避免与主服务冲突

// CORS 配置
app.use(cors());
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'openclaw-chat-bridge' });
});

// 连接状态检查
app.get('/status', async (req, res) => {
    try {
        const connected = await checkOpenClawCLI();
        res.json({ connected: connected });
    } catch (error) {
        res.json({ connected: false, error: error.message });
    }
});

// 聊天 API
app.post('/chat', async (req, res) => {
    try {
        const { message, model = 'anthropic/glm-4.7' } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: '消息内容不能为空'
            });
        }

        console.log('📨 [聊天桥接] 收到消息:', message.substring(0, 50));

        // 通过 OpenClaw CLI 发送消息
        const response = await sendToOpenClaw(message, model);

        console.log('✅ [聊天桥接] 响应成功, 长度:', response.length);

        res.json({
            success: true,
            content: response
        });
    } catch (error) {
        console.error('❌ [聊天桥接] 失败:', error.message);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 检查 OpenClaw CLI 是否可用
function checkOpenClawCLI() {
    return new Promise((resolve) => {
        const child = spawn('openclaw', ['--version'], {
            stdio: 'pipe'
        });

        child.on('error', () => resolve(false));
        child.on('exit', (code) => resolve(code === 0));

        setTimeout(() => {
            child.kill();
            resolve(false);
        }, 2000);
    });
}

// 通过 OpenClaw Gateway 发送消息
function sendToOpenClaw(message, model) {
    return new Promise((resolve, reject) => {
        console.log('🚀 [OpenClaw Gateway] 发送消息到 AI');

        // 使用正确的 openclaw agent 命令
        // --agent main 使用默认 agent
        // --local 表示在本地运行（不需要外部通道）
        // --json 输出 JSON 格式
        const args = [
            'agent',
            '--agent', 'main',
            '--local',
            '--message', message,
            '--json'
        ];

        console.log('📋 [OpenClaw CLI] 命令: openclaw', args.join(' '));

        const child = spawn('openclaw', args, {
            stdio: 'pipe',
            env: {
                ...process.env,
                ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/anthropic',
                ANTHROPIC_AUTH_TOKEN: 'c34797b6ab48453b90f0b6934a0c0ee6.1ZEKrjpDBHUNY44O'
            }
        });

        let responseText = '';
        let errorText = '';

        child.stdout.on('data', (data) => {
            const text = data.toString();
            console.log('📤 [OpenClaw stdout]:', text.substring(0, 200));

            try {
                const jsonData = JSON.parse(text);

                // openclaw agent --json 返回格式：
                // { payloads: [{ text: "回复内容" }], meta: {...} }
                if (jsonData.payloads && jsonData.payloads.length > 0) {
                    // 提取所有 payload 的文本
                    const texts = jsonData.payloads
                        .filter(p => p.text)
                        .map(p => p.text);
                    if (texts.length > 0) {
                        responseText = texts.join('\n');
                    }
                } else if (jsonData.content) {
                    responseText = jsonData.content;
                } else if (jsonData.message && jsonData.message.content) {
                    responseText = jsonData.message.content;
                } else if (jsonData.text) {
                    responseText = jsonData.text;
                } else if (jsonData.response) {
                    responseText = jsonData.response;
                } else {
                    // 尝试提取任何看起来像回复的内容
                    responseText = JSON.stringify(jsonData);
                }
                console.log('✅ [OpenClaw] 提取到内容，长度:', responseText.length);
            } catch (e) {
                // 如果不是 JSON，直接使用文本
                responseText += text;
            }
        });

        child.stderr.on('data', (data) => {
            const text = data.toString();
            console.log('⚠️ [OpenClaw stderr]:', text.substring(0, 100));
            errorText += text;
        });

        child.on('close', (code) => {
            if (code === 0 || responseText.length > 0) {
                console.log('✅ [OpenClaw] 消息已发送, 响应长度:', responseText.length);
                resolve(responseText.trim() || '消息已发送');
            } else {
                console.error('❌ [OpenClaw] 进程异常退出, 代码:', code);
                reject(new Error(errorText || `OpenClaw 退出码: ${code}`));
            }
        });

        child.on('error', (error) => {
            console.error('❌ [OpenClaw] 进程错误:', error);
            reject(new Error(`无法启动 OpenClaw CLI: ${error.message}`));
        });

        // 120秒超时
        setTimeout(() => {
            child.kill();
            if (responseText.length > 0) {
                resolve(responseText.trim());
            } else {
                reject(new Error('OpenClaw 响应超时 (120秒)'));
            }
        }, 120000);
    });
}

// 启动服务
app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 OpenClaw 聊天桥接服务启动成功`);
    console.log(`📍 监听端口: ${PORT}`);
    console.log(`🔗 使用方式: OpenClaw CLI (agent --local)`);

    // 检查 OpenClaw CLI 是否可用
    checkOpenClawCLI().then(available => {
        if (available) {
            console.log(`✅ OpenClaw CLI 可用`);
        } else {
            console.log(`⚠️ OpenClaw CLI 不可用，请确保已安装并配置`);
        }
    });
});

module.exports = app;
