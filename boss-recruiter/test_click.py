# -*- coding: utf-8 -*-
"""
DrissionPage 点击"推荐牛人"测试
"""

import time
from DrissionPage import Chromium

print("=" * 60)
print("DrissionPage 点击'推荐牛人'测试")
print("=" * 60)

# 连接到已运行的Chrome
print("\n连接到Chrome...")
browser = Chromium()
tab = browser.latest_tab

print(f"[OK] 连接成功")
print(f"当前URL: {tab.url}")

# ============================================================
# 直接查找并点击"推荐牛人"
# ============================================================
print("\n" + "=" * 60)
print("查找'推荐牛人'元素...")
print("=" * 60)

try:
    # 使用文本查找
    ele = tab.ele('text:推荐牛人', timeout=3)
    if ele:
        print(f"[OK] 找到元素")
        print(f"  标签: {ele.tag}")
        print(f"  文本: {ele.text}")
        print(f"  类名: {ele.attr('class')}")
        
        # 直接点击，不管是什么标签
        print(f"\n尝试点击...")
        ele.click()
        time.sleep(3)
        
        print(f"点击后URL: {tab.url}")
        print(f"页面标题: {tab.title}")
        
        # 检查页面变化
        if "recommend" in tab.url:
            print("\n[OK] 成功导航到推荐牛人页面！")
        else:
            print("\n[WARN] URL没有包含'recommend'")
    else:
        print("[WARN] 未找到'推荐牛人'元素")

except Exception as e:
    print(f"[ERROR] 操作失败: {e}")

# ============================================================
# 检查当前页面内容
# ============================================================
print("\n" + "=" * 60)
print("检查当前页面内容")
print("=" * 60)

# 检查候选人卡片
selectors = {
    '.geek-item': '候选人卡片',
    '.recommend-card': '推荐卡片',
    '.job-card-wrapper': '职位卡片',
    '.card-item': '卡片项',
}

for selector, name in selectors.items():
    try:
        elements = tab.eles(f'css:{selector}', timeout=2)
        if elements:
            print(f"  [OK] {name} ({selector}): {len(elements)} 个")
    except:
        pass

# 截图
try:
    screenshot_path = "D:\\Desktop\\projects\\xiaohongshuWeb\\boss-recruiter\\screenshot3.png"
    tab.get_screenshot(screenshot_path)
    print(f"\n[OK] 截图已保存: {screenshot_path}")
except Exception as e:
    print(f"[ERROR] 截图失败: {e}")

print("\n" + "=" * 60)
print("测试完成")
print("=" * 60)
