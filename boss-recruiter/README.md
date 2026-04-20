# Boss 直聘自动化招聘脚本

基于 DrissionPage 的 Boss 直聘自动化招聘工具，通过连接已运行的 Chrome 浏览器实现反检测。

## 功能

1. **自动筛选候选人** - 筛选男性、有销售经验的候选人
2. **自动打招呼** - 工作时间 9:00-18:00，10分钟间隔，每日50个上限
3. **自动回复** - 只回复男性首次消息
4. **反检测** - 通过连接已运行的Chrome，避免被检测

## 使用方法

### 第一步：安装依赖

```bash
pip install DrissionPage
```

### 第二步：启动Chrome调试模式

**方法1：双击启动脚本**

```
双击 start_chrome.bat
```

**方法2：手动启动**

```powershell
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome_debug"
```

### 第三步：登录Boss直聘

在打开的 Chrome 浏览器中：
1. 访问 https://www.zhipin.com
2. 扫码登录

### 第四步：运行脚本

```bash
python main.py
```

脚本会自动：
1. 连接到已运行的 Chrome
2. 检测登录状态
3. 导航到推荐牛人页面
4. 筛选符合条件的候选人
5. 自动打招呼

## 配置

编辑 `config.py` 文件：

```python
# 筛选条件
EXPERIENCE_KEYWORDS = ["大健康", "保健品", "护肤品", ...]  # 工作经验关键词
EXCLUDE_POSITION_KEYWORDS = ["营养师", "运营", ...]       # 排除关键词
SALE_KEYWORDS = ["销售", "业务", "招商", ...]            # 销售关键词

# 执行参数
WORK_TIME_START = 9          # 工作开始时间
WORK_TIME_END = 18           # 工作结束时间
GREETING_INTERVAL = 10 * 60  # 打招呼间隔（秒）
DAILY_GREETING_LIMIT = 50    # 每日上限
```

## 性别识别

通过候选人卡片中的 SVG 图标识别性别：
- 男性：`xlink:href="#icon-icon-man"`
- 女性：`xlink:href="#icon-icon-woman"`

## 注意事项

1. **必须先启动Chrome调试模式**，再运行脚本
2. **必须先登录Boss直聘**，脚本不会自动登录
3. 关闭脚本**不会关闭浏览器**
4. 建议使用独立的Chrome用户数据目录（`C:\temp\chrome_debug`）
5. 首次使用建议用 `--test` 模式测试

## 测试模式

```bash
python main.py --test
```

测试模式只筛选候选人，不发送打招呼。

## 文件结构

```
boss-recruiter/
├── main.py              # 主入口
├── config.py            # 配置文件
├── start_chrome.bat     # 启动Chrome调试模式
├── services/
│   ├── browser_service.py   # 浏览器控制（DrissionPage）
│   ├── candidate_filter.py  # 候选人筛选
│   └── auto_reply.py        # 自动回复
└── data/
    ├── greeted_candidates.json  # 已打招呼记录
    └── daily_stats.json         # 每日统计
```

## 更新日志

### 2026-03-12
- 改用 DrissionPage 连接已运行的 Chrome
- 新增通过 SVG 图标识别性别
- 新增点击导航方式
- 新增 start_chrome.bat 启动脚本
- 更新 CSS 选择器适配新页面结构
