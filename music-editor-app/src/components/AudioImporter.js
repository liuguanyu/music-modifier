import React, { useRef, useState } from 'react';
import './AudioImporter.css';
import AudioService from '../services/AudioService';

const AudioImporter = ({ onAudioLoad }) => {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const supportedFormats = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/wave'];

  const validateFile = (file) => {
    if (!supportedFormats.includes(file.type)) {
      const extension = file.name.split('.').pop().toLowerCase();
      if (!['mp3', 'wav'].includes(extension)) {
        throw new Error('不支持的文件格式。请选择 MP3 或 WAV 文件。');
      }
    }
    
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      throw new Error('文件大小超过限制（最大100MB）。');
    }
  };

  const processAudioFile = async (file) => {
    try {
      setLoading(true);
      setError(null);

      validateFile(file);

      // 创建 AudioContext 来解码音频
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // 将文件转换为 ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // 解码音频数据
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // 回调函数传递文件信息和音频缓冲区
      onAudioLoad(file, audioBuffer);
      
      console.log('音频文件加载成功:', {
        name: file.name,
        size: file.size,
        type: file.type,
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels
      });

    } catch (err) {
      setError(err.message || '加载音频文件时出错');
      console.error('音频文件加载失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (files) => {
    if (files && files.length > 0) {
      processAudioFile(files[0]);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div 
      className={`audio-importer ${dragActive ? 'drag-active' : ''} ${loading ? 'loading' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,audio/mp3,audio/mpeg,audio/wav,audio/wave"
        onChange={(e) => handleFileSelect(e.target.files)}
        style={{ display: 'none' }}
      />
      
      <div className="import-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>正在加载音频文件...</p>
          </div>
        ) : (
          <>
            <div className="import-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                <path 
                  d="M12 2L2 22h20L12 2z" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  fill="none"
                />
                <path 
                  d="M12 8v8M8 18h8" 
                  stroke="currentColor" 
                  strokeWidth="2"
                />
              </svg>
            </div>
            
            <h3>导入音频文件</h3>
            <p>拖拽音频文件到这里，或者点击选择文件</p>
            <p className="supported-formats">支持格式：MP3、WAV</p>
            
            <button className="select-file-btn" onClick={openFileDialog}>
              选择文件
            </button>
          </>
        )}
      </div>
      
      {error && (
        <div className="error-message">
          <strong>错误：</strong>{error}
        </div>
      )}
    </div>
  );
};

export default AudioImporter;
