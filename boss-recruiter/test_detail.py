# -*- coding: utf-8 -*-
"""
DrissionPage 详细测试 - 尝试不同的导航方式
"""

import time
from DrissionPage import ChromiumPage, ChromiumOptions

print("=" * 60)
print("DrissionPage 详细测试")
print("=" * 60)

# 连接到已运行的Chrome
co = ChromiumOptions()
co.set_local_port(9222)

print("\n连接到Chrome (端口 9222)...")
try:
    page = ChromiumPage(co)
    print("[OK] 连接成功")
except Exception as e:
    print(f"[ERROR] 连接失败: {e}")
    exit(1)

print(f"\n当前URL: {page.url}")
print(f"页面标题: {page.title}")

# ============================================================
# 测试1: 检查页面结构
# ============================================================
print("\n" + "=" * 60)
print("测试1: 检查页面结构")
print("=" * 60)

# 查找导航链接
print("\n查找导航链接...")
nav_links = page.eles('css:a')
print(f"找到 {len(nav_links)} 个链接")

# 查找推荐牛人链接
recommend_links = page.eles('css:a[href*="recommend"]')
print(f"找到 {len(recommend_links)} 个包含'recommend'的链接")

for i, link in enumerate(recommend_links[:5]):
    try:
        href = link.attr('href')
        text = link.text
        print(f"  链接{i+1}: {text} -> {href}")
    except:
        pass

# ============================================================
# 测试2: 尝试点击导航
# ============================================================
print("\n" + "=" * 60)
print("测试2: 尝试点击导航到推荐牛人")
print("=" * 60)

# 查找"推荐牛人"链接
try:
    # 尝试多种选择器
    selectors = [
        'a[href*="recommend"]',
        'a:contains("推荐牛人")',
        'a:contains("牛人")',
    ]
    
    clicked = False
    for selector in selectors:
        try:
            link = page.ele(selector, timeout=2)
            if link:
                print(f"找到链接，尝试点击: {selector}")
                link.click()
                time.sleep(3)
                print(f"点击后URL: {page.url}")
                clicked = True
                break
        except:
            continue
    
    if not clicked:
        print("未找到推荐牛人链接，尝试其他方式...")
        
except Exception as e:
    print(f"点击导航失败: {e}")

# ============================================================
# 测试3: 使用JavaScript导航
# ============================================================
print("\n" + "=" * 60)
print("测试3: 使用JavaScript导航")
print("=" * 60)

try:
    print("执行: window.location.href = 'https://www.zhipin.com/web/geek/recommend'")
    page.run_js("window.location.href = 'https://www.zhipin.com/web/geek/recommend'")
    time.sleep(3)
    print(f"导航后URL: {page.url}")
    print(f"页面标题: {page.title}")
except Exception as e:
    print(f"JavaScript导航失败: {e}")

# ============================================================
# 测试4: 检查当前页面内容
# ============================================================
print("\n" + "=" * 60)
print("测试4: 检查当前页面内容")
print("=" * 60)

# 检查各种元素
selectors = {
    '.geek-item': '候选人卡片',
    '.recommend-card': '推荐卡片',
    '.job-card-wrapper': '职位卡片',
    '.chat-item': '聊天项',
    '.user-nav': '用户导航',
}

for selector, name in selectors.items():
    try:
        elements = page.eles(f'css:{selector}', timeout=2)
        if elements:
            print(f"  [OK] {name} ({selector}): {len(elements)} 个")
    except:
        pass

# ============================================================
# 测试5: 截图
# ============================================================
print("\n" + "=" * 60)
print("测试5: 截图保存")
print("=" * 60)

try:
    screenshot_path = "D:\\Desktop\\projects\\xiaohongshuWeb\\boss-recruiter\\screenshot.png"
    page.get_screenshot(screenshot_path)
    print(f"[OK] 截图已保存: {screenshot_path}")
except Exception as e:
    print(f"[ERROR] 截图失败: {e}")

print("\n" + "=" * 60)
print("测试完成")
print("=" * 60)
