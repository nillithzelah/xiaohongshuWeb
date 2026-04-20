#!/usr/bin/env python3
"""
修复 chat-anime.html 的模型加载系统
统一使用 PIXI.js + pixi-live2d-display
"""

import re

# 读取服务器文件
with open("/var/www/html/chat-anime.html", "r", encoding="utf-8") as f:
    html = f.read()

print("原始文件大小:", len(html))

# 1. 移除 L2Dwidget 脚本引用
l2d_script = '    <script src="https://unpkg.com/live2d-widget/lib/L2Dwidget.min.js"></script>\n'
html = html.replace(l2d_script, "")
print("1. 移除 L2Dwidget 脚本引用")

# 2. 新的 ModelLoader 代码
new_model_loader = '''                // ========== 统一模型加载器 (PIXI.js) ==========
                const ModelLoader = {
                    container: null,
                    app: null,
                    model: null,

                    async init() {
                        if (this.container) return;

                        this.container = document.createElement("div");
                        this.container.id = "pixi-live2d-container";
                        this.container.style.cssText = "position:fixed;left:20px;bottom:20px;width:200px;height:400px;z-index:9999;pointer-events:auto;cursor:move;";
                        document.body.appendChild(this.container);

                        this.app = new PIXI.Application({
                            width: 200,
                            height: 400,
                            backgroundAlpha: 0,
                            resolution: window.devicePixelRatio || 1,
                            autoDensity: true
                        });
                        this.container.appendChild(this.app.view);
                        this.enableDrag();
                        console.log("✅ PIXI 初始化完成");
                    },

                    async loadModel(model) {
                        console.log("🔄 加载模型:", model.name || model.id);
                        await this.init();

                        if (this.model) {
                            this.app.stage.removeChild(this.model);
                            this.model.destroy();
                            this.model = null;
                        }

                        try {
                            this.model = await PIXI.live2d.Live2DModel.from(model.url);
                            const scale = Math.min(200 / this.model.width, 400 / this.model.height) * 0.8;
                            this.model.scale.set(scale);
                            this.model.x = 100;
                            this.model.y = 400;
                            this.model.anchor.set(0.5, 1);
                            this.app.stage.addChild(this.model);
                            console.log("✅ 模型加载成功:", model.name);
                        } catch (e) {
                            console.error("❌ 模型加载失败:", e);
                            throw e;
                        }
                    },

                    enableDrag() {
                        let isDragging = false;
                        let startX, startY, initialX, initialY;
                        const c = this.container;

                        c.addEventListener("mousedown", (e) => {
                            isDragging = true;
                            startX = e.clientX;
                            startY = e.clientY;
                            initialX = c.offsetLeft;
                            initialY = c.offsetTop;
                            e.preventDefault();
                        });

                        document.addEventListener("mousemove", (e) => {
                            if (!isDragging) return;
                            c.style.left = (initialX + e.clientX - startX) + "px";
                            c.style.top = (initialY + e.clientY - startY) + "px";
                            c.style.right = "auto";
                            c.style.bottom = "auto";
                        });

                        document.addEventListener("mouseup", () => { isDragging = false; });
                    }
                };

'''

# 3. 替换整个旧的 ModelLoader 块
# 找到旧 ModelLoader 的开始和结束
old_loader_start = html.find("                const ModelLoader = {")
old_loader_end = html.find("                };\n\n                // 选择模型", old_loader_start)

if old_loader_start > 0 and old_loader_end > old_loader_start:
    html = html[:old_loader_start] + new_model_loader + html[old_loader_end + len("                };\n\n                // 选择模型"):]
    print(f"2. 替换 ModelLoader (位置: {old_loader_start} - {old_loader_end})")
else:
    print("2. ModelLoader 未找到")

# 4. 替换 L2Dwidget 初始化代码
l2d_init_start = html.find("            // 延迟初始化 Live2D")
l2d_init_end = html.find("            });\n\n        createApp({", l2d_init_start)

if l2d_init_start > 0 and l2d_init_end > l2d_init_start:
    new_init = '''            // 加载默认模型
            const defaultModel = availableModels.value[0];
            if (defaultModel) {
                ModelLoader.loadModel(defaultModel);
            }

        '''
    html = html[:l2d_init_start] + new_init + html[l2d_init_end + len("            });\n\n        "):]
    print(f"3. 替换 L2Dwidget 初始化 (位置: {l2d_init_start} - {l2d_init_end})")
else:
    print("3. L2Dwidget 初始化未找到")

# 5. 简化 selectModel 函数
select_model_pattern = r'const selectModel = async \(model\) => \{[^}]*?currentModelId\.value[^}]*?try \{[^}]*?if \(model\.isNewFormat\)[^}]*?\} catch \(error\)[^}]*?\};'
match = re.search(select_model_pattern, html, re.DOTALL)
if match:
    new_select = '''const selectModel = async (model) => {
                    currentModelId.value = model.id;
                    try {
                        await ModelLoader.loadModel(model);
                        localStorage.setItem("chat-anime-model", model.id);
                        localStorage.setItem("chat-anime-model-url", model.url || "");
                        console.log("✅ 模型切换成功:", model.name);
                    } catch (error) {
                        console.error("❌ 模型加载失败:", error);
                        alert("模型加载失败: " + error.message);
                    }
                };'''
    html = html[:match.start()] + new_select + html[match.end():]
    print("4. 简化 selectModel")
else:
    print("4. selectModel 未找到")

# 6. 简化 onMounted 中的模型恢复逻辑
on_mounted_pattern = r'// 从 localStorage 恢复模型选择[\s\S]*?await ModelLoader\.loadModel\([^)]+\);[\s\S]*?\}\s*\};'
match = re.search(on_mounted_pattern, html)
if match:
    new_on_mounted = '''// 从 localStorage 恢复模型选择
                    const savedModelId = localStorage.getItem("chat-anime-model");
                    const savedModelUrl = localStorage.getItem("chat-anime-model-url");

                    if (savedModelId && savedModelUrl) {
                        currentModelId.value = savedModelId;
                        await ModelLoader.loadModel({ id: savedModelId, url: savedModelUrl, name: savedModelId });
                    } else {
                        const defaultModel = availableModels.value[0];
                        if (defaultModel) {
                            currentModelId.value = defaultModel.id;
                            await ModelLoader.loadModel(defaultModel);
                        }
                    }
                };'''
    html = html[:match.start()] + new_on_mounted + html[match.end():]
    print("5. 简化 onMounted 模型恢复")
else:
    print("5. onMounted 模型恢复未找到")

# 写回文件
with open("/var/www/html/chat-anime.html", "w", encoding="utf-8") as f:
    f.write(html)

print("最终文件大小:", len(html))
print("✅ 修复完成!")
