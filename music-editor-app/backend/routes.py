"""
API 路由定义
"""

import os
import tempfile
import logging
from typing import Dict, Any
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse, JSONResponse

try:
    from services.audio_processor import AudioProcessor
    from services.audio_separator import AudioSeparator
    from services.speech_recognizer import SpeechRecognizer
except ImportError:
    try:
        from backend.services.audio_processor import AudioProcessor
        from backend.services.audio_separator import AudioSeparator
        from backend.services.speech_recognizer import SpeechRecognizer
    except ImportError:
        from .services.audio_processor import AudioProcessor
        from .services.audio_separator import AudioSeparator
        from .services.speech_recognizer import SpeechRecognizer

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

# 初始化服务
audio_processor = AudioProcessor()
audio_separator = AudioSeparator()
speech_recognizer = SpeechRecognizer()

@router.get("/")
async def root():
    """根路径"""
    return {"message": "Music Editor API", "version": "1.0.0"}

@router.get("/health")
async def health_check():
    """健康检查"""
    services_status = {
        "audio_processor": audio_processor.is_ready(),
        "audio_separator": audio_separator.is_ready(),
        "speech_recognizer": speech_recognizer.is_ready()
    }
    
    all_ready = all(services_status.values())
    
    return {
        "status": "healthy" if all_ready else "degraded",
        "services": services_status,
        "timestamp": "2024-01-01T00:00:00Z"
    }

@router.post("/upload-audio")
async def upload_audio(file: UploadFile = File(...)):
    """上传音频文件"""
    try:
        # 验证文件类型
        allowed_types = [
            "audio/mpeg", "audio/mp3", "audio/wav", "audio/flac", 
            "audio/aac", "audio/ogg", "audio/m4a"
        ]
        
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"不支持的文件类型: {file.content_type}"
            )
        
        # 保存文件到临时目录
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # 获取音频信息
        audio_info = await audio_processor.get_audio_info(tmp_path)
        
        return {
            "success": True,
            "file_id": Path(tmp_path).stem,
            "original_filename": file.filename,
            "audio_info": audio_info,
            "temp_path": tmp_path
        }
        
    except Exception as e:
        logger.error(f"上传音频失败: {e}")
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")

@router.post("/process-audio")
async def process_audio(
    file: UploadFile = File(...),
    operation: str = Form(...),
    parameters: str = Form(default="{}")
):
    """处理音频文件"""
    try:
        # 保存上传的文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # 解析参数
        import json
        params = json.loads(parameters)
        
        # 根据操作类型处理
        if operation == "normalize":
            result = await audio_processor.normalize_audio(tmp_path)
        elif operation == "trim":
            start_time = params.get("start_time", 0)
            end_time = params.get("end_time")
            result = await audio_processor.trim_audio(tmp_path, start_time, end_time)
        elif operation == "fade":
            fade_in = params.get("fade_in", 0)
            fade_out = params.get("fade_out", 0)
            result = await audio_processor.apply_fade(tmp_path, fade_in, fade_out)
        elif operation == "effects":
            effects = params.get("effects", {})
            result = await audio_processor.apply_effects(tmp_path, effects)
        else:
            raise HTTPException(status_code=400, detail=f"不支持的操作: {operation}")
        
        return result
        
    except Exception as e:
        logger.error(f"音频处理失败: {e}")
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")

@router.post("/separate-audio")
async def separate_audio(file: UploadFile = File(...)):
    """音轨分离"""
    try:
        # 保存上传的文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # 执行音轨分离
        result = await audio_separator.separate(tmp_path)
        
        # 清理临时文件
        os.unlink(tmp_path)
        
        return result
        
    except Exception as e:
        logger.error(f"音轨分离失败: {e}")
        raise HTTPException(status_code=500, detail=f"分离失败: {str(e)}")

@router.post("/extract-lyrics")
async def extract_lyrics(
    file: UploadFile = File(...),
    language: str = Form(default="auto")
):
    """提取歌词"""
    try:
        # 保存上传的文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # 执行语音识别
        if language == "auto":
            language = None
            
        result = await speech_recognizer.extract_vocals_and_transcribe(tmp_path, language)
        
        # 清理临时文件
        os.unlink(tmp_path)
        
        return result
        
    except Exception as e:
        logger.error(f"歌词提取失败: {e}")
        raise HTTPException(status_code=500, detail=f"提取失败: {str(e)}")

@router.post("/transcribe-with-timestamps")
async def transcribe_with_timestamps(
    file: UploadFile = File(...),
    language: str = Form(default="auto")
):
    """带时间戳的语音识别"""
    try:
        # 保存上传的文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # 执行带时间戳的转录
        if language == "auto":
            language = None
            
        result = await speech_recognizer.transcribe_with_timestamps(tmp_path, language)
        
        # 清理临时文件
        os.unlink(tmp_path)
        
        return result
        
    except Exception as e:
        logger.error(f"时间戳转录失败: {e}")
        raise HTTPException(status_code=500, detail=f"转录失败: {str(e)}")

@router.get("/supported-languages")
async def get_supported_languages():
    """获取支持的语言列表"""
    try:
        result = await speech_recognizer.get_supported_languages()
        return result
        
    except Exception as e:
        logger.error(f"获取语言列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")

@router.get("/separation-quality-info")
async def get_separation_quality_info():
    """获取音轨分离质量信息"""
    try:
        result = await audio_separator.get_separation_quality_info()
        return result
        
    except Exception as e:
        logger.error(f"获取分离质量信息失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")

@router.post("/compose-audio")
async def compose_audio(
    tracks: list = Form(...),
    output_format: str = Form(default="wav")
):
    """音频合成（多轨混合）"""
    try:
        # 解析轨道信息
        import json
        track_list = json.loads(tracks) if isinstance(tracks, str) else tracks
        
        # 执行音频合成
        result = await audio_processor.compose_audio(track_list, output_format)
        
        return result
        
    except Exception as e:
        logger.error(f"音频合成失败: {e}")
        raise HTTPException(status_code=500, detail=f"合成失败: {str(e)}")

@router.get("/download/{file_id}")
async def download_file(file_id: str):
    """下载处理后的文件"""
    try:
        # 构建文件路径（简化版，实际应该有更安全的文件管理）
        file_path = f"/tmp/{file_id}"
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="文件不存在")
        
        return FileResponse(
            file_path,
            media_type='audio/wav',
            filename=f"{file_id}.wav"
        )
        
    except Exception as e:
        logger.error(f"文件下载失败: {e}")
        raise HTTPException(status_code=500, detail=f"下载失败: {str(e)}")

@router.post("/analyze-audio")
async def analyze_audio(file: UploadFile = File(...)):
    """音频分析"""
    try:
        # 保存上传的文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # 执行音频分析
        result = await audio_processor.analyze_audio(tmp_path)
        
        # 清理临时文件
        os.unlink(tmp_path)
        
        return result
        
    except Exception as e:
        logger.error(f"音频分析失败: {e}")
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")

# 错误处理
@router.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP异常处理器"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
            "status_code": exc.status_code
        }
    )

@router.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """通用异常处理器"""
    logger.error(f"未处理的异常: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "服务器内部错误",
            "status_code": 500
        }
    )
