"""
Music Editor Backend - IPC处理器启动脚本
"""

import sys
import asyncio
from pathlib import Path

# 添加当前目录到Python路径
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

from ipc_handler import main

if __name__ == "__main__":
    # 直接启动IPC处理器
    asyncio.run(main())
