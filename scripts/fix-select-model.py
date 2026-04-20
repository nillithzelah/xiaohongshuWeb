#!/usr/bin/env python3
"""修复 selectModel 和 onMounted 中的模型加载调用"""

import re

with open("/var/www/html/chat-anime.html", "r", encoding="utf-8") as f:
    html = f.read()

# 1. 替换 selectModel 函数
old_select = '''                // 选择模型 - 支持两种格式
                const selectModel = async (model) => {
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

new_select = '''                // 选择模型
                const selectModel = async (model) => {
                    currentModelId.value = model.id;
                    try {
                        await ModelLoader.loadModel(model);
                        localStorage.setItem('chat-anime-model', model.id);
                        localStorage.setItem('chat-anime-model-url', model.url || '');
                        console.log('✅ 模型切换成功:', model.name);
                    } catch (error) {
                        console.error('❌ 模型加载失败:', error);
                        alert('模型加载失败: ' + error.message);
                    }
                };'''

if old_select in html:
    html = html.replace(old_select, new_select)
    print("1. 替换 selectModel")
else:
    print("1. selectModel 未找到")

# 2. 替换 onMounted 中的模型恢复逻辑
old_on_mounted = '''                    // 从 localStorage 恢复模型选择
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

new_on_mounted = '''                    // 从 localStorage 恢复模型选择
                    const savedModelId = localStorage.getItem('chat-anime-model');
                    const savedModelUrl = localStorage.getItem('chat-anime-model-url');

                    if (savedModelId && savedModelUrl) {
                        currentModelId.value = savedModelId;
                        setTimeout(async () => {
                            try {
                                await ModelLoader.loadModel({ id: savedModelId, url: savedModelUrl, name: savedModelId });
                            } catch (e) {
                                console.error('恢复模型失败:', e);
                                const defaultModel = availableModels.value[0];
                                if (defaultModel) await ModelLoader.loadModel(defaultModel);
                            }
                        }, 500);
                    } else {
                        setTimeout(async () => {
                            const defaultModel = availableModels.value[0];
                            if (defaultModel) await ModelLoader.loadModel(defaultModel);
                        }, 500);
                    }'''

if old_on_mounted in html:
    html = html.replace(old_on_mounted, new_on_mounted)
    print("2. 替换 onMounted 模型恢复")
else:
    print("2. onMounted 未找到")

with open("/var/www/html/chat-anime.html", "w", encoding="utf-8") as f:
    f.write(html)

print("✅ 完成!")
