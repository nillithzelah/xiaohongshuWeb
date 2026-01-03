// 设置环境变量脚本
const fs = require('fs');
const path = require('path');

// 真实的Cookie
const cookie = 'abRequestId=c7ff57cb-3eab-525c-94ff-31346019cf3e; a1=19b1fa5581arp96q4do2jogvmkhpqw9gnajck4xkq50000506606; webId=27630fea4a8db7edc6bb7bf2107520dd; gid=yjDyi02KYdIfyjDyi022Y04Cy0FUjKA4flJVVTAlkh6TxS28UAEjkT88828KK8K8q0WjDS2d; x-user-id-creator.xiaohongshu.com=692e89b9000000003201a590; customerClientId=102464056668731; access-token-creator.xiaohongshu.com=customer.creator.AT-68c517583925544884305924vlq0rwvac8uwttaq; galaxy_creator_session_id=CABvIkhWNtPfD1Ss9RoARo1G5Umex9zFxt3d; galaxy.creator.beaker.session.id=1765770266185050396757; xsecappid=xhs-pc-web; webBuild=5.3.0; unread={%22ub%22:%22694cf9db00000000220098a9%22%2C%22ue%22:%2269330275000000001e03b5b5%22%2C%22uc%22:28}; acw_tc=0a8f06d517667328017362188e091343389d203a2a66328d4c5b5184374a34; websectiga=2a3d3ea002e7d92b5c9743590ebd24010cf3710ff3af8029153751e41a6af4a3; sec_poison_id=ab9d002e-d086-43cc-b664-63a948774bf6; web_session=040069b961b2b066d66b8b7e7b3b4b27c56bb8; id_token=VjEAAD1LHb3h+OI6Fg9R0fTGkZlT0qY93DDyhAhCXLTsIwhzvWShOXeitmhAzUXMHxcCEwz356rAimthV1IaJTihRuT0z4PGGsxPr9HdO2blkw1fCAu+kIj4XtzqErmfYdYq6y7h; loadts=1766733552138';

// 设置环境变量
process.env.XIAOHONGSHU_COOKIE = cookie;

console.log('✅ Cookie环境变量已设置');
console.log('Cookie值:', cookie.substring(0, 100) + '...');

// 验证设置
console.log('环境变量验证:', process.env.XIAOHONGSHU_COOKIE ? '✅ 已设置' : '❌ 未设置');