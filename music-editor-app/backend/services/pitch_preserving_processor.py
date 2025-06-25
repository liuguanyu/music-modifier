#!/usr/bin/env python3
"""
音高保持处理器
基于WORLD声码器和高级信号处理技术实现音色保持
"""

import os
import logging
import numpy as np
import librosa
import soundfile as sf
from typing import Optional, Dict, Any, Tuple
import tempfile

try:
    import pyworld as pw
    PYWORLD_AVAILABLE = True
except ImportError:
    PYWORLD_AVAILABLE = False
    logging.warning("PyWorld未安装，将使用备用音色保持算法")

logger = logging.getLogger(__name__)

class PitchPreservingProcessor:
    """高级音高和音色保持处理器"""
    
    def __init__(self):
        """初始化处理器"""
        self.sample_rate = 22050
        self.frame_period = 5.0  # ms
        self.f0_floor = 71.0  # Hz
        self.f0_ceil = 800.0  # Hz
        
        # 检查依赖
        self.use_world = PYWORLD_AVAILABLE
        if self.use_world:
            logger.info("使用WORLD声码器进行音色保持")
        else:
            logger.info("使用librosa备用算法进行音色保持")
    
    def extract_voice_features(self, audio: np.ndarray) -> Dict[str, np.ndarray]:
        """
        提取音色特征
        
        Args:
            audio: 音频数据
            
        Returns:
            特征字典
        """
        try:
            features = {}
            
            if self.use_world:
                # 使用WORLD声码器提取特征
                features.update(self._extract_world_features(audio))
            
            # 使用librosa提取补充特征
            features.update(self._extract_librosa_features(audio))
            
            return features
            
        except Exception as e:
            logger.error(f"特征提取失败: {e}")
            # 降级到基础特征
            return self._extract_basic_features(audio)
    
    def _extract_world_features(self, audio: np.ndarray) -> Dict[str, np.ndarray]:
        """使用WORLD声码器提取特征"""
        features = {}
        
        try:
            # 确保音频为double类型
            audio = audio.astype(np.float64)
            
            # 基频提取
            f0, time_axis = pw.harvest(
                audio, 
                self.sample_rate, 
                frame_period=self.frame_period,
                f0_floor=self.f0_floor,
                f0_ceil=self.f0_ceil
            )
            
            # 精确基频提取
            f0_refined = pw.stonemask(audio, f0, time_axis, self.sample_rate)
            
            # 频谱包络提取
            sp = pw.cheaptrick(audio, f0_refined, time_axis, self.sample_rate)
            
            # 非周期性参数
            ap = pw.d4c(audio, f0_refined, time_axis, self.sample_rate)
            
            features.update({
                'world_f0': f0_refined,
                'world_sp': sp,
                'world_ap': ap,
                'world_time_axis': time_axis
            })
            
            logger.debug("WORLD特征提取完成")
            
        except Exception as e:
            logger.error(f"WORLD特征提取失败: {e}")
            
        return features
    
    def _extract_librosa_features(self, audio: np.ndarray) -> Dict[str, np.ndarray]:
        """使用librosa提取特征"""
        features = {}
        
        try:
            # 基频跟踪
            pitches, magnitudes = librosa.piptrack(
                y=audio, 
                sr=self.sample_rate,
                threshold=0.1,
                fmin=self.f0_floor,
                fmax=self.f0_ceil
            )
            
            # 提取主要基频
            f0_librosa = []
            for i in range(pitches.shape[1]):
                index = magnitudes[:, i].argmax()
                pitch = pitches[index, i]
                f0_librosa.append(pitch if pitch > 0 else 0)
            
            # 光谱特征
            spectral_centroid = librosa.feature.spectral_centroid(y=audio, sr=self.sample_rate)
            spectral_rolloff = librosa.feature.spectral_rolloff(y=audio, sr=self.sample_rate)
            spectral_bandwidth = librosa.feature.spectral_bandwidth(y=audio, sr=self.sample_rate)
            
            # MFCC特征
            mfcc = librosa.feature.mfcc(y=audio, sr=self.sample_rate, n_mfcc=13)
            
            # 色度特征
            chroma = librosa.feature.chroma_stft(y=audio, sr=self.sample_rate)
            
            # 声音特征
            zcr = librosa.feature.zero_crossing_rate(audio)
            
            features.update({
                'librosa_f0': np.array(f0_librosa),
                'spectral_centroid': spectral_centroid,
                'spectral_rolloff': spectral_rolloff,
                'spectral_bandwidth': spectral_bandwidth,
                'mfcc': mfcc,
                'chroma': chroma,
                'zcr': zcr
            })
            
            logger.debug("Librosa特征提取完成")
            
        except Exception as e:
            logger.error(f"Librosa特征提取失败: {e}")
            
        return features
    
    def _extract_basic_features(self, audio: np.ndarray) -> Dict[str, np.ndarray]:
        """提取基础特征（降级方案）"""
        features = {}
        
        try:
            # 简单的频谱分析
            stft = librosa.stft(audio)
            magnitude = np.abs(stft)
            phase = np.angle(stft)
            
            features.update({
                'stft_magnitude': magnitude,
                'stft_phase': phase
            })
            
        except Exception as e:
            logger.error(f"基础特征提取失败: {e}")
            
        return features
    
    def transfer_voice_characteristics(
        self,
        source_audio: np.ndarray,
        target_audio: np.ndarray,
        preservation_strength: float = 0.8
    ) -> np.ndarray:
        """
        音色特征转移
        
        Args:
            source_audio: 源音频（提供音色特征）
            target_audio: 目标音频（需要应用音色）
            preservation_strength: 保持强度 (0.0-1.0)
            
        Returns:
            处理后的音频
        """
        try:
            logger.info(f"开始音色特征转移，保持强度: {preservation_strength}")
            
            # 提取特征
            source_features = self.extract_voice_features(source_audio)
            target_features = self.extract_voice_features(target_audio)
            
            # 应用音色转移
            if self.use_world and 'world_f0' in source_features:
                processed_audio = self._world_voice_transfer(
                    source_features, target_features, target_audio, preservation_strength
                )
            else:
                processed_audio = self._librosa_voice_transfer(
                    source_features, target_features, target_audio, preservation_strength
                )
            
            logger.info("音色特征转移完成")
            return processed_audio
            
        except Exception as e:
            logger.error(f"音色特征转移失败: {e}")
            return target_audio
    
    def _world_voice_transfer(
        self,
        source_features: Dict[str, np.ndarray],
        target_features: Dict[str, np.ndarray],
        target_audio: np.ndarray,
        strength: float
    ) -> np.ndarray:
        """使用WORLD进行音色转移"""
        try:
            # 获取目标音频的WORLD特征
            if 'world_f0' not in target_features:
                target_features = self.extract_voice_features(target_audio)
            
            # 混合频谱包络
            mixed_sp = self._blend_spectral_envelope(
                source_features['world_sp'],
                target_features['world_sp'],
                strength
            )
            
            # 混合非周期性参数
            mixed_ap = self._blend_aperiodic_parameters(
                source_features['world_ap'],
                target_features['world_ap'],
                strength
            )
            
            # 保持目标的基频信息
            target_f0 = target_features['world_f0']
            target_time_axis = target_features['world_time_axis']
            
            # 重合成音频
            synthesized = pw.synthesize(
                target_f0,
                mixed_sp,
                mixed_ap,
                self.sample_rate,
                frame_period=self.frame_period
            )
            
            return synthesized.astype(np.float32)
            
        except Exception as e:
            logger.error(f"WORLD音色转移失败: {e}")
            return target_audio
    
    def _librosa_voice_transfer(
        self,
        source_features: Dict[str, np.ndarray],
        target_features: Dict[str, np.ndarray],
        target_audio: np.ndarray,
        strength: float
    ) -> np.ndarray:
        """使用librosa进行音色转移"""
        try:
            # 频谱域处理
            target_stft = librosa.stft(target_audio)
            target_magnitude = np.abs(target_stft)
            target_phase = np.angle(target_stft)
            
            # 应用音色特征
            modified_magnitude = self._apply_timbre_modification(
                target_magnitude,
                source_features,
                target_features,
                strength
            )
            
            # 重构音频
            modified_stft = modified_magnitude * np.exp(1j * target_phase)
            processed_audio = librosa.istft(modified_stft)
            
            return processed_audio
            
        except Exception as e:
            logger.error(f"Librosa音色转移失败: {e}")
            return target_audio
    
    def _blend_spectral_envelope(
        self,
        source_sp: np.ndarray,
        target_sp: np.ndarray,
        strength: float
    ) -> np.ndarray:
        """混合频谱包络"""
        try:
            # 调整长度
            min_frames = min(source_sp.shape[0], target_sp.shape[0])
            source_sp = source_sp[:min_frames]
            target_sp = target_sp[:min_frames]
            
            # 对数域混合
            log_source = np.log(source_sp + 1e-10)
            log_target = np.log(target_sp + 1e-10)
            
            # 线性插值
            mixed_log = (1 - strength) * log_target + strength * log_source
            mixed_sp = np.exp(mixed_log)
            
            return mixed_sp
            
        except Exception as e:
            logger.error(f"频谱包络混合失败: {e}")
            return target_sp
    
    def _blend_aperiodic_parameters(
        self,
        source_ap: np.ndarray,
        target_ap: np.ndarray,
        strength: float
    ) -> np.ndarray:
        """混合非周期性参数"""
        try:
            # 调整长度
            min_frames = min(source_ap.shape[0], target_ap.shape[0])
            source_ap = source_ap[:min_frames]
            target_ap = target_ap[:min_frames]
            
            # 线性插值混合
            mixed_ap = (1 - strength) * target_ap + strength * source_ap
            
            # 限制范围
            mixed_ap = np.clip(mixed_ap, 0.001, 0.999)
            
            return mixed_ap
            
        except Exception as e:
            logger.error(f"非周期性参数混合失败: {e}")
            return target_ap
    
    def _apply_timbre_modification(
        self,
        target_magnitude: np.ndarray,
        source_features: Dict[str, np.ndarray],
        target_features: Dict[str, np.ndarray],
        strength: float
    ) -> np.ndarray:
        """应用音色修改"""
        try:
            modified_magnitude = target_magnitude.copy()
            
            # 应用光谱重心调整
            if 'spectral_centroid' in source_features and 'spectral_centroid' in target_features:
                modified_magnitude = self._adjust_spectral_centroid(
                    modified_magnitude,
                    source_features['spectral_centroid'],
                    target_features['spectral_centroid'],
                    strength
                )
            
            # 应用MFCC调整
            if 'mfcc' in source_features and 'mfcc' in target_features:
                modified_magnitude = self._adjust_with_mfcc(
                    modified_magnitude,
                    source_features['mfcc'],
                    target_features['mfcc'],
                    strength
                )
            
            return modified_magnitude
            
        except Exception as e:
            logger.error(f"音色修改应用失败: {e}")
            return target_magnitude
    
    def _adjust_spectral_centroid(
        self,
        magnitude: np.ndarray,
        source_centroid: np.ndarray,
        target_centroid: np.ndarray,
        strength: float
    ) -> np.ndarray:
        """调整光谱重心"""
        try:
            # 计算重心差异
            source_mean = np.mean(source_centroid)
            target_mean = np.mean(target_centroid)
            
            if target_mean > 0:
                centroid_ratio = source_mean / target_mean
                
                # 创建频率加权
                freq_bins = magnitude.shape[0]
                freq_weights = np.linspace(0.5, 2.0, freq_bins)
                
                # 应用重心调整
                adjustment = 1 + (centroid_ratio - 1) * strength * 0.3
                freq_weights = freq_weights ** adjustment
                
                # 应用权重
                modified_magnitude = magnitude * freq_weights.reshape(-1, 1)
                
                return modified_magnitude
            
            return magnitude
            
        except Exception as e:
            logger.error(f"光谱重心调整失败: {e}")
            return magnitude
    
    def _adjust_with_mfcc(
        self,
        magnitude: np.ndarray,
        source_mfcc: np.ndarray,
        target_mfcc: np.ndarray,
        strength: float
    ) -> np.ndarray:
        """基于MFCC进行调整"""
        try:
            # 计算MFCC差异
            mfcc_diff = np.mean(source_mfcc, axis=1) - np.mean(target_mfcc, axis=1)
            
            # 创建频率滤波器
            freq_bins = magnitude.shape[0]
            mel_filters = librosa.filters.mel(sr=self.sample_rate, n_fft=2*freq_bins-2, n_mels=13)
            
            # 计算调整权重
            adjustment_weights = np.ones(freq_bins)
            
            for i, diff in enumerate(mfcc_diff[:min(13, len(mfcc_diff))]):
                # 将MFCC差异映射到频率权重
                weight_factor = 1 + diff * strength * 0.1
                mel_weight = mel_filters[i] * weight_factor
                adjustment_weights += mel_weight[:freq_bins]
            
            # 应用调整
            modified_magnitude = magnitude * adjustment_weights.reshape(-1, 1)
            
            return modified_magnitude
            
        except Exception as e:
            logger.error(f"MFCC调整失败: {e}")
            return magnitude
    
    def pitch_shift_with_voice_preservation(
        self,
        audio: np.ndarray,
        semitones: float,
        preserve_formants: bool = True
    ) -> np.ndarray:
        """
        音高调整同时保持音色
        
        Args:
            audio: 音频数据
            semitones: 半音数
            preserve_formants: 是否保持共振峰
            
        Returns:
            处理后的音频
        """
        try:
            if self.use_world and preserve_formants:
                return self._world_pitch_shift(audio, semitones)
            else:
                return self._librosa_pitch_shift(audio, semitones, preserve_formants)
                
        except Exception as e:
            logger.error(f"音高调整失败: {e}")
            return audio
    
    def _world_pitch_shift(self, audio: np.ndarray, semitones: float) -> np.ndarray:
        """使用WORLD进行音高调整"""
        try:
            # 确保音频为double类型
            audio = audio.astype(np.float64)
            
            # 提取WORLD特征
            f0, time_axis = pw.harvest(
                audio, self.sample_rate, frame_period=self.frame_period
            )
            f0 = pw.stonemask(audio, f0, time_axis, self.sample_rate)
            sp = pw.cheaptrick(audio, f0, time_axis, self.sample_rate)
            ap = pw.d4c(audio, f0, time_axis, self.sample_rate)
            
            # 计算音高比例
            pitch_ratio = 2 ** (semitones / 12.0)
            
            # 调整基频
            modified_f0 = f0 * pitch_ratio
            modified_f0 = np.clip(modified_f0, self.f0_floor, self.f0_ceil)
            
            # 重合成（保持共振峰）
            synthesized = pw.synthesize(
                modified_f0, sp, ap, self.sample_rate, frame_period=self.frame_period
            )
            
            return synthesized.astype(np.float32)
            
        except Exception as e:
            logger.error(f"WORLD音高调整失败: {e}")
            return audio
    
    def _librosa_pitch_shift(
        self, 
        audio: np.ndarray, 
        semitones: float, 
        preserve_formants: bool
    ) -> np.ndarray:
        """使用librosa进行音高调整"""
        try:
            if preserve_formants:
                # 提取原始音色特征
                original_features = self.extract_voice_features(audio)
                
                # 进行音高调整
                shifted = librosa.effects.pitch_shift(
                    audio, sr=self.sample_rate, n_steps=semitones
                )
                
                # 恢复音色特征
                processed = self.transfer_voice_characteristics(
                    audio, shifted, preservation_strength=0.7
                )
                
                return processed
            else:
                # 简单音高调整
                return librosa.effects.pitch_shift(
                    audio, sr=self.sample_rate, n_steps=semitones
                )
                
        except Exception as e:
            logger.error(f"Librosa音高调整失败: {e}")
            return audio
    
    def time_stretch_with_voice_preservation(
        self,
        audio: np.ndarray,
        rate: float,
        preserve_pitch: bool = True
    ) -> np.ndarray:
        """
        时间拉伸同时保持音色
        
        Args:
            audio: 音频数据
            rate: 拉伸比例 (>1 加快, <1 减慢)
            preserve_pitch: 是否保持音高
            
        Returns:
            处理后的音频
        """
        try:
            if self.use_world and preserve_pitch:
                return self._world_time_stretch(audio, rate)
            else:
                return self._librosa_time_stretch(audio, rate, preserve_pitch)
                
        except Exception as e:
            logger.error(f"时间拉伸失败: {e}")
            return audio
    
    def _world_time_stretch(self, audio: np.ndarray, rate: float) -> np.ndarray:
        """使用WORLD进行时间拉伸"""
        try:
            # 简单的时间轴重采样方法
            # 在实际应用中可以使用更复杂的WORLD时间拉伸算法
            
            # 提取特征
            features = self.extract_voice_features(audio)
            
            # 时间轴调整
            if 'world_time_axis' in features:
                new_length = int(len(audio) / rate)
                stretched = librosa.effects.time_stretch(audio, rate=rate)
                
                # 应用音色保持
                if len(stretched) != len(audio):
                    processed = self.transfer_voice_characteristics(
                        audio, stretched, preservation_strength=0.8
                    )
                    return processed
            
            return librosa.effects.time_stretch(audio, rate=rate)
            
        except Exception as e:
            logger.error(f"WORLD时间拉伸失败: {e}")
            return audio
    
    def _librosa_time_stretch(
        self, 
        audio: np.ndarray, 
        rate: float, 
        preserve_pitch: bool
    ) -> np.ndarray:
        """使用librosa进行时间拉伸"""
        try:
            if preserve_pitch:
                # 提取原始特征
                original_features = self.extract_voice_features(audio)
                
                # 时间拉伸
                stretched = librosa.effects.time_stretch(audio, rate=rate)
                
                # 恢复音色特征
                processed = self.transfer_voice_characteristics(
                    audio, stretched, preservation_strength=0.6
                )
                
                return processed
            else:
                return librosa.effects.time_stretch(audio, rate=rate)
                
        except Exception as e:
            logger.error(f"Librosa时间拉伸失败: {e}")
            return audio

# 导出类
__all__ = ['PitchPreservingProcessor']
