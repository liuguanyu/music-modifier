import React, { useState, useRef } from 'react';
import { 
  Typography, 
  Box, 
  Grid, 
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Button,
  Divider,
  Card,
  CardContent
} from '@mui/material';
import {
  CloudUpload,
  GraphicEq,
  Subtitles,
  LibraryMusic,
  CheckCircle,
  RadioButtonUnchecked
} from '@mui/icons-material';
import AudioImporter from './AudioImporter';
import AudioProcessor from './AudioProcessor';
import WaveformPlayer from './WaveformPlayer';
import LyricsExtractor from './LyricsExtractor';
import LyricsEditor from './LyricsEditor';
import AudioComposer from './AudioComposer';
import './MusicEditor.css';

const MusicEditor = () => {
  const [currentFile, setCurrentFile] = useState(null);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [separatedTracks, setSeparatedTracks] = useState(null);
  const [extractedLyrics, setExtractedLyrics] = useState([]);
  const [editedLyrics, setEditedLyrics] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const waveformRef = useRef(null);

  // 定义流程步骤
  const steps = [
    {
      id: 0,
      label: '上传音频',
      icon: CloudUpload,
      description: '选择并上传音频文件',
      completed: !!currentFile
    },
    {
      id: 1,
      label: '分轨处理',
      icon: GraphicEq,
      description: '人声与伴奏分离',
      completed: !!separatedTracks,
      disabled: !currentFile
    },
    {
      id: 2,
      label: '歌词提取',
      icon: Subtitles,
      description: '智能识别歌词时间轴',
      completed: extractedLyrics.length > 0,
      disabled: !separatedTracks
    },
    {
      id: 3,
      label: '音频合成',
      icon: LibraryMusic,
      description: '混合处理与导出',
      completed: false,
      disabled: extractedLyrics.length === 0
    }
  ];

  const handleFileUpload = (file, audioBuffer) => {
    setCurrentFile(file);
    setAudioBuffer(audioBuffer);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setError('');
    setCurrentStep(0);
    console.log('文件已上传:', {
      name: file.name,
      size: file.size,
      duration: audioBuffer ? audioBuffer.duration : 'unknown',
      sampleRate: audioBuffer ? audioBuffer.sampleRate : 'unknown'
    });
  };

  const handleSeparationComplete = (tracks) => {
    setSeparatedTracks(tracks);
    setCurrentStep(1);
    console.log('音轨分离完成:', tracks);
  };

  const handleLyricsExtracted = (lyrics) => {
    setExtractedLyrics(lyrics);
    setEditedLyrics(lyrics);
    setCurrentStep(2);
    console.log('歌词提取完成:', lyrics);
  };

  const handleLyricsUpdate = (lyrics) => {
    setEditedLyrics(lyrics);
  };

  const handleWaveformReady = (wavesurfer) => {
    waveformRef.current = wavesurfer;
    console.log('波形图已准备就绪');
    
    // 监听播放状态变化
    wavesurfer.on('audioprocess', () => {
      setCurrentTime(wavesurfer.getCurrentTime());
    });
    
    wavesurfer.on('seek', () => {
      setCurrentTime(wavesurfer.getCurrentTime());
    });
    
    wavesurfer.on('play', () => {
      setIsPlaying(true);
    });
    
    wavesurfer.on('pause', () => {
      setIsPlaying(false);
    });
  };

  const handleSeekToTime = (time) => {
    if (waveformRef.current) {
      const duration = waveformRef.current.getDuration();
      waveformRef.current.seekTo(time / duration);
    }
  };

  const handleError = (errorMessage) => {
    setError(errorMessage);
    setLoading(false);
  };

  const handleTracksProcessed = async (tracks) => {
    try {
      console.log('原始分轨结果:', tracks);
      
      // 将本地文件路径转换为可播放的URL
      const processedTracks = { ...tracks };
      
      if (tracks.vocals && window.electronAPI && window.electronAPI.readFile) {
        try {
          console.log('正在读取人声文件:', tracks.vocals);
          const vocalsData = await window.electronAPI.readFile(tracks.vocals);
          console.log('人声文件读取成功，大小:', vocalsData.byteLength);
          const vocalsBlob = new Blob([vocalsData], { type: 'audio/wav' });
          processedTracks.vocalsUrl = URL.createObjectURL(vocalsBlob);
          processedTracks.vocals = tracks.vocals; // 保留原始路径用于下载
          console.log('人声Blob URL创建成功:', processedTracks.vocalsUrl);
        } catch (error) {
          console.error('读取人声文件失败:', error);
          // 尝试使用file://协议作为降级方案
          processedTracks.vocalsUrl = `file://${tracks.vocals}`;
          processedTracks.vocals = tracks.vocals;
        }
      }
      
      if (tracks.instrumental && window.electronAPI && window.electronAPI.readFile) {
        try {
          console.log('正在读取伴奏文件:', tracks.instrumental);
          const instrumentalData = await window.electronAPI.readFile(tracks.instrumental);
          console.log('伴奏文件读取成功，大小:', instrumentalData.byteLength);
          const instrumentalBlob = new Blob([instrumentalData], { type: 'audio/wav' });
          processedTracks.instrumentalUrl = URL.createObjectURL(instrumentalBlob);
          processedTracks.instrumental = tracks.instrumental; // 保留原始路径用于下载
          console.log('伴奏Blob URL创建成功:', processedTracks.instrumentalUrl);
        } catch (error) {
          console.error('读取伴奏文件失败:', error);
          // 尝试使用file://协议作为降级方案
          processedTracks.instrumentalUrl = `file://${tracks.instrumental}`;
          processedTracks.instrumental = tracks.instrumental;
        }
      }
      
      setSeparatedTracks(processedTracks);
      setCurrentStep(1);
      console.log('音轨处理完成，最终结果:', processedTracks);
    } catch (error) {
      console.error('处理分轨结果失败:', error);
      // 降级：直接使用原始路径
      setSeparatedTracks({
        ...tracks,
        vocalsUrl: tracks.vocals ? `file://${tracks.vocals}` : null,
        instrumentalUrl: tracks.instrumental ? `file://${tracks.instrumental}` : null
      });
      setCurrentStep(1);
    }
  };

  const handleStepClick = (stepId) => {
    const step = steps[stepId];
    if (!step.disabled) {
      setCurrentStep(stepId);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Box>
            <Typography variant="h5" gutterBottom>
              音频文件上传
            </Typography>
            <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
              请选择需要处理的音频文件，支持MP3、WAV、FLAC等格式
            </Typography>
            
            <AudioImporter onAudioLoad={handleFileUpload} />
            
            {currentFile && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  音频波形与播放控制
                </Typography>
                <WaveformPlayer
                  audioUrl={audioUrl}
                  title={currentFile.name}
                  onReady={handleWaveformReady}
                  height={150}
                />
                
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                  <Button 
                    variant="contained" 
                    onClick={() => handleStepClick(1)}
                    disabled={!currentFile}
                  >
                    下一步：分轨处理
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        );
        
      case 1:
        return (
          <Box>
            <Typography variant="h5" gutterBottom>
              音轨分离处理
            </Typography>
            <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
              将音频分离为人声轨道和伴奏轨道，可选择不同的分离模式和质量等级
            </Typography>
            
            <AudioProcessor
              audioBuffer={audioBuffer}
              audioFile={currentFile}
              onTracksProcessed={handleTracksProcessed}
            />
            
            {separatedTracks && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  分离结果:
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <WaveformPlayer
                      audioUrl={separatedTracks.vocalsUrl || separatedTracks.vocals}
                      title="人声音轨"
                      height={100}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <WaveformPlayer
                      audioUrl={separatedTracks.instrumentalUrl || separatedTracks.instrumental}
                      title="伴奏音轨"
                      height={100}
                    />
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                  <Button 
                    variant="contained" 
                    onClick={() => handleStepClick(2)}
                    disabled={!separatedTracks}
                  >
                    下一步：歌词提取
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        );
        
      case 2:
        return (
          <Box>
            <Typography variant="h5" gutterBottom>
              智能歌词提取
            </Typography>
            <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
              使用语音识别技术自动提取人声轨道中的歌词，并生成时间轴
            </Typography>
            
            <LyricsExtractor
              audioFile={currentFile}
              vocalsUrl={separatedTracks?.vocals}
              onLyricsExtracted={handleLyricsExtracted}
              onError={handleError}
            />
            
            {extractedLyrics.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  提取结果 ({extractedLyrics.length} 行歌词)
                </Typography>
                <LyricsEditor
                  lyrics={editedLyrics}
                  onLyricsUpdate={handleLyricsUpdate}
                  onSeekToTime={handleSeekToTime}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                />
                
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                  <Button 
                    variant="contained" 
                    onClick={() => handleStepClick(3)}
                    disabled={extractedLyrics.length === 0}
                  >
                    下一步：音频合成
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        );
        
      case 3:
        return (
          <Box>
            <Typography variant="h5" gutterBottom>
              音频混合与导出
            </Typography>
            <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
              设置混音参数，将处理后的音频和歌词合成为最终作品
            </Typography>
            
            <AudioComposer
              originalFile={currentFile}
              separatedTracks={separatedTracks}
              lyrics={editedLyrics}
              onError={handleError}
            />
          </Box>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="music-editor-container">
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        {/* 左侧导航栏 */}
        <Paper 
          elevation={3} 
          sx={{ 
            width: 320, 
            background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
            color: 'white',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* LOGO区域 */}
          <Box sx={{ p: 3, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
              智能音乐编辑器
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              AI音频处理工具
            </Typography>
          </Box>

          {/* 流程步骤 */}
          <Box sx={{ flex: 1, p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, opacity: 0.9 }}>
              处理流程
            </Typography>
            
            <List>
              {steps.map((step) => {
                const IconComponent = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = step.completed;
                const isDisabled = step.disabled;
                
                return (
                  <ListItem
                    key={step.id}
                    button
                    onClick={() => handleStepClick(step.id)}
                    disabled={isDisabled}
                    sx={{
                      mb: 1,
                      borderRadius: 2,
                      background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                      '&:hover': {
                        background: isDisabled ? 'transparent' : 'rgba(255,255,255,0.1)'
                      },
                      opacity: isDisabled ? 0.5 : 1
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {isCompleted ? (
                        <CheckCircle sx={{ color: '#4caf50' }} />
                      ) : (
                        <IconComponent sx={{ color: isActive ? 'white' : 'rgba(255,255,255,0.7)' }} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={step.label}
                      secondary={step.description}
                      primaryTypographyProps={{
                        sx: { 
                          color: isActive ? 'white' : 'rgba(255,255,255,0.9)',
                          fontWeight: isActive ? 600 : 400
                        }
                      }}
                      secondaryTypographyProps={{
                        sx: { color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }
                      }}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Box>

          {/* 状态信息 */}
          {currentFile && (
            <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
                当前项目状态
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7, display: 'block' }}>
                文件: {currentFile.name}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7, display: 'block' }}>
                分轨: {separatedTracks ? '已完成' : '未处理'}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7, display: 'block' }}>
                歌词: {extractedLyrics.length > 0 ? `${extractedLyrics.length}行` : '未提取'}
              </Typography>
            </Box>
          )}
        </Paper>

        {/* 右侧工作区 */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* 错误提示 */}
          {error && (
            <Alert severity="error" sx={{ m: 2 }}>
              {error}
            </Alert>
          )}

          {/* 加载状态 */}
          {loading && (
            <Box display="flex" justifyContent="center" alignItems="center" sx={{ m: 2 }}>
              <CircularProgress />
              <Typography variant="body1" sx={{ ml: 2 }}>处理中...</Typography>
            </Box>
          )}

          {/* 主要内容区域 */}
          <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
            <Card elevation={1}>
              <CardContent sx={{ p: 4 }}>
                {renderStepContent()}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
    </div>
  );
};

export default MusicEditor;
