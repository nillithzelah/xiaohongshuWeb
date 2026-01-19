/**
 * 小红书 Cookie 配置
 *
 * 更新说明：
 * 1. 从浏览器获取新 Cookie（F12 → Network → Request Headers → Cookie）
 * 2. 必须包含的字段：a1, web_session, id_token, loadts
 * 3. loadts 是13位时间戳，自动更新为当前时间
 * 4. 更新后同步到服务器并重启服务
 */

module.exports = {
  // Cookie 更新时间
  updatedAt: new Date('2026-01-08T09:08:55+08:00').toISOString(),

  // Cookie 内容
  value: 'abRequestId=c7ff57cb-3eab-525c-94ff-31346019cf3e; a1=19b1fa5581arp96q4do2jogvmkhpqw9gnajck4xkq50000506606; webId=27630fea4a8db7edc6bb7bf2107520dd; gid=yjDyi02KYdIfyjDyi022Y04Cy0FUjKA4flJVVTAlkh6TxS28UAEjkT88828KK8K8q0WjDS2d; x-user-id-creator.xiaohongshu.com=692e89b9000000003201a590; customerClientId=102464056668731; access-token-creator.xiaohongshu.com=customer.creator.AT-68c517583925544884305924vlq0rwvac8uwttaq; galaxy_creator_session_id=CABvIkhWNtPfD1Ss9RoARo1G5Umex9zFxt3d; galaxy.creator.beaker.session.id=1765770266185050396757; xsecappid=xhs-pc-web; unread={%22ub%22:%22693adc4e000000001e00ce08%22%2C%22ue%22:%22695ca8d8000000001a02cb8e%22%2C%22uc%22:25}; webBuild=5.6.5; web_session=040069b961b2b066d66ba5006b3b4b9db29cc4; id_token=VjEAAJQ+D0cFi9qvcq33Okbl5MYFTagTnfrGWgrAxlUZADWpOiLcVYie6F9P8PPFTll+6rgm8FqQrPyXaawR1CNaALy/RFkI0ICSBMuYxP+9UFn/+meSUUwRTN6LsF1XSo5Eydjv; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=f637627f-7371-4e75-a0a9-da484627af66; loadts=1767834535090',

  // Cookie 获取时间戳（用于判断是否过期）
  loadts: 1767834535090,

  // Cookie 预计有效期（小时）
  estimatedExpiry: 72,

  /**
   * 检查 Cookie 是否需要更新
   * @returns {boolean}
   */
  needsUpdate() {
    const ageHours = (Date.now() - this.loadts) / (1000 * 60 * 60);
    return ageHours > this.estimatedExpiry * 0.8; // 提前20%提示更新
  },

  /**
   * 获取 Cookie 年龄（小时）
   * @returns {number}
   */
  getAgeHours() {
    return Math.floor((Date.now() - this.loadts) / (1000 * 60 * 60));
  }
};
