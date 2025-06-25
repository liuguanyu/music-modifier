"""
IPC处理程序 - 直接调用Python服务，无需HTTP
"""

import os
import sys
import json
import logging
import traceback
import base64
import tempfile
from pathlib import Path

# 添加当前目录到路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.audio_processor import AudioProcessor
from services.audio_separator import AudioSeparator  
from services.speech_recognizer import SpeechRecognizer
from services.voice_composer import VoiceComposer

# 配置日志 - 使用正确的相对路径
log_dir = Path('../logs')
log_dir.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / 'backend.log'),
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
            self.voice_composer = VoiceComposer()
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
    
    async def handle_separate_audio(self, params):
        """处理前端传来的音频分离请求"""
        try:
            # 获取参数
            audio_data = params.get('audio_data')  # base64编码的音频数据
            filename = params.get('filename', 'audio.wav')
            separation_mode = params.get('separation_mode', 'vocal-instrumental')
            
            logger.info(f"收到音频分离请求: {filename}, 模式: {separation_mode}")
            
            # 解码base64音频数据
            audio_bytes = base64.b64decode(audio_data)
            
            # 创建临时文件保存音频
            uploads_dir = Path('uploads')
            uploads_dir.mkdir(exist_ok=True)
            
            temp_input_path = uploads_dir / f"temp_input_{filename}"
            with open(temp_input_path, 'wb') as f:
                f.write(audio_bytes)
            
            logger.info(f"音频文件保存到: {temp_input_path}")
            
            # 调用音频分离服务
            result = await self.audio_separator.separate(str(temp_input_path))
            
            if result.get('success'):
                logger.info("音频分离成功完成")
                return {
                    "success": True,
                    "vocals_path": result.get('vocals_path'),
                    "instrumental_path": result.get('instrumental_path'),
                    "vocals_name": result.get('vocals_name'),
                    "instrumental_name": result.get('instrumental_name')
                }
            else:
                logger.error(f"音频分离失败: {result.get('error')}")
                return {
                    "success": False,
                    "error": result.get('error', '音频分离失败')
                }
                
        except Exception as e:
            logger.error(f"处理音频分离请求失败: {e}")
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "error": f"处理失败: {str(e)}"
            }
    
    async def handle_audio_separate(self, params):
        """音轨分离"""
        input_path = params.get('input_path')
        
        logger.info(f"开始音轨分离: {input_path}")
        result = await self.audio_separator.separate(input_path)
        logger.info(f"音轨分离完成: {result}")
        return result
    
    async def handle_audio_recognize(self, params):
        """语音识别"""
        input_path = params.get('input_path')
        language = params.get('language', 'zh')
        with_timestamps = params.get('with_timestamps', True)
        
        logger.info(f"开始语音识别: {input_path}")
        
        if with_timestamps:
            # 创建会话并进行带时间戳的识别
            session_id = self.speech_recognizer.create_session(input_path)
            try:
                result = await self.speech_recognizer.transcribe_with_timestamps_session(
                    session_id, language
                )
            finally:
                # 清理会话
                self.speech_recognizer.cleanup_session(session_id)
        else:
            # 简单识别
            result = await self.speech_recognizer.transcribe(input_path, language)
        
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
    
    async def handle_voice_compose(self, params):
        """音色合成"""
        text = params.get('text')
        voice_id = params.get('voice_id', 'default')
        speed = params.get('speed', 1.0)
        pitch = params.get('pitch', 0)
        output_format = params.get('output_format', 'wav')
        
        logger.info(f"开始音色合成: {text[:50]}...")
        result = await self.voice_composer.synthesize_speech(
            text, voice_id, speed, pitch, output_format
        )
        logger.info(f"音色合成完成")
        return result
    
    async def handle_voice_clone(self, params):
        """声音克隆"""
        reference_audio = params.get('reference_audio')
        target_text = params.get('target_text')
        clone_quality = params.get('clone_quality', 'medium')
        
        logger.info(f"开始声音克隆: {reference_audio}")
        result = await self.voice_composer.clone_voice(
            reference_audio, target_text, clone_quality
        )
        logger.info(f"声音克隆完成")
        return result
    
    async def handle_voice_list_models(self, params):
        """获取可用音色列表"""
        return await self.voice_composer.list_available_voices()
    
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
            "speech_recognizer": self.speech_recognizer.is_ready(),
            "voice_composer": self.voice_composer.is_ready()
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
