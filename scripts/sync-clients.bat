@echo off
REM 小红书审核客户端同步脚本 (Windows)
REM 功能：同步客户端代码到服务器（自动打包服务会自动创建 zip）

set SERVER=wubug
set REMOTE_DIR=/var/www/xiaohongshu-web/xiaohongshu-audit-clients

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 📦 小红书审核客户端同步脚本
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 💡 提示：服务器上的自动打包服务会在文件变化后自动生成 zip
echo.

REM 同步代码到服务器
echo 📤 同步代码到服务器...
echo.

REM audit-client
if exist "xiaohongshu-audit-clients\audit-client\index.js" (
  scp xiaohongshu-audit-clients\audit-client\index.js %SERVER%:%REMOTE_DIR%/audit-client/
  echo    ✅ audit-client 已同步
)

REM deletion-check-client
if exist "xiaohongshu-audit-clients\deletion-check-client\index.js" (
  scp xiaohongshu-audit-clients\deletion-check-client\index.js %SERVER%:%REMOTE_DIR%/deletion-check-client/
  if exist "xiaohongshu-audit-clients\deletion-check-client\services\" (
    scp xiaohongshu-audit-clients\deletion-check-client\services\*.js %SERVER%:%REMOTE_DIR%/deletion-check-client/services/
  )
  echo    ✅ deletion-check-client 已同步
)

REM deletion-recheck-client
if exist "xiaohongshu-audit-clients\deletion-recheck-client\index.js" (
  scp xiaohongshu-audit-clients\deletion-recheck-client\index.js %SERVER%:%REMOTE_DIR%/deletion-recheck-client/
  if exist "xiaohongshu-audit-clients\deletion-recheck-client\services\" (
    scp xiaohongshu-audit-clients\deletion-recheck-client\services\*.js %SERVER%:%REMOTE_DIR%/deletion-recheck-client/services/
  )
  echo    ✅ deletion-recheck-client 已同步
)

REM discovery-client
if exist "xiaohongshu-audit-clients\discovery-client\index.js" (
  scp xiaohongshu-audit-clients\discovery-client\index.js %SERVER%:%REMOTE_DIR%/discovery-client/
  if exist "xiaohongshu-audit-clients\discovery-client\services\" (
    scp xiaohongshu-audit-clients\discovery-client\services\*.js %SERVER%:%REMOTE_DIR%/discovery-client/services/
  )
  echo    ✅ discovery-client 已同步
)

REM harvest-client
if exist "xiaohongshu-audit-clients\harvest-client\index.js" (
  scp xiaohongshu-audit-clients\harvest-client\index.js %SERVER%:%REMOTE_DIR%/harvest-client/
  if exist "xiaohongshu-audit-clients\harvest-client\services\" (
    scp xiaohongshu-audit-clients\harvest-client\services\*.js %SERVER%:%REMOTE_DIR%/harvest-client/services/
  )
  echo    ✅ harvest-client 已同步
)

REM blacklist-scan-client
if exist "xiaohongshu-audit-clients\blacklist-scan-client\index.js" (
  scp xiaohongshu-audit-clients\blacklist-scan-client\index.js %SERVER%:%REMOTE_DIR%/blacklist-scan-client/
  if exist "xiaohongshu-audit-clients\blacklist-scan-client\services\" (
    scp xiaohongshu-audit-clients\blacklist-scan-client\services\*.js %SERVER%:%REMOTE_DIR%/blacklist-scan-client/services/
  )
  echo    ✅ blacklist-scan-client 已同步
)

REM short-link-client
if exist "xiaohongshu-audit-clients\short-link-client\index.js" (
  scp xiaohongshu-audit-clients\short-link-client\index.js %SERVER%:%REMOTE_DIR%/short-link-client/
  if exist "xiaohongshu-audit-clients\short-link-client\services\" (
    scp xiaohongshu-audit-clients\short-link-client\services\*.js %SERVER%:%REMOTE_DIR%/short-link-client/services/
  )
  echo    ✅ short-link-client 已同步
)

REM shared (最后同步，因为其他客户端依赖它)
if exist "xiaohongshu-audit-clients\shared\" (
  scp -r xiaohongshu-audit-clients\shared\* %SERVER%:%REMOTE_DIR%/shared/
  echo    ✅ shared 已同步
)

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ✅ 同步完成！自动打包服务正在生成 zip...
echo 🔗 下载地址: https://www.wubug.cc/downloads/xiaohongshu-audit-clients.zip
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

pause
