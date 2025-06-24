"""
音乐编辑器后端服务 - 主文件
集成所有音频处理功能
"""

import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 创建 FastAPI 应用
app = FastAPI(
    title="音乐编辑器 API", 
    version="1.0.0",
    description="AI 驱动的音乐编辑和处理服务"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000", 
        "http://localhost:3001", 
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# 导入路由
try:
    from routes import router
    app.include_router(router, prefix="/api", tags=["音乐编辑"])
    logger.info("路由模块加载成功")
except ImportError as e:
    logger.error(f"路由模块加载失败: {e}")
    # 尝试相对导入
    try:
        from backend.routes import router
        app.include_router(router, prefix="/api", tags=["音乐编辑"])
        logger.info("路由模块加载成功（相对导入）")
    except ImportError as e2:
        logger.error(f"相对导入也失败: {e2}")

# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理器"""
    logger.error(f"未处理的异常: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "服务器内部错误",
            "detail": str(exc) if app.debug else "服务器发生错误"
        }
    )

# 根路径
@app.get("/")
async def root():
    """API 根路径"""
    return {
        "message": "音乐编辑器 API 服务",
        "version": "1.0.0",
        "status": "运行中",
        "features": [
            "音轨分离 (AI模型)",
            "语音识别 (Whisper)",
            "音频处理与合成",
            "歌词提取与同步"
        ]
    }

# 启动时检查
@app.on_event("startup")
async def startup_event():
    """应用启动时执行"""
    logger.info("音乐编辑器 API 服务启动中...")
    
    # 检查依赖
    dependencies = {}
    
    try:
        import librosa
        dependencies["librosa"] = librosa.__version__
    except ImportError:
        dependencies["librosa"] = "未安装"
    
    try:
        import torch
        dependencies["torch"] = torch.__version__
        dependencies["cuda_available"] = torch.cuda.is_available()
    except ImportError:
        dependencies["torch"] = "未安装"
    
    try:
        import whisper
        dependencies["whisper"] = "已安装"
    except ImportError:
        dependencies["whisper"] = "未安装"
    
    try:
        import spleeter
        dependencies["spleeter"] = "已安装"
    except ImportError:
        dependencies["spleeter"] = "未安装"
    
    logger.info(f"依赖检查结果: {dependencies}")
    
    # 创建必要的目录
    os.makedirs("temp", exist_ok=True)
    os.makedirs("uploads", exist_ok=True)
    
    logger.info("音乐编辑器 API 服务启动完成")

@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时执行"""
    logger.info("音乐编辑器 API 服务正在关闭...")

# 开发模式运行
if __name__ == "__main__":
    # 检查环境
    logger.info("Python 版本检查...")
    import sys
    logger.info(f"Python 版本: {sys.version}")
    
    # 设置开发模式
    debug_mode = os.getenv("DEBUG", "false").lower() == "true"
    
    # 启动服务器
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=debug_mode,
        log_level="info",
        access_log=True
    )
