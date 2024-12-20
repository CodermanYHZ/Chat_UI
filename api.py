from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Union, Dict, Any
import httpx
import json
import os
import logging
import shutil
from datetime import datetime
import uuid

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# 创建上传目录
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# 挂载静态文件目录
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

class ChatMessage(BaseModel):
    role: str
    content: Union[str, List[Dict[str, Any]]]

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: str
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1024
    stream: Optional[bool] = False
    api_url: str
    api_key: str

# 定义请求模型
class ModelConfig(BaseModel):
    models: list
    defaultModel: str

# 每个请求独立处理，不保存历史记录

async def send_message_to_model(request_data:ChatRequest):
        logger.info("开始处理模型请求")
        url = request_data.api_url
        headers = {"Content-Type": "application/json"}
        if request_data.api_key:
             headers["Authorization"] = f"Bearer {request_data.api_key}"
        
        try:
            # 记录请求数据（去除敏感信息）
            safe_request = {
                "model": request_data.model,
                "messages": [msg.dict() for msg in request_data.messages],
                "temperature": request_data.temperature,
                "max_tokens": request_data.max_tokens
            }
            logger.info(f"请求数据: {json.dumps(safe_request, ensure_ascii=False)}")

            async with httpx.AsyncClient() as client:
                logger.info(f"发送请求到: {url}")
                client.timeout = 30.0
                response = await client.post(url, 
                    json={
                        "messages": [msg.dict() for msg in request_data.messages],
                        "model": request_data.model,
                        "temperature": request_data.temperature,
                        "max_tokens": request_data.max_tokens
                    },
                    headers=headers
                )
                
                if response.status_code != 200:
                    error_text = await response.text()
                    logger.error(f"API返回错误 - 状态码: {response.status_code}, 响应: {error_text}, Headers: {response.headers}")
                    raise HTTPException(
                        status_code=response.status_code, 
                        detail=f"第三方API错误: {error_text}"
                    )
                
                response_data = response.json()
                logger.info("请求成功完成")
                return response_data
        except httpx.RequestError as e:
            logger.error(f"请求失败 - URL: {url}, 错误: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"请求失败: {str(e)}")
        except json.JSONDecodeError as e:
            logger.error(f"响应解析失败: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"响应解析失败: {str(e)}")
        except Exception as e:
            logger.error(f"处理请求时发生错误: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/completions")
async def chat_completion(request_data: ChatRequest):
    try:
        logger.info("收到聊天请求")
        session_id = request_data.messages[0].content if isinstance(request_data.messages[0].content,str) else request_data.messages[0].content[0].get('text') if isinstance(request_data.messages[0].content,list) and len(request_data.messages[0].content)>0 else  uuid.uuid4()
        if isinstance(session_id,str):
            session_id = session_id.split(' ')[-1]
        else:
           session_id = uuid.uuid4()
        if not session_id:
           session_id = uuid.uuid4()
        response = await send_message_to_model(request_data)
        return response
    except Exception as e:
        logger.error(f"处理文本消息请求失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/vision")
async def chat_vision(request_data: ChatRequest):
    try:
       session_id = request_data.messages[0].content if isinstance(request_data.messages[0].content,str) else request_data.messages[0].content[0].get('text') if isinstance(request_data.messages[0].content,list) and len(request_data.messages[0].content)>0 else  uuid.uuid4()
       if isinstance(session_id,str):
           session_id = session_id.split(' ')[-1]
       else:
          session_id = uuid.uuid4()
       if not session_id:
          session_id = uuid.uuid4()
       response = await send_message_to_model(request_data)
       return response
    except Exception as e:
        logger.error(f"处理图片消息请求失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/save-history")
async def save_history(chats: List[dict]):
    try:
        # 确保目录存在
        if not os.path.exists('data'):
            os.makedirs('data')
            
        # 保存到文件
        with open('data/chat_history.json', 'w', encoding='utf-8') as f:
            json.dump(chats, f, ensure_ascii=False, indent=2)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/load-history")
async def load_history():
    try:
        if not os.path.exists('data'):
            os.makedirs('data')
            
        if not os.path.exists('data/chat_history.json'):
            # 如果文件不存在，返回空列表
            return []
            
        with open('data/chat_history.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"加载聊天历史失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/load-config")
async def load_config():
    logger.info("收到加载配置请求")
    try:
        if not os.path.exists('data'):
            logger.info("创建data目录")
            os.makedirs('data')
            
        if not os.path.exists('data/model_config.json'):
            logger.info("创建默认配置文件")
            default_config = {
                "models": [
                    {
                        "id": "glm-4v-flash",
                        "name": "GLM-4V-Flash",
                        "description": "智谱AI视觉语言模型",
                        "url": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
                        "key": "your_api_key_here",
                        "provider": "zhipu"
                    }
                ],
                "defaultModel": "glm-4v-flash"
            }
            with open('data/model_config.json', 'w', encoding='utf-8') as f:
                json.dump(default_config, f, ensure_ascii=False, indent=2)
            return default_config
            
        logger.info("读取现有配置文件")
        with open('data/model_config.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"载配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/save-config")
async def save_config(config: ModelConfig):
    logger.info(f"收到保存配置请求: {config}")
    try:
        if not os.path.exists('data'):
            logger.info("创建data目录")
            os.makedirs('data')
            
        logger.info("保存配置到文件")
        config_dict = config.dict()
        with open('data/model_config.json', 'w', encoding='utf-8') as f:
            json.dump(config_dict, f, ensure_ascii=False, indent=2)
        return {"status": "success"}
    except Exception as e:
        logger.error(f"保存配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        # 生成唯一文件名
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        
        # 按日期组织文件夹
        date_folder = datetime.now().strftime("%Y%m")
        save_dir = os.path.join(UPLOAD_DIR, date_folder)
        if not os.path.exists(save_dir):
            os.makedirs(save_dir)
            
        # 保存文件
        file_path = os.path.join(save_dir, unique_filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 返回相对路径
        return {
            "url": f"/uploads/{date_folder}/{unique_filename}"
        }
    except Exception as e:
        print(f"文件上传失败: {str(e)}")  # 添加错误日志
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("启动服务器...")
    try:
        uvicorn.run(
            "api:app",
            host="0.0.0.0",
            port=8000,
            reload=True
        )
    except Exception as e:
        print(f"服务器启动失败: {e}")
