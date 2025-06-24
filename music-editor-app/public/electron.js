const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const os = require('os');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  // 创建主窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.png'),
    show: false,
    titleBarStyle: 'default'
  });

  // 加载应用
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // 窗口准备就绪后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // 开发模式下打开DevTools
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用准备就绪
app.whenReady().then(createWindow);

// 所有窗口关闭时退出应用 (macOS除外)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 执行Python脚本的通用函数
async function executePythonScript(command, args = []) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '..', 'backend', 'audio_processor_standalone.py');
    const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    
    // 构建完整的命令参数
    const fullArgs = [pythonScript, command, ...args];
    
    exec(`${pythonPath} ${fullArgs.map(arg => `"${arg}"`).join(' ')}`, {
      cwd: path.join(__dirname, '..'),
      timeout: 120000 // 2分钟超时
    }, (error, stdout, stderr) => {
      if (error) {
        console.error(`执行${command}命令失败:`, error);
        resolve({
          success: false,
          error: error.message,
          stderr: stderr
        });
        return;
      }
      
      console.log(`${command}命令输出:`, stdout);
      if (stderr) console.log(`${command}命令错误输出:`, stderr);
      
      try {
        const response = JSON.parse(stdout.trim());
        resolve(response);
      } catch (parseError) {
        console.error('JSON解析失败:', parseError);
        resolve({
          success: false,
          error: '输出解析失败',
          raw_output: stdout,
          stderr: stderr
        });
      }
    });
  });
}

// IPC处理程序

// 文件对话框
ipcMain.handle('show-open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: '音频文件', extensions: ['mp3', 'wav', 'flac', 'm4a'] },
      { name: 'MP3', extensions: ['mp3'] },
      { name: 'WAV', extensions: ['wav'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('show-save-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: '音频文件', extensions: ['mp3', 'wav'] },
      { name: 'MP3', extensions: ['mp3'] },
      { name: 'WAV', extensions: ['wav'] }
    ]
  });
  return result;
});

// 音频处理功能
ipcMain.handle('audio-separate', async (event, inputFile, outputDir, model) => {
  try {
    console.log('开始音轨分离:', { inputFile, outputDir, model });
    const args = ['--input', inputFile, '--output', outputDir, '--model', model || 'simple'];
    return await executePythonScript('separate', args);
  } catch (error) {
    console.error('音轨分离失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('audio-recognize', async (event, inputFile, language, modelSize) => {
  try {
    console.log('开始语音识别:', { inputFile, language, modelSize });
    const args = ['--input', inputFile, '--language', language || 'zh', '--model', modelSize || 'base'];
    return await executePythonScript('recognize', args);
  } catch (error) {
    console.error('语音识别失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('audio-analyze', async (event, inputFile) => {
  try {
    console.log('开始音频分析:', { inputFile });
    const args = ['--input', inputFile];
    return await executePythonScript('analyze', args);
  } catch (error) {
    console.error('音频分析失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('audio-convert', async (event, inputFile, outputFile, format, bitrate) => {
  try {
    console.log('开始音频转换:', { inputFile, outputFile, format, bitrate });
    const args = [
      '--input', inputFile,
      '--output', outputFile,
      '--format', format || 'mp3',
      '--bitrate', bitrate || '256k'
    ];
    return await executePythonScript('convert', args);
  } catch (error) {
    console.error('音频转换失败:', error);
    return { success: false, error: error.message };
  }
});

// 检查Python环境
ipcMain.handle('check-python-env', async () => {
  try {
    console.log('检查Python环境...');
    return await executePythonScript('check');
  } catch (error) {
    console.error('Python环境检查异常:', error);
    return {
      success: false,
      message: `检查异常: ${error.message}`,
      details: { error: error.message }
    };
  }
});

// 文件操作功能
ipcMain.handle('save-temporary-file', async (event, filename, arrayBuffer) => {
  try {
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const tempFilePath = path.join(tempDir, `audio_${timestamp}_${filename}`);
    
    await fs.writeFile(tempFilePath, Buffer.from(arrayBuffer));
    
    return {
      success: true,
      path: tempFilePath,
      message: '临时文件保存成功'
    };
  } catch (error) {
    console.error('保存临时文件失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('get-temp-path', async (event, filename) => {
  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  return path.join(tempDir, `audio_${timestamp}_${filename}`);
});

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
