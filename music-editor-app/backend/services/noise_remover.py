"""
噪音移除服务
专门处理音频分离后的白噪音和其他噪音问题
"""

import numpy as np
import librosa
import soundfile as sf
from scipy import signal
import scipy.fft as fft
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class NoiseRemover:
    """高精度噪音移除器"""
    
    def __init__(self):
        self.output_dir = Path("uploads/cleaned")
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    async def remove_noise(self, audio_path: str, noise_type: str = "auto", strength: float = 0.8) -> dict:
        """
        移除音频中的噪音
        
        Args:
            audio_path: 输入音频文件路径
            noise_type: 噪音类型 ("white", "hiss", "hum", "auto")
            strength: 降噪强度 (0.0-1.0)
            
        Returns:
            Dict: 处理结果
        """
        try:
            logger.info(f"开始降噪处理: {audio_path}, 类型: {noise_type}, 强度: {strength}")
            
            # 加载音频
            y, sr = librosa.load(audio_path, sr=None, mono=False)
            
            if y.ndim == 1:
                # 单声道处理
                cleaned = self._process_mono_noise_removal(y, sr, noise_type, strength)
            else:
                # 立体声处理
                cleaned = self._process_stereo_noise_removal(y, sr, noise_type, strength)
            
            # 生成输出文件名
            input_filename = Path(audio_path).stem
            cleaned_filename = f"{input_filename}_cleaned.wav"
            cleaned_path = self.output_dir / cleaned_filename
            
            # 保存清理后的音频
            sf.write(str(cleaned_path), cleaned, sr)
            
            # 计算噪音减少量
            noise_reduction = self._calculate_noise_reduction(y, cleaned)
            
            logger.info(f"降噪完成: {cleaned_path}, 噪音减少: {noise_reduction:.1f}dB")
            
            return {
                "success": True,
                "cleaned_path": str(cleaned_path),
                "cleaned_filename": cleaned_filename,
                "noise_reduction_db": noise_reduction,
                "sample_rate": sr,
                "duration": len(cleaned) / sr
            }
            
        except Exception as e:
            logger.error(f"降噪处理失败: {e}")
            return {"success": False, "error": str(e)}
    
    def _process_mono_noise_removal(self, audio: np.ndarray, sr: int, noise_type: str, strength: float) -> np.ndarray:
        """处理单声道音频降噪"""
        try:
            # 1. 自动检测噪音类型
            if noise_type == "auto":
                noise_type = self._detect_noise_type(audio, sr)
                logger.info(f"自动检测到噪音类型: {noise_type}")
            
            # 2. 应用相应的降噪算法
            if noise_type == "white":
                cleaned = self._remove_white_noise(audio, sr, strength)
            elif noise_type == "hiss":
                cleaned = self._remove_hiss_noise(audio, sr, strength)
            elif noise_type == "hum":
                cleaned = self._remove_hum_noise(audio, sr, strength)
            else:
                # 通用降噪
                cleaned = self._remove_general_noise(audio, sr, strength)
            
            # 3. 后处理平滑
            cleaned = self._smooth_audio(cleaned, sr)
            
            return cleaned
            
        except Exception as e:
            logger.warning(f"单声道降噪失败: {e}, 返回原音频")
            return audio
    
    def _process_stereo_noise_removal(self, audio: np.ndarray, sr: int, noise_type: str, strength: float) -> np.ndarray:
        """处理立体声音频降噪"""
        try:
            if audio.shape[0] == 2:
                audio = audio.T  # 转置为 (samples, channels)
            
            # 分别处理左右声道
            left_cleaned = self._process_mono_noise_removal(audio[:, 0], sr, noise_type, strength)
            right_cleaned = self._process_mono_noise_removal(audio[:, 1], sr, noise_type, strength)
            
            # 合并声道
            cleaned = np.column_stack([left_cleaned, right_cleaned])
            
            # 立体声相关性增强 (减少声道间的噪音差异)
            cleaned = self._enhance_stereo_coherence(cleaned, strength * 0.3)
            
            return cleaned
            
        except Exception as e:
            logger.warning(f"立体声降噪失败: {e}, 返回原音频")
            return audio
    
    def _detect_noise_type(self, audio: np.ndarray, sr: int) -> str:
        """自动检测噪音类型"""
        try:
            # 计算频谱
            freqs, times, stft = signal.stft(audio, sr, nperseg=2048)
            power_spectrum = np.abs(stft) ** 2
            avg_power = np.mean(power_spectrum, axis=1)
            
            # 分析频谱特征
            # 白噪音: 频谱相对平坦
            # 嘶嘶声: 高频能量较高
            # 嗡嗡声: 低频有峰值
            
            low_freq_power = np.mean(avg_power[freqs < 200])  # <200Hz
            mid_freq_power = np.mean(avg_power[(freqs >= 200) & (freqs < 2000)])  # 200Hz-2kHz
            high_freq_power = np.mean(avg_power[freqs >= 2000])  # >2kHz
            
            total_power = low_freq_power + mid_freq_power + high_freq_power
            
            if total_power > 0:
                low_ratio = low_freq_power / total_power
                high_ratio = high_freq_power / total_power
                
                if low_ratio > 0.4:
                    return "hum"  # 低频嗡嗡声
                elif high_ratio > 0.4:
                    return "hiss"  # 高频嘶嘶声
                else:
                    return "white"  # 白噪音或通用噪音
            
            return "white"
            
        except Exception as e:
            logger.warning(f"噪音类型检测失败: {e}, 使用通用降噪")
            return "white"
    
    def _remove_white_noise(self, audio: np.ndarray, sr: int, strength: float) -> np.ndarray:
        """移除白噪音"""
        try:
            # 使用谱减法
            return self._spectral_subtraction_denoise(audio, sr, strength)
            
        except Exception as e:
            logger.warning(f"白噪音移除失败: {e}")
            return audio
    
    def _remove_hiss_noise(self, audio: np.ndarray, sr: int, strength: float) -> np.ndarray:
        """移除高频嘶嘶声"""
        try:
            # 1. 高频噪音门限
            cleaned = self._high_frequency_gating(audio, sr, strength)
            
            # 2. 自适应高切滤波
            cleaned = self._adaptive_highcut_filter(cleaned, sr, strength)
            
            return cleaned
            
        except Exception as e:
            logger.warning(f"嘶嘶声移除失败: {e}")
            return audio
    
    def _remove_hum_noise(self, audio: np.ndarray, sr: int, strength: float) -> np.ndarray:
        """移除低频嗡嗡声"""
        try:
            # 1. 陷波滤波器 (50/60Hz及其谐波)
            cleaned = audio.copy()
            
            # 移除50Hz, 100Hz, 150Hz (欧洲电网噪音)
            for freq in [50, 100, 150]:
                cleaned = self._notch_filter(cleaned, sr, freq, strength)
            
            # 移除60Hz, 120Hz, 180Hz (美洲电网噪音)
            for freq in [60, 120, 180]:
                cleaned = self._notch_filter(cleaned, sr, freq, strength)
            
            # 2. 低频噪音门限
            cleaned = self._low_frequency_gating(cleaned, sr, strength)
            
            return cleaned
            
        except Exception as e:
            logger.warning(f"嗡嗡声移除失败: {e}")
            return audio
    
    def _remove_general_noise(self, audio: np.ndarray, sr: int, strength: float) -> np.ndarray:
        """通用降噪算法"""
        try:
            # 1. 谱减法基础降噪
            cleaned = self._spectral_subtraction_denoise(audio, sr, strength)
            
            # 2. 维纳滤波
            cleaned = self._wiener_filter_denoise(cleaned, sr, strength * 0.7)
            
            # 3. 自适应滤波
            cleaned = self._adaptive_filter_denoise(cleaned, sr, strength * 0.5)
            
            return cleaned
            
        except Exception as e:
            logger.warning(f"通用降噪失败: {e}")
            return audio
    
    def _spectral_subtraction_denoise(self, audio: np.ndarray, sr: int, strength: float) -> np.ndarray:
        """谱减法降噪"""
        try:
            # 短时傅里叶变换
            freqs, times, stft = signal.stft(audio, sr, nperseg=2048, noverlap=1536)
            
            # 估计噪音功率谱 (使用音频开头和结尾的安静部分)
            quiet_samples = min(int(0.5 * sr), stft.shape[1] // 4)  # 0.5秒或1/4长度
            noise_power = np.mean(
                np.abs(stft[:, :quiet_samples]) ** 2 + 
                np.abs(stft[:, -quiet_samples:]) ** 2, 
                axis=1, keepdims=True
            )
            
            # 信号功率谱
            signal_power = np.abs(stft) ** 2
            
            # 计算增益函数
            snr = signal_power / (noise_power + 1e-10)
            alpha = 2.0 * strength  # 过减法系数
            beta = 0.01  # 最小增益
            
            gain = 1 - alpha / (snr + 1e-10)
            gain = np.maximum(gain, beta)  # 限制最小增益
            
            # 应用增益
            cleaned_stft = stft * gain
            
            # 逆变换
            _, cleaned = signal.istft(cleaned_stft, sr, nperseg=2048, noverlap=1536)
            
            return cleaned[:len(audio)]  # 确保长度一致
            
        except Exception as e:
            logger.warning(f"谱减法降噪失败: {e}")
            return audio
    
    def _wiener_filter_denoise(self, audio: np.ndarray, sr: int, strength: float) -> np.ndarray:
        """维纳滤波降噪"""
        try:
            # 简化的维纳滤波实现
            # 计算功率谱密度
            freqs, psd = signal.welch(audio, sr, nperseg=2048)
            
            # 估计信噪比
            noise_floor = np.percentile(psd, 20)  # 底部20%作为噪音基准
            snr = psd / (noise_floor + 1e-10)
            
            # 维纳增益
            wiener_gain = snr / (snr + 1 / strength)
            
            # 在频域应用滤波
            audio_fft = fft.rfft(audio)
            freq_bins = fft.rfftfreq(len(audio), d=1/sr)
            
            # 插值获得每个频率bin的增益
            gain_interp = np.interp(freq_bins, freqs, wiener_gain)
            filtered_fft = audio_fft * gain_interp
            
            cleaned = fft.irfft(filtered_fft, n=len(audio))
            
            return cleaned
            
        except Exception as e:
            logger.warning(f"维纳滤波失败: {e}")
            return audio
    
    def _adaptive_filter_denoise(self, audio: np.ndarray, sr: int, strength: float) -> np.ndarray:
        """自适应滤波降噪"""
        try:
            # 滑动窗口自适应降噪
            window_size = int(0.1 * sr)  # 100ms窗口
            hop_size = window_size // 4
            
            cleaned = np.zeros_like(audio)
            
            for i in range(0, len(audio) - window_size, hop_size):
                window = audio[i:i + window_size]
                
                # 计算窗口能量
                energy = np.mean(window ** 2)
                
                if energy > 1e-6:  # 有信号的窗口
                    # 自适应增益
                    gain = min(1.0, 1.0 / (1.0 + strength * 0.1 / energy))
                    cleaned_window = window * gain
                else:  # 安静窗口，强降噪
                    cleaned_window = window * (1 - strength * 0.9)
                
                # 重叠相加
                cleaned[i:i + window_size] += cleaned_window * 0.25
            
            return cleaned
            
        except Exception as e:
            logger.warning(f"自适应滤波失败: {e}")
            return audio
    
    def _high_frequency_gating(self, audio: np.ndarray, sr: int, strength: float) -> np.ndarray:
        """高频噪音门限"""
        try:
            # 频谱分析
            freqs, times, stft = signal.stft(audio, sr, nperseg=1024)
            
            # 高频部分 (>4kHz)
            high_freq_mask = freqs > 4000
            high_freq_power = np.abs(stft[high_freq_mask, :]) ** 2
            
            # 计算动态阈值
            high_freq_median = np.median(high_freq_power, axis=0)
            threshold = high_freq_median * (2 - strength)  # 强度越高，阈值越低
            
            # 应用门限
            for i, freq_idx in enumerate(np.where(high_freq_mask)[0]):
                power = np.abs(stft[freq_idx, :]) ** 2
                gain = np.where(power > threshold, 1.0, 1 - strength * 0.8)
                stft[freq_idx, :] *= gain
            
            # 逆变换
            _, cleaned = signal.istft(stft, sr, nperseg=1024)
            
            return cleaned[:len(audio)]
            
        except Exception as e:
            logger.warning(f"高频门限失败: {e}")
            return audio
    
    def _low_frequency_gating(self, audio: np.ndarray, sr: int, strength: float) -> np.ndarray:
        """低频噪音门限"""
        try:
            # 高通滤波器移除极低频
            cutoff = 20 * (1 + strength * 2)  # 20-60Hz动态截止频率
            nyquist = sr / 2
            
            if cutoff < nyquist:
                sos = signal.butter(4, cutoff / nyquist, btype='high', output='sos')
                cleaned = signal.sosfilt(sos, audio)
                return cleaned
            else:
                return audio
                
        except Exception as e:
            logger.warning(f"低频门限失败: {e}")
            return audio
    
    def _adaptive_highcut_filter(self, audio: np.ndarray, sr: int, strength: float) -> np.ndarray:
        """自适应高切滤波"""
        try:
            # 分析高频内容
            freqs, psd = signal.welch(audio, sr, nperseg=2048)
            
            # 寻找合适的高切频率
            cumulative_energy = np.cumsum(psd)
            total_energy = cumulative_energy[-1]
            
            # 保留99% - (strength * 5%)的能量
            energy_threshold = total_energy * (0.99 - strength * 0.05)
            cutoff_idx = np.where(cumulative_energy >= energy_threshold)[0]
            
            if len(cutoff_idx) > 0:
                cutoff_freq = freqs[cutoff_idx[0]]
                cutoff_freq = max(cutoff_freq, 8000)  # 最低8kHz
                
                nyquist = sr / 2
                if cutoff_freq < nyquist * 0.9:
                    sos = signal.butter(6, cutoff_freq / nyquist, btype='low', output='sos')
                    cleaned = signal.sosfilt(sos, audio)
                    return cleaned
            
            return audio
            
        except Exception as e:
            logger.warning(f"自适应高切滤波失败: {e}")
            return audio
    
    def _notch_filter(self, audio: np.ndarray, sr: int, freq: float, strength: float) -> np.ndarray:
        """陷波滤波器"""
        try:
            nyquist = sr / 2
            quality = 30 * strength  # Q因子
            
            if freq < nyquist:
                # 使用兼容性更好的方式创建陷波滤波器
                b, a = signal.iirnotch(freq / nyquist, quality)
                cleaned = signal.filtfilt(b, a, audio)
                return cleaned
            else:
                return audio
                
        except Exception as e:
            logger.warning(f"陷波滤波失败 {freq}Hz: {e}")
            return audio
    
    def _enhance_stereo_coherence(self, audio: np.ndarray, strength: float) -> np.ndarray:
        """增强立体声相关性，减少噪音差异"""
        try:
            if audio.shape[1] != 2:
                return audio
            
            left = audio[:, 0]
            right = audio[:, 1]
            
            # 计算相关性
            correlation = np.corrcoef(left, right)[0, 1] if len(left) > 1 else 0
            
            if correlation > 0.5:  # 高相关性时增强一致性
                # 中央成分
                mid = (left + right) / 2
                # 侧成分
                side_left = left - mid
                side_right = right - mid
                
                # 减少非相关噪音
                gain = 1 - strength
                enhanced_left = mid + side_left * gain
                enhanced_right = mid + side_right * gain
                
                return np.column_stack([enhanced_left, enhanced_right])
            
            return audio
            
        except Exception as e:
            logger.warning(f"立体声相关性增强失败: {e}")
            return audio
    
    def _smooth_audio(self, audio: np.ndarray, sr: int) -> np.ndarray:
        """平滑音频，移除突变"""
        try:
            # 轻微的低通滤波平滑
            cutoff = sr * 0.4  # 40%奈奎斯特频率
            nyquist = sr / 2
            
            if cutoff < nyquist:
                sos = signal.butter(2, cutoff / nyquist, btype='low', output='sos')
                smoothed = signal.sosfilt(sos, audio)
                
                # 与原音频混合 (95%处理后 + 5%原音频保持细节)
                return 0.95 * smoothed + 0.05 * audio
            
            return audio
            
        except Exception as e:
            logger.warning(f"音频平滑失败: {e}")
            return audio
    
    def _calculate_noise_reduction(self, original: np.ndarray, cleaned: np.ndarray) -> float:
        """计算噪音减少量 (dB)"""
        try:
            # 简单的能量对比
            original_energy = np.mean(original ** 2)
            cleaned_energy = np.mean(cleaned ** 2)
            
            if original_energy > 0 and cleaned_energy > 0:
                ratio = original_energy / cleaned_energy
                return 10 * np.log10(ratio)
            
            return 0.0
            
        except Exception as e:
            logger.warning(f"噪音减少量计算失败: {e}")
            return 0.0
    
    async def remove_separation_artifacts(self, vocals_path: str, accompaniment_path: str, strength: float = 0.8) -> dict:
        """专门移除音频分离后的伪影"""
        try:
            logger.info(f"移除分离伪影: vocals={vocals_path}, accompaniment={accompaniment_path}, 强度={strength}")
            
            # 处理人声轨道
            vocals_result = await self.remove_noise(vocals_path, "auto", strength)
            
            # 处理伴奏轨道 
            accompaniment_result = await self.remove_noise(accompaniment_path, "auto", strength)
            
            if vocals_result["success"] and accompaniment_result["success"]:
                return {
                    "success": True,
                    "vocals_cleaned": vocals_result,
                    "accompaniment_cleaned": accompaniment_result,
                    "total_noise_reduction": (
                        vocals_result["noise_reduction_db"] + 
                        accompaniment_result["noise_reduction_db"]
                    ) / 2
                }
            else:
                return {
                    "success": False,
                    "error": "部分轨道清理失败",
                    "vocals_result": vocals_result,
                    "accompaniment_result": accompaniment_result
                }
                
        except Exception as e:
            logger.error(f"分离伪影移除失败: {e}")
            return {"success": False, "error": str(e)}
