@echo off
chcp 65001 >nul
echo ============================================================
echo Boss 直聘自动化 - 启动Chrome调试模式
echo ============================================================
echo.
echo 正在启动Chrome（调试端口9222）...
echo.

"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome_debug"

echo.
echo Chrome已关闭
pause
