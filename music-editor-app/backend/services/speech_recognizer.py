"""
语音识别服务
使用 Whisper 模型进行语音转文字，支持原调原音色数据保存和多任务数据隔离
"""

import os
import uuid
import asyncio
import logging
import tempfile
import json
import copy
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime

import librosa
import soundfile as sf
import numpy as np

logger = logging.getLogger(__name__)

@dataclass
class AudioMetadata:
    """音频元数据，用于保存原始特征以便后续恢复"""
    original_sr: int
    original_duration: float
    original_f0_mean: Optional[float] = None
    original_f0_std: Optional[float] = None
    original_tempo: Optional[float] = None
    original_spectral_centroid: Optional[float] = None
    original_spectral_rolloff: Optional[float] = None
    original_mfcc_mean: Optional[np.ndarray] = None
    original_rms_mean: Optional[float] = None
    transform_parameters: Dict[str, Any] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典，处理numpy数组"""
        data = asdict(self)
        if self.original_mfcc_mean is not None:
            data['original_mfcc_mean'] = self.original_mfcc_mean.tolist()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AudioMetadata':
        """从字典创建实例"""
        if 'original_mfcc_mean' in data and data['original_mfcc_mean'] is not None:
            data['original_mfcc_mean'] = np.array(data['original_mfcc_mean'])
        return cls(**data)

@dataclass  
class RecognitionSession:
    """识别会话，用于数据隔离"""
    session_id: str
    created_at: datetime
    audio_file_path: str
    metadata: AudioMetadata
    processed_audio: Optional[np.ndarray] = None
    recognition_result: Optional[Dict[str, Any]] = None
    temp_files: List[str] = None
    
    def __post_init__(self):
        if self.temp_files is None:
            self.temp_files = []

class SpeechRecognizer:
    """语音识别处理器，支持多任务数据隔离和原调原音色保存"""
    
    def __init__(self):
        self.model_loaded = False
        self.whisper_model = None
        self.sessions: Dict[str, RecognitionSession] = {}
        self._init_whisper()
    
    def _init_whisper(self):
        """初始化 Whisper 模型"""
        try:
            import whisper
            
            # 加载小型模型，快速启动
            self.whisper_model = whisper.load_model("base")
            self.model_loaded = True
            logger.info("Whisper 模型加载成功")
            
        except ImportError:
            logger.warning("Whisper 未安装，语音识别功能不可用")
            self.model_loaded = False
        except Exception as e:
            logger.error(f"Whisper 模型加载失败: {e}")
            self.model_loaded = False
    
    def is_ready(self) -> bool:
        """检查服务是否就绪"""
        return self.model_loaded
    
    def create_session(self, audio_path: str) -> str:
        """创建新的识别会话，确保数据隔离"""
        try:
            # 生成唯一会话ID
            session_id = str(uuid.uuid4())
            
            # 提取原始音频元数据
            metadata = self._extract_audio_metadata(audio_path)
            
            # 创建会话
            session = RecognitionSession(
                session_id=session_id,
                created_at=datetime.now(),
                audio_file_path=audio_path,
                metadata=metadata
            )
            
            self.sessions[session_id] = session
            logger.info(f"创建识别会话: {session_id}")
            
            return session_id
            
        except Exception as e:
            logger.error(f"创建会话失败: {e}")
            raise
    
    def _extract_audio_metadata(self, audio_path: str) -> AudioMetadata:
        """提取音频的原始特征元数据"""
        try:
            # 加载原始音频
            y, sr = librosa.load(audio_path, sr=None)
            duration = librosa.get_duration(y=y, sr=sr)
            
            # 提取基本特征
            metadata = AudioMetadata(
                original_sr=sr,
                original_duration=duration,
                transform_parameters={}
            )
            
            # 提取音高特征
            try:
                f0, voiced_flag, voiced_probs = librosa.pyin(
                    y, fmin=50, fmax=2000, sr=sr
                )
                valid_f0 = f0[voiced_flag]
                if len(valid_f0) > 0:
                    metadata.original_f0_mean = float(np.mean(valid_f0))
                    metadata.original_f0_std = float(np.std(valid_f0))
            except Exception as e:
                logger.warning(f"音高提取失败: {e}")
            
            # 提取节拍特征
            try:
                tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
                metadata.original_tempo = float(tempo)
            except Exception as e:
                logger.warning(f"节拍提取失败: {e}")
            
            # 提取频谱特征
            try:
                spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
                metadata.original_spectral_centroid = float(np.mean(spectral_centroids))
                
                spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
                metadata.original_spectral_rolloff = float(np.mean(spectral_rolloff))
                
                mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
                metadata.original_mfcc_mean = np.mean(mfccs, axis=1)
                
                rms = librosa.feature.rms(y=y)[0]
                metadata.original_rms_mean = float(np.mean(rms))
                
            except Exception as e:
                logger.warning(f"频谱特征提取失败: {e}")
            
            return metadata
            
        except Exception as e:
            logger.error(f"元数据提取失败: {e}")
            # 返回基本元数据
            y, sr = librosa.load(audio_path, sr=None)
            duration = librosa.get_duration(y=y, sr=sr)
            return AudioMetadata(
                original_sr=sr,
                original_duration=duration,
                transform_parameters={}
            )
    
    async def transcribe_with_session(self, session_id: str, language: Optional[str] = None, preserve_original: bool = True) -> Dict[str, Any]:
        """
        使用会话进行语音转文字，保留原始特征数据
        
        Args:
            session_id: 会话ID
            language: 指定语言 (可选)
            preserve_original: 是否保留原始音频特征用于后续重合成
            
        Returns:
            Dict: 包含识别结果和元数据的字典
        """
        try:
            if not self.model_loaded:
                return {
                    "success": False,
                    "error": "Whisper 模型未加载"
                }
            
            if session_id not in self.sessions:
                return {
                    "success": False,
                    "error": f"会话 {session_id} 不存在"
                }
            
            session = self.sessions[session_id]
            
            # 异步处理转录
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, 
                self._run_transcription_with_preservation, 
                session, 
                language,
                preserve_original
            )
            
            # 保存识别结果到会话
            session.recognition_result = result
            
            return {
                "success": True,
                "session_id": session_id,
                "text": result["text"],
                "segments": result["segments"],
                "language": result["language"],
                "duration": result.get("duration", 0),
                "audio_metadata": session.metadata.to_dict() if preserve_original else None,
                "restoration_data": result.get("restoration_data") if preserve_original else None
            }
            
        except Exception as e:
            logger.error(f"语音识别失败: {e}")
            return {
                "success": False,
                "error": str(e),
                "session_id": session_id
            }
    
    def _run_transcription_with_preservation(self, session: RecognitionSession, language: Optional[str] = None, preserve_original: bool = True) -> Dict[str, Any]:
        """运行 Whisper 转录，保留恢复数据"""
        
        # 加载音频（Whisper 要求采样率为 16kHz）
        audio, sr = librosa.load(session.audio_file_path, sr=16000)
        
        # 保存原始16kHz音频用于对比
        original_16k_audio = audio.copy()
        
        # 针对演唱音频进行可逆预处理
        processed_audio, restoration_data = self._preprocess_singing_audio_reversible(
            audio, sr, session.metadata, preserve_original
        )
        
        # 保存处理后的音频到会话
        session.processed_audio = processed_audio.copy()
        
        # 运行转录，针对演唱音频优化参数
        options = {
            "fp16": False,  # 提高精度
            "temperature": 0.0,  # 提高一致性
            "compression_ratio_threshold": 2.4,  # 调整压缩比阈值
            "logprob_threshold": -1.0,  # 调整概率阈值
            "no_speech_threshold": 0.6,  # 调整静音检测阈值（适应演唱）
            "condition_on_previous_text": True,  # 利用上下文信息
            "word_timestamps": True,  # 获取词级时间戳
        }
        if language:
            options["language"] = language
            
        result = self.whisper_model.transcribe(processed_audio, **options)
        
        # 处理时间戳，映射回原始时间线
        segments = []
        for segment in result.get("segments", []):
            # 如果进行了时间拉伸，需要映射回原始时间
            original_start = segment["start"]
            original_end = segment["end"]
            
            if restoration_data and "tempo_stretch_ratio" in restoration_data:
                stretch_ratio = restoration_data["tempo_stretch_ratio"]
                original_start = segment["start"] / stretch_ratio
                original_end = segment["end"] / stretch_ratio
            
            segments.append({
                "start": original_start,
                "end": original_end,
                "text": segment["text"].strip(),
                "confidence": segment.get("no_speech_prob", 0),
                "original_segment": segment  # 保留原始段信息
            })
        
        result_data = {
            "text": result["text"].strip(),
            "segments": segments,
            "language": result.get("language", "unknown"),
            "duration": len(original_16k_audio) / sr
        }
        
        if preserve_original:
            result_data["restoration_data"] = restoration_data
        
        return result_data
    
    def _preprocess_singing_audio_reversible(self, audio: np.ndarray, sr: int, metadata: AudioMetadata, preserve_original: bool) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        针对演唱音频的可逆预处理
        
        Args:
            audio: 音频数据
            sr: 采样率
            metadata: 原始音频元数据
            preserve_original: 是否保留恢复数据
            
        Returns:
            Tuple[np.ndarray, Dict]: (处理后的音频, 恢复数据)
        """
        try:
            if not preserve_original:
                # 如果不需要保留原始数据，使用简化处理
                return self._simple_preprocess(audio), {}
            
            restoration_data = {
                "preprocessing_steps": [],
                "original_features": {}
            }
            
            processed_audio = audio.copy()
            
            # 1. 动态范围压缩（可逆）
            compressed_audio, compression_params = self._apply_reversible_compressor(processed_audio)
            processed_audio = compressed_audio
            restoration_data["compression_params"] = compression_params
            restoration_data["preprocessing_steps"].append("compression")
            
            # 2. 音调标准化（可逆）
            if metadata.original_f0_mean and metadata.original_f0_mean > 0:
                pitch_shifted_audio, pitch_params = self._apply_reversible_pitch_shift(
                    processed_audio, sr, metadata.original_f0_mean
                )
                processed_audio = pitch_shifted_audio
                restoration_data["pitch_shift_params"] = pitch_params
                restoration_data["preprocessing_steps"].append("pitch_shift")
            
            # 3. 时间拉伸（可逆）
            if metadata.original_tempo and metadata.original_tempo > 0:
                time_stretched_audio, tempo_params = self._apply_reversible_time_stretch(
                    processed_audio, sr, metadata.original_tempo
                )
                processed_audio = time_stretched_audio
                restoration_data["tempo_stretch_params"] = tempo_params
                restoration_data["preprocessing_steps"].append("time_stretch")
                restoration_data["tempo_stretch_ratio"] = tempo_params.get("stretch_ratio", 1.0)
            
            # 4. 共振峰增强（可逆）
            enhanced_audio, formant_params = self._apply_reversible_formant_enhancement(
                processed_audio, sr
            )
            processed_audio = enhanced_audio
            restoration_data["formant_enhancement_params"] = formant_params
            restoration_data["preprocessing_steps"].append("formant_enhancement")
            
            # 5. 降噪（保留噪声特征）
            denoised_audio, noise_params = self._apply_reversible_denoising(processed_audio)
            processed_audio = denoised_audio
            restoration_data["denoising_params"] = noise_params
            restoration_data["preprocessing_steps"].append("denoising")
            
            return processed_audio, restoration_data
            
        except Exception as e:
            logger.warning(f"可逆演唱音频预处理失败，使用原音频: {e}")
            return audio, {}
    
    def _simple_preprocess(self, audio: np.ndarray) -> np.ndarray:
        """简化预处理，不保留恢复数据"""
        # 基本标准化
        audio = audio - np.mean(audio)
        max_val = np.max(np.abs(audio))
        if max_val > 0:
            audio = audio / max_val * 0.8
        return audio
    
    def _apply_reversible_compressor(self, audio: np.ndarray, threshold: float = 0.3, ratio: float = 4.0) -> Tuple[np.ndarray, Dict[str, Any]]:
        """可逆动态范围压缩"""
        # 记录压缩参数
        params = {
            "threshold": threshold,
            "ratio": ratio,
            "original_peak": float(np.max(np.abs(audio))),
            "original_rms": float(np.sqrt(np.mean(audio**2)))
        }
        
        # 检测信号幅度
        abs_audio = np.abs(audio)
        
        # 应用压缩
        compressed = np.where(
            abs_audio > threshold,
            threshold + (abs_audio - threshold) / ratio,
            abs_audio
        ) * np.sign(audio)
        
        return compressed, params
    
    def _apply_reversible_pitch_shift(self, audio: np.ndarray, sr: int, original_f0: float) -> Tuple[np.ndarray, Dict[str, Any]]:
        """可逆音调偏移"""
        try:
            # 语声典型基频
            target_f0 = 150  # 中性语调
            
            # 计算需要的偏移量
            semitones_shift = 12 * np.log2(target_f0 / original_f0)
            semitones_shift = np.clip(semitones_shift, -12, 12)
            
            params = {
                "original_f0": original_f0,
                "target_f0": target_f0,
                "semitones_shift": float(semitones_shift)
            }
            
            # 只在显著差异时应用
            if abs(semitones_shift) > 1:
                shifted_audio = librosa.effects.pitch_shift(audio, sr=sr, n_steps=semitones_shift)
                return shifted_audio, params
            else:
                return audio, params
                
        except Exception as e:
            logger.warning(f"音调偏移失败: {e}")
            return audio, {"error": str(e)}
    
    def _apply_reversible_time_stretch(self, audio: np.ndarray, sr: int, original_tempo: float) -> Tuple[np.ndarray, Dict[str, Any]]:
        """可逆时间拉伸"""
        try:
            # 语声典型节拍
            target_tempo = 120  # BPM
            
            # 计算拉伸比例
            stretch_ratio = original_tempo / target_tempo
            stretch_ratio = np.clip(stretch_ratio, 0.8, 1.2)
            
            params = {
                "original_tempo": original_tempo,
                "target_tempo": target_tempo,
                "stretch_ratio": float(stretch_ratio)
            }
            
            # 只在显著差异时应用
            if abs(stretch_ratio - 1.0) > 0.05:
                stretched_audio = librosa.effects.time_stretch(audio, rate=stretch_ratio)
                return stretched_audio, params
            else:
                return audio, params
                
        except Exception as e:
            logger.warning(f"时间拉伸失败: {e}")
            return audio, {"error": str(e)}
    
    def _apply_reversible_formant_enhancement(self, audio: np.ndarray, sr: int) -> Tuple[np.ndarray, Dict[str, Any]]:
        """可逆共振峰增强"""
        try:
            # 记录原始频谱
            original_fft = np.fft.rfft(audio)
            freqs = np.fft.rfftfreq(len(audio), 1/sr)
            
            # 语声共振峰频段增强
            voice_band = (freqs >= 300) & (freqs <= 3000)
            enhancement_factor = 1.1
            
            params = {
                "enhancement_factor": enhancement_factor,
                "frequency_range": [300, 3000],
                "original_spectrum_mean": float(np.mean(np.abs(original_fft[voice_band])))
            }
            
            # 应用增强
            enhanced_fft = original_fft.copy()
            enhanced_fft[voice_band] *= enhancement_factor
            
            enhanced_audio = np.fft.irfft(enhanced_fft, len(audio))
            
            return enhanced_audio, params
            
        except Exception as e:
            logger.warning(f"共振峰增强失败: {e}")
            return audio, {"error": str(e)}
    
    def _apply_reversible_denoising(self, audio: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
        """可逆降噪"""
        try:
            # 估计噪声特征（前0.5秒）
            noise_frames = min(int(0.5 * len(audio)), len(audio) // 4)
            noise_sample = audio[:noise_frames]
            
            params = {
                "noise_level": float(np.std(noise_sample)),
                "noise_mean": float(np.mean(noise_sample)),
                "original_rms": float(np.sqrt(np.mean(audio**2)))
            }
            
            # 移除直流偏置
            denoised = audio - np.mean(audio)
            
            # 简单高通滤波移除低频噪声
            fft = np.fft.rfft(denoised)
            freqs = np.fft.rfftfreq(len(denoised))
            
            # 保留语音频段
            high_pass_cutoff = 0.01  # 归一化频率
            fft[freqs < high_pass_cutoff] *= 0.1
            
            denoised = np.fft.irfft(fft, len(denoised))
            
            # 标准化
            max_val = np.max(np.abs(denoised))
            if max_val > 0:
                denoised = denoised / max_val * 0.8
            
            return denoised, params
            
        except Exception as e:
            logger.warning(f"降噪失败: {e}")
            return audio, {"error": str(e)}
    
    async def transcribe(self, audio_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        """
        简化的语音转文字接口（向后兼容）
        """
        try:
            # 创建临时会话
            session_id = self.create_session(audio_path)
            
            # 进行识别
            result = await self.transcribe_with_session(session_id, language, preserve_original=False)
            
            # 清理会话
            self.cleanup_session(session_id)
            
            return result
            
        except Exception as e:
            logger.error(f"语音识别失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_session_metadata(self, session_id: str) -> Optional[Dict[str, Any]]:
        """获取会话的音频元数据"""
        if session_id not in self.sessions:
            return None
        
        session = self.sessions[session_id]
        return session.metadata.to_dict()
    
    def get_restoration_data(self, session_id: str) -> Optional[Dict[str, Any]]:
        """获取用于音频重合成的恢复数据"""
        if session_id not in self.sessions:
            return None
        
        session = self.sessions[session_id]
        if session.recognition_result and "restoration_data" in session.recognition_result:
            return session.recognition_result["restoration_data"]
        
        return None
    
    def cleanup_session(self, session_id: str) -> bool:
        """清理会话数据"""
        try:
            if session_id not in self.sessions:
                return False
            
            session = self.sessions[session_id]
            
            # 清理临时文件
            for temp_file in session.temp_files:
                try:
                    if os.path.exists(temp_file):
                        os.unlink(temp_file)
                except Exception as e:
                    logger.warning(f"清理临时文件失败 {temp_file}: {e}")
            
            # 删除会话
            del self.sessions[session_id]
            logger.info(f"清理会话: {session_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"清理会话失败: {e}")
            return False
    
    def list_active_sessions(self) -> List[Dict[str, Any]]:
        """列出所有活跃会话"""
        sessions_info = []
        for session_id, session in self.sessions.items():
            sessions_info.append({
                "session_id": session_id,
                "created_at": session.created_at.isoformat(),
                "audio_file": session.audio_file_path,
                "has_result": session.recognition_result is not None
            })
        return sessions_info
    
    async def extract_vocals_and_transcribe_with_session(self, session_id: str, language: Optional[str] = None) -> Dict[str, Any]:
        """
        使用会话进行人声提取和语音识别
        """
        try:
            if session_id not in self.sessions:
                return {
                    "success": False,
                    "error": f"会话 {session_id} 不存在"
                }
            
            session = self.sessions[session_id]
            
            # 首先进行人声分离
            vocals_audio = await self._extract_vocals_advanced(session.audio_file_path, session)
            
            if vocals_audio is None:
                # 如果分离失败，直接对原音频进行识别
                return await self.transcribe_with_session(session_id, language)
            
            # 保存人声到临时文件
            temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            session.temp_files.append(temp_file.name)
            sf.write(temp_file.name, vocals_audio, 16000)
            temp_file.close()
            
            # 创建新会话用于人声识别
            vocals_session_id = self.create_session(temp_file.name)
            
            try:
                # 对人声进行识别
                result = await self.transcribe_with_session(vocals_session_id, language)
                result["vocal_extraction"] = True
                result["original_session_id"] = session_id
                
                return result
                
            finally:
                # 清理人声会话
                self.cleanup_session(vocals_session_id)
                
        except Exception as e:
            logger.error(f"人声提取和识别失败: {e}")
            # 降级为直接识别原音频
            return await self.transcribe_with_session(session_id, language)
    
    async def _extract_vocals_advanced(self, audio_path: str, session: RecognitionSession) -> Optional[np.ndarray]:
        """高级人声提取，保留更多信息"""
        try:
            # 加载音频
            y, sr = librosa.load(audio_path, sr=16000, mono=False)
            
            if y.ndim == 1:
                # 单声道，无法分离，返回原音频
                return librosa.util.normalize(y)
            
            # 立体声处理
            left = y[0]
            right = y[1]
            
            # 保存立体声信息到会话
            stereo_info = {
                "has_stereo": True,
                "left_channel_rms": float(np.sqrt(np.mean(left**2))),
                "right_channel_rms": float(np.sqrt(np.mean(right**2))),
                "correlation": float(np.corrcoef(left, right)[0, 1])
            }
            session.metadata.transform_parameters["stereo_info"] = stereo_info
            
            # 多种方法结合的人声分离
            # 方法1: 中央声道分离
            vocals_center = (left + right) / 2
            
            # 方法2: 侧音分离 (left - right)
            side = (left - right) / 2
            
            # 方法3: 基于能量的权重组合
            center_energy = np.sqrt(np.mean(vocals_center**2))
            side_energy = np.sqrt(np.mean(side**2))
            
            if center_energy > side_energy:
                # 人声更可能在中央
                vocals = vocals_center
            else:
                # 混合方法
                vocals = 0.7 * vocals_center + 0.3 * side
            
            # 动态范围优化
            rms = librosa.feature.rms(y=vocals)[0]
            threshold = np.percentile(rms, 20)  # 保留能量较高的部分
            
            # 应用软阈值
            mask = rms > threshold
            if np.any(mask):
                # 平滑掩码
                mask_smooth = np.convolve(mask.astype(float), np.ones(3)/3, mode='same') > 0.5
                
                # 保留高能量段，衰减低能量段
                frame_length = len(vocals) // len(rms)
                energy_mask = np.repeat(mask_smooth, frame_length)[:len(vocals)]
                vocals = vocals * (0.3 + 0.7 * energy_mask)
            
            # 标准化
            vocals = librosa.util.normalize(vocals)
            
            return vocals
            
        except Exception as e:
            logger.error(f"高级人声提取失败: {e}")
            return None
    
    async def get_supported_languages(self) -> Dict[str, Any]:
        """获取支持的语言列表"""
        if not self.model_loaded:
            return {
                "success": False,
                "error": "Whisper 模型未加载"
            }
        
        languages = {
            "zh": "中文",
            "en": "英语", 
            "ja": "日语",
            "ko": "韩语",
            "es": "西班牙语",
            "fr": "法语",
            "de": "德语",
            "it": "意大利语",
            "pt": "葡萄牙语",
            "ru": "俄语",
            "ar": "阿拉伯语",
            "hi": "印地语",
            "auto": "自动检测"
        }
        
        return {
            "success": True,
            "languages": languages,
            "default": "auto",
            "model": "whisper-base"
        }
    
    async def transcribe_with_timestamps_session(self, session_id: str, language: Optional[str] = None) -> Dict[str, Any]:
        """
        使用会话进行带时间戳的语音识别（用于歌词同步）
        """
        try:
            result = await self.transcribe_with_session(session_id, language, preserve_original=True)
            
            if not result["success"]:
                return result
            
            # 处理为歌词格式
            lyrics_lines = []
            for segment in result["segments"]:
                lyrics_lines.append({
                    "start_time": segment["start"],
                    "end_time": segment["end"],
                    "text": segment["text"],
                    "confidence": 1.0 - segment["confidence"],  # 转换为置信度
                    "words": self._split_into_words_advanced(
                        segment["text"], 
                        segment["start"], 
                        segment["end"],
                        session_id
                    )
                })
            
            return {
                "success": True,
                "session_id": session_id,
                "full_text": result["text"],
                "lyrics_lines": lyrics_lines,
                "language": result["language"],
                "total_duration": result["duration"],
                "audio_metadata": result.get("audio_metadata"),
                "restoration_data": result.get("restoration_data")
            }
            
        except Exception as e:
            logger.error(f"时间戳转录失败: {e}")
            return {
                "success": False,
                "error": str(e),
                "session_id": session_id
            }
    
    def _split_into_words_advanced(self, text: str, start_time: float, end_time: float, session_id: str) -> list:
        """高级单词/字符分割，考虑演唱特征"""
        words = text.split()
        duration = end_time - start_time
        
        if not words:
            return []
        
        # 检查是否有节拍信息用于更精确的时间分割
        restoration_data = self.get_restoration_data(session_id)
        tempo_ratio = 1.0
        if restoration_data and "tempo_stretch_ratio" in restoration_data:
            tempo_ratio = restoration_data["tempo_stretch_ratio"]
        
        # 考虑演唱中的延音和休止符
        # 简化版本：为长音符留更多时间
        word_durations = []
        total_chars = sum(len(word) for word in words)
        
        for word in words:
            # 基于字符数和可能的延音特征分配时间
            base_duration = duration * len(word) / total_chars
            
            # 检查是否包含可能的延音字符
            if any(char in word for char in ['ah', 'oh', 'la', '啊', '哦', '呃']):
                base_duration *= 1.3  # 延音增加30%时间
            
            word_durations.append(base_duration)
        
        # 标准化总时间
        total_estimated = sum(word_durations)
        if total_estimated > 0:
            word_durations = [d * duration / total_estimated for d in word_durations]
        
        word_timestamps = []
        current_time = start_time
        
        for i, (word, word_duration) in enumerate(zip(words, word_durations)):
            word_end = current_time + word_duration
            
            word_timestamps.append({
                "word": word,
                "start": current_time,
                "end": word_end,
                "confidence": 0.8,  # 基础置信度
                "tempo_adjusted": tempo_ratio != 1.0
            })
            
            current_time = word_end
        
        return word_timestamps
