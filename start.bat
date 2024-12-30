@echo off
chcp 65001 > nul

:: 切换到脚本所在目录
cd /d "%~dp0"

:: 检查必要的文件和文件夹是否存在
if not exist "api.py" (
    echo 错误: 未找到 api.py
    echo 请确保在正确的目录下运行此脚本
    pause
    exit /b 1
)

if not exist "data" (
    echo 错误: 未找到 data 文件夹
    pause
    exit /b 1
)

:: 创建日志目录
if not exist "log" mkdir log

:: 启动 Python 后端服务（不创建新窗口）
echo 正在启动后端服务...
start /b cmd /c "python api.py"

:: 等待1秒确保后端启动
timeout /t 1 /nobreak > nul

:: 使用默认浏览器打开前端页面
start index.html

echo 服务已启动，日志文件保存在 log 目录下
echo 请勿关闭此窗口。按任意键退出...
pause > nul