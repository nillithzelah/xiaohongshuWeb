# -*- coding: utf-8 -*-
"""
DrissionPage 连接到已运行的Chrome浏览器
"""

import time
from DrissionPage import ChromiumPage, ChromiumOptions

print("=" * 60)
print("DrissionPage 连接到已运行的Chrome")
print("=" * 60)

# 配置连接到已运行的Chrome
co = ChromiumOptions()
co.set_local_port(9222)  # 连接到端口9222

print("\n正在连接到Chrome (端口 9222)...")

try:
    page = ChromiumPage(co)
    print("[OK] 连接成功！")
except Exception as e:
    print(f"[ERROR] 连接失败: {e}")
    print("\n请确保Chrome已用以下命令启动：")
    print('chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\\temp\\chrome_debug"')
    exit(1)

# 显示当前页面信息
print(f"\n当前URL: {page.url}")
print(f"页面标题: {page.title}")

# 如果在Boss直聘，尝试操作
if "zhipin.com" in page.url:
    print("\n[OK] 检测到Boss直聘页面")
    
    # 检查登录状态
    try:
        user_nav = page.ele('css:.user-nav', timeout=2)
        if user_nav:
            print("[OK] 已登录")
        else:
            print("[WARN] 未登录，请先在浏览器中登录")
    except:
        print("[WARN] 未登录，请先在浏览器中登录")
    
    # 尝试访问推荐牛人页面
    print("\n尝试访问推荐牛人页面...")
    page.get("https://www.zhipin.com/web/geek/recommend")
    time.sleep(3)
    
    print(f"当前URL: {page.url}")
    print(f"页面标题: {page.title}")
    
    # 检查是否有候选人卡片
    selectors = [
        '.recommend-card',
        '.job-card-wrapper',
        '.geek-item',
        '[ka="search-geek-item"]',
    ]
    
    print("\n查找候选人卡片...")
    for selector in selectors:
        try:
            elements = page.eles(f'css:{selector}', timeout=2)
            if elements:
                print(f"  [OK] {selector}: 找到 {len(elements)} 个")
        except:
            pass
    
    # 检查是否被检测
    if "about:blank" in page.url or "chrome://" in page.url:
        print("\n[WARN] 页面异常，可能被检测到")
    elif "web/user" in page.url:
        print("\n[WARN] 被重定向到登录页")
    else:
        print("\n[OK] 页面正常")

print("\n" + "=" * 60)
print("测试完成。浏览器保持打开，你可以继续操作。")
print("=" * 60)
