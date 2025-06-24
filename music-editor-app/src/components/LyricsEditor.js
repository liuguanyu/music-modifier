import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  List, 
  ListItem, 
  ListItemText, 
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip
} from '@mui/material';
import { 
  Edit, 
  Delete, 
  Add, 
  PlayArrow, 
  Save,
  Download,
  Upload
} from '@mui/icons-material';
import './LyricsEditor.css';

const LyricsEditor = ({ 
  lyrics = [], 
  onLyricsUpdate = () => {}, 
  onSeekToTime = () => {},
  currentTime = 0,
  isPlaying = false 
}) => {
  const [editedLyrics, setEditedLyrics] = useState([]);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editDialog, setEditDialog] = useState(false);
  const [editItem, setEditItem] = useState({ text: '', startTime: 0, endTime: 0 });

  useEffect(() => {
    setEditedLyrics(lyrics);
  }, [lyrics]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = (time % 60).toFixed(1);
    return `${minutes}:${seconds.padStart(4, '0')}`;
  };

  const parseTimeString = (timeStr) => {
    const parts = timeStr.split(':');
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  };

  const handleEditLyric = (index) => {
    const lyric = editedLyrics[index];
    setEditItem({
      text: lyric.text,
      startTime: lyric.startTime,
      endTime: lyric.endTime
    });
    setEditingIndex(index);
    setEditDialog(true);
  };

  const handleDeleteLyric = (index) => {
    const newLyrics = editedLyrics.filter((_, i) => i !== index);
    setEditedLyrics(newLyrics);
    onLyricsUpdate(newLyrics);
  };

  const handleAddLyric = () => {
    setEditItem({
      text: '',
      startTime: currentTime,
      endTime: currentTime + 3
    });
    setEditingIndex(-1);
    setEditDialog(true);
  };

  const handleSaveEdit = () => {
    const newLyric = {
      text: editItem.text,
      startTime: typeof editItem.startTime === 'string' 
        ? parseTimeString(editItem.startTime) 
        : editItem.startTime,
      endTime: typeof editItem.endTime === 'string' 
        ? parseTimeString(editItem.endTime) 
        : editItem.endTime
    };

    let newLyrics;
    if (editingIndex >= 0) {
      // 编辑现有歌词
      newLyrics = [...editedLyrics];
      newLyrics[editingIndex] = newLyric;
    } else {
      // 添加新歌词
      newLyrics = [...editedLyrics, newLyric];
    }

    // 按时间排序
    newLyrics.sort((a, b) => a.startTime - b.startTime);
    
    setEditedLyrics(newLyrics);
    onLyricsUpdate(newLyrics);
    setEditDialog(false);
  };

  const handleSeekToLyric = (startTime) => {
    onSeekToTime(startTime);
  };

  const getCurrentLyricIndex = () => {
    return editedLyrics.findIndex(lyric => 
      currentTime >= lyric.startTime && currentTime <= lyric.endTime
    );
  };

  const exportLyrics = () => {
    const lrcContent = editedLyrics.map(lyric => {
      const timeStr = formatTime(lyric.startTime).replace(':', ':');
      return `[${timeStr}]${lyric.text}`;
    }).join('\n');

    const blob = new Blob([lrcContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lyrics.lrc';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importLyrics = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const lines = content.split('\n');
        const parsedLyrics = lines.map(line => {
          const match = line.match(/\[(\d+):(\d+\.?\d*)\](.+)/);
          if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseFloat(match[2]);
            const startTime = minutes * 60 + seconds;
            return {
              text: match[3],
              startTime: startTime,
              endTime: startTime + 3 // 默认持续3秒
            };
          }
          return null;
        }).filter(Boolean);

        setEditedLyrics(parsedLyrics);
        onLyricsUpdate(parsedLyrics);
      };
      reader.readAsText(file);
    }
  };

  const currentLyricIndex = getCurrentLyricIndex();

  return (
    <Paper className="lyrics-editor" elevation={2}>
      <Box className="lyrics-header">
        <Typography variant="h6">歌词编辑器</Typography>
        <Box className="lyrics-actions">
          <input
            accept=".lrc,.txt"
            style={{ display: 'none' }}
            id="import-lyrics"
            type="file"
            onChange={importLyrics}
          />
          <label htmlFor="import-lyrics">
            <Button variant="outlined" component="span" startIcon={<Upload />} size="small">
              导入
            </Button>
          </label>
          
          <Button 
            variant="outlined" 
            onClick={exportLyrics}
            startIcon={<Download />}
            size="small"
          >
            导出
          </Button>
          
          <Button 
            variant="contained" 
            onClick={handleAddLyric}
            startIcon={<Add />}
            size="small"
          >
            添加歌词
          </Button>
        </Box>
      </Box>

      <Box className="lyrics-content">
        {editedLyrics.length === 0 ? (
          <Typography variant="body2" color="textSecondary" className="empty-message">
            暂无歌词，点击"添加歌词"开始编辑
          </Typography>
        ) : (
          <List className="lyrics-list">
            {editedLyrics.map((lyric, index) => (
              <ListItem 
                key={index}
                className={`lyric-item ${index === currentLyricIndex ? 'current' : ''}`}
                divider
              >
                <ListItemText
                  primary={
                    <Box className="lyric-text-container">
                      <Typography variant="body1" className="lyric-text">
                        {lyric.text}
                      </Typography>
                      <Chip 
                        label={`${formatTime(lyric.startTime)} - ${formatTime(lyric.endTime)}`}
                        size="small"
                        className="lyric-time"
                      />
                    </Box>
                  }
                />
                
                <Box className="lyric-actions">
                  <IconButton 
                    size="small" 
                    onClick={() => handleSeekToLyric(lyric.startTime)}
                    title="跳转到此时间"
                  >
                    <PlayArrow />
                  </IconButton>
                  
                  <IconButton 
                    size="small" 
                    onClick={() => handleEditLyric(index)}
                    title="编辑"
                  >
                    <Edit />
                  </IconButton>
                  
                  <IconButton 
                    size="small" 
                    onClick={() => handleDeleteLyric(index)}
                    title="删除"
                    color="error"
                  >
                    <Delete />
                  </IconButton>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* 编辑对话框 */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingIndex >= 0 ? '编辑歌词' : '添加歌词'}
        </DialogTitle>
        
        <DialogContent>
          <TextField
            label="歌词内容"
            fullWidth
            multiline
            rows={3}
            value={editItem.text}
            onChange={(e) => setEditItem({ ...editItem, text: e.target.value })}
            margin="normal"
          />
          
          <Box className="time-inputs">
            <TextField
              label="开始时间 (分:秒)"
              value={typeof editItem.startTime === 'number' 
                ? formatTime(editItem.startTime) 
                : editItem.startTime}
              onChange={(e) => setEditItem({ ...editItem, startTime: e.target.value })}
              margin="normal"
              className="time-input"
            />
            
            <TextField
              label="结束时间 (分:秒)"
              value={typeof editItem.endTime === 'number' 
                ? formatTime(editItem.endTime) 
                : editItem.endTime}
              onChange={(e) => setEditItem({ ...editItem, endTime: e.target.value })}
              margin="normal"
              className="time-input"
            />
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>取消</Button>
          <Button onClick={handleSaveEdit} variant="contained" startIcon={<Save />}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default LyricsEditor;
