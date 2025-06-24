// 音频处理核心服务
class AudioService {
  constructor() {
    this.audioContext = null;
    this.initAudioContext();
    this.checkElectronAPI();
  }

  // 检查Electron API是否可用
  checkElectronAPI() {
    if (typeof window.electronAPI === 'undefined') {
      console.warn('Electron API不可用，部分功能将无法使用');
      this.electronAvailable = false;
    } else {
      this.electronAvailable = true;
      console.log('Electron API已加载');
    }
  }

  // 初始化音频上下文
  initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.error('音频上下文初始化失败:', error);
    }
  }

  // 加载音频文件并转换为AudioBuffer
  async loadAudioFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target.result;
          const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          resolve(audioBuffer);
        } catch (error) {
          reject(new Error('音频解码失败: ' + error.message));
        }
      };
      
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsArrayBuffer(file);
    });
  }

  // 将File对象保存为临时文件并返回路径
  async saveFileTemporary(file) {
    if (!this.electronAvailable) {
      throw new Error('Electron API不可用，无法保存临时文件');
    }

    try {
      // 通过文件对话框获取保存路径，或使用临时路径
      const timestamp = Date.now();
      const tempPath = `/tmp/audio_${timestamp}_${file.name}`;
      
      // 读取文件内容
      const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsArrayBuffer(file);
      });

      // 调用IPC保存临时文件
      const result = await window.electronAPI.saveTemporaryFile(file.name, arrayBuffer);
      
      if (result.success) {
        console.log('临时文件保存成功:', result.path);
        return result.path;
      } else {
        throw new Error(result.error || '临时文件保存失败');
      }
      
    } catch (error) {
      console.error('保存临时文件失败:', error);
      throw error;
    }
  }

  // 创建音频播放器
  createPlayer(audioBuffer) {
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    const analyser = this.audioContext.createAnalyser();
    
    source.buffer = audioBuffer;
    source.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(this.audioContext.destination);
    
    // 配置分析器
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    return {
      source,
      gainNode,
      analyser,
      dataArray,
      bufferLength,
      play: (when = 0) => source.start(when),
      stop: () => source.stop(),
      setVolume: (volume) => gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime)
    };
  }

  // 生成波形数据用于可视化
  generateWaveformData(audioBuffer, samples = 1000) {
    const channelData = audioBuffer.getChannelData(0); // 使用第一个声道
    const blockSize = Math.floor(channelData.length / samples);
    const waveformData = [];
    
    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      const end = start + blockSize;
      let sum = 0;
      
      for (let j = start; j < end; j++) {
        sum += Math.abs(channelData[j]);
      }
      
      waveformData.push(sum / blockSize);
    }
    
    return waveformData;
  }

  // 简单的音频分离算法（基于频谱分析）
  async separateAudio(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const numberOfChannels = audioBuffer.numberOfChannels;
    
    // 创建分离后的音频缓冲区
    const vocalBuffer = this.audioContext.createBuffer(numberOfChannels, length, sampleRate);
    const instrumentalBuffer = this.audioContext.createBuffer(numberOfChannels, length, sampleRate);
    
    // 简单的中央声道提取算法（用于分离人声）
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const vocalData = vocalBuffer.getChannelData(channel);
      const instrumentalData = instrumentalBuffer.getChannelData(channel);
      
      for (let i = 0; i < length; i++) {
        // 如果是立体声，进行中央声道分离
        if (numberOfChannels === 2) {
          const leftChannel = audioBuffer.getChannelData(0)[i];
          const rightChannel = audioBuffer.getChannelData(1)[i];
          
          // 人声通常在中央（左右声道相似）
          const vocal = (leftChannel + rightChannel) / 2;
          // 伴奏是左右声道的差异
          const instrumental = (leftChannel - rightChannel) / 2;
          
          vocalData[i] = vocal * 0.8; // 降低音量避免失真
          instrumentalData[i] = instrumental * 0.8;
        } else {
          // 单声道的简单处理
          vocalData[i] = inputData[i] * 0.5;
          instrumentalData[i] = inputData[i] * 0.5;
        }
      }
    }
    
    return {
      vocal: vocalBuffer,
      instrumental: instrumentalBuffer
    };
  }

  // 音频格式转换 - AudioBuffer转WAV
  audioBufferToWav(audioBuffer) {
    const length = audioBuffer.length;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const bytesPerSample = 2;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;
    
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);
    
    // WAV文件头
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    // RIFF chunk
    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    
    // fmt chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true);  // PCM format
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true); // bits per sample
    
    // data chunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    // 写入音频数据
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return arrayBuffer;
  }

  // 混音功能
  async mixTracks(tracks) {
    if (!tracks || tracks.length === 0) {
      throw new Error('没有可混音的轨道');
    }
    
    // 找到最长的轨道
    const maxLength = Math.max(...tracks.map(track => track.buffer.length));
    const sampleRate = tracks[0].buffer.sampleRate;
    const numberOfChannels = tracks[0].buffer.numberOfChannels;
    
    // 创建输出缓冲区
    const mixedBuffer = this.audioContext.createBuffer(numberOfChannels, maxLength, sampleRate);
    
    // 混合所有轨道
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const outputData = mixedBuffer.getChannelData(channel);
      
      for (let trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
        const track = tracks[trackIndex];
        const trackData = track.buffer.getChannelData(channel);
        const volume = track.volume || 1;
        
        for (let i = 0; i < Math.min(trackData.length, maxLength); i++) {
          outputData[i] += trackData[i] * volume;
        }
      }
      
      // 标准化音量防止削波
      let maxSample = 0;
      for (let i = 0; i < maxLength; i++) {
        maxSample = Math.max(maxSample, Math.abs(outputData[i]));
      }
      
      if (maxSample > 1) {
        for (let i = 0; i < maxLength; i++) {
          outputData[i] /= maxSample;
        }
      }
    }
    
    return mixedBuffer;
  }

  // 应用音频效果
  applyEffect(audioBuffer, effectType, params = {}) {
    const length = audioBuffer.length;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    
    const processedBuffer = this.audioContext.createBuffer(numberOfChannels, length, sampleRate);
    
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = processedBuffer.getChannelData(channel);
      
      switch (effectType) {
        case 'reverb':
          this.applyReverb(inputData, outputData, params);
          break;
        case 'delay':
          this.applyDelay(inputData, outputData, params, sampleRate);
          break;
        case 'distortion':
          this.applyDistortion(inputData, outputData, params);
          break;
        default:
          outputData.set(inputData);
      }
    }
    
    return processedBuffer;
  }

  // 混响效果
  applyReverb(inputData, outputData, params) {
    const { roomSize = 0.5, decay = 0.7 } = params;
    const delayLength = Math.floor(inputData.length * roomSize * 0.1);
    
    for (let i = 0; i < inputData.length; i++) {
      let reverbSample = inputData[i];
      
      // 添加延迟回声
      if (i >= delayLength) {
        reverbSample += outputData[i - delayLength] * decay;
      }
      
      outputData[i] = reverbSample * 0.8; // 降低音量防止失真
    }
  }

  // 延迟效果
  applyDelay(inputData, outputData, params, sampleRate) {
    const { delayTime = 0.2, feedback = 0.4, wetLevel = 0.5 } = params;
    const delayLength = Math.floor(delayTime * sampleRate);
    
    for (let i = 0; i < inputData.length; i++) {
      let delaySample = inputData[i];
      
      if (i >= delayLength) {
        delaySample += outputData[i - delayLength] * feedback;
      }
      
      outputData[i] = inputData[i] * (1 - wetLevel) + delaySample * wetLevel;
    }
  }

  // 失真效果
  applyDistortion(inputData, outputData, params) {
    const { drive = 2, tone = 0.5 } = params;
    
    for (let i = 0; i < inputData.length; i++) {
      let sample = inputData[i] * drive;
      
      // 软削波
      if (sample > 1) sample = 1;
      if (sample < -1) sample = -1;
      
      // 简单的音调控制
      sample = sample * tone + inputData[i] * (1 - tone);
      
      outputData[i] = sample;
    }
  }

  // ===== IPC通信方法 =====

  // AI音轨分离（使用Electron IPC）
  async separateAudioWithAI(file, model = 'spleeter:2stems-2kHz') {
    if (!this.electronAvailable) {
      console.warn('Electron不可用，使用本地分离算法');
      return await this.separateAudio(await this.loadAudioFile(file));
    }

    try {
      // 使用文件选择对话框或直接传递文件路径
      let filePath;
      if (file.path) {
        // 如果是从文件系统选择的文件，直接使用路径
        filePath = file.path;
      } else {
        // 对于拖拽或上传的文件，需要先保存为临时文件
        filePath = await this.saveFileTemporary(file);
      }
      
      const outputDir = `/tmp/separated_${Date.now()}`;
      
      console.log('调用IPC音轨分离...', { filePath, outputDir, model });
      const result = await window.electronAPI.audioSeparate(filePath, outputDir, model);
      
      if (result.success) {
        return {
          success: true,
          vocal_path: result.vocal_path,
          instrumental_path: result.instrumental_path,
          method: 'ai_spleeter'
        };
      } else {
        throw new Error(result.error || 'AI分离失败');
      }
      
    } catch (error) {
      console.error('AI音轨分离失败，使用本地算法:', error);
      // 降级到本地算法
      const audioBuffer = await this.loadAudioFile(file);
      return await this.separateAudio(audioBuffer);
    }
  }

  // 语音识别
  async recognizeSpeech(file, language = 'zh', modelSize = 'base') {
    if (!this.electronAvailable) {
      throw new Error('语音识别需要Electron环境');
    }

    try {
      let filePath;
      if (file.path) {
        filePath = file.path;
      } else {
        filePath = await this.saveFileTemporary(file);
      }
      
      console.log('调用IPC语音识别...', { filePath, language, modelSize });
      const result = await window.electronAPI.audioRecognize(filePath, language, modelSize);
      
      return result;
    } catch (error) {
      console.error('语音识别失败:', error);
      throw error;
    }
  }

  // 音频分析
  async analyzeAudio(file) {
    if (!this.electronAvailable) {
      // 使用本地简单分析
      const audioBuffer = await this.loadAudioFile(file);
      return {
        success: true,
        duration: audioBuffer.duration,
        sample_rate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        method: 'local_analysis'
      };
    }

    try {
      let filePath;
      if (file.path) {
        filePath = file.path;
      } else {
        filePath = await this.saveFileTemporary(file);
      }
      
      console.log('调用IPC音频分析...', filePath);
      const result = await window.electronAPI.audioAnalyze(filePath);
      return result;
    } catch (error) {
      console.error('音频分析失败，使用本地分析:', error);
      // 降级到本地分析
      const audioBuffer = await this.loadAudioFile(file);
      return {
        success: true,
        duration: audioBuffer.duration,
        sample_rate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        method: 'local_fallback'
      };
    }
  }

  // 音频格式转换
  async convertAudioFormat(file, targetFormat = 'mp3', options = {}) {
    if (!this.electronAvailable) {
      throw new Error('音频格式转换需要Electron环境');
    }

    try {
      let inputPath;
      if (file.path) {
        inputPath = file.path;
      } else {
        inputPath = await this.saveFileTemporary(file);
      }
      
      const outputPath = `/tmp/${Date.now()}_converted.${targetFormat}`;
      
      console.log('调用IPC音频转换...', { inputPath, outputPath, targetFormat });
      const result = await window.electronAPI.audioConvert(
        inputPath, 
        outputPath, 
        targetFormat, 
        options.bitrate || '256k'
      );
      
      return result;
    } catch (error) {
      console.error('音频格式转换失败:', error);
      throw error;
    }
  }

  // 检查Python环境状态
  async checkPythonEnvironment() {
    if (!this.electronAvailable) {
      return { status: 'electron_unavailable' };
    }

    try {
      console.log('检查Python环境...');
      const result = await window.electronAPI.checkPythonEnv();
      return { 
        status: result.success ? 'available' : 'unavailable',
        message: result.message,
        details: result.details
      };
    } catch (error) {
      console.error('Python环境检查失败:', error);
      return { status: 'error', error: error.message };
    }
  }

  // 获取服务状态
  async getServiceStatus() {
    const pythonStatus = await this.checkPythonEnvironment();
    
    return {
      status: 'online',
      electron: this.electronAvailable,
      python: pythonStatus.status === 'available',
      audioContext: !!this.audioContext,
      details: {
        electronAPI: this.electronAvailable ? 'available' : 'unavailable',
        pythonEnv: pythonStatus,
        audioContext: this.audioContext ? 'initialized' : 'failed'
      }
    };
  }

  // 保存AudioBuffer为文件
  async saveAudioBuffer(audioBuffer, filename = 'audio.wav') {
    const wavData = this.audioBufferToWav(audioBuffer);
    const blob = new Blob([wavData], { type: 'audio/wav' });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return { success: true, filename };
  }
}

export default AudioService;
