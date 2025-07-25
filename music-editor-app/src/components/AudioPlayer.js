import React, { useState, useRef, useEffect } from 'react';
import './AudioPlayer.css';

const AudioPlayer = ({ audioBuffer, audioFile }) => {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (audioBuffer) {
      setDuration(audioBuffer.duration);
      drawWaveform();
    }
  }, [audioBuffer]);

  const drawWaveform = () => {
    if (!audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 清除画布
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // 获取音频数据
    const channelData = audioBuffer.getChannelData(0);
    const samples = channelData.length;
    const samplesPerPixel = Math.floor(samples / width);

    // 绘制波形
    ctx.strokeStyle = '#4facfe';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const startSample = x * samplesPerPixel;
      const endSample = startSample + samplesPerPixel;
      
      let min = 1;
      let max = -1;
      
      for (let i = startSample; i < endSample && i < samples; i++) {
        const sample = channelData[i];
        if (sample > max) max = sample;
        if (sample < min) min = sample;
      }
      
      const yMax = height / 2 - (max * height / 2 * 0.8);
      const yMin = height / 2 - (min * height / 2 * 0.8);
      
      if (x === 0) {
        ctx.moveTo(x, (yMax + yMin) / 2);
      } else {
        ctx.lineTo(x, yMax);
        ctx.lineTo(x, yMin);
      }
    }
    
    ctx.stroke();

    // 绘制进度线
    if (duration > 0) {
      const progress = (currentTime / duration) * width;
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(progress, 0);
      ctx.lineTo(progress, height);
      ctx.stroke();
    }
  };

  useEffect(() => {
    drawWaveform();
  }, [currentTime, audioBuffer]);

  const playAudio = async () => {
    if (!audioBuffer) return;

    try {
      console.log('AudioPlayer: 开始播放音频');
      
      // 先清理之前的资源
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
          sourceRef.current.disconnect();
        } catch (e) {
          // 忽略已经停止的源
        }
        sourceRef.current = null;
      }

      // 创建新的AudioContext（如果不存在）
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // 如果context被暂停了，需要恢复
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // 创建音频源
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      
      // 创建音量控制节点
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = volume;
      
      // 连接音频节点
      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      // 保存引用
      sourceRef.current = source;
      const startTime = currentTime;
      const contextStartTime = audioContextRef.current.currentTime;
      
      // 设置播放结束回调
      source.onended = () => {
        console.log('AudioPlayer: 播放结束');
        setIsPlaying(false);
        setCurrentTime(duration);
        sourceRef.current = null;
      };
      
      // 开始播放
      source.start(0, startTime);
      setIsPlaying(true);
      
      console.log('AudioPlayer: 播放开始，起始时间:', startTime);
      
      // 更新播放进度
      let animationId;
      const updateProgress = () => {
        if (audioContextRef.current && sourceRef.current) {
          const elapsed = audioContextRef.current.currentTime - contextStartTime;
          const newCurrentTime = startTime + elapsed;
          
          if (newCurrentTime >= duration) {
            setCurrentTime(duration);
            setIsPlaying(false);
            console.log('AudioPlayer: 播放完成');
            return;
          } else {
            setCurrentTime(newCurrentTime);
            animationId = requestAnimationFrame(updateProgress);
          }
        }
      };
      animationId = requestAnimationFrame(updateProgress);
      
      // 存储动画ID以便清理
      source.animationId = animationId;
      
    } catch (error) {
      console.error('AudioPlayer: 播放音频失败:', error);
      setIsPlaying(false);
    }
  };

  const pauseAudio = () => {
    console.log('AudioPlayer: 暂停播放');
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (error) {
        // 忽略已经停止的源的错误
      }
      sourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleCanvasClick = (e) => {
    if (!audioBuffer) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickProgress = x / rect.width;
    const newTime = clickProgress * duration;
    
    setCurrentTime(newTime);
    
    if (isPlaying) {
      pauseAudio();
      setTimeout(() => playAudio(), 100);
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleVolumeChange = (e) => {
    setVolume(parseFloat(e.target.value));
  };

  if (!audioBuffer || !audioFile) {
    return null;
  }

  return (
    <div className="audio-player">
      <div className="player-header">
        <h3>音频播放器</h3>
        <div className="audio-info-compact">
          <span className="file-name">{audioFile.name}</span>
          <span className="duration">{formatTime(duration)}</span>
        </div>
      </div>
      
      <div className="waveform-container">
        <canvas
          ref={canvasRef}
          width={800}
          height={120}
          className="waveform-canvas"
          onClick={handleCanvasClick}
        />
        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      
      <div className="player-controls">
        <button
          className={`play-pause-btn ${isPlaying ? 'playing' : ''}`}
          onClick={isPlaying ? pauseAudio : playAudio}
        >
          {isPlaying ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.14v14l11-7-11-7z"/>
            </svg>
          )}
        </button>
        
        <div className="volume-control">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            className="volume-slider"
          />
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
