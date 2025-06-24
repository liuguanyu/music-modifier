#!/usr/bin/env python3
"""
测试IPC集成
验证新的IPC架构是否正常工作
"""

import sys
import os
import json
import subprocess
import time

# 添加后端路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def test_ipc_handler():
    """测试IPC处理器"""
    print("=== 测试IPC处理器 ===")
    
    try:
        # 启动IPC处理器
        ipc_script = os.path.join(os.path.dirname(__file__), 'backend', 'ipc_handler.py')
        
        # 使用虚拟环境的Python
        python_path = os.path.join(os.path.dirname(__file__), 'myenv', 'bin', 'python3')
        if not os.path.exists(python_path):
            python_path = 'python3'
        
        print(f"启动IPC处理器: {python_path} {ipc_script}")
        
        process = subprocess.Popen(
            [python_path, ipc_script],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=os.path.dirname(__file__)
        )
        
        # 等待初始化
        time.sleep(2)
        
        # 测试环境检查命令
        test_command = {
            "id": 1,
            "command": "check_environment",
            "params": {}
        }
        
        print("发送测试命令:", json.dumps(test_command))
        process.stdin.write(json.dumps(test_command) + '\n')
        process.stdin.flush()
        
        # 读取响应
        try:
            output_line = process.stdout.readline()
            print(f"收到响应: {output_line.strip()}")
            
            if output_line.strip():
                response = json.loads(output_line.strip())
                print("解析的响应:", json.dumps(response, indent=2, ensure_ascii=False))
                
                if response.get('result', {}).get('success'):
                    print("✅ IPC处理器测试成功!")
                    return True
                else:
                    print("❌ IPC处理器返回失败:", response.get('result', {}))
                    return False
            else:
                print("❌ 没有收到响应")
                return False
                
        except json.JSONDecodeError as e:
            print(f"❌ JSON解析失败: {e}")
            print(f"原始输出: {output_line}")
            return False
        
        except Exception as e:
            print(f"❌ 读取响应时出错: {e}")
            return False
            
    except Exception as e:
        print(f"❌ 启动IPC处理器失败: {e}")
        return False
        
    finally:
        if 'process' in locals():
            process.terminate()
            process.wait()

def main():
    """运行所有测试"""
    print("开始测试IPC集成...")
    
    success = test_ipc_handler()
    
    if success:
        print("\n🎉 所有测试通过!")
        print("新的IPC架构集成成功!")
    else:
        print("\n❌ 测试失败")
        print("请检查配置和依赖")

if __name__ == "__main__":
    main()
