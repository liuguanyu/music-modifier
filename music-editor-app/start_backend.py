#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音乐编辑器后端启动脚本
运行前请确保已安装所需依赖: pip install -r backend/requirements.txt
"""

import os
import sys
import subprocess
import logging
from pathlib import Path

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

def check_python_version():
    """检查Python版本"""
    if sys.version_info < (3, 8):
        logger.error("需要Python 3.8或更高版本")
        return False
    logger.info(f"Python版本: {sys.version}")
    return True

def check_dependencies():
    """检查必要依赖"""
    try:
        import fastapi
        import uvicorn
        import librosa
        import soundfile
        import numpy
        import pydub
        logger.info("所有必要依赖已安装")
        return True
    except ImportError as e:
        logger.error(f"缺少依赖: {e}")
        logger.info("请运行: pip install -r backend/requirements.txt")
        return False

def install_dependencies():
    """安装依赖"""
    requirements_file = Path("backend/requirements.txt")
    if not requirements_file.exists():
        logger.error("requirements.txt文件不存在")
        return False
    
    try:
        logger.info("正在安装依赖...")
        subprocess.run([
            sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
        ], check=True)
        logger.info("依赖安装完成")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"依赖安装失败: {e}")
        return False

def check_optional_dependencies():
    """检查可选依赖（AI模型）"""
    optional_deps = {}
    
    # 检查 Spleeter (音轨分离)
    try:
        import spleeter
        optional_deps["spleeter"] = True
        logger.info("✓ Spleeter (音轨分离) 已安装")
    except ImportError:
        optional_deps["spleeter"] = False
        logger.warning("⚠ Spleeter 未安装，将使用基础分离算法")
        logger.info("安装: pip install spleeter")
    
    # 检查 OpenAI Whisper (语音识别)
    try:
        import whisper
        optional_deps["whisper"] = True
        logger.info("✓ Whisper (语音识别) 已安装")
    except ImportError:
        optional_deps["whisper"] = False
        logger.warning("⚠ Whisper 未安装，语音识别功能不可用")
        logger.info("安装: pip install openai-whisper")
    
    return optional_deps

def start_server(host="127.0.0.1", port=8000):
    """启动FastAPI服务器"""
    try:
        # 切换到backend目录
        backend_dir = Path("backend")
        if backend_dir.exists():
            os.chdir(backend_dir)
            logger.info(f"切换到目录: {os.getcwd()}")
        else:
            logger.error("backend目录不存在")
            return
        
        import uvicorn
        
        logger.info(f"启动服务器 http://{host}:{port}")
        logger.info("按 Ctrl+C 停止服务器")
        
        uvicorn.run(
            "main:app",
            host=host,
            port=port,
            reload=True,
            log_level="info"
        )
        
    except KeyboardInterrupt:
        logger.info("服务器已停止")
    except Exception as e:
        logger.error(f"启动服务器失败: {e}")

def main():
    """主函数"""
    logger.info("=== 音乐编辑器后端启动脚本 ===")
    
    # 检查Python版本
    if not check_python_version():
        sys.exit(1)
    
    # 检查并安装依赖
    if not check_dependencies():
        logger.info("尝试自动安装依赖...")
        if not install_dependencies():
            logger.error("依赖安装失败，请手动安装")
            sys.exit(1)
    
    # 检查可选依赖
    optional_deps = check_optional_dependencies()
    
    # 显示功能状态
    logger.info("\n=== 功能状态 ===")
    logger.info("✓ 基础音频处理")
    logger.info("✓ 音频格式转换")
    logger.info("✓ 音频分析")
    
    if optional_deps.get("spleeter"):
        logger.info("✓ AI音轨分离 (Spleeter)")
    else:
        logger.info("⚠ 基础音轨分离 (建议安装Spleeter)")
    
    if optional_deps.get("whisper"):
        logger.info("✓ AI语音识别 (Whisper)")
    else:
        logger.info("✗ 语音识别不可用 (需安装Whisper)")
    
    logger.info("=" * 30)
    
    # 启动服务器
    try:
        start_server()
    except Exception as e:
        logger.error(f"启动失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
