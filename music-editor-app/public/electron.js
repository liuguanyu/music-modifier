const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const os = require('os');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let pythonProcess = null;
let requestId = 0;
const pendingRequests = new Map();

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
    ? 'http://localhost:3001'
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // 窗口准备就绪后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // 开发模式下打开DevTools
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
    
    // 启动Python IPC处理器
    startPythonIPC();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // 关闭Python进程
    if (pythonProcess) {
      pythonProcess.kill();
      pythonProcess = null;
    }
  });
}

// 启动Python IPC处理器
function startPythonIPC() {
  if (pythonProcess) {
    console.log('Python进程已存在');
    return;
  }

  try {
    const ipcHandlerScript = path.join(__dirname, '..', 'backend', 'ipc_handler.py');
    const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    const virtualEnvPath = path.join(__dirname, '..', 'myenv', 'bin', 'python3');
    
    // 检查虚拟环境是否存在
    const usePythonPath = require('fs').existsSync(virtualEnvPath) ? virtualEnvPath : pythonPath;
    
    console.log('启动Python IPC处理器:', usePythonPath, ipcHandlerScript);
    
    pythonProcess = spawn(usePythonPath, [ipcHandlerScript], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // 处理Python进程的输出
    pythonProcess.stdout.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const response = JSON.parse(line);
          const requestId = response.id;
          const result = response.result;
          
          if (pendingRequests.has(requestId)) {
            const { resolve } = pendingRequests.get(requestId);
            pendingRequests.delete(requestId);
            resolve(result);
          }
        } catch (error) {
          console.error('解析Python响应失败:', error, 'Raw:', line);
        }
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error('Python进程错误:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python进程退出，代码: ${code}`);
      pythonProcess = null;
    });

    pythonProcess.on('error', (error) => {
      console.error('Python进程启动失败:', error);
      pythonProcess = null;
    });

  } catch (error) {
    console.error('启动Python IPC处理器失败:', error);
  }
}

// 发送命令到Python处理器
function sendCommandToPython(command, params) {
  return new Promise((resolve, reject) => {
    if (!pythonProcess || pythonProcess.killed) {
      reject(new Error('Python进程未运行'));
      return;
    }

    const currentRequestId = ++requestId;
    const request = {
      id: currentRequestId,
      command: command,
      params: params
    };

    // 存储pending请求
    pendingRequests.set(currentRequestId, { resolve, reject });

    // 设置超时
    setTimeout(() => {
      if (pendingRequests.has(currentRequestId)) {
        pendingRequests.delete(currentRequestId);
        reject(new Error(`命令超时: ${command}`));
      }
    }, 120000); // 2分钟超时

    // 发送请求
    try {
      pythonProcess.stdin.write(JSON.stringify(request) + '\n');
    } catch (error) {
      pendingRequests.delete(currentRequestId);
      reject(error);
    }
  });
}

// 应用准备就绪
app.whenReady().then(createWindow);

// 所有窗口关闭时退出应用 (macOS除外)
app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
});

// ===== IPC处理程序 =====

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
    return await sendCommandToPython('audio_separate', {
      input_path: inputFile,
      output_dir: outputDir,
      model: model
    });
  } catch (error) {
    console.error('音轨分离失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('audio-recognize', async (event, inputFile, language, modelSize) => {
  try {
    console.log('开始语音识别:', { inputFile, language, modelSize });
    return await sendCommandToPython('audio_recognize', {
      input_path: inputFile,
      language: language,
      model_size: modelSize
    });
  } catch (error) {
    console.error('语音识别失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('audio-analyze', async (event, inputFile) => {
  try {
    console.log('开始音频分析:', { inputFile });
    return await sendCommandToPython('audio_analyze', {
      input_path: inputFile
    });
  } catch (error) {
    console.error('音频分析失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('audio-convert', async (event, inputFile, outputFile, format, bitrate) => {
  try {
    console.log('开始音频转换:', { inputFile, outputFile, format, bitrate });
    return await sendCommandToPython('audio_convert', {
      input_path: inputFile,
      output_path: outputFile,
      target_format: format,
      bitrate: bitrate
    });
  } catch (error) {
    console.error('音频转换失败:', error);
    return { success: false, error: error.message };
  }
});

// 检查Python环境
ipcMain.handle('check-python-env', async () => {
  try {
    console.log('检查Python环境...');
    return await sendCommandToPython('check_environment', {});
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
