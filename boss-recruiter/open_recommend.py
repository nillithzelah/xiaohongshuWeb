# -*- coding: utf-8 -*-
"""
打开推荐牛人页面
"""

import time
from DrissionPage import Chromium

print("连接到Chrome...")
browser = Chromium()
tab = browser.latest_tab

print(f"当前URL: {tab.url}")

# 导航到推荐牛人页面
print("点击'推荐牛人'...")
try:
    ele = tab.ele('text:推荐牛人', timeout=3)
    if ele:
        ele.click()
        time.sleep(2)
        print(f"导航后URL: {tab.url}")
        print("完成！")
    else:
        print("未找到'推荐牛人'链接")
except Exception as e:
    print(f"导航失败: {e}")
