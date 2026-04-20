#!/usr/bin/env python3
"""完整修复 chat-anime.html 模型系统"""

with open("/var/www/html/chat-anime.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. 添加 Cubism SDK 依赖（在 pixi-live2d-display 之后）
old_scripts = '''    <script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/index.min.js"></script>'''

new_scripts = '''    <script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/index.min.js"></script>
    <!-- Cubism 2.1 SDK (for .moc models) -->
    <script src="https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js"></script>
    <!-- Cubism 4 SDK (for .moc3 models) -->
    <script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"></script>'''

html = html.replace(old_scripts, new_scripts)
print("1. 添加 Cubism SDK")

# 2. 移除 L2Dwidget 脚本
l2d_script = '    <script src="https://unpkg.com/live2d-widget/lib/L2Dwidget.min.js"></script>\n'
html = html.replace(l2d_script, "")
print("2. 移除 L2Dwidget 脚本")

# 3. 替换 L2Dwidget 初始化为简单的 PIXI 初始化
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
                if (defaultModel) loadLive2DModel(defaultModel);
            }, 1000);'''

html = html.replace(old_init, new_init)
print("3. 替换 L2Dwidget 初始化")

# 4. 在 Vue app 之前添加 Live2D 加载函数
vue_marker = "        createApp({"
live2d_loader = '''        // ========== Live2D 模型加载器 ==========
        let live2dApp = null;
        let live2dModel = null;

        async function loadLive2DModel(model) {
            console.log("🔄 加载模型:", model.name);

            // 初始化 PIXI
            if (!live2dApp) {
                const container = document.createElement("div");
                container.id = "live2d-container";
                container.style.cssText = "position:fixed;left:20px;bottom:20px;width:200px;height:400px;z-index:9999;pointer-events:auto;cursor:move;";
                document.body.appendChild(container);

                live2dApp = new PIXI.Application({
                    width: 200,
                    height: 400,
                    backgroundAlpha: 0,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true
                });
                container.appendChild(live2dApp.view);

                // 拖动功能
                let isDragging = false;
                let startX, startY, initX, initY;
                container.addEventListener("mousedown", (e) => {
                    isDragging = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    initX = container.offsetLeft;
                    initY = container.offsetTop;
                    e.preventDefault();
                });
                document.addEventListener("mousemove", (e) => {
                    if (!isDragging) return;
                    container.style.left = (initX + e.clientX - startX) + "px";
                    container.style.top = (initY + e.clientY - startY) + "px";
                    container.style.right = "auto";
                    container.style.bottom = "auto";
                });
                document.addEventListener("mouseup", () => { isDragging = false; });
            }

            // 销毁旧模型
            if (live2dModel) {
                live2dApp.stage.removeChild(live2dModel);
                live2dModel.destroy();
                live2dModel = null;
            }

            try {
                live2dModel = await PIXI.live2d.Live2DModel.from(model.url);
                const scale = Math.min(200 / live2dModel.width, 400 / live2dModel.height) * 0.8;
                live2dModel.scale.set(scale);
                live2dModel.x = 100;
                live2dModel.y = 400;
                live2dModel.anchor.set(0.5, 1);
                live2dApp.stage.addChild(live2dModel);
                console.log("✅ 模型加载成功:", model.name);
            } catch (e) {
                console.error("❌ 模型加载失败:", e);
            }
        }

        '''

html = html.replace(vue_marker, live2d_loader + vue_marker)
print("4. 添加 Live2D 加载函数")

# 5. 简化 selectModel
old_select = '''                const selectModel = async (model) => {
                    currentModelId.value = model.id;

                    try {
                        if (model.isNewFormat) {
                            // 加载新格式模型
                            await ModelLoader.loadMoc3Model(model);
                        } else {
                            // 加载旧格式模型
                            await ModelLoader.loadMocModel(model);
                        }

                        // 保存选择到 localStorage
                        localStorage.setItem('chat-anime-model', model.id);
                        localStorage.setItem('chat-anime-model-url', model.url || '');
                        localStorage.setItem('chat-anime-model-format', model.isNewFormat ? 'moc3' : 'moc');

                        console.log('✅ 模型切换成功:', model.name);
                    } catch (error) {
                        console.error('❌ 模型加载失败:', error);
                        alert(`模型加载失败: ${error.message}\\n\\n请检查控制台获取详细信息。`);
                    }
                };'''

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
                };'''

html = html.replace(old_select, new_select)
print("5. 简化 selectModel")

# 6. 简化 onMounted 中的模型恢复
old_mount = '''                    // 从 localStorage 恢复模型选择
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

new_mount = '''                    // 从 localStorage 恢复模型
                    const savedModelId = localStorage.getItem('chat-anime-model');
                    const savedModelUrl = localStorage.getItem('chat-anime-model-url');
                    if (savedModelId && savedModelUrl) {
                        currentModelId.value = savedModelId;
                        setTimeout(() => loadLive2DModel({ id: savedModelId, url: savedModelUrl, name: savedModelId }), 500);
                    } else {
                        setTimeout(() => loadLive2DModel(availableModels.value[0]), 500);
                    }'''

html = html.replace(old_mount, new_mount)
print("6. 简化 onMounted")

# 写回文件
with open("/var/www/html/chat-anime.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ 修复完成!")
