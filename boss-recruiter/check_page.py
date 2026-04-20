# -*- coding: utf-8 -*-
"""
检查当前页面状态
"""

import time
from DrissionPage import Chromium

print("=" * 60)
print("检查当前页面状态")
print("=" * 60)

# 连接到已运行的Chrome
browser = Chromium()

# 列出所有标签页
print("\n所有标签页：")
tabs = browser.get_tabs()
for i, t in enumerate(tabs):
    try:
        print(f"  {i+1}. {t.title} - {t.url}")
    except:
        print(f"  {i+1}. 无法读取")

# 获取当前活动标签页
tab = browser.latest_tab

print(f"\n当前活动标签页:")
print(f"  URL: {tab.url}")
print(f"  标题: {tab.title}")

# 截图
print("\n正在截图...")
screenshot_path = "D:\\Desktop\\projects\\xiaohongshuWeb\\boss-recruiter\\current_page.png"
tab.get_screenshot(screenshot_path)
print(f"截图已保存: {screenshot_path}")

# 获取当前页面的候选人
print("\n当前页面的候选人：")
cards = tab.eles('css:.card-item')
print(f"找到 {len(cards)} 个候选人卡片")

for i, card in enumerate(cards[:5]):
    try:
        name = ""
        try:
            name_ele = card.ele('css:.name', timeout=1)
            if name_ele:
                name = name_ele.text.strip()
        except:
            pass
        print(f"  {i+1}. {name}")
    except:
        pass

print("\n" + "=" * 60)
print("请查看截图确认是否是正确的页面")
print("=" * 60)
