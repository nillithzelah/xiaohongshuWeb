# -*- coding: utf-8 -*-
"""
自动回复服务
"""

import logging
import json
from typing import Dict, Any, Set, Optional
from pathlib import Path
from datetime import datetime

import config

logger = logging.getLogger(__name__)


class AutoReplyService:
    """自动回复服务"""

    def __init__(self):
        self.replied_ids = self._load_replied_ids()

    def should_reply(self, chat_item: Dict[str, Any]) -> bool:
        """
        判断是否应该自动回复

        规则：
        1. 只回复男性
        2. 只回复首次消息

        Args:
            chat_item: 聊天项信息

        Returns:
            是否应该回复
        """
        # 检查性别
        gender = chat_item.get('gender', 'unknown')
        if gender != 'male':
            logger.debug(f"{chat_item.get('name')} 不是男性，不自动回复")
            return False

        # 检查是否已回复过
        chat_id = self._get_chat_id(chat_item)
        if chat_id and chat_id in self.replied_ids:
            logger.debug(f"{chat_item.get('name')} 已回复过，跳过")
            return False

        return True

    def mark_as_replied(self, chat_item: Dict[str, Any]):
        """标记为已回复"""
        chat_id = self._get_chat_id(chat_item)
        if chat_id:
            self.replied_ids.add(chat_id)
            self._save_replied_ids()

    def _get_chat_id(self, chat_item: Dict[str, Any]) -> Optional[str]:
        """获取聊天的唯一标识"""
        # 使用名称作为标识（实际应该用更可靠的 ID）
        return chat_item.get('name')

    def _load_replied_ids(self) -> Set[str]:
        """加载已回复的聊天ID"""
        try:
            file_path = Path(config.GREETED_FILE).parent / 'replied_chats.json'
            if file_path.exists():
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return set(data.get('ids', []))
        except Exception as e:
            logger.warning(f"加载已回复记录失败: {e}")

        return set()

    def _save_replied_ids(self):
        """保存已回复的聊天ID"""
        try:
            file_path = Path(config.GREETED_FILE).parent / 'replied_chats.json'
            file_path.parent.mkdir(parents=True, exist_ok=True)

            data = {
                'ids': list(self.replied_ids),
                'updated_at': datetime.now().isoformat()
            }

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

        except Exception as e:
            logger.warning(f"保存已回复记录失败: {e}")


class TimeController:
    """执行时间控制器"""

    @staticmethod
    def is_work_time() -> bool:
        """
        检查当前是否在工作时间内

        Returns:
            是否在工作时间（9:00-18:00）
        """
        now = datetime.now()
        hour = now.hour

        return config.WORK_TIME_START <= hour < config.WORK_TIME_END

    @staticmethod
    def get_next_work_time() -> str:
        """获取下一个工作时间点"""
        now = datetime.now()
        hour = now.hour

        if hour < config.WORK_TIME_START:
            # 还没到工作时间，返回今天工作时间开始
            next_time = now.replace(
                hour=config.WORK_TIME_START,
                minute=0,
                second=0,
                microsecond=0
            )
        else:
            # 已过工作时间，返回明天工作时间开始
            next_time = now.replace(
                hour=config.WORK_TIME_START,
                minute=0,
                second=0,
                microsecond=0
            )
            # 加一天
            from datetime import timedelta
            next_time += timedelta(days=1)

        return next_time.strftime('%Y-%m-%d %H:%M:%S')

    @staticmethod
    def format_remaining_time() -> str:
        """格式化剩余时间"""
        now = datetime.now()
        hour = now.hour

        if hour < config.WORK_TIME_START:
            # 还没到工作时间
            remaining = config.WORK_TIME_START - hour
            return f"距离工作时间还有 {remaining} 小时"

        elif hour >= config.WORK_TIME_END:
            # 已过工作时间
            return "已过工作时间，等待明天"

        else:
            # 工作时间内
            remaining = config.WORK_TIME_END - hour
            return f"工作时间剩余 {remaining} 小时"
