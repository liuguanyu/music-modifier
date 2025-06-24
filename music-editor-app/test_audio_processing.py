#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音频处理功能测试脚本
测试音频分离、歌词提取等功能
"""

import requests
import json
import time
import os

def test_audio_upload():
    """测试音频文件上传"""
    print("=== 测试音频文件上传 ===")
    
    test_file = "test_files/你眼里的光.mp3"
    if not os.path.exists(test_file):
        print(f"测试文件不存在: {test_file}")
        return False
    
    url = "http://127.0.0.1:8001/api/upload-audio"
    
    try:
        with open(test_file, 'rb') as f:
            files = {'file': (os.path.basename(test_file), f, 'audio/mpeg')}
            response = requests.post(url, files=files)
        
        if response.status_code == 200:
            result = response.json()
            print(f"上传成功: {result}")
            return result.get('filename')
        else:
            print(f"上传失败: {response.status_code}, {response.text}")
            return False
            
    except Exception as e:
        print(f"上传异常: {e}")
        return False

def test_audio_separation(filename):
    """测试音频分离"""
    print("=== 测试音频分离 ===")
    
    url = "http://127.0.0.1:8001/api/separate_audio"
    data = {'filename': filename}
    
    try:
        response = requests.post(url, json=data)
        
        if response.status_code == 200:
            result = response.json()
            print(f"分离成功: {result}")
            return result
        else:
            print(f"分离失败: {response.status_code}, {response.text}")
            return False
            
    except Exception as e:
        print(f"分离异常: {e}")
        return False

def test_lyrics_extraction(filename):
    """测试歌词提取"""
    print("=== 测试歌词提取 ===")
    
    url = "http://127.0.0.1:8001/api/extract_lyrics"
    data = {'filename': filename}
    
    try:
        response = requests.post(url, json=data)
        
        if response.status_code == 200:
            result = response.json()
            print(f"歌词提取成功:")
            print(f"原始文本: {result.get('text', '无')}")
            print(f"时间轴歌词: {result.get('lyrics_with_timestamps', '无')}")
            return result
        else:
            print(f"歌词提取失败: {response.status_code}, {response.text}")
            return False
            
    except Exception as e:
        print(f"歌词提取异常: {e}")
        return False

def test_api_health():
    """测试API健康状态"""
    print("=== 测试API健康状态 ===")
    
    url = "http://127.0.0.1:8001/"
    
    try:
        response = requests.get(url)
        
        if response.status_code == 200:
            result = response.json()
            print(f"API健康: {result}")
            return True
        else:
            print(f"API异常: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"连接失败: {e}")
        return False

def main():
    """主测试流程"""
    print("音频处理功能完整测试")
    print("=" * 40)
    
    # 1. 测试API健康状态
    if not test_api_health():
        print("❌ API服务未启动，请先启动后端服务")
        return
    
    # 2. 测试文件上传
    filename = test_audio_upload()
    if not filename:
        print("❌ 文件上传失败")
        return
    
    print(f"✅ 文件上传成功: {filename}")
    
    # 等待一下
    time.sleep(1)
    
    # 3. 测试音频分离
    separation_result = test_audio_separation(filename)
    if separation_result:
        print("✅ 音频分离测试成功")
    else:
        print("❌ 音频分离测试失败")
    
    # 等待一下
    time.sleep(1)
    
    # 4. 测试歌词提取
    lyrics_result = test_lyrics_extraction(filename)
    if lyrics_result:
        print("✅ 歌词提取测试成功")
    else:
        print("❌ 歌词提取测试失败")
    
    print("\n" + "=" * 40)
    print("测试完成!")

if __name__ == '__main__':
    main()
