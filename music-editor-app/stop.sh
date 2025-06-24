#!/bin/bash

# 音乐编辑器停止脚本
# 安全停止前端和后端服务

echo "=== 停止音乐编辑器服务 ==="

# 检查PID文件是否存在
if [ -f "logs/frontend.pid" ] || [ -f "logs/backend.pid" ]; then
    
    # 停止前端服务
    if [ -f "logs/frontend.pid" ]; then
        FRONTEND_PID=$(cat logs/frontend.pid)
        echo "🛑 停止前端服务 (PID: $FRONTEND_PID)"
        
        if kill -0 $FRONTEND_PID 2>/dev/null; then
            kill $FRONTEND_PID 2>/dev/null
            sleep 2
            
            # 如果进程还在运行，强制终止
            if kill -0 $FRONTEND_PID 2>/dev/null; then
                echo "⚠️  强制终止前端服务"
                kill -9 $FRONTEND_PID 2>/dev/null
            fi
            echo "✅ 前端服务已停止"
        else
            echo "ℹ️  前端服务已经停止"
        fi
        
        rm -f logs/frontend.pid
    fi
    
    # 停止后端服务
    if [ -f "logs/backend.pid" ]; then
        BACKEND_PID=$(cat logs/backend.pid)
        echo "🛑 停止后端服务 (PID: $BACKEND_PID)"
        
        if kill -0 $BACKEND_PID 2>/dev/null; then
            kill $BACKEND_PID 2>/dev/null
            sleep 2
            
            # 如果进程还在运行，强制终止
            if kill -0 $BACKEND_PID 2>/dev/null; then
                echo "⚠️  强制终止后端服务"
                kill -9 $BACKEND_PID 2>/dev/null
            fi
            echo "✅ 后端服务已停止"
        else
            echo "ℹ️  后端服务已经停止"
        fi
        
        rm -f logs/backend.pid
    fi
    
else
    echo "ℹ️  没有找到运行中的服务"
    
    # 尝试通过端口查找并停止进程
    echo "🔍 检查端口占用..."
    
    # 查找占用3000端口的进程（前端）
    FRONTEND_PIDS=$(lsof -t -i:3000 2>/dev/null)
    if [ ! -z "$FRONTEND_PIDS" ]; then
        echo "发现前端进程: $FRONTEND_PIDS"
        for pid in $FRONTEND_PIDS; do
            echo "停止进程 $pid"
            kill $pid 2>/dev/null
        done
    fi
    
    # 查找占用8000端口的进程（后端）
    BACKEND_PIDS=$(lsof -t -i:8000 2>/dev/null)
    if [ ! -z "$BACKEND_PIDS" ]; then
        echo "发现后端进程: $BACKEND_PIDS"
        for pid in $BACKEND_PIDS; do
            echo "停止进程 $pid"
            kill $pid 2>/dev/null
        done
    fi
    
    # 查找node和python进程
    echo "🔍 查找相关进程..."
    
    # 停止webpack-dev-server
    pkill -f "webpack-dev-server" 2>/dev/null && echo "停止webpack-dev-server"
    
    # 停止uvicorn
    pkill -f "uvicorn.*main:app" 2>/dev/null && echo "停止uvicorn"
    
fi

# 清理临时文件
echo "🧹 清理临时文件..."
rm -f logs/*.pid 2>/dev/null

# 检查是否还有相关进程
sleep 1
REMAINING_3000=$(lsof -t -i:3000 2>/dev/null)
REMAINING_8000=$(lsof -t -i:8000 2>/dev/null)

if [ ! -z "$REMAINING_3000" ] || [ ! -z "$REMAINING_8000" ]; then
    echo "⚠️  仍有进程占用端口，可能需要手动停止"
    [ ! -z "$REMAINING_3000" ] && echo "   端口3000: $REMAINING_3000"
    [ ! -z "$REMAINING_8000" ] && echo "   端口8000: $REMAINING_8000"
    echo "   手动停止: kill <PID>"
else
    echo "✅ 所有服务已完全停止"
fi

echo "🎵 音乐编辑器已停止运行"
