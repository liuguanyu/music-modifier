"""
IPC处理程序 - 直接调用Python服务，无需HTTP
"""

import os
import sys
import json
import logging
import traceback
from pathlib import Path

# 添加当前目录到路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.audio_processor import AudioProcessor
from services.audio_separator import AudioSeparator  
from services.speech_recognizer import SpeechRecognizer

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/backend.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class IPCHandler:
    """IPC命令处理器"""
    
    def __init__(self):
        """初始化服务"""
        try:
            self.audio_processor = AudioProcessor()
            self.audio_separator = AudioSeparator()
            self.speech_recognizer = SpeechRecognizer()
            logger.info("所有服务初始化完成")
        except Exception as e:
            logger.error(f"服务初始化失败: {e}")
            raise
    
    async def handle_command(self, command, params):
        """处理单个IPC命令"""
        try:
            method_name = f"handle_{command}"
            if hasattr(self, method_name):
                method = getattr(self, method_name)
                return await method(params)
            else:
                return {
                    "success": False,
                    "error": f"未知命令: {command}"
                }
        except Exception as e:
            logger.error(f"处理命令失败 {command}: {e}")
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e)
            }
    
    async def handle_audio_separate(self, params):
        """音轨分离"""
        input_path = params.get('input_path')
        output_dir = params.get('output_dir', '/tmp')
        model = params.get('model', 'spleeter:2stems-16kHz')
        
        logger.info(f"开始音轨分离: {input_path}")
        result = await self.audio_separator.separate(input_path, output_dir, model)
        logger.info(f"音轨分离完成: {result}")
        return result
    
    async def handle_audio_recognize(self, params):
        """语音识别"""
        input_path = params.get('input_path')
        language = params.get('language', 'zh')
        model_size = params.get('model_size', 'base')
        
        logger.info(f"开始语音识别: {input_path}")
        result = await self.speech_recognizer.transcribe_with_timestamps(
            input_path, language, model_size
        )
        logger.info(f"语音识别完成")
        return result
    
    async def handle_audio_analyze(self, params):
        """音频分析"""
        input_path = params.get('input_path')
        
        logger.info(f"开始音频分析: {input_path}")
        result = await self.audio_processor.analyze_audio(input_path)
        logger.info(f"音频分析完成")
        return result
    
    async def handle_audio_convert(self, params):
        """音频格式转换"""
        input_path = params.get('input_path')
        output_path = params.get('output_path')
        target_format = params.get('target_format', 'mp3')
        bitrate = params.get('bitrate', '256k')
        
        logger.info(f"开始音频转换: {input_path} -> {output_path}")
        result = await self.audio_processor.convert_format(
            input_path, output_path, target_format, bitrate
        )
        logger.info(f"音频转换完成")
        return result
    
    async def handle_check_environment(self, params):
        """检查环境状态"""
        return {
            "success": True,
            "audio_processor": self.audio_processor.is_ready(),
            "audio_separator": self.audio_separator.is_ready(),
            "speech_recognizer": self.speech_recognizer.is_ready(),
            "python_version": sys.version,
            "working_directory": os.getcwd()
        }
    
    async def handle_health_check(self, params):
        """健康检查"""
        services = {
            "audio_processor": self.audio_processor.is_ready(),
            "audio_separator": self.audio_separator.is_ready(),
            "speech_recognizer": self.speech_recognizer.is_ready()
        }
        
        return {
            "success": True,
            "status": "healthy" if all(services.values()) else "degraded",
            "services": services
        }

# 主处理函数
async def main():
    """主函数 - 处理来自stdin的IPC命令"""
    handler = IPCHandler()
    
    logger.info("IPC处理器启动，等待命令...")
    
    try:
        while True:
            # 从stdin读取命令
            line = sys.stdin.readline().strip()
            if not line:
                continue
                
            try:
                # 解析JSON命令
                data = json.loads(line)
                command = data.get('command')
                params = data.get('params', {})
                request_id = data.get('id')
                
                # 处理命令
                result = await handler.handle_command(command, params)
                
                # 返回结果
                response = {
                    "id": request_id,
                    "result": result
                }
                
                print(json.dumps(response), flush=True)
                
            except json.JSONDecodeError as e:
                error_response = {
                    "id": None,
                    "result": {
                        "success": False,
                        "error": f"JSON解析错误: {e}"
                    }
                }
                print(json.dumps(error_response), flush=True)
                
    except KeyboardInterrupt:
        logger.info("IPC处理器停止")
    except Exception as e:
        logger.error(f"IPC处理器异常: {e}")
        logger.error(traceback.format_exc())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
