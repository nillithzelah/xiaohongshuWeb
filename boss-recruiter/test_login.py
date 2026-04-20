# -*- coding: utf-8 -*-
"""
简单登录测试 - 不会自动关闭浏览器
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

print("正在打开Boss直聘登录页面...")
page.get("https://www.zhipin.com/web/user/?ka=header-login")

print("=" * 50)
print("请在浏览器中扫码登录")
print("登录成功后，按回车键继续...")
print("=" * 50)

# 等待用户输入
input()

# 检查当前状态
print(f"\n当前URL: {page.url}")
print(f"页面标题: {page.title}")

# 检查登录状态
try:
    avatar = page.ele('css:.user-nav', timeout=2)
    if avatar:
        print("✅ 检测到用户头像，登录成功")
    else:
        print("❌ 未检测到用户头像")
except:
    print("❌ 未找到用户头像元素")

# 尝试访问推荐牛人页面
print("\n尝试访问推荐牛人页面...")
page.get("https://www.zhipin.com/web/geek/recommend")
time.sleep(3)

print(f"当前URL: {page.url}")
print(f"页面标题: {page.title}")

# 检查是否有候选人卡片
try:
    cards = page.eles('css:.recommend-card', timeout=5)
    print(f"找到 {len(cards)} 个候选人卡片")
except:
    print("未找到候选人卡片")

# 检查页面是否有异常
if "web/user" in page.url:
    print("⚠️ 被重定向到登录页面，可能被检测到")
elif "about:blank" in page.url or "chrome://" in page.url:
    print("⚠️ 页面异常，可能被检测到")
else:
    print("✅ 页面正常")

print("\n" + "=" * 50)
print("测试完成。按回车键关闭浏览器...")
print("=" * 50)
input()

page.quit()
