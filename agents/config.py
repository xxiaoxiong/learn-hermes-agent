"""环境配置加载 — 所有 h0X_*.py 从此文件读取模型配置"""
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL: str = os.getenv("HERMES_BASE_URL", "https://api.openai.com/v1")
API_KEY: str = os.getenv("HERMES_API_KEY", "")
MODEL: str = os.getenv("HERMES_MODEL", "gpt-4o")
