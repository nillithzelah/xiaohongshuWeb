# -*- coding: utf-8 -*-
"""
浏览器控制服务 - 使用 DrissionPage 连接已运行的Chrome

使用方法：
1. 先启动Chrome（带调试端口）：
   chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome_debug"
   
2. 在Chrome中登录Boss直聘

3. 运行脚本，DrissionPage会连接到已打开的Chrome
"""

import time
import random
import logging
from typing import Optional, List, Dict, Any

from DrissionPage import Chromium

import config

logger = logging.getLogger(__name__)


class BrowserService:
    """Boss 直聘浏览器控制服务 - 连接已运行的Chrome"""

    def __init__(self, debug_port: int = 9222):
        self.debug_port = debug_port
        self.browser = None
        self.tab = None
        self.is_logged_in = False

    def init_browser(self, headless: bool = False) -> bool:
        """
        连接到已运行的Chrome浏览器

        Args:
            headless: 忽略此参数（连接模式不支持headless）

        Returns:
            是否连接成功
        """
        try:
            logger.info(f"正在连接到Chrome (端口 {self.debug_port})...")
            
            # 连接到已运行的Chrome
            self.browser = Chromium()
            self.tab = self.browser.latest_tab
            
            logger.info(f"连接成功，当前URL: {self.tab.url}")
            return True

        except Exception as e:
            logger.error(f"连接浏览器失败: {e}")
            logger.error(f"请确保Chrome已用以下命令启动：")
            logger.error(f'chrome.exe --remote-debugging-port={self.debug_port} --user-data-dir="C:\\temp\\chrome_debug"')
            return False

    def login(self, timeout: int = 120) -> bool:
        """
        检查登录状态（需要用户已手动登录）

        Args:
            timeout: 等待时间（秒）

        Returns:
            是否已登录
        """
        if not self.tab:
            logger.error("浏览器未连接")
            return False

        try:
            # 检查是否在Boss直聘页面
            if "zhipin.com" not in self.tab.url:
                logger.info("正在打开Boss直聘...")
                self.tab.get("https://www.zhipin.com")
                time.sleep(2)

            # 检查登录状态 - 查找用户导航元素
            try:
                user_nav = self.tab.ele('css:.user-nav', timeout=3)
                if user_nav:
                    self.is_logged_in = True
                    logger.info("检测到已登录状态")
                    return True
            except:
                pass

            # 如果在登录页面，等待用户登录
            if "web/user" in self.tab.url:
                logger.info("请在浏览器中扫码登录...")
                
                start_time = time.time()
                while time.time() - start_time < timeout:
                    try:
                        user_nav = self.tab.ele('css:.user-nav', timeout=2)
                        if user_nav:
                            self.is_logged_in = True
                            logger.info("登录成功！")
                            return True
                    except:
                        pass
                    time.sleep(2)
                
                logger.error("登录超时")
                return False

            # 检查URL是否包含已登录的路径
            if "web/chat" in self.tab.url or "web/geek" in self.tab.url:
                self.is_logged_in = True
                logger.info("检测到已登录状态（通过URL）")
                return True

            logger.warning("无法确定登录状态，请确保已登录")
            return False

        except Exception as e:
            logger.error(f"检查登录状态失败: {e}")
            return False

    def check_login_status(self) -> bool:
        """
        检查登录状态

        Returns:
            是否已登录
        """
        if not self.tab:
            return False

        try:
            # 检查URL
            if "web/user" in self.tab.url and "web/chat" not in self.tab.url:
                self.is_logged_in = False
                return False

            # 检查用户导航
            try:
                user_nav = self.tab.ele('css:.user-nav', timeout=2)
                if user_nav:
                    self.is_logged_in = True
                    return True
            except:
                pass

            # 通过URL判断
            if "web/chat" in self.tab.url or "web/geek" in self.tab.url:
                self.is_logged_in = True
                return True

            return False

        except Exception as e:
            logger.error(f"检查登录状态失败: {e}")
            return False

    def get_recommend_candidates(self, scroll_times: int = 3) -> List[Dict[str, Any]]:
        """
        获取推荐牛人列表

        Args:
            scroll_times: 滚动加载次数

        Returns:
            候选人信息列表
        """
        if not self.is_logged_in:
            logger.error("请先登录")
            return []

        candidates = []

        try:
            # 使用点击导航到推荐牛人页面
            self._navigate_to_recommend()
            
            # 滚动加载更多候选人
            for i in range(scroll_times):
                self._scroll_down()
                self._random_delay(1, 2)

            # 获取候选人卡片（使用新的选择器）
            cards = self.tab.eles('css:.card-item')
            logger.info(f"找到 {len(cards)} 个候选人卡片")

            for card in cards:
                try:
                    candidate = self._parse_candidate_card(card)
                    if candidate:
                        candidates.append(candidate)
                except Exception as e:
                    logger.warning(f"解析候选人卡片失败: {e}")
                    continue

            logger.info(f"获取到 {len(candidates)} 个候选人")
            return candidates

        except Exception as e:
            logger.error(f"获取推荐牛人失败: {e}")
            return []

    def _navigate_to_recommend(self):
        """
        导航到推荐牛人页面（使用点击导航）
        """
        try:
            # 检查是否已经在推荐牛人页面
            if "recommend" in self.tab.url:
                logger.info("已在推荐牛人页面")
                return

            # 方法1: 通过文本查找"推荐牛人"链接并点击
            try:
                ele = self.tab.ele('text:推荐牛人', timeout=3)
                if ele:
                    logger.info("找到'推荐牛人'链接，点击导航...")
                    ele.click()
                    time.sleep(3)
                    logger.info(f"导航后URL: {self.tab.url}")
                    return
            except:
                pass

            # 方法2: 如果方法1失败，尝试直接访问URL
            logger.info("尝试直接访问推荐牛人页面...")
            self.tab.get(config.BOSS_URLS["recommend"])
            time.sleep(3)

        except Exception as e:
            logger.warning(f"导航到推荐牛人页面失败: {e}")

    def _parse_candidate_card(self, card) -> Optional[Dict[str, Any]]:
        """
        解析候选人卡片信息

        Args:
            card: 候选人卡片元素

        Returns:
            候选人信息字典
        """
        try:
            # 获取姓名
            name = ""
            try:
                name_ele = card.ele('css:.name', timeout=1)
                if name_ele:
                    name = name_ele.text.strip()
            except:
                pass

            # 获取性别（通过SVG的xlink:href）
            gender = self._detect_gender(card)

            # 获取卡片文本用于提取其他信息
            card_text = card.text if card.text else ""

            # 获取打招呼按钮
            greet_btn = None
            try:
                greet_btn = card.ele('css:button', timeout=1)
            except:
                pass

            # 生成唯一ID（使用姓名+部分文本）
            card_id = f"{name}_{hash(card_text[:50])}"

            return {
                'id': card_id,
                'name': name,
                'gender': gender,  # 'male', 'female', 'unknown'
                'info': card_text[:200],
                'card_element': card,
                'greet_btn': greet_btn
            }

        except Exception as e:
            logger.debug(f"解析卡片异常: {e}")
            return None

    def _detect_gender(self, card) -> str:
        """
        检测候选人性别（通过SVG的xlink:href）

        男性: xlink:href="#icon-icon-man"
        女性: xlink:href="#icon-icon-woman"

        Args:
            card: 候选人卡片元素

        Returns:
            'male', 'female', 'unknown'
        """
        try:
            # 方法1: 查找svg.gender元素
            try:
                svg = card.ele('css:svg.gender', timeout=1)
                if svg:
                    use_ele = svg.ele('tag:use', timeout=1)
                    if use_ele:
                        href = use_ele.attr('xlink:href') or ''
                        if '#icon-icon-man' in href:
                            return 'male'
                        elif '#icon-icon-woman' in href:
                            return 'female'
            except:
                pass

            # 方法2: 直接查找use元素
            try:
                use_ele = card.ele('css:use', timeout=1)
                if use_ele:
                    href = use_ele.attr('xlink:href') or ''
                    if '#icon-icon-man' in href:
                        return 'male'
                    elif '#icon-icon-woman' in href:
                        return 'female'
            except:
                pass

            # 方法3: 通过父元素查找
            try:
                # 查找头像容器
                avatar_wrap = card.ele('css:.avatar-wrap, .avatar-box', timeout=1)
                if avatar_wrap:
                    svg = avatar_wrap.ele('css:svg', timeout=1)
                    if svg:
                        use_ele = svg.ele('tag:use', timeout=1)
                        if use_ele:
                            href = use_ele.attr('xlink:href') or ''
                            if '#icon-icon-man' in href:
                                return 'male'
                            elif '#icon-icon-woman' in href:
                                return 'female'
            except:
                pass

            return 'unknown'

        except Exception:
            return 'unknown'

    def greet_candidate(self, candidate: Dict[str, Any]) -> bool:
        """
        向候选人打招呼

        Args:
            candidate: 候选人信息

        Returns:
            是否打招呼成功
        """
        try:
            greet_btn = candidate.get('greet_btn')
            
            if not greet_btn:
                # 尝试重新查找按钮
                card = candidate.get('card_element')
                if card:
                    greet_btn = card.ele('css:button', timeout=2)

            if greet_btn:
                # 检查按钮文本
                btn_text = greet_btn.text if greet_btn.text else ""
                if "已打招呼" in btn_text or "继续沟通" in btn_text:
                    logger.info(f"{candidate.get('name')} 已打过招呼")
                    return False

                # 点击打招呼
                self._human_click(greet_btn)
                self._random_delay(1, 2)
                
                logger.info(f"已向 {candidate.get('name')} 打招呼")
                return True

            return False

        except Exception as e:
            logger.warning(f"打招呼失败 {candidate.get('name')}: {e}")
            return False

    def open_chat_page(self) -> bool:
        """
        打开聊天页面

        Returns:
            是否打开成功
        """
        if not self.is_logged_in:
            return False

        try:
            # 使用点击导航
            try:
                chat_link = self.tab.ele('text:沟通', timeout=3)
                if chat_link:
                    chat_link.click()
                    time.sleep(2)
                    return True
            except:
                pass

            # 备用：直接访问URL
            self.tab.get(config.BOSS_URLS["chat"])
            self._random_delay()
            return True

        except Exception as e:
            logger.error(f"打开聊天页面失败: {e}")
            return False

    def get_unread_chats(self) -> List[Dict[str, Any]]:
        """
        获取未读消息列表

        Returns:
            未读聊天列表
        """
        unread_chats = []

        try:
            # 查找未读消息标记
            unread_items = self.tab.eles('css:.chat-item.unread')

            for item in unread_items:
                try:
                    name_elem = item.ele('css:.name-text', timeout=1)
                    name = name_elem.text if name_elem else "未知"

                    # 获取性别
                    gender = self._detect_gender(item)

                    # 获取最后一条消息
                    msg_elem = item.ele('css:.last-msg', timeout=1)
                    last_msg = msg_elem.text if msg_elem else ""

                    unread_chats.append({
                        'name': name,
                        'gender': gender,
                        'last_msg': last_msg,
                        'element': item
                    })

                except Exception as e:
                    logger.debug(f"解析未读消息失败: {e}")
                    continue

            logger.info(f"发现 {len(unread_chats)} 条未读消息")
            return unread_chats

        except Exception as e:
            logger.error(f"获取未读消息失败: {e}")
            return []

    def send_quick_reply(self, chat_item: Dict[str, Any]) -> bool:
        """
        发送常用语回复

        Args:
            chat_item: 聊天项信息

        Returns:
            是否发送成功
        """
        try:
            # 点击聊天项打开对话
            element = chat_item.get('element')
            if element:
                self._human_click(element)
                self._random_delay(1, 2)

            # 查找常用语按钮
            quick_reply_btn = self.tab.ele('css:.quick-reply-btn', timeout=3)
            if quick_reply_btn:
                self._human_click(quick_reply_btn)
                self._random_delay(0.5, 1)

                # 点击第一个常用语
                first_reply = self.tab.ele('css:.quick-reply-item:first-child', timeout=2)
                if first_reply:
                    self._human_click(first_reply)
                    self._random_delay(0.5, 1)
                    logger.info(f"已向 {chat_item.get('name')} 发送常用语回复")
                    return True
            else:
                # 如果没有常用语按钮，直接发送默认回复
                input_box = self.tab.ele('css:.chat-input', timeout=2)
                if input_box:
                    input_box.input(config.DEFAULT_REPLY_TEMPLATE)
                    self._random_delay(0.5, 1)

                    send_btn = self.tab.ele('css:.send-btn', timeout=2)
                    if send_btn:
                        self._human_click(send_btn)
                        logger.info(f"已向 {chat_item.get('name')} 发送文本回复")
                        return True

            return False

        except Exception as e:
            logger.warning(f"发送回复失败: {e}")
            return False

    def _scroll_down(self, distance: int = 500):
        """向下滚动页面"""
        if self.tab:
            self.tab.scroll.down(distance)

    def _random_delay(self, min_sec: float = None, max_sec: float = None):
        """随机延迟，模拟人类行为"""
        min_sec = min_sec or config.RANDOM_DELAY_MIN
        max_sec = max_sec or config.RANDOM_DELAY_MAX
        time.sleep(random.uniform(min_sec, max_sec))

    def _human_click(self, element):
        """模拟人类点击（带随机偏移）"""
        if element:
            element.click()

    def close(self):
        """关闭连接（不关闭浏览器）"""
        # 连接模式下不关闭浏览器，只断开连接
        self.browser = None
        self.tab = None
        self.is_logged_in = False
        logger.info("已断开与浏览器的连接")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
