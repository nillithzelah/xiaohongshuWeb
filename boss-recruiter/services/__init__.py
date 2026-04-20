# -*- coding: utf-8 -*-
"""
Boss 直聘自动化服务模块
"""

from .browser_service import BrowserService
from .candidate_filter import CandidateFilter
from .auto_reply import AutoReplyService

__all__ = [
    'BrowserService',
    'CandidateFilter',
    'AutoReplyService'
]
