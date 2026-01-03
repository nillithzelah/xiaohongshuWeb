# 服务器运维与 AI 行为准则

## 1. 日志与监控 (防止卡死)
- 严禁执行 'pm2 logs'，该命令是持续流，会导致 Agent 超时卡死。
- 查看日志必须使用 'tail -n' 直接读取文件。
- 默认日志路径：~/.pm2/logs/xiaohongshu-api-out.log
- 常用查询：ssh wubug "tail -n 50 ~/.pm2/logs/xiaohongshu-api-out.log"

## 2. 部署与同步
- 服务器别名统一使用 'wubug'。
- 严禁将本地 .env 文件推送到服务器，以免破坏生产环境数据库连接。
- 后端代码修改后，必须同步服务器。
- 后端代码同步后，必须执行 'pm2 restart xiaohongshu-api'。
- 严禁使用 'scp 文件名 root@IP:/path' 格式，统一使用 'scp 文件名 wubug:/path' 格式。
- 前端部署路径：`/var/www/xiaohongshu-web/admin/public`

## 3. 数据库安全 (MongoDB)
- 在执行任何破坏性数据库脚本前，必须先运行 mongodump 备份。
- 使用 MCP 访问数据库时，严禁执行 'dropDatabase' 或 'dropCollection'。
- 所有的查询操作默认必须带上 limit(100) 限制。

## 4. 故障排查
- 如果请求返回 405 或 502，优先检查 pm2 进程是否存活 (pm2 list) 而非盲目修改 Nginx。
- 如果前端白屏显示 %PUBLIC_URL%，说明 Nginx 指向了源码目录而非 build 目录，引导用户执行 build 并检查 Nginx alias。

- 严禁在涉及积分、金额计算时直接使用浮点数加减。
- 所有金额计算必须先乘以 100 转为整数，计算完成后再除以 100。

- 在安装任何新的 npm 依赖包前，必须先询问用户并说明理由。
- 优先搜索项目内已有的 utils 或 services 文件夹，复用现有逻辑(如 XiaohongshuService)，禁止重复造轮子。

- 后端所有异步操作必须包裹在 try-catch 中。
- catch 块内严禁只写 console.error(err)，必须返回符合项目规范的 JSON 错误响应 {success: false, message: "..."}。

- 每次成功修改代码并保存后，自动在 root 目录下的 UPDATE_LOG.md 中记录本次改动的时间、文件和核心功能点。

## 5. 前端开发规范 (React/Vue)
- 组件命名使用 PascalCase，文件使用 kebab-case。
- 所有异步请求必须使用项目内的 request 工具类，禁止直接使用 fetch 或 axios。
- 状态管理优先使用 Vuex/Pinia 或 React Context，禁止在组件内大量使用 useState。
- 图片上传必须使用项目内的 upload 服务，禁止直接调用 OSS API。

## 6. 小程序开发规范
- 所有页面必须在 app.json 中注册。
- 网络请求必须使用 wx.request 封装，禁止使用第三方库。
- 敏感数据如 token 必须存储在 wx.getStorageSync 中，禁止明文存储。
- 页面跳转使用 wx.navigateTo，复杂逻辑使用 wx.redirectTo。

## 7. 代码质量与测试
- 所有新功能必须编写单元测试 (Jest/Mocha)。
- 代码提交前必须运行 ESLint 和 Prettier 检查。
- 禁止使用 console.log 在生产代码中，必须使用项目日志工具。
- 变量命名使用 camelCase，常量使用 UPPER_SNAKE_CASE。

## 8. 安全规范
- 所有用户输入必须进行校验和转义，防止 XSS 攻击。
- API 接口必须验证用户权限，禁止越权访问。
- 密码存储必须使用 bcrypt 哈希，禁止明文存储。
- 敏感配置如数据库密码必须使用环境变量，禁止硬编码。

## 分佣逻辑安全
- 在计算佣金（commission_1, commission_2）时，必须设置封顶上限，防止由于逻辑错误导致的"积分无限裂变"。
- 严禁在循环（Loop）里执行 User.save() 这种累加操作，必须先在内存中算好最终值，最后一次性更新数据库。
- 所有的分润逻辑必须在数据库事务（Transaction）中运行，确保上级加钱和任务完成状态是同步发生的

- 如果连续 3 次尝试失败，必须停止操作并询问用户原因，严禁盲目重试。

## 9. PM2 进程管理
- 所有后端服务必须通过 PM2 管理，使用配置文件 ecosystem.config.js。
- 配置文件位置：`/var/www/xiaohongshu-web/ecosystem.config.js`
- 启动服务：`pm2 start ecosystem.config.js`
- 重启服务：`pm2 restart xiaohongshu-api`
- 查看进程：`pm2 list`
- 严禁直接使用 node 命令启动生产服务。

## 10. 环境变量管理
- 所有敏感配置必须通过环境变量设置，禁止硬编码。
- 服务器环境变量在 ecosystem.config.js 中配置。
- 本地开发使用 .env 文件，但严禁推送到服务器。
- 环境变量包括：数据库连接、OSS配置、JWT密钥等。

## 11. 服务器监控与维护
- 定期检查服务器磁盘使用率，避免空间不足。
- 监控 PM2 进程状态，确保服务正常运行。
- 日志文件定期轮转，防止日志文件过大。
- 服务器备份：重要数据变更前必须备份数据库和配置文件。

## 12. 代码部署规范
- 部署前必须在本地测试通过。
- 部署后验证服务状态和日志。
- 大版本更新前，创建服务器快照备份。
