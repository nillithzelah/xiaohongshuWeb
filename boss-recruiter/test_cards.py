# -*- coding: utf-8 -*-
"""
DrissionPage 分析候选人卡片结构
"""

import time
from DrissionPage import Chromium

print("=" * 60)
print("DrissionPage 分析候选人卡片")
print("=" * 60)

# 连接到已运行的Chrome
browser = Chromium()
tab = browser.latest_tab

print(f"当前URL: {tab.url}")

# 确保在推荐牛人页面
if "recommend" not in tab.url:
    print("导航到推荐牛人页面...")
    ele = tab.ele('text:推荐牛人', timeout=3)
    if ele:
        ele.click()
        time.sleep(3)
    print(f"当前URL: {tab.url}")

# ============================================================
# 分析候选人卡片
# ============================================================
print("\n" + "=" * 60)
print("分析候选人卡片结构")
print("=" * 60)

# 查找所有候选人卡片
cards = tab.eles('css:.card-item')
print(f"找到 {len(cards)} 个候选人卡片")

# 分析前3个卡片的详细结构
for i, card in enumerate(cards[:3]):
    print(f"\n--- 候选人 {i+1} ---")
    
    try:
        # 尝试获取整个卡片的HTML（前500字符）
        html = card.html[:500] if card.html else "无HTML"
        print(f"HTML片段: {html[:200]}...")
        
        # 查找姓名
        name_selectors = ['.name', '.geek-name', '.user-name', 'h3', 'h4']
        for sel in name_selectors:
            try:
                name_ele = card.ele(f'css:{sel}', timeout=1)
                if name_ele and name_ele.text:
                    print(f"姓名 ({sel}): {name_ele.text}")
                    break
            except:
                pass
        
        # 查找职位
        job_selectors = ['.job-title', '.position', '.title', 'p']
        for sel in job_selectors:
            try:
                job_ele = card.ele(f'css:{sel}', timeout=1)
                if job_ele and job_ele.text:
                    print(f"职位 ({sel}): {job_ele.text}")
                    break
            except:
                pass
        
        # 查找公司
        company_selectors = ['.company', '.company-name', '.corp']
        for sel in company_selectors:
            try:
                company_ele = card.ele(f'css:{sel}', timeout=1)
                if company_ele and company_ele.text:
                    print(f"公司 ({sel}): {company_ele.text}")
                    break
            except:
                pass
        
        # 查找头像（检测性别）
        avatar_selectors = ['.avatar', '.avatar-wrap', '.user-avatar', 'img']
        for sel in avatar_selectors:
            try:
                avatar = card.ele(f'css:{sel}', timeout=1)
                if avatar:
                    class_name = avatar.attr('class') or ""
                    style = avatar.attr('style') or ""
                    print(f"头像 ({sel}): class={class_name}, style={style[:50]}")
                    break
            except:
                pass
        
        # 查找打招呼按钮
        btn_selectors = ['.start-chat-btn', '.greet-btn', 'button', '.btn']
        for sel in btn_selectors:
            try:
                btn = card.ele(f'css:{sel}', timeout=1)
                if btn:
                    print(f"按钮 ({sel}): {btn.text}")
                    break
            except:
                pass
        
        # 打印卡片内所有文本
        try:
            all_text = card.text
            print(f"所有文本: {all_text[:100]}...")
        except:
            pass
            
    except Exception as e:
        print(f"分析失败: {e}")

# ============================================================
# 尝试获取所有卡片的文本内容
# ============================================================
print("\n" + "=" * 60)
print("所有候选人概览")
print("=" * 60)

for i, card in enumerate(cards[:10]):
    try:
        text = card.text.replace('\n', ' | ')
        print(f"{i+1}. {text[:80]}...")
    except:
        pass

print("\n" + "=" * 60)
print("分析完成")
print("=" * 60)
