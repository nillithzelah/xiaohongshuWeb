/**
 * 位置定位助手
 * 拖动方块，实时显示中心坐标
 */

var window = null;
var touchX = 0;
var touchY = 0;
var winX = 0;
var winY = 0;

// 创建悬浮窗
function createWindow() {
    return floaty.window(
        <frame id="frame" bg="#FF0000" w="60" h="60">
            <text id="pos_text" text="?" textColor="#FFFFFF" textSize="10sp" gravity="center"/>
        </frame>
    );
}

// 更新位置显示 - 显示中心点坐标
function updatePosition() {
    var x = window.getX();
    var y = window.getY();
    var centerX = Math.floor(x + 30);
    var centerY = Math.floor(y + 30);
    var text = centerX + "," + centerY;
    window.pos_text.setText(text);
}

// 打印完整坐标信息
function printPosition() {
    var x = window.getX();
    var y = window.getY();
    var centerX = Math.floor(x + 30);
    var centerY = Math.floor(y + 30);

    console.log("========== 坐标信息 ==========");
    console.log("方块左上角: (" + x + ", " + y + ")");
    console.log("方块中心点: (" + centerX + ", " + centerY + ") ← 使用这个");
    console.log("方块右下角: (" + (x + 60) + ", " + (y + 60) + ")");
    console.log("屏幕尺寸: " + device.width + "x" + device.height);
    console.log("============================");
    toast("中心: (" + centerX + ", " + centerY + ")");
}

// 初始化
console.log("━━━━━━━━━━━━━━━━━━━━━━");
console.log("🎯 位置定位助手");
console.log("━━━━━━━━━━━━━━━━━━━━━━");
console.log("屏幕尺寸: " + device.width + "x" + device.height);
console.log("显示的是方块中心坐标");
console.log("━━━━━━━━━━━━━━━━━━━━━━");

auto.waitFor();
window = createWindow();

// 初始位置 - 右上角
window.setPosition(device.width - 120, 100);
updatePosition();

// 设置触摸监听
window.frame.setOnTouchListener(function(view, event) {
    switch (event.getAction()) {
        case event.ACTION_DOWN:
            touchX = event.getRawX();
            touchY = event.getRawY();
            winX = window.getX();
            winY = window.getY();
            return true;

        case event.ACTION_MOVE:
            var deltaX = event.getRawX() - touchX;
            var deltaY = event.getRawY() - touchY;
            window.setPosition(winX + deltaX, winY + deltaY);
            updatePosition();  // 实时更新显示
            return true;

        case event.ACTION_UP:
            printPosition();  // 松开时打印完整信息
            return true;
    }
    return false;
});

window.frame.setLongClickable(true);
window.frame.setOnLongClickListener(function() {
    printPosition();
    return true;
});

toast("位置助手已启动");

// 阻止脚本退出
while (true) {
    sleep(1000);
}
