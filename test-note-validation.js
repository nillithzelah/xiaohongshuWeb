const XiaohongshuService = require('./server/services/xiaohongshuService');

// 设置Cookie环境变量
process.env.XIAOHONGSHU_COOKIE = 'abRequestId=c7ff57cb-3eab-525c-94ff-31346019cf3e; a1=19b1fa5581arp96q4do2jogvmkhpqw9gnajck4xkq50000506606; webId=27630fea4a8db7edc6bb7bf2107520dd; gid=yjDyi02KYdIfyjDyi022Y04Cy0FUjKA4flJVVTAlkh6TxS28UAEjkT88828KK8K8q0WjDS2d; x-user-id-creator.xiaohongshu.com=692e89b9000000003201a590; customerClientId=102464056668731; access-token-creator.xiaohongshu.com=customer.creator.AT-68c517583925544884305924vlq0rwvac8uwttaq; galaxy_creator_session_id=CABvIkhWNtPfD1Ss9RoARo1G5Umex9zFxt3d; galaxy.creator.beaker.session.id=1765770266185050396757; xsecappid=xhs-pc-web; webBuild=5.3.0; unread={%22ub%22:%22694cf9db00000000220098a9%22%2C%22ue%22:%2269330275000000001e03b5b5%22%2C%22uc%22:28}; acw_tc=0a8f06d517667328017362188e091343389d203a2a66328d4c5b5184374a34; websectiga=2a3d3ea002e7d92b5c9743590ebd24010cf3710ff3af8029153751e41a6af4a3; sec_poison_id=ab9d002e-d086-43cc-b664-63a948774bf6; web_session=040069b961b2b066d66b8b7e7b3b4b27c56bb8; id_token=VjEAAD1LHb3h+OI6Fg9R0fTGkZlT0qY93DDyhAhCXLTsIwhzvWShOXeitmhAzUXMHxcCEwz356rAimthV1IaJTihRuT0z4PGGsxPr9HdO2blkw1fCAu+kIj4XtzqErmfYdYq6y7h; loadts=1766733552138';

async function testNoteValidation() {
  const noteUrl = 'https://www.xiaohongshu.com/explore/693e5d73000000001e00aab2?note_flow_source=wechat&xsec_token=CBdC1IAKDFifZngecxguDVTAbv8ozG8Bwc1B7Fwmo9750=';

  console.log('🧪 开始测试笔记验证...');
  console.log('📝 笔记链接:', noteUrl);

  try {
    // 1. 验证链接
    console.log('\n1️⃣ 验证链接有效性...');
    const validation = await XiaohongshuService.validateNoteUrl(noteUrl);
    console.log('验证结果:', JSON.stringify(validation, null, 2));

    if (!validation.valid) {
      console.log('❌ 链接验证失败');
      return;
    }

    // 2. 解析笔记内容
    console.log('\n2️⃣ 解析笔记内容...');
    const content = await XiaohongshuService.parseNoteContent(noteUrl);
    console.log('解析结果:', JSON.stringify(content, null, 2));

    // 3. 检查关键词
    console.log('\n3️⃣ 检查关键词...');
    const keywords = ['减肥被骗', '护肤被骗', '祛斑被骗', '丰胸被骗', '医美被骗', '白发转黑被骗', '手镯定制被骗'];
    const titleHasKeyword = keywords.some(kw => content.title?.includes(kw));
    const bodyHasKeyword = keywords.some(kw => content.bodyText?.includes(kw));
    const metaHasKeyword = keywords.some(kw => content.metaDesc?.includes(kw));

    console.log('关键词检查结果:');
    console.log('- 标题包含关键词:', titleHasKeyword);
    console.log('- 正文包含关键词:', bodyHasKeyword);
    console.log('- Meta描述包含关键词:', metaHasKeyword);
    console.log('- 关键词检查通过:', titleHasKeyword || bodyHasKeyword || metaHasKeyword);

    // 4. 验证完成
    console.log('\n4️⃣ 验证完成');
    console.log('基础验证结果: 通过');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testNoteValidation();