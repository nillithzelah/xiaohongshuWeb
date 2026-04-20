# -*- coding: utf-8 -*-
"""
Boss 直聘自动化脚本 - 主入口（DrissionPage版）

功能：
1. 自动筛选符合条件的候选人（男性、大健康销售经验）
2. 自动打招呼（工作时间 9:00-18:00，10分钟间隔，每日50个上限）
3. 自动回复未读消息（只回复男性首次消息）

使用方法：
1. 安装依赖：pip install -r requirements.txt
2. 先启动Chrome调试模式：
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome_debug"
3. 在Chrome中登录Boss直聘
4. 运行脚本：python main.py
5. 脚本将自动连接到Chrome并运行

注意：
- 必须先启动Chrome调试模式，再运行脚本
- 脚本不会自动启动浏览器，需要手动启动
- 关闭脚本不会关闭浏览器

Author: Claude Code
Date: 2026-03-12
Updated: 2026-03-12 - 使用DrissionPage连接已运行的Chrome
"""

import sys
import time
import random
import logging
import argparse
from datetime import datetime
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent))

import config
from services import BrowserService, CandidateFilter
from services.candidate_filter import DailyStats
from services.auto_reply import AutoReplyService, TimeController

# 配置日志
def setup_logging():
    """配置日志格式"""
    # 创建 data 目录
    Path('data').mkdir(exist_ok=True)

    # 配置日志处理器
    logging.basicConfig(
        level=getattr(logging, config.LOG_LEVEL),
        format=config.LOG_FORMAT,
        datefmt=config.LOG_DATE_FORMAT,
        handlers=[
            # 控制台输出
            logging.StreamHandler(sys.stdout),
            # 文件输出
            logging.FileHandler(
                f'data/boss_recruiter_{datetime.now().strftime("%Y%m%d")}.log',
                encoding='utf-8'
            )
        ]
    )

    # 设置第三方库日志级别
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('DrissionPage').setLevel(logging.WARNING)


logger = logging.getLogger(__name__)


class BossRecruiter:
    """Boss 直聘自动化招聘主控制器"""

    def __init__(self):
        self.browser = BrowserService()
        self.filter = CandidateFilter()
        self.stats = DailyStats()
        self.auto_reply = AutoReplyService()
        self.running = False

    def start(self):
        """启动自动化脚本"""
        logger.info("=" * 60)
        logger.info("Boss 直聘自动化招聘脚本启动")
        logger.info("=" * 60)
        logger.info("")
        logger.info("使用说明：")
        logger.info("1. 请先启动Chrome（带调试端口）：")
        logger.info(f'   {config.CHROME_DEBUG_COMMAND}')
        logger.info("2. 在Chrome中登录Boss直聘")
        logger.info("3. 登录成功后，脚本将自动运行")
        logger.info("=" * 60)

        # 初始化浏览器（连接到已运行的Chrome）
        if not self.browser.init_browser():
            logger.error("浏览器连接失败，程序退出")
            logger.error("请确保Chrome已用调试端口启动")
            return

        # 检查登录状态
        if not self.browser.login(timeout=30):
            logger.error("未检测到登录状态，程序退出")
            logger.error("请先在Chrome中登录Boss直聘")
            self.browser.close()
            return

        self.running = True
        self._main_loop()

    def _main_loop(self):
        """主循环"""
        last_greet_time = 0  # 上次打招呼时间

        try:
            while self.running:
                # 检查工作时间
                if not TimeController.is_work_time():
                    logger.info(f"当前不在工作时间，{TimeController.format_remaining_time()}")
                    logger.info(f"下次工作时间: {TimeController.get_next_work_time()}")
                    time.sleep(60 * 30)  # 等待30分钟再检查
                    continue

                # 检查每日上限
                if not self.stats.can_greet_today():
                    logger.info(f"今日已达到打招呼上限 ({config.DAILY_GREETING_LIMIT} 个)")
                    logger.info(f"下次工作时间: {TimeController.get_next_work_time()}")
                    time.sleep(60 * 30)
                    continue

                # 检查打招呼间隔
                time_since_last_greet = time.time() - last_greet_time
                if time_since_last_greet < config.GREETING_INTERVAL:
                    wait_time = config.GREETING_INTERVAL - time_since_last_greet
                    logger.info(f"等待打招呼间隔... 还需 {int(wait_time)} 秒")
                    time.sleep(min(wait_time, 60))
                    continue

                # 执行打招呼任务
                try:
                    greeted_count = self._do_greeting_task()
                    if greeted_count > 0:
                        last_greet_time = time.time()
                        logger.info(f"本批次打招呼 {greeted_count} 人")
                except Exception as e:
                    logger.error(f"打招呼任务执行出错: {e}")

                # 执行自动回复任务
                try:
                    self._do_auto_reply_task()
                except Exception as e:
                    logger.error(f"自动回复任务执行出错: {e}")

                # 短暂休息
                time.sleep(random.uniform(5, 10))

        except KeyboardInterrupt:
            logger.info("收到停止信号，正在退出...")
        finally:
            self.browser.close()
            logger.info("Boss 直聘自动化脚本已停止")

    def _do_greeting_task(self) -> int:
        """
        执行打招呼任务

        Returns:
            本批次打招呼数量
        """
        logger.info("-" * 40)
        logger.info("开始执行打招呼任务")

        # 获取推荐候选人
        candidates = self.browser.get_recommend_candidates(scroll_times=2)
        if not candidates:
            logger.warning("未获取到候选人，可能需要刷新页面或重新登录")
            return 0

        # 筛选符合条件的候选人
        qualified = self.filter.filter_candidates(candidates)
        if not qualified:
            logger.info("没有符合条件的候选人")
            return 0

        # 执行打招呼
        greeted_count = 0
        for candidate in qualified[:config.GREETING_BATCH_SIZE]:
            # 检查每日上限
            if not self.stats.can_greet_today():
                logger.info("已达到每日上限，停止打招呼")
                break

            # 打招呼
            success = self.browser.greet_candidate(candidate)
            if success:
                self.filter.mark_as_greeted(candidate)
                self.stats.increment_count()
                greeted_count += 1
                logger.info(
                    f"打招呼成功 ({self.stats.get_today_count()}/{config.DAILY_GREETING_LIMIT}): "
                    f"{candidate.get('name')} - {candidate.get('position')}"
                )

            # 随机延迟
            time.sleep(random.uniform(
                config.RANDOM_DELAY_MIN,
                config.RANDOM_DELAY_MAX
            ))

        logger.info(f"打招呼任务完成，本批次: {greeted_count} 人")
        return greeted_count

    def _do_auto_reply_task(self):
        """执行自动回复任务"""
        logger.info("-" * 40)
        logger.info("开始执行自动回复任务")

        # 打开聊天页面
        if not self.browser.open_chat_page():
            logger.warning("无法打开聊天页面")
            return

        # 获取未读消息
        unread_chats = self.browser.get_unread_chats()
        if not unread_chats:
            logger.info("没有未读消息")
            return

        # 筛选需要回复的聊天
        for chat in unread_chats:
            if not self.auto_reply.should_reply(chat):
                continue

            # 发送回复
            success = self.browser.send_quick_reply(chat)
            if success:
                self.auto_reply.mark_as_replied(chat)
                logger.info(f"已自动回复: {chat.get('name')}")

            # 随机延迟
            time.sleep(random.uniform(1, 2))

        logger.info("自动回复任务完成")

    def stop(self):
        """停止脚本"""
        self.running = False


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='Boss 直聘自动化招聘脚本',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python main.py              # 正常运行
  python main.py --test       # 测试模式（只筛选不发送）
  python main.py --headless   # 无头模式（不推荐，容易被检测）
        """
    )
    parser.add_argument(
        '--test',
        action='store_true',
        help='测试模式：只筛选候选人，不发送打招呼'
    )
    parser.add_argument(
        '--headless',
        action='store_true',
        help='无头模式：浏览器后台运行（容易被检测）'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=config.DAILY_GREETING_LIMIT,
        help=f'每日打招呼上限（默认 {config.DAILY_GREETING_LIMIT}）'
    )

    args = parser.parse_args()

    # 更新配置
    if args.limit:
        config.DAILY_GREETING_LIMIT = args.limit

    # 设置日志
    setup_logging()

    # 显示启动信息
    logger.info("=" * 60)
    logger.info("Boss 直聘自动化招聘脚本 v1.0.0")
    logger.info("=" * 60)
    logger.info(f"工作时间: {config.WORK_TIME_START}:00 - {config.WORK_TIME_END}:00")
    logger.info(f"打招呼间隔: {config.GREETING_INTERVAL // 60} 分钟")
    logger.info(f"每日上限: {config.DAILY_GREETING_LIMIT} 人")
    logger.info(f"每批次: {config.GREETING_BATCH_SIZE} 人")
    logger.info(f"测试模式: {'开启' if args.test else '关闭'}")
    logger.info("=" * 60)

    # 创建并启动
    recruiter = BossRecruiter()

    if args.test:
        # 测试模式
        logger.info("测试模式：将只筛选候选人，不发送打招呼")
        logger.info("")
        logger.info("请先启动Chrome（带调试端口）：")
        logger.info(f'   {config.CHROME_DEBUG_COMMAND}')
        logger.info("")
        
        if recruiter.browser.init_browser():
            if recruiter.browser.login(timeout=30):
                candidates = recruiter.browser.get_recommend_candidates()
                qualified = recruiter.filter.filter_candidates(candidates)
                logger.info(f"测试完成：共 {len(candidates)} 个候选人，{len(qualified)} 个符合条件")
                
                # 打印符合条件的候选人
                if qualified:
                    logger.info("")
                    logger.info("符合条件的候选人：")
                    for c in qualified:
                        logger.info(f"  - {c.get('name')}: {c.get('info', '')[:50]}...")
        recruiter.browser.close()
    else:
        # 正常运行
        recruiter.start()


if __name__ == '__main__':
    main()
