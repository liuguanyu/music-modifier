const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 通用invoke接口
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // 文件对话框
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
  
  // 应用信息
  platform: process.platform,
  versions: process.versions,
  
  // 音频处理功能
  audioSeparate: (inputFile, outputDir, model) => ipcRenderer.invoke('audio-separate', inputFile, outputDir, model),
  audioRecognize: (inputFile, language, modelSize) => ipcRenderer.invoke('audio-recognize', inputFile, language, modelSize),
  audioAnalyze: (inputFile) => ipcRenderer.invoke('audio-analyze', inputFile),
  audioConvert: (inputFile, outputFile, format, bitrate) => ipcRenderer.invoke('audio-convert', inputFile, outputFile, format, bitrate),
  checkPythonEnv: () => ipcRenderer.invoke('check-python-env'),
  
  // 文件操作
  saveTemporaryFile: (filename, arrayBuffer) => ipcRenderer.invoke('save-temporary-file', filename, arrayBuffer),
  getTempPath: (filename) => ipcRenderer.invoke('get-temp-path', filename),
  copyFile: (sourcePath, destinationPath) => ipcRenderer.invoke('copy-file', sourcePath, destinationPath),
  
  // 文件系统相关 (仅在需要时添加)
  // readFile: (path) => ipcRenderer.invoke('read-file', path),
  // writeFile: (path, data) => ipcRenderer.invoke('write-file', path, data)
});

// 阻止网页导航到文件URL
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    * {
      user-select: text;
      -webkit-user-drag: none;
    }
    
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    }
  `;
  document.head.appendChild(style);
});
