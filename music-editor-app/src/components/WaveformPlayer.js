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

  useEffect(() => {
    if (waveformRef.current && !wavesurfer.current) {
      // 初始化WaveSurfer
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#4F81BD',
        progressColor: '#1976d2',
        cursorColor: '#ff5722',
        barWidth: 2,
        responsive: true,
        height: height,
        normalize: true,
        backend: 'WebAudio',
        mediaControls: false
      });

      // 事件监听
      wavesurfer.current.on('ready', () => {
        if (wavesurfer.current) {
          setDuration(wavesurfer.current.getDuration());
          setIsLoading(false);
          onReady(wavesurfer.current);
        }
      });

      wavesurfer.current.on('audioprocess', () => {
        if (wavesurfer.current) {
          setCurrentTime(wavesurfer.current.getCurrentTime());
        }
      });

      wavesurfer.current.on('seek', () => {
        if (wavesurfer.current) {
          setCurrentTime(wavesurfer.current.getCurrentTime());
        }
      });

      wavesurfer.current.on('play', () => {
        setIsPlaying(true);
      });

      wavesurfer.current.on('pause', () => {
        setIsPlaying(false);
      });

      wavesurfer.current.on('finish', () => {
        setIsPlaying(false);
      });

      wavesurfer.current.on('loading', (percent) => {
        if (percent < 100) {
          setIsLoading(true);
        }
      });

      // 添加error事件处理
      wavesurfer.current.on('error', (error) => {
        console.warn('WaveSurfer error (safely ignored):', error);
        setIsLoading(false);
      });
    }

    return () => {
      if (wavesurfer.current) {
        try {
          // 先停止播放，然后销毁
          if (wavesurfer.current.isPlaying()) {
            wavesurfer.current.pause();
          }
          // 等待一小段时间确保停止完成
          setTimeout(() => {
            if (wavesurfer.current) {
              wavesurfer.current.destroy();
              wavesurfer.current = null;
            }
          }, 100);
        } catch (error) {
          // 忽略销毁时的错误
          console.warn('WaveSurfer destroy error (safely ignored):', error);
          wavesurfer.current = null;
        }
      }
    };
  }, [height, onReady]);

  useEffect(() => {
    if (audioUrl && wavesurfer.current) {
      setIsLoading(true);
      // 使用Promise方式处理异步错误
      const loadPromise = wavesurfer.current.load(audioUrl);
      if (loadPromise && loadPromise.catch) {
        loadPromise.catch((error) => {
          console.warn('WaveSurfer load promise error (safely ignored):', error);
          if (wavesurfer.current) {
            setIsLoading(false);
          }
        });
      }
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
