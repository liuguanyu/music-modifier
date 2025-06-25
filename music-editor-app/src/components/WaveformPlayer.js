import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Box, Button, Slider, Typography, Paper } from '@mui/material';
import { PlayArrow, Pause, Stop, VolumeUp } from '@mui/icons-material';
import './WaveformPlayer.css';

const WaveformPlayer = ({ 
  audioUrl, 
  title = "音频波形", 
  onReady = () => {},
  showRegions = false,
  onRegionUpdate = () => {},
  height = 128 
}) => {
  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // 避免重复初始化
    if (waveformRef.current && !wavesurfer.current) {
      try {
        console.log('WaveformPlayer: 开始初始化 WaveSurfer');
        // 初始化WaveSurfer（新版本API）
        wavesurfer.current = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: '#4F81BD',
          progressColor: '#1976d2',
          cursorColor: '#ff5722',
          barWidth: 2,
          responsive: true,
          height: height,
          normalize: true,
          mediaControls: false
        });

        // 事件监听
        wavesurfer.current.on('ready', () => {
          console.log('WaveformPlayer: 音频已准备就绪');
          if (wavesurfer.current) {
            setDuration(wavesurfer.current.getDuration());
            setIsLoading(false);
            setError('');
            onReady(wavesurfer.current);
          }
        });

        wavesurfer.current.on('timeupdate', (currentTime) => {
          setCurrentTime(currentTime);
        });

        wavesurfer.current.on('seeking', (currentTime) => {
          setCurrentTime(currentTime);
        });

        wavesurfer.current.on('play', () => {
          console.log('WaveformPlayer: 开始播放');
          setIsPlaying(true);
        });

        wavesurfer.current.on('pause', () => {
          console.log('WaveformPlayer: 暂停播放');
          setIsPlaying(false);
        });

        wavesurfer.current.on('finish', () => {
          console.log('WaveformPlayer: 播放完成');
          setIsPlaying(false);
        });

        wavesurfer.current.on('loading', (percent) => {
          console.log('WaveformPlayer: 加载进度', percent);
          if (percent < 100) {
            setIsLoading(true);
          } else {
            setIsLoading(false);
          }
        });

        // 添加error事件处理
        wavesurfer.current.on('error', (error) => {
          console.error('WaveformPlayer: 播放错误', error);
          setError(`播放错误: ${error.message || error}`);
          setIsLoading(false);
        });

        console.log('WaveformPlayer: WaveSurfer 实例创建成功');
      } catch (error) {
        console.error('WaveformPlayer: 初始化失败', error);
        setError(`初始化失败: ${error.message}`);
      }
    }

    return () => {
      if (wavesurfer.current) {
        try {
          console.log('WaveformPlayer: 开始清理 WaveSurfer 实例');
          // 先停止播放
          if (wavesurfer.current.isPlaying && wavesurfer.current.isPlaying()) {
            wavesurfer.current.pause();
          }
          // 移除所有事件监听器
          wavesurfer.current.unAll();
          // 销毁实例
          wavesurfer.current.destroy();
          wavesurfer.current = null;
          console.log('WaveformPlayer: WaveSurfer 实例清理完成');
        } catch (error) {
          console.warn('WaveformPlayer: 清理时出错，但会继续清理', error);
          wavesurfer.current = null;
        }
      }
    };
  }, [height, onReady]);

  useEffect(() => {
    let isComponentMounted = true;
    
    if (audioUrl && wavesurfer.current) {
      console.log('WaveformPlayer: 开始加载音频:', audioUrl);
      setIsLoading(true);
      setError('');
      
      try {
        // 在加载新音频前，先停止当前播放
        if (wavesurfer.current.isPlaying && wavesurfer.current.isPlaying()) {
          wavesurfer.current.pause();
        }
        
        // 使用Promise方式处理异步错误
        const loadPromise = wavesurfer.current.load(audioUrl);
        if (loadPromise && loadPromise.catch) {
          loadPromise.catch((error) => {
            // 只有在组件还挂载时才更新状态
            if (isComponentMounted) {
              // 忽略因组件卸载导致的AbortError
              if (error.name === 'AbortError' && error.message.includes('signal is aborted')) {
                console.log('WaveformPlayer: 音频加载被中止（组件卸载）');
                return;
              }
              console.error('WaveformPlayer: 加载音频失败:', error);
              setError(`音频加载失败: ${error.message || '未知错误'}`);
              setIsLoading(false);
            }
          });
        }
      } catch (error) {
        if (isComponentMounted) {
          console.error('WaveformPlayer: 加载音频异常:', error);
          setError(`音频加载异常: ${error.message}`);
          setIsLoading(false);
        }
      }
      
      return () => {
        isComponentMounted = false;
      };
    } else if (!audioUrl && wavesurfer.current) {
      console.log('WaveformPlayer: 清空音频URL');
      setIsLoading(false);
      setError('');
    }
  }, [audioUrl]);

  useEffect(() => {
    if (wavesurfer.current) {
      wavesurfer.current.setVolume(volume);
    }
  }, [volume]);

  const handlePlayPause = () => {
    if (wavesurfer.current) {
      wavesurfer.current.playPause();
    }
  };

  const handleStop = () => {
    if (wavesurfer.current) {
      wavesurfer.current.stop();
      setIsPlaying(false);
    }
  };

  const handleSeek = (event, newValue) => {
    if (wavesurfer.current && duration > 0) {
      const seekTime = (newValue / 100) * duration;
      wavesurfer.current.seekTo(seekTime / duration);
    }
  };

  const handleVolumeChange = (event, newValue) => {
    setVolume(newValue / 100);
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressValue = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Paper className="waveform-player" elevation={2}>
      <Box className="waveform-header">
        <Typography variant="h6" component="h3">
          {title}
        </Typography>
        {isLoading && (
          <Typography variant="body2" color="textSecondary">
            加载中...
          </Typography>
        )}
        {error && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}
      </Box>
      
      <Box className="waveform-container" ref={waveformRef} />
      
      <Box className="waveform-controls">
        <Box className="playback-controls">
          <Button
            variant="contained"
            color="primary"
            onClick={handlePlayPause}
            disabled={!audioUrl || isLoading}
            startIcon={isPlaying ? <Pause /> : <PlayArrow />}
            size="small"
          >
            {isPlaying ? '暂停' : '播放'}
          </Button>
          
          <Button
            variant="outlined"
            onClick={handleStop}
            disabled={!audioUrl || isLoading}
            startIcon={<Stop />}
            size="small"
          >
            停止
          </Button>
        </Box>

        <Box className="progress-control">
          <Typography variant="body2" className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </Typography>
          
          <Slider
            value={progressValue}
            onChange={handleSeek}
            disabled={!audioUrl || isLoading}
            size="small"
            className="progress-slider"
          />
        </Box>

        <Box className="volume-control">
          <VolumeUp fontSize="small" />
          <Slider
            value={volume * 100}
            onChange={handleVolumeChange}
            size="small"
            className="volume-slider"
            min={0}
            max={100}
          />
        </Box>
      </Box>
    </Paper>
  );
};

export default WaveformPlayer;
