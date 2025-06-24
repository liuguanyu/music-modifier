import React, { useState, useRef } from 'react';
import './LyricsExtractor.css';

const LyricsExtractor = ({ audioBuffer, audioFile, onLyricsExtracted }) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractedLyrics, setExtractedLyrics] = useState(null);
  const [currentStep, setCurrentStep] = useState('');
  const [recognitionMode, setRecognitionMode] = useState('auto');
  const [language, setLanguage] = useState('zh-CN');
  
  // 模拟歌词提取处理
  const simulateLyricsExtraction = async () => {
    setIsExtracting(true);
    setExtractionProgress(0);
    
    try {
      // 模拟处理进度
      const steps = [
        { name: '分析音频内容', progress: 20 },
        { name: '语音识别处理', progress: 40 },
        { name: '提取歌词文本', progress: 60 },
        { name: '时间轴对齐', progress: 80 },
        { name: '生成LRC文件', progress: 100 }
      ];
      
      for (let step of steps) {
        setCurrentStep(step.name);
        await new Promise(resolve => setTimeout(resolve, 1200));
        setExtractionProgress(step.progress);
      }
      
      // 模拟生成的歌词内容
      const lyricsResult = {
        text: `[00:00.00]歌词提取示例
[00:03.50]这是一个音乐编辑器的演示
[00:07.20]支持音频分离和歌词识别
[00:11.80]让音乐创作变得更简单
[00:15.60]每一段旋律都有它的故事
[00:19.40]每一句歌词都承载着情感
[00:23.20]音乐是心灵的语言
[00:27.00]让我们一起创造美好的声音`,
        
        segments: [
          { time: 0, text: '歌词提取示例', duration: 3.5 },
          { time: 3.5, text: '这是一个音乐编辑器的演示', duration: 3.7 },
          { time: 7.2, text: '支持音频分离和歌词识别', duration: 4.6 },
          { time: 11.8, text: '让音乐创作变得更简单', duration: 3.8 },
          { time: 15.6, text: '每一段旋律都有它的故事', duration: 3.8 },
          { time: 19.4, text: '每一句歌词都承载着情感', duration: 3.8 },
          { time: 23.2, text: '音乐是心灵的语言', duration: 3.8 },
          { time: 27.0, text: '让我们一起创造美好的声音', duration: 4.0 }
        ],
        
        fileName: `${audioFile.name.replace(/\.[^/.]+$/, "")}_lyrics.lrc`,
        confidence: 0.85
      };
      
      setExtractedLyrics(lyricsResult);
      setCurrentStep('歌词提取完成');
      
      if (onLyricsExtracted) {
        onLyricsExtracted(lyricsResult);
      }
      
    } catch (error) {
      console.error('歌词提取失败:', error);
      setCurrentStep('提取失败');
    } finally {
      setIsExtracting(false);
    }
  };
  
  const downloadLyrics = (lyrics, fileName) => {
    try {
      const blob = new Blob([lyrics], { type: 'text/plain;charset=utf-8' });
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
  
  const editLyrics = (index, newText) => {
    if (!extractedLyrics) return;
    
    const updatedSegments = [...extractedLyrics.segments];
    updatedSegments[index] = { ...updatedSegments[index], text: newText };
    
    // 重新生成LRC格式文本
    const updatedLrcText = updatedSegments.map(segment => {
      const minutes = Math.floor(segment.time / 60);
      const seconds = (segment.time % 60).toFixed(2).padStart(5, '0');
      return `[${minutes.toString().padStart(2, '0')}:${seconds}]${segment.text}`;
    }).join('\n');
    
    const updatedLyrics = {
      ...extractedLyrics,
      text: updatedLrcText,
      segments: updatedSegments
    };
    
    setExtractedLyrics(updatedLyrics);
  };
  
  const resetExtraction = () => {
    setExtractedLyrics(null);
    setExtractionProgress(0);
    setCurrentStep('');
  };

  if (!audioBuffer || !audioFile) {
    return null;
  }

  return (
    <div className="lyrics-extractor">
      <div className="extractor-header">
        <h3>歌词提取</h3>
        <div className="extraction-settings">
          <div className="setting-group">
            <label>识别模式:</label>
            <select 
              value={recognitionMode} 
              onChange={(e) => setRecognitionMode(e.target.value)}
              disabled={isExtracting}
            >
              <option value="auto">自动识别</option>
              <option value="vocal-only">仅人声</option>
              <option value="manual-timing">手动对齐</option>
            </select>
          </div>
          <div className="setting-group">
            <label>语言:</label>
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isExtracting}
            >
              <option value="zh-CN">中文</option>
              <option value="en-US">英语</option>
              <option value="ja-JP">日语</option>
              <option value="ko-KR">韩语</option>
            </select>
          </div>
        </div>
      </div>

      {!extractedLyrics && !isExtracting && (
        <div className="extraction-controls">
          <button 
            className="extract-btn"
            onClick={simulateLyricsExtraction}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/>
            </svg>
            开始歌词识别
          </button>
          <p className="extract-description">
            自动识别音频中的人声内容，生成时间轴对齐的歌词文件
          </p>
        </div>
      )}

      {isExtracting && (
        <div className="extraction-status">
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${extractionProgress}%` }}
              ></div>
            </div>
            <span className="progress-text">{extractionProgress}%</span>
          </div>
          <p className="current-step">{currentStep}</p>
        </div>
      )}

      {extractedLyrics && !isExtracting && (
        <div className="extraction-results">
          <div className="result-header">
            <h4>提取结果</h4>
            <div className="result-info">
              <span className="confidence">
                识别准确度: {(extractedLyrics.confidence * 100).toFixed(1)}%
              </span>
              <button 
                className="download-lrc-btn"
                onClick={() => downloadLyrics(extractedLyrics.text, extractedLyrics.fileName)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                下载LRC
              </button>
            </div>
          </div>

          <div className="lyrics-editor">
            {extractedLyrics.segments.map((segment, index) => (
              <div key={index} className="lyric-line">
                <div className="time-info">
                  {Math.floor(segment.time / 60).toString().padStart(2, '0')}:
                  {(segment.time % 60).toFixed(2).padStart(5, '0')}
                </div>
                <input
                  type="text"
                  value={segment.text}
                  onChange={(e) => editLyrics(index, e.target.value)}
                  className="lyric-text-input"
                  placeholder="编辑歌词..."
                />
              </div>
            ))}
          </div>

          <div className="extraction-actions">
            <button 
              className="reset-btn"
              onClick={resetExtraction}
            >
              重新提取
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LyricsExtractor;
