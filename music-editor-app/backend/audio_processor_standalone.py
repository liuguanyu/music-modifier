#!/usr/bin/env python3
"""
独立音频处理器 - 用于Electron IPC调用
不需要HTTP服务器，直接通过命令行参数接收任务
"""

import sys
import json
import asyncio
import logging
import argparse
from pathlib import Path
import tempfile
import os

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 导入本地服务
from services.audio_processor import AudioProcessor
from services.audio_separator import AudioSeparator
from services.speech_recognizer import SpeechRecognizer

class StandaloneProcessor:
    """独立音频处理器"""
    
    def __init__(self):
        self.audio_processor = AudioProcessor()
        self.audio_separator = AudioSeparator()
        self.speech_recognizer = SpeechRecognizer()
    
    async def separate_audio(self, input_path, output_dir, model_type="simple"):
        """音轨分离"""
        try:
            os.makedirs(output_dir, exist_ok=True)
            
            if model_type == "ai" and self.audio_separator.is_ready():
                # 使用AI分离
                result = await self.audio_separator.separate_advanced(input_path, output_dir)
            else:
                # 使用简单分离
                result = await self.audio_separator.separate_simple(input_path, output_dir)
            
            return {
                "success": True,
                "vocal_path": result.get("vocal"),
                "instrumental_path": result.get("instrumental"),
                "method": result.get("method", "simple")
            }
            
        except Exception as e:
            logger.error(f"音轨分离失败: {e}")
            return {"success": False, "error": str(e)}
    
    async def recognize_speech(self, audio_path, language="auto", model_size="base"):
        """语音识别"""
        try:
            if not self.speech_recognizer.is_ready():
                return {"success": False, "error": "语音识别模型未就绪"}
            
            # 先尝试提取人声再识别
            result = await self.speech_recognizer.extract_vocals_and_transcribe(
                audio_path, language if language != "auto" else None
            )
            
            return result
            
        except Exception as e:
            logger.error(f"语音识别失败: {e}")
            return {"success": False, "error": str(e)}
    
    async def analyze_audio(self, audio_path):
        """音频分析"""
        try:
            info = await self.audio_processor.get_audio_info(audio_path)
            return {
                "success": True,
                "duration": info["duration"],
                "sample_rate": info["sample_rate"],
                "channels": info["channels"],
                "format": info["format"],
                "bitrate": info.get("bitrate"),
                "size": info["size"]
            }
            
        except Exception as e:
            logger.error(f"音频分析失败: {e}")
            return {"success": False, "error": str(e)}
    
    async def convert_audio(self, input_path, output_path, target_format, bitrate="256k"):
        """音频格式转换"""
        try:
            result = await self.audio_processor.convert_format(
                input_path, output_path, target_format, bitrate
            )
            return {
                "success": True,
                "output_path": result["output_path"],
                "format": target_format,
                "size": result.get("size")
            }
            
        except Exception as e:
            logger.error(f"音频转换失败: {e}")
            return {"success": False, "error": str(e)}
    
    async def check_environment(self):
        """检查Python环境"""
        status = {
            "python_version": sys.version,
            "audio_processor": self.audio_processor is not None,
            "audio_separator": self.audio_separator.is_ready(),
            "speech_recognizer": self.speech_recognizer.is_ready(),
        }
        
        return {
            "success": True,
            "status": status,
            "ready": all([
                status["audio_processor"],
                status["audio_separator"] or True,  # 简单分离总是可用
                status["speech_recognizer"] or True  # 可选功能
            ])
        }

def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description='音频处理器')
    parser.add_argument('command', choices=['separate', 'recognize', 'analyze', 'convert', 'check'], 
                       help='执行的命令')
    
    # 通用参数
    parser.add_argument('--input', required=False, help='输入文件路径')
    parser.add_argument('--output', required=False, help='输出文件/目录路径')
    
    # 分离相关参数
    parser.add_argument('--model', default='simple', help='分离模型类型')
    
    # 识别相关参数
    parser.add_argument('--language', default='zh', help='识别语言')
    parser.add_argument('--model-size', default='base', help='识别模型大小')
    
    # 转换相关参数
    parser.add_argument('--format', default='mp3', help='目标格式')
    parser.add_argument('--bitrate', default='256k', help='比特率')
    
    return parser.parse_args()

async def main():
    """主函数 - 处理命令行调用"""
    try:
        args = parse_args()
        processor = StandaloneProcessor()
        
        # 根据命令执行相应操作
        if args.command == 'separate':
            if not args.input or not args.output:
                result = {"success": False, "error": "分离操作需要 --input 和 --output 参数"}
            else:
                result = await processor.separate_audio(args.input, args.output, args.model)
                
        elif args.command == 'recognize':
            if not args.input:
                result = {"success": False, "error": "识别操作需要 --input 参数"}
            else:
                result = await processor.recognize_speech(args.input, args.language, args.model_size)
                
        elif args.command == 'analyze':
            if not args.input:
                result = {"success": False, "error": "分析操作需要 --input 参数"}
            else:
                result = await processor.analyze_audio(args.input)
                
        elif args.command == 'convert':
            if not args.input or not args.output:
                result = {"success": False, "error": "转换操作需要 --input 和 --output 参数"}
            else:
                result = await processor.convert_audio(args.input, args.output, args.format, args.bitrate)
                
        elif args.command == 'check':
            result = await processor.check_environment()
            
        else:
            result = {"success": False, "error": f"未知命令: {args.command}"}
        
        # 输出结果
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        error_result = {"success": False, "error": f"执行失败: {e}"}
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
