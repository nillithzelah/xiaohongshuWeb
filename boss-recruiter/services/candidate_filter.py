# -*- coding: utf-8 -*-
"""
候选人筛选服务
"""

import re
import json
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime

import config

logger = logging.getLogger(__name__)


class CandidateFilter:
    """候选人筛选服务"""

    def __init__(self):
        self.greeted_ids = self._load_greeted_ids()

    def filter_candidates(self, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        筛选符合条件的候选人

        筛选规则：
        1. 性别为男性
        2. 有相关行业经验（大健康/保健品/护肤品等）
        3. 职位是销售岗位
        4. 未打过招呼

        Args:
            candidates: 候选人列表

        Returns:
            符合条件的候选人列表
        """
        qualified = []

        for candidate in candidates:
            try:
                # 检查是否已打过招呼
                if self._is_already_greeted(candidate):
                    logger.debug(f"{candidate.get('name')} 已打过招呼，跳过")
                    continue

                # 检查性别
                if not self._is_male(candidate):
                    logger.debug(f"{candidate.get('name')} 不是男性，跳过")
                    continue

                # 检查职位（从info文本中提取）
                if not self._is_sales_position(candidate):
                    logger.debug(f"{candidate.get('name')} 职位不是销售，跳过")
                    continue

                # 检查是否有排除关键词
                if self._has_exclude_keywords(candidate):
                    logger.debug(f"{candidate.get('name')} 职位包含排除关键词，跳过")
                    continue

                # 检查工作经验（从info文本中提取）
                if not self._has_relevant_experience(candidate):
                    logger.debug(f"{candidate.get('name')} 没有相关经验，跳过")
                    continue

                # 全部条件满足
                qualified.append(candidate)
                logger.info(f"[OK] {candidate.get('name')} - 符合条件")

            except Exception as e:
                logger.warning(f"筛选候选人时出错: {e}")
                continue

        logger.info(f"筛选结果: {len(qualified)}/{len(candidates)} 个候选人符合条件")
        return qualified

    def _is_male(self, candidate: Dict[str, Any]) -> bool:
        """检查是否为男性"""
        gender = candidate.get('gender', 'unknown')
        return gender == 'male'

    def _is_sales_position(self, candidate: Dict[str, Any]) -> bool:
        """
        检查是否为销售岗位

        判断逻辑：从info文本中检查是否包含销售相关关键词
        """
        # 获取候选人信息文本
        info = candidate.get('info', '').lower()
        
        # 也检查name字段（可能包含职位信息）
        name = candidate.get('name', '').lower()
        
        # 合并文本
        full_text = f"{info} {name}"

        # 检查是否包含销售关键词
        for keyword in config.SALE_KEYWORDS:
            if keyword.lower() in full_text:
                return True

        return False

    def _has_exclude_keywords(self, candidate: Dict[str, Any]) -> bool:
        """
        检查是否包含排除关键词

        如：营养师、运营、总助等非销售岗位
        """
        info = candidate.get('info', '').lower()
        name = candidate.get('name', '').lower()
        full_text = f"{info} {name}"

        for keyword in config.EXCLUDE_POSITION_KEYWORDS:
            if keyword.lower() in full_text:
                return True

        return False

    def _has_relevant_experience(self, candidate: Dict[str, Any]) -> bool:
        """
        检查是否有相关行业经验

        相关行业：大健康、保健品、护肤品、减肥、增高、美容销售等
        """
        info = candidate.get('info', '').lower()
        name = candidate.get('name', '').lower()
        full_text = f"{info} {name}"

        # 检查是否包含经验关键词
        for keyword in config.EXPERIENCE_KEYWORDS:
            if keyword.lower() in full_text:
                return True

        return False

    def _is_already_greeted(self, candidate: Dict[str, Any]) -> bool:
        """检查是否已经打过招呼"""
        candidate_id = candidate.get('id', '')
        if not candidate_id:
            return False

        return candidate_id in self.greeted_ids

    def mark_as_greeted(self, candidate: Dict[str, Any]):
        """标记候选人为已打招呼"""
        candidate_id = candidate.get('id', '')
        if candidate_id:
            self.greeted_ids.add(candidate_id)
            self._save_greeted_ids()

    def _load_greeted_ids(self) -> set:
        """加载已打招呼的候选人ID"""
        try:
            file_path = Path(config.GREETED_FILE)
            if file_path.exists():
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return set(data.get('ids', []))
        except Exception as e:
            logger.warning(f"加载已打招呼记录失败: {e}")

        return set()

    def _save_greeted_ids(self):
        """保存已打招呼的候选人ID"""
        try:
            file_path = Path(config.GREETED_FILE)
            file_path.parent.mkdir(parents=True, exist_ok=True)

            data = {
                'ids': list(self.greeted_ids),
                'updated_at': datetime.now().isoformat()
            }

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

        except Exception as e:
            logger.warning(f"保存已打招呼记录失败: {e}")


class DailyStats:
    """每日统计管理"""

    def __init__(self):
        self.stats = self._load_stats()

    def get_today_count(self) -> int:
        """获取今日打招呼数量"""
        today = datetime.now().strftime('%Y-%m-%d')
        return self.stats.get(today, 0)

    def increment_count(self) -> int:
        """增加今日打招呼数量"""
        today = datetime.now().strftime('%Y-%m-%d')
        self.stats[today] = self.stats.get(today, 0) + 1
        self._save_stats()
        return self.stats[today]

    def can_greet_today(self) -> bool:
        """检查今日是否还可以打招呼"""
        return self.get_today_count() < config.DAILY_GREETING_LIMIT

    def _load_stats(self) -> Dict[str, int]:
        """加载统计数据"""
        try:
            file_path = Path(config.STATS_FILE)
            if file_path.exists():
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"加载统计数据失败: {e}")

        return {}

    def _save_stats(self):
        """保存统计数据"""
        try:
            file_path = Path(config.STATS_FILE)
            file_path.parent.mkdir(parents=True, exist_ok=True)

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(self.stats, f, ensure_ascii=False, indent=2)

        except Exception as e:
            logger.warning(f"保存统计数据失败: {e}")
