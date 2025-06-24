import React, { useState, useRef } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Grid, 
  Card, 
  CardContent,
  Tabs,
  Tab,
  Alert,
  CircularProgress
} from '@mui/material';
import AudioImporter from './AudioImporter';
import AudioProcessor from './AudioProcessor';
import WaveformPlayer from './WaveformPlayer';
import LyricsExtractor from './LyricsExtractor';
import LyricsEditor from './LyricsEditor';
import AudioComposer from './AudioComposer';
import './MusicEditor.css';

const TabPanel = ({ children, value, index, ...props }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`music-editor-tabpanel-${index}`}
      aria-labelledby={`music-editor-tab-${index}`}
      {...props}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const MusicEditor = () => {
  const [currentFile, setCurrentFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [separatedTracks, setSeparatedTracks] = useState(null);
  const [extractedLyrics, setExtractedLyrics] = useState([]);
  const [editedLyrics, setEditedLyrics] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const waveformRef = useRef(null);

  const handleFileUpload = (file, audioBuffer) => {
    setCurrentFile(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setError('');
    console.log('文件已上传:', {
      name: file.name,
      size: file.size,
      duration: audioBuffer ? audioBuffer.duration : 'unknown',
      sampleRate: audioBuffer ? audioBuffer.sampleRate : 'unknown'
    });
  };

  const handleSeparationComplete = (tracks) => {
    setSeparatedTracks(tracks);
    console.log('音轨分离完成:', tracks);
  };

  const handleLyricsExtracted = (lyrics) => {
    setExtractedLyrics(lyrics);
    setEditedLyrics(lyrics);
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

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleError = (errorMessage) => {
    setError(errorMessage);
    setLoading(false);
  };

  return (
    <div className="music-editor-container">
      <Container maxWidth="xl">
        <Box className="editor-header">
          <Typography variant="h3" component="h1" className="editor-title">
            智能音乐编辑器
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            音频导入、分离、歌词提取与编辑的全流程工具
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" sx={{ mb: 3 }}>
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>处理中...</Typography>
          </Box>
        )}

        <Grid container spacing={3}>
          {/* 文件导入区 */}
          <Grid item xs={12}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  1. 音频文件导入
                </Typography>
                <AudioImporter onAudioLoad={handleFileUpload} />
              </CardContent>
            </Card>
          </Grid>

          {/* 主要功能区 */}
          {currentFile && (
            <Grid item xs={12}>
              <Card elevation={2}>
                <CardContent>
                  <Tabs value={activeTab} onChange={handleTabChange} aria-label="音乐编辑功能">
                    <Tab label="波形播放" />
                    <Tab label="音轨分离" />
                    <Tab label="歌词提取" />
                    <Tab label="歌词编辑" />
                    <Tab label="音频合成" />
                  </Tabs>

                  {/* 波形播放面板 */}
                  <TabPanel value={activeTab} index={0}>
                    <Typography variant="h6" gutterBottom>
                      音频波形与播放控制
                    </Typography>
                    <WaveformPlayer
                      audioUrl={audioUrl}
                      title={currentFile.name}
                      onReady={handleWaveformReady}
                      height={150}
                    />
                  </TabPanel>

                  {/* 音轨分离面板 */}
                  <TabPanel value={activeTab} index={1}>
                    <Typography variant="h6" gutterBottom>
                      音轨分离处理
                    </Typography>
                    <AudioProcessor
                      audioFile={currentFile}
                      onSeparationComplete={handleSeparationComplete}
                      onError={handleError}
                    />
                    
                    {separatedTracks && (
                      <Box className="separated-tracks">
                        <Typography variant="subtitle1" sx={{ mt: 3, mb: 2 }}>
                          分离结果:
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <WaveformPlayer
                              audioUrl={separatedTracks.vocals}
                              title="人声音轨"
                              height={100}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <WaveformPlayer
                              audioUrl={separatedTracks.instrumental}
                              title="伴奏音轨"
                              height={100}
                            />
                          </Grid>
                        </Grid>
                      </Box>
                    )}
                  </TabPanel>

                  {/* 歌词提取面板 */}
                  <TabPanel value={activeTab} index={2}>
                    <Typography variant="h6" gutterBottom>
                      智能歌词提取
                    </Typography>
                    <LyricsExtractor
                      audioFile={currentFile}
                      vocalsUrl={separatedTracks?.vocals}
                      onLyricsExtracted={handleLyricsExtracted}
                      onError={handleError}
                    />
                  </TabPanel>

                  {/* 歌词编辑面板 */}
                  <TabPanel value={activeTab} index={3}>
                    <Typography variant="h6" gutterBottom>
                      歌词时间轴编辑
                    </Typography>
                    <LyricsEditor
                      lyrics={editedLyrics}
                      onLyricsUpdate={handleLyricsUpdate}
                      onSeekToTime={handleSeekToTime}
                      currentTime={currentTime}
                      isPlaying={isPlaying}
                    />
                  </TabPanel>

                  {/* 音频合成面板 */}
                  <TabPanel value={activeTab} index={4}>
                    <Typography variant="h6" gutterBottom>
                      音频混合与导出
                    </Typography>
                    <AudioComposer
                      originalFile={currentFile}
                      separatedTracks={separatedTracks}
                      lyrics={editedLyrics}
                      onError={handleError}
                    />
                  </TabPanel>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* 状态信息 */}
          {currentFile && (
            <Grid item xs={12}>
              <Card elevation={1}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    当前项目状态
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="textSecondary">
                        音频文件: {currentFile.name}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="textSecondary">
                        音轨分离: {separatedTracks ? '已完成' : '未处理'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="textSecondary">
                        歌词提取: {extractedLyrics.length > 0 ? `${extractedLyrics.length}行` : '未提取'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="textSecondary">
                        歌词编辑: {editedLyrics.length > 0 ? `${editedLyrics.length}行` : '无编辑'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Container>
    </div>
  );
};

export default MusicEditor;
