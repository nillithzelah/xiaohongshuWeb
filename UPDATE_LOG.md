# UPDATE_LOG

## 2026-01-02 17:07:00
- **设备删除**: 额外删除了accountName为"浅f0t"的设备，该设备状态为online/approved，已分配给用户ObjectId("695786bd8d3afc51102ec6eb")
- **设备删除**: 真实删除了accountName为"14757189744"的设备，该设备状态为online/pending，assignedUser为null
- **用户状态恢复**: 将手机号14757189744的兼职用户状态从已删除恢复为正常状态，清除删除时间和删除者信息，用户现在可以正常使用系统
- **数据库更新**: 将所有审核状态为null（空白）的设备更新为"approved"状态，共更新14个设备，现在所有设备都有有效的审核状态，可以在小程序中正常显示
- **服务器执行**: 在服务器上执行数据库更新脚本，审核状态分布从 (null:14, approved:3, rejected:1, pending:1) 更新为 (approved:17, pending:2, rejected:1)，设备总数从18个减少到16个

## 2026-01-02 15:40:00
- **server/services/asyncAiReviewService.js**: 修复 CommentLimit 数据无法创建的问题：当 `userNoteInfo.author` 是字符串格式时，代码没有将其赋值给 `authorToRecord`，导致评论限制无法记录。修复方案：添加对字符串格式 author 的支持，同时支持逗号分隔的多个昵称（取第一个）
- **server/services/continuousCheckService.js**: 修复持续检查服务中积分更新错误：当用户points字段为undefined时，MongoDB的$inc操作会失败。修复方案：改为使用$set操作，确保积分字段有效后再更新
- **部署到服务器**: 将修复后的 asyncAiReviewService.js 和 continuousCheckService.js 同步到服务器并重启 xiaohongshu-api 服务

## 2026-01-02 14:06:00
- **server/models/*.js**: 修改所有模型中的 createdAt 和 updatedAt 默认值为北京时间函数，确保数据库中存储的创建和更新时间使用北京时间而非UTC时间
- **server/services/asyncAiReviewService.js**: 修复审核延迟逻辑中的时间计算问题，统一使用北京时间进行时间差计算，避免 createdAt（北京时间）与 Date.now()（UTC时间）混合导致的延迟计算错误；修复评论审核通过后评论限制记录失败的问题，优先使用评论验证找到的作者，其次使用用户提交的作者，确保 commentlimits 表能正确记录评论限制信息；修复评论限制检查逻辑，支持字符串和数组格式的作者信息，避免因数据格式不匹配导致评论限制失效
- **server/services/CommentVerificationService.js**: 改进评论验证服务的作者查找逻辑，添加三种查找方法：1) 容器查找，2) 向上查找，3) 位置配对，确保能准确获取评论作者昵称，避免评论限制检查失效
- **部署到服务器**: 将修改后的模型文件和修复后的审核服务同步到服务器 /var/www/xiaohongshu-web/server/models/ 和 /var/www/xiaohongshu-web/server/services/ 并重启 xiaohongshu-api 服务，新的数据创建将使用北京时间，审核延迟逻辑已修复，评论验证服务已优化，评论限制记录已修复

## 2026-01-02 13:02:00
- **server/models/SubmissionTracker.js**: 同步到服务器，用于跟踪昵称在笔记链接下的评论提交次数和内容
- **server/routes/client.js**: 同步到服务器，实现评论昵称限制功能：一个昵称在一个笔记链接下最多只能发两条评论，且评论内容不能完全一样
- **部署到服务器**: 将评论限制功能相关文件同步到服务器并重启 xiaohongshu-api 服务，功能现已生效

## 2026-01-02 11:58:45
- **server/utils/timeUtils.js**: 修复formatBeijingTime方法中的时区转换问题，移除手动加8小时的逻辑，直接使用toLocaleString的timeZone参数，避免双重时区转换导致时间快8小时的问题

## 2026-01-02 11:58:51
- **server/routes/client.js**: 实现评论昵称限制功能，一个昵称在一个笔记链接下最多只能发两条评论：1) 修改防作弊检查逻辑，只对评论类型生效；2) 在评论任务成功提交后自动更新SubmissionTracker计数；3) 添加详细的日志记录和错误处理；4) 创建测试脚本验证功能正确性
- **test-comment-limit.js**: 创建评论限制功能测试脚本，验证昵称在链接下的评论次数限制是否正常工作

## 2026-01-02 11:58:01
- **miniprogram/pages/index/index.wxml**: 修改设备审核状态显示，当状态未知时显示"审核中"而不是"未知状态"

## 2026-01-02 11:57:16
- **miniprogram/pages/index/index.wxml**: 修复设备审核状态卡片中提交时间显示问题，移除不必要的字符串处理，直接显示API返回的格式化时间字符串

## 2026-01-02 11:53:48
- **miniprogram/pages/upload/upload.wxml**: 在上传页面的账号列表中添加昵称限制状态显示，与设备列表页面保持一致，显示昵称7天使用限制的剩余天数和状态

## 2026-01-02 11:44:00
- **server/services/asyncAiReviewService.js**: 修复昵称7天使用限制检查未生效的问题：1) 添加回退机制，当AI解析昵称失败时使用用户提交的昵称进行检查；2) 确保昵称清理逻辑在检查时与保存时保持一致；3) 增加详细的调试日志，帮助排查昵称限制问题；4) 优化错误信息，提供更清晰的限制触发提示
- **部署到服务器**: 将修复后的 asyncAiReviewService.js 同步到服务器并重启 xiaohongshu-api 服务，昵称7天检查功能现已生效

## 2026-01-02 13:48:00
- **server/routes/client.js**: 修改评论审核昵称获取逻辑，只使用AI匹配到的昵称，不再fallback到用户提交的昵称数组第一个元素，确保审核输出只基于实际匹配结果
- **部署到服务器**: 将修改后的 server/routes/client.js 同步到服务器 wubug 并重启 xiaohongshu-api 服务

## 2026-01-02 11:38:00
- **miniprogram/pages/index/index.wxml**: 修复设备审核状态卡片中设备昵称显示问题，当accountName为空时显示"未知设备"而不是空白
- **server/routes/client.js**: 在 `/devices/my-review-status` API中添加accountName安全处理，确保返回数据中accountName字段不为空

## 2026-01-02 11:03:00
- **server/routes/client.js**: 修改 `/device/my-list` API，只返回审核通过的设备（reviewStatus 为 'ai_approved' 或 'approved'），防止审核中的设备出现在小程序上传页面
- **server/services/asyncAiReviewService.js**: 修改AI审核服务中的设备获取逻辑，只使用审核通过的设备昵称进行评论验证，防止审核中的设备昵称被错误加入验证列表
- **部署到服务器**: 将设备状态过滤修改同步到服务器并重启 xiaohongshu-api 服务

## 2026-01-02 11:24:00
- **server/services/asyncAiReviewService.js**: 修改7天昵称使用限制的错误信息，从"昵称"xxx"在7天内已经被使用过"改为更清晰的"风控提示：昵称"xxx"在7天内已被使用，无法重复提交审核"
- **server/services/asyncAiReviewService.js**: 修复7天昵称限制生效问题，当AI解析的作者为空时，使用用户提交的作者信息进行检查，添加调试日志确保限制正常工作
- **部署到服务器**: 将7天昵称限制修复同步到服务器并重启 xiaohongshu-api 服务

## 2026-01-02 10:26:00
- **server/services/asyncAiReviewService.js**: 修复评论审核重试决策逻辑，解决评论不存在时仍错误重试的问题：1) 修正评论审核中评论不存在、关键词检查失败、评论验证错误时的重试判断，添加reviewAttempt < 2检查；2) 统一评论和笔记的关键词检查重试逻辑，使用shouldRetryReview方法；3) 修复笔记审核关键词检查逻辑，添加重试次数限制；4) 确保所有审核类型都正确遵循重试决策规则；5) 创建测试脚本验证修复效果
- **test-comment-audit-fix.js**: 创建评论审核重试决策测试脚本，验证所有重试决策逻辑是否正确工作
- **server/services/asyncAiReviewService.js**: 优化笔记审核拒绝原因，提供更具体的匹配失败信息：作者不匹配、标题不匹配，或两者都不匹配
- **部署到服务器**: 将优化后的 asyncAiReviewService.js 同步到服务器并重启 xiaohongshu-api 服务

## 2026-01-02 10:05:00
- **server/services/asyncAiReviewService.js**: 修复系统错误重试时的死循环问题，在重试前正确更新数据库中的 reviewAttempt 计数器，防止无限重试循环，确保审核任务在达到最大重试次数后能正确终止

## 2026-01-02 10:19:00
- **server/services/CommentVerificationService.js**: 优化评论验证功能，解决正确评论被误判为虚假提交的问题：1) 更新CSS选择器以适应小红书最新页面结构；2) 改进评论加载逻辑，增加智能滚动和"查看更多"按钮点击；3) 放宽内容匹配策略，从完全一致改为允许小差异（95%相似度+关键词匹配）；4) 增强错误信息和调试输出

## 2026-01-02 09:33:00
- **miniprogram/pages/device-list/device-list.wxml**: 添加设备状态 'reviewing' 的显示支持，修复设备列表中不显示"审核中"状态的问题

## 2026-01-02 09:41:00
- **miniprogram/pages/index/index.js**: 修复设备审核状态API路径，从 `/xiaohongshu/api/devices/my-review-status` 修正为 `/xiaohongshu/api/client/devices/my-review-status`，解决403错误

## 2026-01-02 09:52:00
- **delete-device-by-name.js**: 创建数据库删除脚本，成功删除昵称为 "Yuki是斜刘海" 的设备（ID: 6954919cfde1a88d6d4dae4b），该设备状态为 reviewing/rejected

## 2026-01-02 01:35:00
- **test-note-validation.js**: 创建笔记验证测试脚本，测试链接有效性、内容解析和关键词检查
- **test-full-review.js**: 创建完整审核流程测试脚本，模拟审核逻辑和匹配检查

## 2026-01-02 01:36:00
- **server/services/xiaohongshuService.js**: 修改 parseNoteContent 和 checkNotePage 方法，添加 Cookie 支持以提高内容解析准确性
- **test-note-validation.js**: 添加 Cookie 环境变量设置，用于测试登录状态下的内容解析

## 2026-01-02 01:40:00
- **server/services/xiaohongshuService.js**: 重构审核架构，移除 performAIReview 方法，简化 validateNoteUrl 只返回基础验证结果，避免审核逻辑分散
- **test-note-validation.js**: 更新测试脚本，移除对已删除 performAIReview 方法的调用

## 2026-01-02 01:43:00
- **部署到服务器**: 将修改后的 xiaohongshuService.js 同步到服务器并重启 xiaohongshu-api 服务

## 2026-01-02 01:46:00
- **server/services/asyncAiReviewService.js**: 修复评论审核重试逻辑，当第一次审核因错误失败时返回 { needsRetry: true } 而不是 undefined，避免第二次审核时出现 "Cannot read properties of undefined (reading passed)" 错误
- **部署到服务器**: 将修复后的 asyncAiReviewService.js 同步到服务器并重启服务

## 2026-01-02 01:48:00
- **server/services/asyncAiReviewService.js**: 修复 processReview 方法，正确处理 { needsRetry: true } 返回值，避免将其传递给 updateReviewWithAiResult 导致 undefined 错误
- **部署到服务器**: 将最终修复后的 asyncAiReviewService.js 同步到服务器并重启服务

## 2026-01-02 02:00:00
- **server/services/asyncAiReviewService.js**: 优化AI审核流程，提高并发数从2到5，添加智能重试逻辑基于失败原因，改进错误处理和异常恢复机制，添加熔断器保护
- **server/services/xiaohongshuService.js**: 增强关键词检查算法，支持模糊匹配和权重计算，提供更智能的内容匹配
- **server/test-error-handling.js**: 创建错误处理机制测试脚本，验证熔断器和错误分类功能
- **server/test-full-audit-flow.js**: 创建完整审核流程测试脚本，在服务器上验证所有优化功能
- **部署到服务器**: 将优化后的代码同步到服务器并重启 xiaohongshu-api 服务
- **测试结果**: ✅ 核心功能测试全部通过 - 并发数提升、关键词检查算法、错误分类系统、熔断器逻辑、智能重试决策都工作正常