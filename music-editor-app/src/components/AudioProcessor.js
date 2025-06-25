import React, { useState, useCallback } from 'react';
import './AudioProcessor.css';

const AudioProcessor = ({ audioBuffer, audioFile, onTracksProcessed }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processedAudio, setProcessedAudio] = useState(null);
  const [separationMode, setSeparationMode] = useState('clean');
  const [separationQuality, setSeparationQuality] = useState('high');
  const [currentStep, setCurrentStep] = useState('');
  
  // 使用useCallback避免不必要的重新渲染和可能的递归调用
  const processAudioSeparation = useCallback(async () => {
    if (isProcessing) {
      console.log('处理正在进行中，跳过重复调用');
      return;
    }
    
    setIsProcessing(true);
    setProcessProgress(0);
    setCurrentStep('准备处理音频...');
    
    try {
      // 检查IPC是否可用
      if (!window.electronAPI) {
        throw new Error('Electron IPC不可用');
      }

      setCurrentStep('准备音频数据...');
      setProcessProgress(10);
      
      // 将音频文件保存为临时文件
      const arrayBuffer = await audioFile.arrayBuffer();
      const tempFileResult = await window.electronAPI.saveTemporaryFile(audioFile.name, arrayBuffer);
      
      // 提取文件路径
      const tempFilePath = tempFileResult.path || tempFileResult;
      console.log('临时文件路径:', tempFilePath);
      
      setCurrentStep('发送到Python后端进行分离...');
      setProcessProgress(20);
      
      // 调用新的IPC处理器进行音频分离
      const result = await window.electronAPI.invoke('audio-separate', {
        inputPath: tempFilePath,
        mode: separationMode,
        quality: separationQuality
      });
      
      setCurrentStep('正在处理音频分离...');
      setProcessProgress(60);
      
      if (result && result.success !== false) {
        setCurrentStep('生成分离结果...');
        setProcessProgress(90);
        
        // 创建分离后的音频结果
        const processedResult = {
          vocals: result.vocals_path || result.vocal_path,
          instrumental: result.accompaniment_path || result.instrumental_path,
          vocalsName: result.vocals_filename || `${audioFile.name.replace(/\.[^/.]+$/, "")}_vocals.wav`,
          instrumentalName: result.accompaniment_filename || `${audioFile.name.replace(/\.[^/.]+$/, "")}_accompaniment.wav`,
          vocalsBuffer: null, // 实际音频数据从Python返回
          instrumentalBuffer: null
        };
        
        setCurrentStep('处理完成!');
        setProcessProgress(100);
        setProcessedAudio(processedResult);
        
        if (onTracksProcessed) {
          onTracksProcessed(processedResult);
        }
      } else {
        throw new Error(result?.error || '音频分离失败');
      }
      
    } catch (error) {
      console.error('音频处理失败:', error);
      setCurrentStep(`处理失败: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [audioFile, separationMode, separationQuality, isProcessing, onTracksProcessed]);
  
  const downloadAudio = useCallback(async (audioPath, fileName) => {
    try {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        // 使用Electron的保存对话框
        const result = await window.electronAPI.showSaveDialog();
        if (!result.canceled && result.filePath) {
          // 复制文件到用户选择的位置
          const copyResult = await window.electronAPI.copyFile(audioPath, result.filePath);
          if (copyResult.success) {
            alert(`文件已保存到: ${result.filePath}`);
            console.log('文件保存成功:', result.filePath);
          } else {
            throw new Error(copyResult.error || '文件复制失败');
          }
        }
      } else {
        // 降级到浏览器下载（如果在浏览器环境中运行）
        const a = document.createElement('a');
        a.href = audioPath;
        a.download = fileName;
        a.click();
      }
    } catch (error) {
      console.error('下载失败:', error);
      alert('下载失败: ' + error.message);
    }
  }, []);

  const resetProcessing = useCallback(() => {
    setProcessedAudio(null);
    setProcessProgress(0);
    setCurrentStep('');
  }, []);

  if (!audioBuffer || !audioFile) {
    return null;
  }

  return (
    <div className="audio-processor">
      <div className="processor-header">
        <h3>音频处理</h3>
        <div className="separation-controls">
          <div className="separation-mode">
            <label>分离模式:</label>
            <select 
              value={separationMode} 
              onChange={(e) => setSeparationMode(e.target.value)}
              disabled={isProcessing}
            >
              <option value="clean">纯净分离 (推荐)</option>
              <option value="enhanced">增强分离 (AI+后处理)</option>
              <option value="fallback">基础分离 (兼容模式)</option>
            </select>
          </div>
          <div className="separation-quality">
            <label>分离质量:</label>
            <select 
              value={separationQuality} 
              onChange={(e) => setSeparationQuality(e.target.value)}
              disabled={isProcessing}
            >
              <option value="high">高质量 (推荐)</option>
              <option value="medium">中等质量</option>
              <option value="fast">快速处理</option>
            </select>
          </div>
        </div>
      </div>

      {!processedAudio && !isProcessing && (
        <div className="processing-controls">
          <button 
            className="process-btn"
            onClick={processAudioSeparation}
            disabled={isProcessing}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            开始音频分离（真实处理）
          </button>
          <p className="process-description">
            使用AI模型分离音频中的人声和伴奏轨道，生成高质量的独立音频文件
          </p>
        </div>
      )}

      {isProcessing && (
        <div className="processing-status">
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${processProgress}%` }}
              ></div>
            </div>
            <span className="progress-text">{processProgress}%</span>
          </div>
          <p className="current-step">{currentStep}</p>
        </div>
      )}

      {processedAudio && !isProcessing && (
        <div className="processing-results">
          <h4>处理结果</h4>
          <div className="result-tracks">
            <div className="track-item">
              <div className="track-info">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2s-2-.9-2-2V4c0-1.1.9-2 2-2zm4.31 9.69l1.42 1.42c1.54-1.54 1.54-4.08 0-5.62l-1.42 1.42c.78.78.78 2.04 0 2.82z"/>
                </svg>
                <div>
                  <span className="track-name">人声轨道（AI分离）</span>
                  <span className="track-description">使用AI模型分离的纯人声音频</span>
                </div>
              </div>
              <button 
                className="download-btn"
                onClick={() => downloadAudio(processedAudio.vocals, processedAudio.vocalsName)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                下载
              </button>
            </div>

            <div className="track-item">
              <div className="track-info">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21s4.5-2.01 4.5-4.5V7h4V3h-7z"/>
                </svg>
                <div>
                  <span className="track-name">伴奏轨道（AI分离）</span>
                  <span className="track-description">使用AI模型分离的纯伴奏音频</span>
                </div>
              </div>
              <button 
                className="download-btn"
                onClick={() => downloadAudio(processedAudio.instrumental, processedAudio.instrumentalName)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                下载
              </button>
            </div>
          </div>

          <div className="processing-actions">
            <button 
              className="reset-btn"
              onClick={resetProcessing}
            >
              重新处理
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioProcessor;
