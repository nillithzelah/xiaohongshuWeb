@echo off
chcp 65001 >nul
title 小红书客户端依赖安装

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║   小红书客户端依赖安装脚本                                    ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM 检查 Node.js 是否安装
echo [1/5] 检查 Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   ❌ 未检测到 Node.js
    echo.
    echo   请先安装 Node.js: https://nodejs.org/
    echo   安装后重新运行此脚本
    echo.
    pause
    exit /b 1
)
echo   ✅ Node.js 已安装:
node --version
echo.

REM 设置镜像源（加速国内下载）
echo [2/5] 配置 npm 镜像源...
call npm config set registry https://registry.npmmirror.com
echo   ✅ 镜像源已设置为: https://registry.npmmirror.com
echo.

REM 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM 安装共享模块依赖
echo [3/5] 安装共享模块 (shared)...
if exist "shared" (
    cd /d "%SCRIPT_DIR%\shared"
    if not exist "node_modules" (
        echo   📦 正在安装 shared 依赖...
        call npm install
        if %errorlevel% neq 0 (
            echo   ❌ shared 依赖安装失败
            pause
            exit /b 1
        )
        echo   ✅ shared 依赖安装完成
    ) else (
        echo   ✅ shared 依赖已存在，跳过
    )
) else (
    echo   ⚠️  shared 目录不存在
)
echo.

REM 安装各客户端依赖
echo [4/5] 安装客户端依赖...
echo.

if exist "harvest-client" (
    echo   [1/3] 📦 安装 harvest-client...
    cd /d "%SCRIPT_DIR%\harvest-client"
    if not exist "node_modules" (
        call npm install
        if %errorlevel% neq 0 (
            echo   ❌ harvest-client 安装失败
            pause
            exit /b 1
        )
        echo   ✅ harvest-client 安装完成
    ) else (
        echo   ✅ harvest-client 依赖已存在，跳过
    )
    echo.
)

if exist "discovery-client" (
    echo   [2/3] 📦 安装 discovery-client...
    cd /d "%SCRIPT_DIR%\discovery-client"
    if not exist "node_modules" (
        call npm install
        if %errorlevel% neq 0 (
            echo   ❌ discovery-client 安装失败
            pause
            exit /b 1
        )
        echo   ✅ discovery-client 安装完成
    ) else (
        echo   ✅ discovery-client 依赖已存在，跳过
    )
    echo.
)

if exist "audit-client" (
    echo   [3/3] 📦 安装 audit-client...
    cd /d "%SCRIPT_DIR%\audit-client"
    if not exist "node_modules" (
        call npm install
        if %errorlevel% neq 0 (
            echo   ❌ audit-client 安装失败
            pause
            exit /b 1
        )
        echo   ✅ audit-client 安装完成
    ) else (
        echo   ✅ audit-client 依赖已存在，跳过
    )
    echo.
)

REM 验证关键依赖
echo [5/5] 验证关键依赖...
echo.

echo 检查 puppeteer-extra:
if exist "harvest-client\node_modules\puppeteer-extra" (
    echo   ✅ harvest-client\puppeteer-extra
) else (
    echo   ❌ harvest-client\puppeteer-extra 未安装
)

if exist "discovery-client\node_modules\puppeteer-extra" (
    echo   ✅ discovery-client\puppeteer-extra
) else (
    echo   ❌ discovery-client\puppeteer-extra 未安装
)

if exist "audit-client\node_modules\puppeteer-extra" (
    echo   ✅ audit-client\puppeteer-extra
) else (
    echo   ❌ audit-client\puppeteer-extra 未安装
)

echo.

echo ╔════════════════════════════════════════════════════════════╗
echo ║   ✅ 所有依赖安装完成！                                     ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo 💡 使用方法:
echo.
echo    cd harvest-client
echo    npm start
echo.
echo ⚠️  注意: 首次运行前请修改 config.json 中的服务器地址
echo.
pause
