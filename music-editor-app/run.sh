#!/bin/bash

# 音乐编辑器快速启动脚本
# 自动启动前端和后端服务

echo "=== 音乐编辑器启动脚本 ==="
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
echo "=== 安装依赖 ==="

# 安装前端依赖
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

# 创建并激活Python虚拟环境
echo "📦 设置Python虚拟环境..."
if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "❌ 虚拟环境创建失败"
        exit 1
    fi
fi

# 激活虚拟环境
source venv/bin/activate
echo "✅ 虚拟环境已激活"

# 检查并安装后端依赖
echo "📦 检查后端依赖..."
python -c "import fastapi, uvicorn, librosa, soundfile, numpy, pydub" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📦 安装后端依赖..."
    pip install -r backend/requirements.txt
    if [ $? -ne 0 ]; then
        echo "❌ 后端依赖安装失败"
        exit 1
    fi
    echo "✅ 后端依赖安装完成"
else
    echo "✅ 后端依赖已安装"
fi

echo ""
echo "=== 启动服务 ==="

# 启动后端服务
echo "🚀 启动后端服务..."
cd backend
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# 等待后端启动
echo "⏳ 等待后端服务启动..."
for i in {1..30}; do
    curl -s http://127.0.0.1:8000/health > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ 后端服务启动成功 (PID: $BACKEND_PID)"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo "❌ 后端服务启动超时"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
done

# 启动前端服务
echo "🚀 启动前端服务..."
npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!

# 等待前端启动
echo "⏳ 等待前端服务启动..."
for i in {1..30}; do
    curl -s http://127.0.0.1:3000 > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ 前端服务启动成功 (PID: $FRONTEND_PID)"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo "❌ 前端服务启动超时"
        kill $FRONTEND_PID 2>/dev/null
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
done

echo ""
echo "🎉 启动完成!"
echo "📱 前端地址: http://localhost:3000"
echo "🔧 后端API: http://localhost:8000" 
echo "📚 API文档: http://localhost:8000/docs"
echo ""
echo "📋 进程信息:"
echo "   前端服务 PID: $FRONTEND_PID"
echo "   后端服务 PID: $BACKEND_PID"
echo ""
echo "📝 日志文件:"
echo "   前端日志: logs/frontend.log"
echo "   后端日志: logs/backend.log"
echo ""
echo "🛑 停止服务: 按 Ctrl+C 或运行 ./stop.sh"
echo ""

# 保存PID到文件
echo $FRONTEND_PID > logs/frontend.pid
echo $BACKEND_PID > logs/backend.pid

# 等待用户中断
trap 'echo ""; echo "🛑 正在停止服务..."; kill $FRONTEND_PID 2>/dev/null; kill $BACKEND_PID 2>/dev/null; rm -f logs/*.pid; echo "✅ 服务已停止"; exit 0' INT

echo "🎵 音乐编辑器正在运行，按 Ctrl+C 停止..."

# 监控服务状态
while true; do
    sleep 5
    
    # 检查后端是否还在运行
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "❌ 后端服务意外停止"
        kill $FRONTEND_PID 2>/dev/null
        rm -f logs/*.pid
        exit 1
    fi
    
    # 检查前端是否还在运行
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "❌ 前端服务意外停止"
        kill $BACKEND_PID 2>/dev/null
        rm -f logs/*.pid
        exit 1
    fi
done
