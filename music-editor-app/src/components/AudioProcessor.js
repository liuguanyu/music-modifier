import React, { useState, useRef } from 'react';
import './AudioProcessor.css';

const AudioProcessor = ({ audioBuffer, audioFile, onTracksProcessed }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processedAudio, setProcessedAudio] = useState(null);
  const [separationMode, setSeparationMode] = useState('vocal-instrumental');
  const [currentStep, setCurrentStep] = useState('');
  
  // 模拟音频分离处理
  const simulateAudioSeparation = async () => {
    setIsProcessing(true);
    setProcessProgress(0);
    
    try {
      // 模拟处理进度
      const steps = [
        { name: '分析音频频谱', progress: 20 },
        { name: '识别声音特征', progress: 40 },
        { name: '分离音轨', progress: 60 },
        { name: '优化音质', progress: 80 },
        { name: '生成输出文件', progress: 100 }
      ];
      
      for (let step of steps) {
        setCurrentStep(step.name);
        await new Promise(resolve => setTimeout(resolve, 800));
        setProcessProgress(step.progress);
      }
      
      // 为模拟目的，创建音频URL（实际项目中应该是分离后的实际音频）
      const originalUrl = URL.createObjectURL(audioFile);
      
      // 模拟生成分离后的音频结果
      const processedResult = {
        vocals: originalUrl, // 模拟人声音频URL
        instrumental: originalUrl, // 模拟伴奏音频URL
        vocalsBuffer: audioBuffer, // 保留buffer用于下载
        instrumentalBuffer: audioBuffer, // 保留buffer用于下载
        vocalsName: `${audioFile.name.replace(/\.[^/.]+$/, "")}_vocal.wav`,
        instrumentalName: `${audioFile.name.replace(/\.[^/.]+$/, "")}_instrumental.wav`
      };
      
      setProcessedAudio(processedResult);
      setCurrentStep('处理完成');
      
      if (onTracksProcessed) {
        onTracksProcessed(processedResult);
      }
      
    } catch (error) {
      console.error('音频处理失败:', error);
      setCurrentStep('处理失败');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const downloadAudio = async (audioBuffer, fileName) => {
    try {
      // 将AudioBuffer转换为WAV格式
      const wavBuffer = audioBufferToWav(audioBuffer);
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
    }
  };
  
  // AudioBuffer转WAV格式的工具函数
  const audioBufferToWav = (buffer) => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV文件头
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // 写入音频数据
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return arrayBuffer;
  };

  const resetProcessing = () => {
    setProcessedAudio(null);
    setProcessProgress(0);
    setCurrentStep('');
  };

  if (!audioBuffer || !audioFile) {
    return null;
  }

  return (
    <div className="audio-processor">
      <div className="processor-header">
        <h3>音频处理</h3>
        <div className="separation-mode">
          <label>分离模式:</label>
          <select 
            value={separationMode} 
            onChange={(e) => setSeparationMode(e.target.value)}
            disabled={isProcessing}
          >
            <option value="vocal-instrumental">人声/伴奏分离</option>
            <option value="drums-bass-other">鼓点/低音/其他分离</option>
            <option value="speech-music">语音/音乐分离</option>
          </select>
        </div>
      </div>

      {!processedAudio && !isProcessing && (
        <div className="processing-controls">
          <button 
            className="process-btn"
            onClick={simulateAudioSeparation}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            开始音频分离
          </button>
          <p className="process-description">
            将自动分离音频中的人声和伴奏轨道，生成独立的音频文件
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
                  <span className="track-name">人声轨道</span>
                  <span className="track-description">分离出的纯人声音频</span>
                </div>
              </div>
              <button 
                className="download-btn"
                onClick={() => downloadAudio(processedAudio.vocalsBuffer, processedAudio.vocalsName)}
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
                  <span className="track-name">伴奏轨道</span>
                  <span className="track-description">分离出的纯伴奏音频</span>
                </div>
              </div>
              <button 
                className="download-btn"
                onClick={() => downloadAudio(processedAudio.instrumentalBuffer, processedAudio.instrumentalName)}
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
