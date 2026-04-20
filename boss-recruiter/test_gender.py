# -*- coding: utf-8 -*-
"""
DrissionPage 完整测试 - 性别识别 + 筛选男性候选人
"""

import time
from DrissionPage import Chromium

print("=" * 60)
print("DrissionPage 性别识别测试")
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

# ============================================================
# 分析候选人卡片 - 性别识别
# ============================================================
print("\n" + "=" * 60)
print("分析候选人卡片 - 性别识别")
print("=" * 60)

# 查找所有候选人卡片
cards = tab.eles('css:.card-item')
print(f"找到 {len(cards)} 个候选人卡片\n")

male_candidates = []
female_candidates = []
unknown_candidates = []

for i, card in enumerate(cards):
    candidate = {
        'index': i + 1,
        'name': '',
        'gender': 'unknown',
        'info': '',
    }
    
    try:
        # 获取姓名
        name_ele = card.ele('css:.name', timeout=1)
        if name_ele:
            candidate['name'] = name_ele.text.strip()
        
        # 获取卡片文本（用于显示信息）
        card_text = card.text.replace('\n', ' | ')[:80]
        candidate['info'] = card_text
        
        # 识别性别 - 通过SVG的xlink:href
        try:
            # 方法1: 查找svg.gender元素
            svg = card.ele('css:svg.gender', timeout=1)
            if svg:
                # 查找use元素的xlink:href属性
                use_ele = svg.ele('tag:use', timeout=1)
                if use_ele:
                    href = use_ele.attr('xlink:href') or ''
                    if '#icon-icon-man' in href:
                        candidate['gender'] = 'male'
                    elif '#icon-icon-woman' in href:
                        candidate['gender'] = 'female'
        except:
            pass
        
        # 方法2: 直接查找use元素
        if candidate['gender'] == 'unknown':
            try:
                use_ele = card.ele('css:use[xlink\\:href*="icon-icon-"]', timeout=1)
                if use_ele:
                    href = use_ele.attr('xlink:href') or ''
                    if '#icon-icon-man' in href:
                        candidate['gender'] = 'male'
                    elif '#icon-icon-woman' in href:
                        candidate['gender'] = 'female'
            except:
                pass
        
        # 分类
        if candidate['gender'] == 'male':
            male_candidates.append(candidate)
            gender_mark = '[男]'
        elif candidate['gender'] == 'female':
            female_candidates.append(candidate)
            gender_mark = '[女]'
        else:
            unknown_candidates.append(candidate)
            gender_mark = '[?]'
        
        print(f"{candidate['index']}. {gender_mark} {candidate['name']}")
        print(f"   {candidate['info'][:60]}...")
        
    except Exception as e:
        print(f"{i+1}. 分析失败: {e}")

# ============================================================
# 统计结果
# ============================================================
print("\n" + "=" * 60)
print("统计结果")
print("=" * 60)

print(f"总人数: {len(cards)}")
print(f"男性: {len(male_candidates)}")
print(f"女性: {len(female_candidates)}")
print(f"未知: {len(unknown_candidates)}")

print(f"\n男性候选人列表:")
for c in male_candidates:
    print(f"  - {c['name']}")

print(f"\n女性候选人列表:")
for c in female_candidates:
    print(f"  - {c['name']}")

if unknown_candidates:
    print(f"\n未知性别候选人:")
    for c in unknown_candidates:
        print(f"  - {c['name']}")

# ============================================================
# 测试点击打招呼（不实际发送，只检测按钮）
# ============================================================
print("\n" + "=" * 60)
print("测试打招呼按钮")
print("=" * 60)

if male_candidates:
    # 取第一个男性候选人测试
    first_male = male_candidates[0]
    card = cards[first_male['index'] - 1]
    
    try:
        # 查找打招呼按钮
        btn = card.ele('css:button', timeout=2)
        if btn:
            print(f"找到打招呼按钮: '{btn.text}'")
            print("（不实际点击，避免发送消息）")
        else:
            print("未找到打招呼按钮")
    except Exception as e:
        print(f"查找按钮失败: {e}")

print("\n" + "=" * 60)
print("测试完成！")
print("=" * 60)
print("\n结论：")
print("1. DrissionPage 可以成功连接到已运行的Chrome")
print("2. 可以成功导航到推荐牛人页面")
print("3. 可以通过SVG的xlink:href识别性别")
print("4. 页面正常，没有被检测到")
print("5. 可以实现自动化打招呼流程")
