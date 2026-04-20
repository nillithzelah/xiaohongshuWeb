#!/usr/bin/env python3
"""
按照 live2d-test 项目的模式重写 chat-anime.html 的模型加载系统
"""

with open("/var/www/html/chat-anime.html", "r", encoding="utf-8") as f:
    html = f.read()

print("开始修复...")

# ========== 1. 替换脚本依赖 ==========
old_scripts = '''    <script src="https://unpkg.com/live2d-widget/lib/L2Dwidget.min.js"></script>
    <!-- PIXI.js 和 pixi-live2d-display (用于新格式 .moc3 模型) -->
    <script src="https://unpkg.com/pixi.js@7.3.2/dist/pixi.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/index.min.js"></script>'''

new_scripts = '''    <!-- PIXI.js -->
    <script src="https://unpkg.com/pixi.js@7.x/dist/pixi.min.js"></script>
    <!-- Cubism 2.1 SDK -->
    <script src="https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js"></script>
    <!-- Cubism 4 SDK -->
    <script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"></script>
    <!-- pixi-live2d-display -->
    <script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/index.min.js"></script>'''

html = html.replace(old_scripts, new_scripts)
print("1. 替换脚本依赖")

# ========== 2. 在 Vue app 之前添加全局变量和模型加载函数 ==========
vue_marker = "        createApp({"

live2d_code = '''        // ========== Live2D 模型管理 ==========
        let live2dApp = null;
        let live2dModel = null;

        async function initLive2D() {
            if (live2dApp) return;

            const container = document.createElement('div');
            container.id = 'live2d-container';
            container.style.cssText = 'position:fixed;left:20px;bottom:20px;width:200px;height:400px;z-index:9999;pointer-events:auto;';
            document.body.appendChild(container);

            const canvas = document.createElement('canvas');
            canvas.id = 'live2d-canvas';
            canvas.width = 200;
            canvas.height = 400;
            container.appendChild(canvas);

            live2dApp = new PIXI.Application({
                view: canvas,
                width: 200,
                height: 400,
                backgroundAlpha: 0,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });

            console.log('✅ Live2D 初始化完成');
        }

        async function loadLive2DModel(model) {
            console.log('🔄 加载模型:', model.name);

            await initLive2D();

            // 移除并销毁旧模型
            if (live2dModel) {
                live2dApp.stage.removeChild(live2dModel);
                live2dModel.destroy();
                live2dModel = null;
            }

            try {
                live2dModel = await PIXI.live2d.Live2DModel.from(model.url);

                // 自适应缩放
                const scale = Math.min(200 / live2dModel.width, 400 / live2dModel.height) * 0.8;
                live2dModel.scale.set(Math.max(0.02, Math.min(1.0, scale)));
                live2dModel.x = 100;
                live2dModel.y = 400;
                live2dModel.anchor.set(0.5, 1.0);

                live2dApp.stage.addChild(live2dModel);
                console.log('✅ 模型加载成功:', model.name);
            } catch (e) {
                console.error('❌ 模型加载失败:', e);
                throw e;
            }
        }

        '''

html = html.replace(vue_marker, live2d_code + vue_marker)
print("2. 添加 Live2D 加载函数")

# ========== 3. 替换 L2Dwidget 初始化为加载默认模型 ==========
old_init = '''            // 延迟初始化 Live2D
            setTimeout(() => {
                if (typeof L2Dwidget !== 'undefined') {
                    console.log('L2Dwidget 可用，开始初始化...');
                    L2Dwidget.init({
                        model: {
                            jsonPath: modelUrl,
                            scale: 1
                        },
                        display: {
                            position: 'left',
                            width: 200,
                            height: 400,
                            hOffset: 0,
                            vOffset: -20
                        },
                        mobile: {
                            show: true,
                            scale: 0.5
                        },
                        dialog: {
                            enable: true,
                            script: {
                                'hover': '嗨～今天想聊点什么？💕',
                                'touch': '有什么可以帮你的吗？'
                            }
                        }
                    });
                } else {
                    console.log('L2Dwidget 未加载');
                }
            }, 1000);'''

new_init = '''            // 加载默认模型
            setTimeout(() => {
                const defaultModel = availableModels.value[0];
                if (defaultModel) {
                    loadLive2DModel(defaultModel);
                }
            }, 1000);'''

html = html.replace(old_init, new_init)
print("3. 替换初始化代码")

# ========== 4. 简化 selectModel ==========
old_select_start = "                const selectModel = async (model) => {"
old_select_end = "                };\n\n                // 初始化"

# 找到 selectModel 的位置
select_start_idx = html.find(old_select_start)
if select_start_idx > 0:
    select_end_idx = html.find(old_select_end, select_start_idx)
    if select_end_idx > 0:
        new_select = '''                const selectModel = async (model) => {
                    currentModelId.value = model.id;
                    try {
                        await loadLive2DModel(model);
                        localStorage.setItem('chat-anime-model', model.id);
                        localStorage.setItem('chat-anime-model-url', model.url || '');
                        console.log('✅ 模型切换成功:', model.name);
                    } catch (error) {
                        console.error('❌ 模型加载失败:', error);
                    }
                };

                // 初始化'''
        html = html[:select_start_idx] + new_select + html[select_end_idx + len(old_select_end):]
        print("4. 简化 selectModel")

# ========== 5. 简化 onMounted 中的模型恢复 ==========
old_restore = '''                    // 从 localStorage 恢复模型选择
                    const savedModelId = localStorage.getItem('chat-anime-model');
                    const savedModelFormat = localStorage.getItem('chat-anime-model-format');

                    if (savedModelId) {
                        currentModelId.value = savedModelId;

                        // 查找保存的模型
                        const savedModel = availableModels.value.find(m => m.id === savedModelId);

                        if (savedModel) {
                            // 延迟加载模型，确保 DOM 和库都已加载
                            setTimeout(async () => {
                                try {
                                    console.log('🔄 恢复上次选择的模型:', savedModel.name);

                                    if (savedModelFormat === 'moc3' || savedModel.isNewFormat) {
                                        await ModelLoader.loadMoc3Model(savedModel);
                                    } else {
                                        await ModelLoader.loadMocModel(savedModel);
                                    }
                                } catch (error) {
                                    console.error('❌ 恢复模型失败:', error);
                                    // 如果恢复失败，加载默认模型
                                    const defaultModel = availableModels.value[0];
                                    await ModelLoader.loadMocModel(defaultModel);
                                }
                            }, 500);
                        }
                    } else {
                        // 没有保存的模型，加载默认模型
                        setTimeout(async () => {
                            const defaultModel = availableModels.value[0];
                            await ModelLoader.loadMocModel(defaultModel);
                        }, 500);
                    }'''

new_restore = '''                    // 从 localStorage 恢复模型
                    const savedModelId = localStorage.getItem('chat-anime-model');
                    const savedModelUrl = localStorage.getItem('chat-anime-model-url');
                    if (savedModelId && savedModelUrl) {
                        currentModelId.value = savedModelId;
                        setTimeout(() => {
                            loadLive2DModel({ id: savedModelId, url: savedModelUrl, name: savedModelId });
                        }, 500);
                    }'''

html = html.replace(old_restore, new_restore)
print("5. 简化模型恢复逻辑")

# 写回文件
with open("/var/www/html/chat-anime.html", "w", encoding="utf-8") as f:
    f.write(html)

print("\n✅ 修复完成!")
