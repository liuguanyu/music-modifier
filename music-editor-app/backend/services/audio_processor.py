"""
音频处理服务
负责音频合成、混音、格式转换等功能
"""

import os
import asyncio
import logging
from pathlib import Path
import tempfile
import librosa
import soundfile as sf
import numpy as np
from typing import Dict, Any, Optional
from pydub import AudioSegment
import json

logger = logging.getLogger(__name__)

class AudioProcessor:
    """音频处理器"""
    
    def __init__(self):
        self.processor_ready = True
        logger.info("音频处理器初始化完成")
    
    def is_ready(self) -> bool:
        """检查服务是否就绪"""
        return self.processor_ready
    
    async def compose(self, vocals_path: str, accompaniment_path: str, 
                     lyrics_data: Optional[str] = None) -> Dict[str, Any]:
        """
        合成音频文件
        
        Args:
            vocals_path: 人声音轨路径
            accompaniment_path: 伴奏音轨路径
            lyrics_data: 歌词数据 (JSON 字符串)
            
        Returns:
            Dict: 合成结果
        """
        try:
            # 异步执行合成
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, 
                self._compose_audio, 
                vocals_path, 
                accompaniment_path, 
                lyrics_data
            )
            
            return result
            
        except Exception as e:
            logger.error(f"音频合成失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _compose_audio(self, vocals_path: str, accompaniment_path: str, 
                      lyrics_data: Optional[str] = None) -> Dict[str, Any]:
        """执行音频合成"""
        try:
            # 加载音频文件
            vocals_audio = AudioSegment.from_file(vocals_path)
            accompaniment_audio = AudioSegment.from_file(accompaniment_path)
            
            # 确保两个音频长度一致
            max_length = max(len(vocals_audio), len(accompaniment_audio))
            
            # 如果长度不一致，进行填充或裁剪
            if len(vocals_audio) < max_length:
                vocals_audio = vocals_audio + AudioSegment.silent(
                    duration=max_length - len(vocals_audio)
                )
            elif len(vocals_audio) > max_length:
                vocals_audio = vocals_audio[:max_length]
                
            if len(accompaniment_audio) < max_length:
                accompaniment_audio = accompaniment_audio + AudioSegment.silent(
                    duration=max_length - len(accompaniment_audio)
                )
            elif len(accompaniment_audio) > max_length:
                accompaniment_audio = accompaniment_audio[:max_length]
            
            # 调整音量平衡
            vocals_volume = 0  # dB (不变)
            accompaniment_volume = -3  # dB (稍微降低)
            
            vocals_adjusted = vocals_audio + vocals_volume
            accompaniment_adjusted = accompaniment_audio + accompaniment_volume
            
            # 混音
            mixed_audio = vocals_adjusted.overlay(accompaniment_adjusted)
            
            # 创建输出文件
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                output_path = temp_file.name
                
            # 导出混音结果
            mixed_audio.export(output_path, format="wav")
            
            # 计算音频时长
            duration = len(mixed_audio) / 1000.0  # 转换为秒
            
            logger.info(f"音频合成成功，时长: {duration:.2f}秒")
            
            return {
                "success": True,
                "output_path": output_path,
                "duration": duration,
                "format": "wav",
                "sample_rate": mixed_audio.frame_rate,
                "channels": mixed_audio.channels
            }
            
        except Exception as e:
            logger.error(f"音频合成执行失败: {e}")
            raise e
    
    async def apply_effects(self, audio_path: str, effects: Dict[str, Any]) -> Dict[str, Any]:
        """
        应用音频效果
        
        Args:
            audio_path: 输入音频路径
            effects: 效果参数字典
            
        Returns:
            Dict: 处理结果
        """
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, 
                self._apply_audio_effects, 
                audio_path, 
                effects
            )
            
            return result
            
        except Exception as e:
            logger.error(f"音频效果应用失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _apply_audio_effects(self, audio_path: str, effects: Dict[str, Any]) -> Dict[str, Any]:
        """应用音频效果的实现"""
        try:
            # 加载音频
            audio = AudioSegment.from_file(audio_path)
            
            # 应用各种效果
            if effects.get("normalize", False):
                # 音量标准化
                audio = audio.normalize()
            
            if "volume" in effects:
                # 音量调整
                volume_change = effects["volume"]  # dB
                audio = audio + volume_change
            
            if "fade_in" in effects:
                # 淡入效果
                fade_duration = int(effects["fade_in"] * 1000)  # 转换为毫秒
                audio = audio.fade_in(fade_duration)
            
            if "fade_out" in effects:
                # 淡出效果
                fade_duration = int(effects["fade_out"] * 1000)  # 转换为毫秒
                audio = audio.fade_out(fade_duration)
            
            if "speed" in effects:
                # 速度调整
                speed_factor = effects["speed"]
                if speed_factor != 1.0:
                    # 通过改变帧率来调整速度
                    new_frame_rate = int(audio.frame_rate * speed_factor)
                    audio = audio._spawn(audio.raw_data, overrides={
                        "frame_rate": new_frame_rate
                    }).set_frame_rate(audio.frame_rate)
            
            # 保存处理后的音频
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                output_path = temp_file.name
                
            audio.export(output_path, format="wav")
            
            return {
                "success": True,
                "output_path": output_path,
                "duration": len(audio) / 1000.0,
                "effects_applied": list(effects.keys())
            }
            
        except Exception as e:
            logger.error(f"音频效果应用执行失败: {e}")
            raise e
    
    async def convert_format(self, audio_path: str, target_format: str, 
                           quality: str = "high") -> Dict[str, Any]:
        """
        转换音频格式
        
        Args:
            audio_path: 输入音频路径
            target_format: 目标格式 (mp3, wav, flac, etc.)
            quality: 质量设置 (low, medium, high)
            
        Returns:
            Dict: 转换结果
        """
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, 
                self._convert_audio_format, 
                audio_path, 
                target_format, 
                quality
            )
            
            return result
            
        except Exception as e:
            logger.error(f"音频格式转换失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _convert_audio_format(self, audio_path: str, target_format: str, 
                            quality: str = "high") -> Dict[str, Any]:
        """执行音频格式转换"""
        try:
            # 加载音频
            audio = AudioSegment.from_file(audio_path)
            
            # 设置质量参数
            export_params = {}
            
            if target_format.lower() == "mp3":
                if quality == "high":
                    export_params["bitrate"] = "320k"
                elif quality == "medium":
                    export_params["bitrate"] = "192k"
                else:
                    export_params["bitrate"] = "128k"
            
            # 创建输出文件
            with tempfile.NamedTemporaryFile(
                suffix=f".{target_format.lower()}", 
                delete=False
            ) as temp_file:
                output_path = temp_file.name
            
            # 导出
            audio.export(output_path, format=target_format.lower(), **export_params)
            
            # 获取文件大小
            file_size = os.path.getsize(output_path)
            
            return {
                "success": True,
                "output_path": output_path,
                "format": target_format.lower(),
                "duration": len(audio) / 1000.0,
                "file_size": file_size,
                "quality": quality
            }
            
        except Exception as e:
            logger.error(f"音频格式转换执行失败: {e}")
            raise e
    
    async def analyze_audio(self, audio_path: str) -> Dict[str, Any]:
        """
        分析音频文件
        
        Args:
            audio_path: 音频文件路径
            
        Returns:
            Dict: 音频分析结果
        """
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, 
                self._analyze_audio_file, 
                audio_path
            )
            
            return result
            
        except Exception as e:
            logger.error(f"音频分析失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _analyze_audio_file(self, audio_path: str) -> Dict[str, Any]:
        """分析音频文件的实现"""
        try:
            # 使用 librosa 进行详细分析
            y, sr = librosa.load(audio_path, sr=None)
            
            # 基本信息
            duration = librosa.get_duration(y=y, sr=sr)
            tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
            
            # 频谱分析
            spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
            
            # 音量分析
            rms = librosa.feature.rms(y=y)[0]
            
            # 使用 pydub 获取更多信息
            audio_segment = AudioSegment.from_file(audio_path)
            
            return {
                "success": True,
                "duration": duration,
                "sample_rate": sr,
                "channels": len(y.shape) if y.ndim > 1 else 1,
                "tempo": float(tempo),
                "beat_count": len(beats),
                "spectral_centroid_mean": float(np.mean(spectral_centroid)),
                "spectral_rolloff_mean": float(np.mean(spectral_rolloff)),
                "rms_mean": float(np.mean(rms)),
                "max_amplitude": float(np.max(np.abs(y))),
                "file_size": os.path.getsize(audio_path),
                "format_info": {
                    "frame_rate": audio_segment.frame_rate,
                    "sample_width": audio_segment.sample_width,
                    "channels": audio_segment.channels,
                    "max_possible_amplitude": audio_segment.max_possible_amplitude
                }
            }
            
        except Exception as e:
            logger.error(f"音频分析执行失败: {e}")
            raise e
    
    def get_supported_formats(self) -> Dict[str, Any]:
        """获取支持的音频格式"""
        return {
            "input_formats": ["wav", "mp3", "flac", "aac", "m4a", "ogg"],
            "output_formats": ["wav", "mp3", "flac", "aac"],
            "effects": [
                "normalize",
                "volume",
                "fade_in", 
                "fade_out",
                "speed"
            ],
            "quality_options": ["low", "medium", "high"]
        }
