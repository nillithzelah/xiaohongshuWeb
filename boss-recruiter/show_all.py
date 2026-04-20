# -*- coding: utf-8 -*-
"""
显示全部候选人
"""

import time
from DrissionPage import Chromium

print("=" * 60)
print("显示全部候选人")
print("=" * 60)

# 连接到已运行的Chrome
browser = Chromium()
tab = browser.latest_tab

print(f"\n当前URL: {tab.url}")

# 确保在推荐牛人页面
if "recommend" not in tab.url:
    print("导航到推荐牛人页面...")
    ele = tab.ele('text:推荐牛人', timeout=3)
    if ele:
        ele.click()
        time.sleep(3)

# 获取候选人卡片
cards = tab.eles('css:.card-item')
print(f"\n找到 {len(cards)} 个候选人卡片")
print("=" * 60)

# 显示所有候选人
for i, card in enumerate(cards):
    try:
        # 获取姓名
        name = ""
        try:
            name_ele = card.ele('css:.name', timeout=1)
            if name_ele:
                name = name_ele.text.strip()
        except:
            pass
        
        # 获取性别
        gender = "未知"
        try:
            svg = card.ele('css:svg.gender', timeout=1)
            if svg:
                use_ele = svg.ele('tag:use', timeout=1)
                if use_ele:
                    href = use_ele.attr('xlink:href') or ''
                    if '#icon-icon-man' in href:
                        gender = "男"
                    elif '#icon-icon-woman' in href:
                        gender = "女"
        except:
            pass
        
        # 获取卡片文本（简短版本）
        card_text = card.text.replace('\n', ' | ')[:100]
        
        # 显示
        print(f"\n{i+1}. [{gender}] {name}")
        print(f"   {card_text}")
        
    except Exception as e:
        print(f"{i+1}. 读取失败: {e}")

print("\n" + "=" * 60)
print(f"总计: {len(cards)} 个候选人")
print("=" * 60)
