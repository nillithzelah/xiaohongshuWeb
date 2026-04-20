# -*- coding: utf-8 -*-
"""
Boss 直聘自动化脚本配置文件
"""

# ============== 筛选条件配置 ==============

# 工作经验关键词（必须包含至少一个）
EXPERIENCE_KEYWORDS = [
    # 大健康相关
    "大健康", "保健品", "健康管理", "营养保健",

    # 护肤美容
    "护肤品", "美容", "化妆品", "祛斑", "祛痘", "护肤",

    # 减肥增高
    "减肥", "瘦身", "增高", "塑形",

    # 医疗健康
    "医疗器械", "医药", "药店", "诊所",

    # 其他健康
    "养生", "理疗", "康复", "健身"
]

# 排除职位关键词（包含这些的跳过）
EXCLUDE_POSITION_KEYWORDS = [
    "营养师", "运营", "总助", "助理", "客服",
    "人事", "行政", "财务", "技术", "开发",
    "设计", "美工", "剪辑", "文案", "策划",
    "数据", "分析", "管培生", "实习生"
]

# 必须包含的销售关键词
SALE_KEYWORDS = [
    "销售", "业务", "招商", "推广", "市场",
    "顾问", "代表", "专员", "经理", "主管"
]

# ============== 执行参数配置 ==============

# 工作时间段（24小时制）
WORK_TIME_START = 9   # 开始时间
WORK_TIME_END = 18    # 结束时间

# 打招呼配置
GREETING_INTERVAL = 10 * 60  # 打招呼间隔（秒），10分钟
GREETING_BATCH_SIZE = 5      # 每批次打招呼数量
DAILY_GREETING_LIMIT = 50    # 每日打招呼上限

# 随机延迟范围（秒），用于模拟人类行为
RANDOM_DELAY_MIN = 1
RANDOM_DELAY_MAX = 3

# ============== Boss 直聘 URL ==============

BOSS_URLS = {
    "login": "https://www.zhipin.com/web/user/?ka=header-login",
    "recommend": "https://www.zhipin.com/web/chat/recommend",  # 推荐牛人（BOSS端）
    "chat": "https://www.zhipin.com/web/chat/index",           # 聊天页面（BOSS端）
    "new": "https://www.zhipin.com/web/geek/new"               # 推荐牛人（新）
}

# ============== Chrome 调试端口 ==============

# Chrome远程调试端口（用于DrissionPage连接）
CHROME_DEBUG_PORT = 9222

# Chrome用户数据目录
CHROME_USER_DATA_DIR = "C:\\temp\\chrome_debug"

# 启动Chrome调试模式的命令
CHROME_DEBUG_COMMAND = f'"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port={CHROME_DEBUG_PORT} --user-data-dir="{CHROME_USER_DATA_DIR}"'

# ============== 常用语配置 ==============

# 自动回复使用的常用语（第一个）
DEFAULT_REPLY_TEMPLATE = "您好，我看到您的简历，非常符合我们大健康销售岗位的要求，方便聊聊吗？"

# ============== 日志配置 ==============

LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# ============== 数据存储 ==============

# 已打招呼的候选人ID存储文件
GREETED_FILE = "data/greeted_candidates.json"

# 每日统计文件
STATS_FILE = "data/daily_stats.json"
