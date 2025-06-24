import React, { useState, useRef } from 'react';
import './AudioComposer.css';

const AudioComposer = ({ audioBuffer, audioFile, extractedLyrics, processedTracks }) => {
  const [isComposing, setIsComposing] = useState(false);
  const [compositionProgress, setCompositionProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [compositionSettings, setCompositionSettings] = useState({
    outputFormat: 'mp3',
    quality: 'high',
    includeLyrics: true,
    mixingMode: 'balanced'
  });
  const [composedAudio, setComposedAudio] = useState(null);

  // 模拟音频合成处理
  const simulateAudioComposition = async () => {
    setIsComposing(true);
    setCompositionProgress(0);
    
    try {
      // 模拟处理进度
      const steps = [
        { name: '准备音频轨道', progress: 20 },
        { name: '同步歌词时间轴', progress: 35 },
        { name: '混音处理', progress: 50 },
        { name: '应用音效增强', progress: 70 },
        { name: '编码输出格式', progress: 85 },
        { name: '生成最终文件', progress: 100 }
      ];
      
      for (let step of steps) {
        setCurrentStep(step.name);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setCompositionProgress(step.progress);
      }
      
      // 模拟生成的合成音频
      const compositionResult = {
        fileName: `${audioFile.name.replace(/\.[^/.]+$/, "")}_composed.${compositionSettings.outputFormat}`,
        size: '4.2 MB',
        duration: '3:42',
        quality: compositionSettings.quality,
        format: compositionSettings.outputFormat.toUpperCase(),
        includedLyrics: compositionSettings.includeLyrics,
        createdAt: new Date().toLocaleString('zh-CN')
      };
      
      setComposedAudio(compositionResult);
      setCurrentStep('合成完成');
      
    } catch (error) {
      console.error('音频合成失败:', error);
      setCurrentStep('合成失败');
    } finally {
      setIsComposing(false);
    }
  };

  const downloadComposedAudio = (audio) => {
    try {
      // 模拟下载功能
      const link = document.createElement('a');
      link.href = '#';
      link.download = audio.fileName;
      
      // 这里应该是实际的音频blob URL
      console.log(`下载合成音频: ${audio.fileName}`);
      alert('模拟下载功能 - 实际项目中会下载合成的音频文件');
      
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  const resetComposition = () => {
    setComposedAudio(null);
    setCompositionProgress(0);
    setCurrentStep('');
  };

  const updateSetting = (key, value) => {
    setCompositionSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const canCompose = audioBuffer && audioFile && (processedTracks || extractedLyrics);

  return (
    <div className="audio-composer">
      <div className="composer-header">
        <h3>音频合成</h3>
        <p className="composer-description">
          将分离的音轨与新歌词重新合成为完整的音乐作品
        </p>
      </div>

      <div className="composition-settings">
        <h4>合成设置</h4>
        <div className="settings-grid">
          <div className="setting-item">
            <label>输出格式:</label>
            <select 
              value={compositionSettings.outputFormat} 
              onChange={(e) => updateSetting('outputFormat', e.target.value)}
              disabled={isComposing}
            >
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
              <option value="flac">FLAC</option>
              <option value="aac">AAC</option>
            </select>
          </div>

          <div className="setting-item">
            <label>音质:</label>
            <select 
              value={compositionSettings.quality} 
              onChange={(e) => updateSetting('quality', e.target.value)}
              disabled={isComposing}
            >
              <option value="standard">标准 (128kbps)</option>
              <option value="good">优质 (192kbps)</option>
              <option value="high">高质量 (320kbps)</option>
              <option value="lossless">无损</option>
            </select>
          </div>

          <div className="setting-item">
            <label>混音模式:</label>
            <select 
              value={compositionSettings.mixingMode} 
              onChange={(e) => updateSetting('mixingMode', e.target.value)}
              disabled={isComposing}
            >
              <option value="balanced">平衡混音</option>
              <option value="vocal-enhanced">人声增强</option>
              <option value="bass-boosted">低音增强</option>
              <option value="custom">自定义</option>
            </select>
          </div>

          <div className="setting-item checkbox-item">
            <label>
              <input
                type="checkbox"
                checked={compositionSettings.includeLyrics}
                onChange={(e) => updateSetting('includeLyrics', e.target.checked)}
                disabled={isComposing || !extractedLyrics}
              />
              嵌入歌词文件
            </label>
          </div>
        </div>
      </div>

      {canCompose && !composedAudio && !isComposing && (
        <div className="composition-controls">
          <button 
            className="compose-btn"
            onClick={simulateAudioComposition}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
            开始合成音频
          </button>
          
          <div className="composition-info">
            <div className="info-item">
              <span className="info-label">原始文件:</span>
              <span className="info-value">{audioFile?.name}</span>
            </div>
            {processedTracks && (
              <div className="info-item">
                <span className="info-label">分离轨道:</span>
                <span className="info-value">人声, 伴奏</span>
              </div>
            )}
            {extractedLyrics && (
              <div className="info-item">
                <span className="info-label">歌词文件:</span>
                <span className="info-value">{extractedLyrics.fileName}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {!canCompose && (
        <div className="composition-unavailable">
          <div className="unavailable-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <h4>准备合成</h4>
          <p>请先完成以下步骤之一:</p>
          <ul>
            <li>使用音频处理功能分离人声和伴奏</li>
            <li>使用歌词提取功能获取歌词文件</li>
          </ul>
        </div>
      )}

      {isComposing && (
        <div className="composition-status">
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${compositionProgress}%` }}
              ></div>
            </div>
            <span className="progress-text">{compositionProgress}%</span>
          </div>
          <p className="current-step">{currentStep}</p>
          
          <div className="processing-visualization">
            <div className="audio-wave">
              {[...Array(12)].map((_, i) => (
                <div 
                  key={i} 
                  className="wave-bar"
                  style={{ 
                    animationDelay: `${i * 0.1}s`,
                    height: `${20 + Math.random() * 30}px`
                  }}
                ></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {composedAudio && !isComposing && (
        <div className="composition-results">
          <div className="result-header">
            <h4>合成完成</h4>
            <div className="result-actions">
              <button 
                className="download-btn"
                onClick={() => downloadComposedAudio(composedAudio)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                下载音频
              </button>
              <button 
                className="reset-btn"
                onClick={resetComposition}
              >
                重新合成
              </button>
            </div>
          </div>

          <div className="result-details">
            <div className="audio-preview">
              <div className="preview-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
              <div className="preview-info">
                <h5>{composedAudio.fileName}</h5>
                <div className="audio-specs">
                  <span>{composedAudio.format}</span>
                  <span>{composedAudio.quality}</span>
                  <span>{composedAudio.size}</span>
                  <span>{composedAudio.duration}</span>
                </div>
              </div>
            </div>

            <div className="composition-details-grid">
              <div className="detail-item">
                <span className="detail-label">创建时间:</span>
                <span className="detail-value">{composedAudio.createdAt}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">包含歌词:</span>
                <span className="detail-value">
                  {composedAudio.includedLyrics ? '是' : '否'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">混音模式:</span>
                <span className="detail-value">{compositionSettings.mixingMode}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioComposer;
