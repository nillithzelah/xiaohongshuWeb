# -*- coding: utf-8 -*-
"""
测试打招呼 - 查看打招呼结果
"""

import time
from DrissionPage import Chromium

print("=" * 60)
print("测试打招呼")
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
print(f"找到 {len(cards)} 个候选人卡片")

# 测试对前3个候选人打招呼
print("\n" + "=" * 60)
print("测试打招呼（前3个候选人）")
print("=" * 60)

for i, card in enumerate(cards[:3]):
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
        
        print(f"\n{i+1}. [{gender}] {name}")
        
        # 查找打招呼按钮
        btn = card.ele('css:button', timeout=2)
        if btn:
            btn_text = btn.text if btn.text else ""
            print(f"   按钮文本: {btn_text}")
            
            # 尝试点击
            print(f"   尝试点击...")
            btn.click()
            time.sleep(2)
            
            # 检查点击后的状态
            print(f"   点击后URL: {tab.url}")
            
            # 检查是否有弹窗或提示
            try:
                # 检查是否已经打过招呼
                if "已打招呼" in tab.text or "继续沟通" in tab.text:
                    print(f"   结果: 已经打过招呼了")
                else:
                    print(f"   结果: 打招呼成功")
            except:
                print(f"   结果: 未知")
        else:
            print(f"   未找到按钮")
            
    except Exception as e:
        print(f"{i+1}. 处理失败: {e}")

print("\n" + "=" * 60)
print("测试完成")
print("=" * 60)
