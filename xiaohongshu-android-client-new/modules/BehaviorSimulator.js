/**
 * 行为模拟模块
 * 模拟人类操作，避免被检测
 */

function BehaviorSimulator(config) {
    this.config = config || {
        minDelay: 2000,
        maxDelay: 5000,
        scrollCount: 3
    };

    // 随机延迟
    this.randomDelay = function() {
        var delay = this.config.minDelay + Math.random() * (this.config.maxDelay - this.config.minDelay);
        sleep(delay);
    };

    // 模拟搜索行为
    this.simulateSearch = function() {
        // 随机延迟
        this.randomDelay();

        // 模拟输入停顿
        sleep(500 + Math.random() * 1000);
    };

    // 模拟浏览行为
    this.simulateBrowsing = function(minScrolls, maxScrolls) {
        var scrollCount = minScrolls || Math.floor(Math.random() * this.config.scrollCount) + 1;

        for (var i = 0; i < scrollCount; i++) {
            // 随机滚动距离
            var scrollDistance = 300 + Math.random() * 500;

            swipe(
                device.width / 2,
                device.height * 0.7,
                device.width / 2,
                device.height * 0.3,
                300 + Math.random() * 200
            );

            // 滚动后随机停顿
            sleep(1000 + Math.random() * 2000);
        }
    };

    // 模拟完整阅读
    this.simulateFullBrowsing = function() {
        // 阅读时长：5-15秒
        var readTime = 5000 + Math.random() * 10000;

        // 阅读期间随机滚动1-2次
        var scrollCount = Math.floor(Math.random() * 2) + 1;

        for (var i = 0; i < scrollCount; i++) {
            sleep(readTime / (scrollCount + 1));

            // 轻微滑动
            swipe(
                device.width / 2,
                device.height * 0.6,
                device.width / 2,
                device.height * 0.4,
                500
            );
        }

        sleep(readTime / (scrollCount + 1));
    };

    // 随机点击（模拟误触）
    this.randomClick = function(probability) {
        probability = probability || 0.1; // 默认10%概率

        if (Math.random() < probability) {
            var x = Math.random() * device.width;
            var y = Math.random() * device.height;
            click(x, y);
            sleep(1000);
            return true;
        }
        return false;
    };

    // 随机返回（模拟误操作）
    this.randomBack = function(probability) {
        probability = probability || 0.05; // 默认5%概率

        if (Math.random() < probability) {
            back();
            sleep(1000);
            // 再前进
            this.simulateBrowsing(1, 1);
            return true;
        }
        return false;
    };
}

module.exports = BehaviorSimulator;
