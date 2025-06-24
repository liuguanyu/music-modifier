#!/usr/bin/env python3
"""
智能音乐编辑器演示脚本
展示基本功能和API调用
"""

import requests
import json
import time

def test_api():
    """测试API功能"""
    base_url = "http://localhost:8000"
    
    print("🎵 智能音乐编辑器演示")
    print("=" * 50)
    
    # 1. 健康检查
    print("\n1. 检查后端服务状态...")
    try:
        response = requests.get(f"{base_url}/health")
        health_data = response.json()
        print(f"✅ 后端服务状态: {health_data['status']}")
        
        for service, status in health_data['services'].items():
            status_icon = "✅" if status else "⚠️"
            print(f"   {status_icon} {service}: {'就绪' if status else '需要安装依赖'}")
            
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到后端服务，请确保服务器正在运行")
        return
    
    # 2. 测试根路径
    print("\n2. 测试API根路径...")
    try:
        response = requests.get(f"{base_url}/")
        data = response.json()
        print(f"✅ {data['message']}")
    except Exception as e:
        print(f"❌ API测试失败: {e}")
    
    # 3. 显示可用的API端点
    print("\n3. 可用的API端点:")
    endpoints = [
        ("POST", "/api/separate-audio", "音轨分离 - 将歌曲分离为人声和伴奏"),
        ("POST", "/api/extract-lyrics", "歌词提取 - 从音频中识别歌词"),
        ("POST", "/api/compose-audio", "音频合成 - 合成修改后的音频"),
    ]
    
    for method, endpoint, description in endpoints:
        print(f"   {method:4} {endpoint:20} - {description}")
    
    print("\n" + "=" * 50)
    print("📱 前端界面:")
    print("   访问 http://localhost:3001 查看完整界面")
    print("\n💡 使用说明:")
    print("   1. 在前端界面上传音频文件")
    print("   2. 系统自动进行音轨分离")
    print("   3. 提取并编辑歌词")
    print("   4. 合成最终音频文件")
    

def show_project_structure():
    """显示项目结构"""
    print("\n📁 项目结构:")
    structure = """
music-editor-app/
├── frontend (React应用)
│   ├── src/components/     # React组件
│   ├── public/            # 静态文件
│   └── package.json       # 前端依赖
├── backend (FastAPI服务)
│   ├── services/          # 核心服务
│   ├── main.py           # API入口
│   └── requirements.txt   # 后端依赖
└── 启动脚本
    ├── run.sh            # 一键启动脚本
    └── stop.sh           # 停止服务脚本
"""
    print(structure)

if __name__ == "__main__":
    test_api()
    show_project_structure()
    
    print("\n🚀 快速启动:")
    print("   ./run.sh     # 启动所有服务")
    print("   ./stop.sh    # 停止所有服务")
