# -*- coding: utf-8 -*-
"""
新建标签页查看推荐候选人
"""

import time
from DrissionPage import Chromium

print("=" * 60)
print("新建标签页查看推荐候选人")
print("=" * 60)

# 连接到已运行的Chrome
browser = Chromium()

# 获取当前标签页的信息
current_tab = browser.latest_tab
print(f"\n当前标签页: {current_tab.url}")

# 新建一个标签页
print("\n新建标签页...")
new_tab = browser.new_tab('https://www.zhipin.com/web/chat/recommend')
time.sleep(3)

print(f"新标签页URL: {new_tab.url}")
print(f"新标签页标题: {new_tab.title}")

# 获取新标签页的候选人
print("\n新标签页的候选人：")
cards = new_tab.eles('css:.card-item')
print(f"找到 {len(cards)} 个候选人卡片")

new_candidates = []
for i, card in enumerate(cards[:10]):
    try:
        name = ""
        try:
            name_ele = card.ele('css:.name', timeout=1)
            if name_ele:
                name = name_ele.text.strip()
        except:
            pass
        new_candidates.append(name)
        print(f"  {i+1}. {name}")
    except:
        pass

# 截图
screenshot_path = "D:\\Desktop\\projects\\xiaohongshuWeb\\boss-recruiter\\new_tab_page.png"
new_tab.get_screenshot(screenshot_path)
print(f"\n截图已保存: {screenshot_path}")

# 切换回原来的标签页
print("\n切换回原来的标签页...")
current_tab.set.activate()
time.sleep(1)

# 获取原标签页的候选人
print("\n原标签页的候选人：")
cards = current_tab.eles('css:.card-item')
print(f"找到 {len(cards)} 个候选人卡片")

old_candidates = []
for i, card in enumerate(cards[:10]):
    try:
        name = ""
        try:
            name_ele = card.ele('css:.name', timeout=1)
            if name_ele:
                name = name_ele.text.strip()
        except:
            pass
        old_candidates.append(name)
        print(f"  {i+1}. {name}")
    except:
        pass

# 比较
print("\n" + "=" * 60)
print("比较两个标签页的候选人")
print("=" * 60)

print(f"\n新标签页前10个: {new_candidates}")
print(f"原标签页前10个: {old_candidates}")

if new_candidates == old_candidates:
    print("\n结论: 两个标签页的候选人相同")
else:
    print("\n结论: 两个标签页的候选人不同！")
    print("这说明推荐列表是动态的，每次刷新可能不同")

print("\n" + "=" * 60)
