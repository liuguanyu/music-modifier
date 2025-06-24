#!/bin/bash

# Electron音乐编辑器启动脚本
# 启动Python后端服务和Electron应用

echo "=== Electron音乐编辑器启动脚本 ==="
echo "🎵 正在启动 AI 音乐编辑器..."

# 检查node版本
echo "检查 Node.js 版本..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 16+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt "16" ]; then
    echo "❌ Node.js 版本过低 (当前: $(node -v))，需要 16+"
    exit 1
fi
echo "✅ Node.js 版本: $(node -v)"

# 检查Python版本
echo "检查 Python 版本..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 未安装，请先安装 Python 3.8+"
    exit 1
fi

PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "✅ Python 版本: $PYTHON_VERSION"

# 创建日志目录
mkdir -p logs

echo ""
echo "=== 检查依赖 ==="

# 检查前端依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 前端依赖安装失败"
        exit 1
    fi
    echo "✅ 前端依赖安装完成"
else
    echo "✅ 前端依赖已存在"
fi

# 检查Python虚拟环境
echo "📦 检查Python虚拟环境..."
if [ ! -d "myenv" ]; then
    echo "❌ myenv 虚拟环境不存在，请先创建"
    exit 1
fi

# 激活虚拟环境
source myenv/bin/activate
echo "✅ 虚拟环境已激活"

# 检查后端依赖
echo "📦 检查后端依赖..."
python -c "import fastapi, uvicorn, librosa, soundfile, numpy, pydub" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ 后端依赖缺失，请检查 myenv 环境"
    exit 1
else
    echo "✅ 后端依赖已安装"
fi

echo ""
echo "=== 启动服务 ==="

# 启动后端服务
echo "🚀 启动Python后端服务..."
cd backend
python3 main.py > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# 等待后端启动
echo "⏳ 等待后端服务启动..."
sleep 3
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ 后端服务启动失败，查看日志: logs/backend.log"
    exit 1
fi
echo "✅ 后端服务启动成功 (PID: $BACKEND_PID)"

# 启动Electron应用
echo "🚀 启动Electron应用..."
npm run app > logs/electron.log 2>&1 &
ELECTRON_PID=$!

echo ""
echo "🎉 启动完成!"
echo "🖥️  Electron应用正在启动..."
echo "🔧 后端服务: Python FastAPI"
echo ""
echo "📋 进程信息:"
echo "   Electron应用 PID: $ELECTRON_PID"
echo "   后端服务 PID: $BACKEND_PID"
echo ""
echo "📝 日志文件:"
echo "   Electron日志: logs/electron.log"
echo "   后端日志: logs/backend.log"
echo ""
echo "🛑 停止服务: 按 Ctrl+C 或运行 ./stop.sh"
echo ""

# 保存PID到文件
echo $ELECTRON_PID > logs/electron.pid
echo $BACKEND_PID > logs/backend.pid

# 等待用户中断
trap 'echo ""; echo "🛑 正在停止服务..."; kill $ELECTRON_PID 2>/dev/null; kill $BACKEND_PID 2>/dev/null; rm -f logs/*.pid; echo "✅ 服务已停止"; exit 0' INT

echo "🎵 音乐编辑器正在运行，按 Ctrl+C 停止..."

# 监控服务状态
while true; do
    sleep 5
    
    # 检查后端是否还在运行
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "❌ 后端服务意外停止"
        kill $ELECTRON_PID 2>/dev/null
        rm -f logs/*.pid
        exit 1
    fi
    
    # 检查Electron是否还在运行
    if ! kill -0 $ELECTRON_PID 2>/dev/null; then
        echo "❌ Electron应用意外停止"
        kill $BACKEND_PID 2>/dev/null
        rm -f logs/*.pid
        exit 1
    fi
done
