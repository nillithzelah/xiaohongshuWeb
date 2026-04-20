/**
 * 小红书自动化操作模块
 * 负责在小红书APP中进行各种操作
 */

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
        // 尝试多种搜索按钮的选择器
        var searchSelectors = [
            id("search"),                           // ID
            text("搜索"),                          // 文本
            descContains("搜索"),                   // 描述包含
            classNameContains("Search")            // 类名包含
        ];

        for (var i = 0; i < searchSelectors.length; i++) {
            try {
                var btn = searchSelectors[i].findOne(2000);
                if (btn) {
                    this.clickCenter(btn);
                    sleep(1000);
                    return true;
                }
            } catch (e) {}
        }

        return false;
    };

    // 搜索关键词
    this.search = function(keyword) {
        // 找到搜索框
        var searchBox = id("search_input").findOne(3000);
        if (!searchBox) {
            searchBox = className("EditText").findOne(1000);
        }

        if (!searchBox) {
            return false;
        }

        // 点击搜索框
        searchBox.click();
        sleep(500);

        // 输入关键词
        searchBox.setText(keyword);
        sleep(1000);

        // 按回车搜索
        keyCode("KEYCODE_ENTER");
        sleep(2000);

        return true;
    };

    // 点击随机笔记
    this.clickRandomNote = function() {
        // 查找笔记列表项
        var noteSelectors = [
            className("androidx.recyclerview.widget.RecyclerView"),
            id("recyclerView"),
            className("ListView")
        ];

        for (var i = 0; i < noteSelectors.length; i++) {
            try {
                var list = noteSelectors[i].findOne(1000);
                if (list) {
                    var children = list.children();
                    if (children && children.length > 0) {
                        // 随机选择一个笔记
                        var randomIndex = Math.floor(Math.random() * Math.min(children.length, 10));
                        var note = children.get(randomIndex);
                        if (note) {
                            this.clickCenter(note);
                            sleep(2000);
                            return true;
                        }
                    }
                }
            } catch (e) {}
        }

        return false;
    };

    // 获取短链接
    this.getShortLink = function() {
        // 点击分享按钮
        var shareBtn = descContains("分享").findOne(2000);
        if (!shareBtn) {
            shareBtn = text("分享").findOne(1000);
        }

        if (!shareBtn) {
            return null;
        }

        this.clickCenter(shareBtn);
        sleep(1000);

        // 点击复制链接
        var copyBtn = text("复制链接").findOne(2000);
        if (!copyBtn) {
            copyBtn = textContains("复制").findOne(1000);
        }

        if (!copyBtn) {
            // 关闭分享面板
            back();
            return null;
        }

        this.clickCenter(copyBtn);
        sleep(500);

        // 从剪贴板获取
        var clip = app.getClipboardText();

        // 关闭分享面板
        back();
        sleep(500);

        // 检查是否是短链接
        if (clip && clip.includes("xhslink.com")) {
            return clip;
        }

        return null;
    };

    // 返回搜索结果页
    this.backToSearch = function() {
        back();
        sleep(1500);
    };

    // 关闭弹窗
    this.closePopup = function() {
        // 常见的关闭按钮位置
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

    // 检查是否在笔记详情页
    this.isNoteDetailPage = function() {
        return descContains("返回").exists() || textContains("评论").exists();
    };

    // 滚动页面
    this.scrollPage = function(direction) {
        direction = direction || "down";
        var x = device.width / 2;
        var y = device.height / 2;

        if (direction === "down") {
            swipe(x, y * 1.5, x, y * 0.5, 500);
        } else {
            swipe(x, y * 0.5, x, y * 1.5, 500);
        }

        sleep(1000);
    };
}

module.exports = XiaohongshuAutomation;
