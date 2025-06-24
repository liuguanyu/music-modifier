#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
本地功能测试脚本 - 无需HTTP请求
直接测试音频处理模块功能
"""

import os
import sys
import asyncio

# 添加backend路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def test_audio_separator():
    """测试音轨分离服务"""
    print("=== 测试音轨分离服务 ===")
    
    try:
        from backend.services.audio_separator import AudioSeparator
        
        separator = AudioSeparator()
        print(f"音轨分离服务初始化: {'成功' if separator else '失败'}")
        print(f"服务状态: {'就绪' if separator.is_ready() else '未就绪'}")
        return True
        
    except Exception as e:
        print(f"音轨分离服务测试失败: {e}")
        return False

async def test_speech_recognizer():
    """测试语音识别服务"""
    print("\n=== 测试语音识别服务 ===")
    
    try:
        from backend.services.speech_recognizer import SpeechRecognizer
        
        recognizer = SpeechRecognizer()
        print(f"语音识别服务初始化: {'成功' if recognizer else '失败'}")
        print(f"服务状态: {'就绪' if recognizer.is_ready() else '未就绪'}")
        
        if recognizer.is_ready():
            # 测试获取支持的语言
            langs = await recognizer.get_supported_languages()
            if langs.get('success'):
                print(f"支持的语言数量: {len(langs.get('languages', {}))}")
                print(f"语言列表: {list(langs.get('languages', {}).keys())[:5]}...")  # 只显示前5个
            else:
                print("获取语言列表失败")
        
        return True
        
    except Exception as e:
        print(f"语音识别服务测试失败: {e}")
        return False

def test_audio_processor():
    """测试音频处理器"""
    print("\n=== 测试音频处理器 ===")
    
    try:
        from backend.services.audio_processor import AudioProcessor
        
        processor = AudioProcessor()
        print(f"音频处理器初始化: {'成功' if processor else '失败'}")
        return True
        
    except Exception as e:
        print(f"音频处理器测试失败: {e}")
        return False

def check_test_files():
    """检查测试文件"""
    print("\n=== 检查测试文件 ===")
    
    test_dirs = ['test_files', 'uploads', 'backend/uploads']
    for test_dir in test_dirs:
        if os.path.exists(test_dir):
            files = os.listdir(test_dir)
            if files:
                print(f"{test_dir}/: {len(files)} 个文件")
                for file in files[:3]:  # 只显示前3个
                    print(f"  - {file}")
            else:
                print(f"{test_dir}/: 空目录")
        else:
            print(f"{test_dir}/: 不存在")

def check_python_version():
    """检查Python版本"""
    print("=== Python环境检查 ===")
    print(f"Python版本: {sys.version}")
    print(f"Python路径: {sys.executable}")

async def main():
    """主测试流程"""
    print("音频编辑器本地功能测试")
    print("=" * 50)
    
    # Python环境检查
    check_python_version()
    
    # 检查测试文件
    check_test_files()
    
    # 测试各个服务
    results = []
    
    # 1. 测试音轨分离
    results.append(("音轨分离", test_audio_separator()))
    
    # 2. 测试语音识别
    results.append(("语音识别", await test_speech_recognizer()))
    
    # 3. 测试音频处理器
    results.append(("音频处理器", test_audio_processor()))
    
    # 输出结果
    print("\n" + "=" * 50)
    print("测试结果汇总:")
    for name, success in results:
        status = "✅ 成功" if success else "❌ 失败"
        print(f"  {name}: {status}")
    
    total_success = sum(1 for _, success in results if success)
    print(f"\n总计: {total_success}/{len(results)} 项测试通过")

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n测试被用户中断")
    except Exception as e:
        print(f"\n测试执行异常: {e}")
