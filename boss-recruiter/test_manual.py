# -*- coding: utf-8 -*-
"""
手动导航测试 - 用户手动操作，脚本只检测状态
"""

import time
from DrissionPage import ChromiumPage, ChromiumOptions

# 配置浏览器
co = ChromiumOptions()
co.set_argument('--disable-blink-features=AutomationControlled')
co.set_argument('--disable-infobars')
co.set_argument('--start-maximized')
co.set_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

print("正在启动浏览器...")
page = ChromiumPage(co)

print("正在打开Boss直聘...")
page.get("https://www.zhipin.com")

print("=" * 60)
print("请手动完成以下操作：")
print("1. 扫码登录")
print("2. 导航到「推荐牛人」页面")
print("3. 确认页面正常显示候选人列表")
print("=" * 60)
print("完成后，按回车键开始检测...")
print("=" * 60)

input()

# 检测当前状态
print("\n" + "=" * 60)
print("开始检测页面状态...")
print("=" * 60)

print(f"\n当前URL: {page.url}")
print(f"页面标题: {page.title}")

# 检测候选人卡片的多种选择器
selectors = [
    '.recommend-card',
    '.job-card-wrapper',
    '.job-card-left',
    '[ka="search-job-item"]',
    '.search-job-result',
    '.job-list-box',
]

print("\n尝试多种选择器查找候选人卡片...")
for selector in selectors:
    try:
        elements = page.eles(f'css:{selector}', timeout=2)
        if elements:
            print(f"  ✅ {selector}: 找到 {len(elements)} 个元素")
        else:
            print(f"  ❌ {selector}: 未找到")
    except Exception as e:
        print(f"  ❌ {selector}: 错误 - {e}")

# 检测是否被反爬
print("\n检测反爬状态...")
if "web/user" in page.url:
    print("  ⚠️ 在登录页面")
elif "about:blank" in page.url or "chrome://" in page.url:
    print("  ⚠️ 页面异常")
else:
    print("  ✅ URL正常")

# 检查页面内容
try:
    page_text = page.html[:500] if page.html else ""
    if "安全限制" in page_text or "访问频繁" in page_text:
        print("  ⚠️ 检测到频率限制关键词")
    else:
        print("  ✅ 未检测到频率限制")
except:
    print("  ❌ 无法读取页面内容")

print("\n" + "=" * 60)
print("检测完成。")
print("=" * 60)
print("按回车键关闭浏览器...")
input()

page.quit()
