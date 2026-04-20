/**
 * 红薯糖水 - 小红书采集助手
 * 纯悬浮窗模式，无 UI 模式冲突
 */

// ========== 全局配置 ==========
var CONFIG = {
    server: {
        baseUrl: "https://www.wubug.cc/xiaohongshu/api",
        timeout: 30000
    },
    client: {
        type: "android-autox"
    }
};

// ========== 全局变量 ==========
var isRunning = false;
var collectedCount = 0;
var uploadedCount = 0;
var logs = [];
var floatyWindow = null;
var keepRunning = true;
var shortLinksBuffer = [];  // 短链接缓存

// 采集任务状态
var collectTask = {
    isRunning: false,
    thread: null
};

// ========== 获取悬浮窗位置 ==========
function getFloatyPosition() {
    try {
        // 按钮放在屏幕右侧边缘（按钮宽度62 = 54+8padding）
        var x = device.width - 162;
        var y = 200;
        return { x: x, y: y };
    } catch (e) {
        return { x: 600, y: 200 };
    }
}


// ========== API 通信模块 ==========
function ApiClient(config) {
    this.config = config || {
        baseUrl: "https://www.wubug.cc/xiaohongshu/api",
        timeout: 30000
    };

    this.getClientId = function() {
        var storage = storages.create("xhs_client");
        var id = storage.get("client_id");
        if (!id) {
            var serial = "unknown";
            try {
                if (device && device.serial) serial = device.serial;
            } catch (e) {}
            id = "autox_" + serial + "_" + Date.now();
            storage.put("client_id", id);
        }
        return id;
    };

    this.httpGet = function(path, params) {
        var url = this.config.baseUrl + path;
        if (params) {
            var query = [];
            for (var key in params) {
                query.push(encodeURIComponent(key) + "=" + encodeURIComponent(params[key]));
            }
            url += "?" + query.join("&");
        }
        console.log("GET URL: " + url);
        try {
            var response = http.get(url, {
                headers: {
                    "Content-Type": "application/json",
                    "X-Client-Type": this.config.clientType || "android-autox",
                    "X-Client-Id": this.getClientId()
                },
                timeout: this.config.timeout
            });
            console.log("Status: " + response.statusCode);
            if (response.statusCode === 200) {
                var bodyStr = response.body.string();
                console.log("Body: " + bodyStr.substring(0, 100));
                return JSON.parse(bodyStr);
            } else {
                throw new Error("HTTP " + response.statusCode);
            }
        } catch (e) {
            console.log("Request error: " + e.message);
            throw new Error("请求失败: " + e.message);
        }
    };

    this.httpPost = function(path, data) {
        var url = this.config.baseUrl + path;
        try {
            var response = http.post(url, {
                headers: {
                    "Content-Type": "application/json",
                    "X-Client-Type": this.config.clientType || "android-autox",
                    "X-Client-Id": this.getClientId()
                },
                body: JSON.stringify(data),
                timeout: this.config.timeout
            });
            if (response.statusCode === 200) {
                var bodyStr = response.body.string();
                return JSON.parse(bodyStr);
            } else {
                throw new Error("HTTP " + response.statusCode);
            }
        } catch (e) {
            throw new Error("请求失败: " + e.message);
        }
    };

    this.addShortLink = function(shortUrl, source, remark) {
        return this.httpPost("/short-link-pool/add", {
            shortUrl: shortUrl,
            source: source || "android-autox",
            remark: remark || ""
        });
    };

    // 获取搜索关键词列表
    this.getKeywords = function() {
        return this.httpGet("/client/discovery/keywords");
    };

    // 分配关键词（多设备协同）
    this.allocateKeyword = function(clientId) {
        return this.httpGet("/client/discovery/keywords/allocate", {
            clientId: clientId || this.getClientId()
        });
    };

    // 释放关键词
    this.releaseKeyword = function(keyword, clientId) {
        return this.httpPost("/client/discovery/keywords/release", {
            keyword: keyword,
            clientId: clientId || this.getClientId()
        });
    };
}

// ========== 小红书自动化操作模块 ==========
function XiaohongshuAutomation() {
    this.packageName = "com.xingin.xhs";

    // 检查APP是否运行
    this.isAppRunning = function() {
        return currentPackage() === this.packageName;
    };

    // 启动APP
    this.launchApp = function() {
        app.launchPackage(this.packageName);
        sleep(3000);
        return this.isAppRunning();
    };

    // 点击搜索按钮
    this.clickSearchButton = function() {
        addLog("🔍 [步骤1] 查找搜索按钮...");
        // 尝试多种搜索按钮的选择器
        var searchSelectors = [
            id("search"),
            text("搜索"),
            descContains("搜索"),
            classNameContains("Search")
        ];

        for (var i = 0; i < searchSelectors.length; i++) {
            try {
                var btn = searchSelectors[i].findOne(2000);
                if (btn) {
                    this.clickCenter(btn);
                    addLog("✅ [步骤1] 搜索按钮已点击");
                    sleep(1000);
                    return true;
                }
            } catch (e) {}
        }
        addLog("⚠️ [步骤1] 搜索按钮未找到");
        return false;
    };

    // 搜索关键词
    this.search = function(keyword) {
        addLog("🔎 [步骤2] 查找搜索框...");
        var searchBox = id("search_input").findOne(3000);
        if (!searchBox) {
            searchBox = className("EditText").findOne(1000);
        }

        if (!searchBox) {
            addLog("⚠️ [步骤2] 搜索框未找到");
            return false;
        }

        addLog("✅ [步骤2] 搜索框已找到");

        searchBox.click();
        sleep(500);

        addLog("⌨️ [步骤2] 输入: " + keyword);
        searchBox.setText(keyword);
        sleep(1000);

        addLog("⏎ [步骤2] 发送回车");
        // AutoX 使用 events.injectKey 代替 keyCode
        try {
            events.injectKey(KeyEvent.KEYCODE_ENTER);
        } catch (e) {
            // 如果失败，尝试点击搜索
            addLog("⚠️ [步骤2] injectKey失败，尝试点击搜索按钮");
            var searchBtn = text("搜索").findOne(500);
            if (searchBtn) {
                this.clickCenter(searchBtn);
            }
        }
        sleep(2000);

        addLog("✅ [步骤2] 搜索完成");
        return true;
    };

    // 点击随机笔记
    this.clickRandomNote = function() {
        addLog("📝 [步骤3] 尝试点击笔记...");

        // 方法1: 尝试找到列表并点击子项
        var noteSelectors = [
            className("androidx.recyclerview.widget.RecyclerView"),
            id("recyclerView"),
            className("ListView")
        ];

        var listFound = false;
        for (var i = 0; i < noteSelectors.length; i++) {
            try {
                var list = noteSelectors[i].findOne(1000);
                if (list) {
                    addLog("✅ [步骤3] 找到列表 (方法" + (i+1) + ")");
                    listFound = true;
                    var children = list.children();
                    if (children && children.length > 0) {
                        addLog("📊 [步骤3] 子项数量: " + children.length);
                        var randomIndex = Math.floor(Math.random() * Math.min(children.length, 10));
                        var note = children.get(randomIndex);
                        if (note) {
                            this.clickCenter(note);
                            addLog("✅ [步骤3] 已点击笔记项 " + randomIndex);
                            sleep(2000);
                            return true;
                        }
                    }
                }
            } catch (e) {
                addLog("⚠️ [步骤3] 方法" + (i+1) + "异常: " + e.message);
            }
        }

        // 方法2: 直接点击屏幕中央
        addLog("📍 [步骤3] 尝试点击屏幕中央...");
        try {
            var centerX = device.width / 2;
            var centerY = device.height / 2;
            var offsetX = Math.floor(Math.random() * 40) - 20;
            var offsetY = Math.floor(Math.random() * 40) - 20;
            click(centerX + offsetX, centerY + offsetY);
            addLog("✅ [步骤3] 已点击坐标 (" + (centerX + offsetX) + "," + (centerY + offsetY) + ")");
            sleep(2000);
            return true;
        } catch (e) {
            addLog("❌ [步骤3] 点击失败: " + e.message);
            return false;
        }
    };

    // 获取短链接
    this.getShortLink = function() {
        addLog("🔗 [步骤4] 点击右上角分享按钮...");

        // 方法1: 尝试通过选择器找分享按钮
        var shareBtn = descContains("分享").findOne(1000);
        if (!shareBtn) {
            shareBtn = text("分享").findOne(500);
        }
        if (!shareBtn) {
            shareBtn = id("share").findOne(500);
        }

        // 方法2: 直接点击分享按钮（用户实测坐标：1200x2664 屏幕）
        if (!shareBtn) {
            addLog("📍 [步骤4] 点击分享按钮...");
            try {
                // 分享按钮坐标（基于 1200x2664 屏幕，id=moreOperateIV）
                var shareX = 1101;
                var shareY = 220;
                click(shareX, shareY);
                sleep(500);
                addLog("✅ [步骤4] 已点击分享按钮 (" + shareX + "," + shareY + ")");
            } catch (e) {
                addLog("❌ [步骤4] 点击失败: " + e.message);
            }
        } else {
            this.clickCenter(shareBtn);
            addLog("✅ [步骤4] 分享按钮已点击");
        }

        sleep(1500);

        addLog("📋 [步骤4] 查找复制链接按钮...");
        var copyBtn = null;

        // 尝试多种方式查找复制按钮
        var copySelectors = [
            text("复制链接"),
            textContains("复制"),
            descContains("复制"),
            text("链接"),
            text("复制"),
            id("copy")
        ];

        for (var i = 0; i < copySelectors.length; i++) {
            try {
                copyBtn = copySelectors[i].findOne(1000);
                if (copyBtn) {
                    addLog("✅ [步骤4] 找到复制按钮 (方式" + (i+1) + ")");
                    break;
                }
            } catch (e) {}
        }

        // 如果没找到，使用用户实测的坐标点击复制按钮
        if (!copyBtn) {
            addLog("📍 [步骤4] 尝试坐标点击复制按钮...");
            try {
                // 复制链接按钮坐标（基于 1200x2664 屏幕，id=0_resource_name_obfuscated）
                var copyX = 337;
                var copyY = 2421;
                click(copyX, copyY);
                sleep(500);
                addLog("✅ [步骤4] 已点击复制按钮 (" + copyX + "," + copyY + ")");
            } catch (e) {
                addLog("❌ [步骤4] 坐标点击失败: " + e.message);
                back();
                sleep(500);
                return null;
            }
        } else {
            this.clickCenter(copyBtn);
            addLog("✅ [步骤4] 复制按钮已点击");
        }

        sleep(1000);

        var clip = getClip();
        back();
        sleep(500);

        if (clip && clip.indexOf("xhslink.com") >= 0) {
            addLog("✅ [步骤4] 获取短链接成功: " + clip.substring(0, 30) + "...");
            return clip;
        }

        addLog("⚠️ [步骤4] 剪贴板内容: " + (clip ? clip.substring(0, 50) : "空"));
        return null;
    };

    // 返回搜索结果页
    this.backToSearch = function() {
        back();
        sleep(1500);
    };

    // 关闭弹窗
    this.closePopup = function() {
        var closeSelectors = [
            id("close"),
            text("关闭"),
            text("知道了"),
            text("跳过"),
            desc("关闭")
        ];

        for (var i = 0; i < closeSelectors.length; i++) {
            try {
                var btn = closeSelectors[i].findOnce(500);
                if (btn) {
                    this.clickCenter(btn);
                    sleep(500);
                    return true;
                }
            } catch (e) {}
        }
        return false;
    };

    // 点击控件中心位置（带随机偏移）
    this.clickCenter = function(uiObject) {
        if (!uiObject) return false;
        try {
            var bounds = uiObject.bounds();
            var randomX = Math.floor(Math.random() * 10) - 5;
            var randomY = Math.floor(Math.random() * 10) - 5;
            var x = bounds.centerX() + randomX;
            var y = bounds.centerY() + randomY;
            click(x, y);
            return true;
        } catch (e) {
            return false;
        }
    };

    // 滚动页面
    this.scrollPage = function(direction) {
        direction = direction || "down";
        var x = device.width / 2;
        var y = device.height / 2;

        addLog("📜 [滚动] 向" + (direction === "down" ? "下" : "上") + "滚动...");
        if (direction === "down") {
            swipe(x, y * 1.5, x, y * 0.5, 500);
        } else {
            swipe(x, y * 0.5, x, y * 1.5, 500);
        }
        sleep(1000);
    };
}

// ========== 日志函数 ==========
function addLog(message) {
    var timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    var logMessage = "[" + timestamp + "] " + message;
    logs.push(logMessage);
    if (logs.length > 100) {
        logs.shift();
    }
    console.log(logMessage);
    // 使用 toast 显示重要信息
    if (message.indexOf("✅") === 0 || message.indexOf("❌") === 0) {
        toast(message);
    }
}

function updateStatus(status, color) {
    console.log("[状态] " + status);
}

function updateStats() {
    console.log("[统计] 已采集:" + collectedCount + " 已上传:" + uploadedCount + " 缓存:" + shortLinksBuffer.length);
}

// ========== 悬浮窗布局 ==========
function createFloatyWindow() {
    return floaty.window(
        <vertical id="floaty_root" margin="0" bg="#80000000" padding="4">
            <button id="btn_collect" text="采集" w="54" h="50" bg="#4CAF50" textStyle="bold" textSize="12sp"/>
            <button id="btn_convert" text="转换" w="54" h="50" bg="#2196F3" textStyle="bold" textSize="12sp" margin-top="2"/>
            <button id="btn_close" text="关闭" w="54" h="50" bg="#F44336" textStyle="bold" textSize="12sp" margin-top="2"/>
        </vertical>
    );
}

// ========== 模块实例 ==========
var apiClient = new ApiClient({
    baseUrl: CONFIG.server.baseUrl,
    timeout: CONFIG.server.timeout,
    clientType: CONFIG.client.type
});

var xhsAuto = new XiaohongshuAutomation();

// ========== 任务控制 ==========
function startTask(taskType) {
    if (isRunning) {
        addLog("⚠️ 有任务正在运行");
        return;
    }
    isRunning = true;
    addLog("🚀 开始: " + (taskType === 'collect' ? '采集' : '转换'));
    updateStatus("● 运行中", "#4CAF50");

    threads.start(function() {
        try {
            if (taskType === 'collect') {
                runCollectTask();
            } else if (taskType === 'convert') {
                runConvertTask();
            }
        } catch (e) {
            addLog("❌ 异常: " + e.message);
            isRunning = false;
            updateStatus("● 异常", "#F44336");
        }
    });
}

// ========== 采集任务（循环采集）==========
function runCollectTaskOnce() {
    addLog("━━━━━━━━━━━━━━━━━━━━━━");
    addLog("🔄 开始新的采集循环");

    // 1. 从服务器分配关键词
    addLog("🔍 [步骤0] 请求分配关键词...");
    var keywordResult;
    try {
        var clientId = apiClient.getClientId();
        keywordResult = apiClient.allocateKeyword();
    } catch (e) {
        addLog("❌ [步骤0] 网络错误: " + e.message);
        return false;
    }

    if (!keywordResult || !keywordResult.success) {
        addLog("⚠️ [步骤0] " + (keywordResult ? keywordResult.message : "服务器无响应"));
        return false;
    }

    var keyword = keywordResult.data.keyword;
    addLog("✅ [步骤0] 关键词: " + keyword);

    // 使用 try-finally 确保关键词在任何情况下都会被释放
    var notesCollected = 0;
    var success = false;

    try {
        // 2. 启动小红书APP
        if (!xhsAuto.isAppRunning()) {
            addLog("📱 [启动] 启动小红书...");
            if (!xhsAuto.launchApp()) {
                addLog("❌ [启动] APP启动失败");
                return false;
            }
            xhsAuto.closePopup();
        }

        // 3. 进入搜索
        if (!xhsAuto.clickSearchButton()) {
            addLog("⚠️ 搜索按钮未找到，可能已在搜索页");
        }

        xhsAuto.search(keyword);
        sleep(3000);

        // 4. 循环采集当前搜索结果的笔记
        var maxNotesPerKeyword = 50;  // 每个关键词最多采集50条
        var scrollCount = 0;
        var maxScroll = 10;  // 最多滚动10次

        while (notesCollected < maxNotesPerKeyword && collectTask.isRunning) {
            addLog("📝 [笔记] 尝试第 " + (notesCollected + 1) + " 条...");

            // 点击笔记
            if (!xhsAuto.clickRandomNote()) {
                addLog("⚠️ [笔记] 点击失败，尝试滚动...");
                // 滚动加载更多
                xhsAuto.scrollPage("down");
                sleep(2000);
                scrollCount++;
                if (scrollCount >= maxScroll) {
                    addLog("⏭️ [笔记] 已滚动 " + maxScroll + " 次，换个关键词");
                    break;
                }
                continue;
            }

            // 获取短链接
            var shortUrl = xhsAuto.getShortLink();
            if (!shortUrl) {
                addLog("⚠️ [链接] 获取失败，返回继续");
                xhsAuto.backToSearch();
                sleep(2000);
                continue;
            }

            // 上传
            addLog("📤 [上传] " + shortUrl.substring(0, 30) + "...");
            try {
                var uploadResult = apiClient.addShortLink(shortUrl, "android-autox", "关键词:" + keyword);
                addLog("📡 [上传] 服务器回复: " + JSON.stringify(uploadResult));
                if (uploadResult && uploadResult.success) {
                    addLog("✅ [上传] 成功");
                    collectedCount++;
                    uploadedCount++;
                } else {
                    addLog("⚠️ [上传] 失败: " + (uploadResult ? uploadResult.message : "无响应"));
                }
            } catch (e) {
                addLog("❌ [上传] 异常: " + e.message);
            }

            notesCollected++;

            // 返回搜索页继续下一个
            xhsAuto.backToSearch();
            sleep(2000);
        }

        success = true;
    } finally {
        // 5. 释放关键词（无论成功失败都执行）
        try {
            apiClient.releaseKeyword(keyword);
            addLog("🔓 [释放] 关键词已释放");
        } catch (e) {
            addLog("⚠️ [释放] 释放失败: " + e.message);
        }
    }

    addLog("✅ [完成] 本轮采集 " + notesCollected + " 条");
    return success;
}

// ========== 转换任务 ==========
function runConvertTask() {
    addLog("🔄 开始转换...");
    var clip = getClip();

    if (!clip) {
        addLog("⚠️ 剪贴板为空");
        isRunning = false;
        updateStatus("● 就绪", "#4CAF50");
        return;
    }

    addLog("📋 内容: " + clip.substring(0, 30) + "...");

    if (clip.indexOf("xiaohongshu.com") >= 0) {
        addLog("✅ 检测到小红书链接");
        addLog("⚠️ 转换功能待实现");
    } else {
        addLog("⚠️ 未识别到小红书链接");
    }

    isRunning = false;
    updateStatus("● 就绪", "#4CAF50");
}

// ========== 上传短链接 ==========
function uploadShortLinks() {
    if (shortLinksBuffer.length === 0) return;

    addLog("📤 上传 " + shortLinksBuffer.length + " 条...");

    var successCount = 0;
    for (var i = 0; i < shortLinksBuffer.length; i++) {
        try {
            var result = apiClient.addShortLink(shortLinksBuffer[i].url);
            if (result && result.success) {
                successCount++;
            } else {
                addLog("⚠️ 失败: " + (result.message || "未知"));
            }
        } catch (e) {
            addLog("❌ 异常: " + e.message);
        }
    }

    uploadedCount += successCount;
    shortLinksBuffer = [];
    addLog("✅ 上传: " + successCount + " 条成功");
    updateStats();
}

// ========== 悬浮窗事件 ==========
function setupFloatyEvents() {
    // 采集按钮 - 支持运行/停止切换
    floatyWindow.btn_collect.click(function() {
        if (collectTask.isRunning) {
            // 停止采集
            collectTask.isRunning = false;
            addLog("⏸️ 采集已停止");
            updateStatus("● 已停止", "#FF9800");
            floatyWindow.btn_collect.setText("采集");
            floatyWindow.btn_collect.setBackgroundColor(colors.parseColor("#4CAF50"));
        } else {
            // 启动采集
            collectTask.isRunning = true;
            addLog("🚀 开始采集");
            updateStatus("● 运行中", "#4CAF50");
            floatyWindow.btn_collect.setText("停止");
            floatyWindow.btn_collect.setBackgroundColor(colors.parseColor("#F44336"));

            collectTask.thread = threads.start(function() {
                while (collectTask.isRunning) {
                    try {
                        runCollectTaskOnce();
                        // 间隔3秒继续下一次
                        sleep(3000);
                    } catch (e) {
                        addLog("❌ 采集异常: " + e.message);
                    }
                }
                // 循环结束后重置按钮
                if (collectTask.isRunning === false) {
                    addLog("⏹️ 采集任务结束");
                    updateStatus("● 就绪", "#4CAF50");
                    floatyWindow.btn_collect.setText("采集");
                    floatyWindow.btn_collect.setBackgroundColor(colors.parseColor("#4CAF50"));
                }
            });
        }
    });

    floatyWindow.btn_convert.click(function() {
        addLog("🔄 转换功能开发中");
        toast("转换功能开发中");
    });

    floatyWindow.btn_close.click(function() {
        addLog("👋 再见");
        toast("已关闭");

        // 停止采集任务
        if (collectTask.isRunning) {
            collectTask.isRunning = false;
            addLog("⏹️ 采集任务已停止");
        }

        // 关闭悬浮窗
        floatyWindow.close();

        // 设置退出标志
        keepRunning = false;

        // 退出脚本
        sleep(500);
        exit();
    });
}

// ========== 初始化 ==========
function init() {
    // 确保无障碍服务
    auto.waitFor();

    // 创建悬浮窗
    floatyWindow = createFloatyWindow();
    var pos = getFloatyPosition();
    floatyWindow.setPosition(pos.x, pos.y);

    // 绑定事件
    setupFloatyEvents();

    // 延迟添加日志
    setTimeout(function() {
        addLog("━━━━━━━━━━━━━━━━━━━━━━");
        addLog("🎯 红薯糖水 v1.0");
        addLog("━━━━━━━━━━━━━━━━━━━━━━");
        addLog("✅ 已启动");
        addLog("💡 点击采集开始");
        addLog("━━━━━━━━━━━━━━━━━━━━━━");
        toast("红薯糖水已启动");
    }, 500);
}

// 启动
init();

// 保持脚本运行 - 在单独线程中循环
threads.start(function() {
    while (keepRunning) {
        sleep(1000);
    }
});
