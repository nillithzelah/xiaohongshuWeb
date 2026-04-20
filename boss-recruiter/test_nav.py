# -*- coding: utf-8 -*-
"""
DrissionPage 正确用法测试 - 使用点击导航
"""

import time
from DrissionPage import Chromium

print("=" * 60)
print("DrissionPage 点击导航测试")
print("=" * 60)

# 连接到已运行的Chrome
print("\n连接到Chrome (端口 9222)...")
browser = Chromium()
tab = browser.latest_tab

print(f"[OK] 连接成功")
print(f"当前URL: {tab.url}")
print(f"页面标题: {tab.title}")

# ============================================================
# 测试1: 查找导航菜单
# ============================================================
print("\n" + "=" * 60)
print("测试1: 查找导航菜单")
print("=" * 60)

# 查找顶部导航
nav_selectors = [
    '.nav-box',
    '.header-nav',
    '.menu-nav',
    'nav',
    '.nav',
]

for selector in nav_selectors:
    try:
        nav = tab.ele(f'css:{selector}', timeout=1)
        if nav:
            print(f"[OK] 找到导航: {selector}")
            # 打印导航内的链接
            links = nav.eles('tag:a')
            print(f"  导航内有 {len(links)} 个链接")
            for link in links[:10]:
                try:
                    text = link.text.strip()
                    href = link.attr('href')
                    if text:
                        print(f"    - {text}: {href}")
                except:
                    pass
            break
    except:
        continue

# ============================================================
# 测试2: 查找"推荐牛人"或"牛人"链接
# ============================================================
print("\n" + "=" * 60)
print("测试2: 查找'推荐牛人'链接")
print("=" * 60)

# 尝试多种方式查找
search_texts = ['推荐牛人', '牛人', '推荐', '人才']

for text in search_texts:
    try:
        # 使用文本查找
        ele = tab.ele(f'text={text}', timeout=1)
        if ele:
            print(f"[OK] 找到文本'{text}'的元素")
            print(f"  标签: {ele.tag}")
            print(f"  文本: {ele.text}")
            # 如果是链接或包含链接，尝试点击
            if ele.tag == 'a':
                print(f"  尝试点击...")
                ele.click()
                time.sleep(3)
                print(f"  点击后URL: {tab.url}")
                break
            else:
                # 查找父级链接
                parent = ele.parent()
                if parent and parent.tag == 'a':
                    print(f"  父级是链接，尝试点击...")
                    parent.click()
                    time.sleep(3)
                    print(f"  点击后URL: {tab.url}")
                    break
    except Exception as e:
        pass

# ============================================================
# 测试3: 查找侧边栏菜单
# ============================================================
print("\n" + "=" * 60)
print("测试3: 查找侧边栏菜单")
print("=" * 60)

sidebar_selectors = [
    '.side-bar',
    '.sidebar',
    '.menu',
    '.left-menu',
    '.aside',
]

for selector in sidebar_selectors:
    try:
        sidebar = tab.ele(f'css:{selector}', timeout=1)
        if sidebar:
            print(f"[OK] 找到侧边栏: {selector}")
            # 打印侧边栏内的链接
            links = sidebar.eles('tag:a')
            print(f"  侧边栏内有 {len(links)} 个链接")
            for link in links[:10]:
                try:
                    text = link.text.strip()
                    href = link.attr('href')
                    if text:
                        print(f"    - {text}: {href}")
                except:
                    pass
            break
    except:
        continue

# ============================================================
# 测试4: 打印所有可点击的菜单项
# ============================================================
print("\n" + "=" * 60)
print("测试4: 查找所有菜单项")
print("=" * 60)

# 查找所有可能是菜单的元素
menu_items = tab.eles('css:.menu-item, .nav-item, .item')
print(f"找到 {len(menu_items)} 个菜单项")

for item in menu_items[:15]:
    try:
        text = item.text.strip()
        if text and len(text) < 20:
            print(f"  - {text}")
    except:
        pass

# ============================================================
# 测试5: 截图
# ============================================================
print("\n" + "=" * 60)
print("测试5: 截图")
print("=" * 60)

try:
    screenshot_path = "D:\\Desktop\\projects\\xiaohongshuWeb\\boss-recruiter\\screenshot2.png"
    tab.get_screenshot(screenshot_path)
    print(f"[OK] 截图已保存: {screenshot_path}")
except Exception as e:
    print(f"[ERROR] 截图失败: {e}")

print("\n" + "=" * 60)
print("测试完成")
print(f"当前URL: {tab.url}")
print("=" * 60)
