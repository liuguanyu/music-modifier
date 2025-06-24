# 🎵 智能音乐编辑器

一款基于AI技术的专业音乐编辑软件，支持音轨分离、歌词识别与编辑、音频处理和合成等功能。

## ✨ 主要功能

### 🎯 核心功能
1. **音轨分离** - 将音频文件分离为人声和伴奏轨道
2. **歌词识别** - AI自动识别歌词并生成时间轴
3. **歌词编辑** - 可视化编辑器，支持实时修改
4. **音频合成** - 重新合成修改后的音频文件

### 🛠️ 技术特性
- 基于Spleeter的高质量音轨分离
- 使用OpenAI Whisper进行语音识别
- React前端界面，响应式设计
- FastAPI后端API，高性能异步处理
- 支持多种音频格式 (MP3, WAV, FLAC)

## 🚀 快速开始

### 系统要求
- Python 3.8+
- Node.js 14+
- 4GB+ RAM 推荐

### 一键启动
```bash
# 克隆项目
git clone <repository-url>
cd music-editor-app

# 启动所有服务
./run.sh
```

### 手动启动
```bash
# 1. 启动后端服务
cd music-editor-app
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r backend/requirements.txt
python start_backend.py

# 2. 启动前端服务
npm install
npm start
```

## 📱 使用界面

访问 http://localhost:3001 打开音乐编辑器界面

### 工作流程
1. **导入音频** - 点击"选择文件"上传音频文件
2. **音轨分离** - 系统自动分离人声和伴奏
3. **歌词识别** - AI提取歌词并生成时间轴
4. **编辑处理** - 使用可视化编辑器修改歌词和时间轴
5. **音频合成** - 生成最终的音频文件

## 🔧 API文档

### 后端服务端点

**基础端点**
```
GET  /                    # 服务状态
GET  /health             # 健康检查
```

**音频处理API**
```
POST /api/separate-audio   # 音轨分离
POST /api/extract-lyrics   # 歌词提取  
POST /api/compose-audio    # 音频合成
```

## 📂 项目结构

```
music-editor-app/
├── frontend/                 # React前端应用
│   ├── public/              # 静态资源
│   ├── src/
│   │   ├── components/      # React组件
│   │   │   ├── AudioImporter.js      # 音频导入组件
│   │   │   ├── WaveformPlayer.js     # 波形播放器
│   │   │   ├── LyricsEditor.js       # 歌词编辑器
│   │   │   ├── LyricsExtractor.js    # 歌词提取器
│   │   │   ├── AudioComposer.js      # 音频合成器
│   │   │   └── MusicEditor.js        # 主编辑器
│   │   ├── services/        # 前端服务
│   │   └── App.js          # 应用入口
│   └── package.json        # 前端依赖配置
├── backend/                 # FastAPI后端服务
│   ├── services/           # 核心服务模块
│   │   ├── audio_separator.py    # 音轨分离服务
│   │   ├── speech_recognizer.py  # 语音识别服务
│   │   └── audio_processor.py    # 音频处理服务
│   ├── main.py            # API主入口
│   └── requirements.txt    # 后端依赖
├── scripts/                # 工具脚本
│   ├── run.sh             # 一键启动脚本
│   ├── stop.sh            # 停止服务脚本
│   └── demo.py            # 演示脚本
└── README.md              # 项目文档
```

## 🧪 测试和演示

### 运行演示
```bash
cd music-editor-app
python demo.py
```

### 健康检查
```bash
curl http://localhost:8000/health
```

## ⚙️ 配置说明

### 环境变量
```bash
# 后端配置
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

# 前端配置
REACT_APP_API_URL=http://localhost:8000
```

### 依赖说明

**AI模型依赖（可选）**
- `spleeter` - 音轨分离（需要TensorFlow）
- `whisper` - 语音识别（需要PyTorch）

**基础依赖（必需）**
- `fastapi` - Web框架
- `uvicorn` - ASGI服务器
- `librosa` - 音频处理
- `numpy` - 数值计算

## 🔍 故障排除

### 常见问题

**1. 音轨分离功能不可用**
```bash
# 安装Spleeter依赖
pip install spleeter tensorflow
```

**2. 语音识别功能不可用**  
```bash
# 安装Whisper依赖
pip install whisper-ai torch
```

**3. 前端无法连接后端**
- 检查后端服务是否在端口8000运行
- 检查防火墙设置
- 确认CORS配置正确

**4. 音频文件上传失败**
- 检查文件格式是否支持 (MP3, WAV)
- 确认文件大小不超过限制
- 检查临时目录权限

## 📄 许可证

本项目采用 MIT 许可证 - 详情请查看 [LICENSE](LICENSE) 文件

## 🤝 贡献指南

欢迎提交Issue和Pull Request来帮助改进项目！

### 开发环境设置
1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 📞 支持与联系

- 项目主页: [GitHub Repository]
- 问题报告: [GitHub Issues]
- 功能请求: [GitHub Discussions]

---

**享受音乐创作的乐趣！** 🎶
