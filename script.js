// 添加在 script 标签开始处，其他函数定义之前
function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // 从 DataURL 中提取 base64 部分
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = (error) => {
            console.error('文件读取失败:', error);
            reject(error);
        };
    });
}

// DOM 元素
const textarea = document.querySelector('textarea');
const sendBtn = document.querySelector('.send-btn');
const messagesContainer = document.querySelector('.messages');
const newChatBtn = document.querySelector('.new-chat-btn');
const chatList = document.querySelector('.chat-list');
const contextMenu = document.querySelector('.context-menu');
// 初始化代码高亮
marked.setOptions({
    highlight: function (code, lang) {
        let language = lang;
        if (!language) {
            try {
                const result = hljs.highlightAuto(code);
                language = result.language;
                code = result.value
            } catch (__) {}
        }else{
                try {
                code = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
            } catch (__) { }
        }
        if(language){
                return `<div class="code-block-container"><div class="code-language">${language}</div><pre><code class="hljs">${code}</code></pre></div>`;
        }else{
            return `<div class="code-block-container"><pre><code class="hljs">${code}</code></pre></div>`
        }
    }
});
// 初始化聊天管器和模型管理器
let chatManager;
let modelManager;

// 修改模型选择的初始化
function initializeModelSelect() {
    const modelSelect = document.getElementById('modelSelect');
    const providerBadge = document.getElementById('providerBadge');
    modelSelect.innerHTML = '';
    
    // 直接使用固定的模型列表
    const models = [
        {
            id: "glm-4v-flash",
            name: "GLM-4V-Flash",
            description: "智谱AI视觉言模型",
            provider: "zhipu"
        }
    ];
    
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        option.title = model.description;
        modelSelect.appendChild(option);
    });

    // 设置默认选择的模型
    modelSelect.selectedIndex = 0;
    const selectedModel = models[0];
    
    // 更新提供商标签
    if (providerBadge) {
        providerBadge.textContent = selectedModel.provider.toUpperCase();
        providerBadge.className = `provider-badge provider-${selectedModel.provider}`;
    }

    // 保存选择
    localStorage.setItem('selectedModel', selectedModel.id);
}

// 在页面加载初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化理器
    initializeModelSelect();
    modelManager = new ModelManager();
    chatManager = new ChatManager();
    
    // 新建聊天按钮事件
    if (newChatBtn) {
        console.log('添加新建聊天按钮事件监听器');
        newChatBtn.onclick = () => {
            console.log('点击新建聊天按钮');
            chatManager.createNewChat();
        };
    }
    
    // 右键菜单事件
    document.querySelector('.context-menu-item.rename').addEventListener('click', () => {
        const chatId = parseInt(document.querySelector('.context-menu').dataset.chatId);
        const chatElement = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        
        if (chatElement) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'rename-input';
            input.value = chatElement.textContent;
            
            input.onblur = () => {
                const newTitle = input.value.trim();
                if (newTitle) {
                    chatManager.renameChat(chatId, newTitle);
                }
            };
            
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    input.blur();
                }
            };
            
            chatElement.textContent = '';
            chatElement.appendChild(input);
            input.focus();
            input.select();
        }
        
        document.querySelector('.context-menu').style.display = 'none';
    });
    
    document.querySelector('.context-menu-item.delete').addEventListener('click', () => {
        const chatId = parseInt(document.querySelector('.context-menu').dataset.chatId);
        chatManager.deleteChat(chatId);
        document.querySelector('.context-menu').style.display = 'none';
    });
    
    // 点击其他区域关闭右键菜单
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu')) {
            document.querySelector('.context-menu').style.display = 'none';
        }
    });

    // 修改发送按钮的事件监听器
    sendBtn.addEventListener('click', async () => {
        const message = textarea.value.trim();
        const fileInput = document.getElementById('fileUpload');
        const file = fileInput.files[0];
        
        if (!message && !file) return;
        
        try {
            // 如果有文件，先检查是否是支持图片的模型
            if (file && !modelManager.isVisionModel()) {
                chatManager.addMessage('请选择支持图片的模型（如 GLM-4V）再上传图片', false);
                return;
            }

            // 添加用户消息到界面（包含文件）
            chatManager.addMessage(message, true, file);
            
            // 清空输入
            textarea.value = '';
            fileInput.value = '';
            
            // 移除文件预览
            const existingPreview = document.querySelector('.file-preview');
            if (existingPreview) {
                existingPreview.remove();
            }
            
            // 发送到API并获取回复
            const response = await sendMessageToAPI(message, file);
            if (response && response.choices && response.choices[0]) {
                const assistantMessage = response.choices[0].message.content;
                chatManager.addMessage(assistantMessage, false);
            }
            
        } catch (error) {
            console.error('发送消息失败:', error);
            chatManager.addMessage('抱歉，发生了错误，请稍后重试。', false);
        }
    });

    // 添加模型按钮点击事件
    document.querySelector('.add-model-btn').addEventListener('click', () => {
        document.querySelector('.add-model-dialog').style.display = 'flex';
    });

    // 取消按钮点击事件
    document.querySelector('.add-model-dialog .cancel-btn').addEventListener('click', () => {
        document.querySelector('.add-model-dialog').style.display = 'none';
    });

    // 保存模型按钮点击事件
    document.querySelector('.save-model-btn').addEventListener('click', () => {
        const name = document.getElementById('modelName').value.trim();
        const url = document.getElementById('modelUrl').value.trim();
        const key = document.getElementById('modelKey').value.trim();

        if (!name || !url || !key) {
            alert('请填写所有字段');
            return;
        }

        const newModel = {
            name,
            url,
            key,
            description: `自定义模型: ${name}`,
            provider: 'custom'
        };

        modelManager.addCustomModel(newModel);
        document.querySelector('.add-model-dialog').style.display = 'none';

        // 清空表单
        document.getElementById('modelName').value = '';
        document.getElementById('modelUrl').value = '';
        document.getElementById('modelKey').value = '';
    });

    // 点击对话框外部关闭
    document.querySelector('.add-model-dialog').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            e.target.style.display = 'none';
        }
    });
});

// 加聊天管理类
class ChatManager {
    constructor() {
        this.chats = [];
        this.currentChatId = null;
        this.init();
    }

    async init() {
        this.chats = await chatHistoryManager.loadHistory();
        if (this.chats.length === 0) {
            this.createNewChat();
        } else {
            this.currentChatId = this.chats[0].id;
        }
        this.displayCurrentChat();
    }

    async saveChats() {
        await chatHistoryManager.saveHistory(this.chats);
    }

    createNewChat() {
        console.log('创建新天');
        const newChat = {
            id: Date.now(),
            title: `新对话 ${this.chats.length + 1}`,
            messages: []
        };
        this.chats.unshift(newChat);
        this.currentChatId = newChat.id;
        this.saveChats();
        this.displayCurrentChat();
        return newChat.id;
    }

    getCurrentChat() {
        return this.chats.find(chat => chat.id === this.currentChatId);
    }

    async addMessage(content, isUser = true, file = null) {
        const currentChat = this.getCurrentChat();
        if (currentChat) {
            // 创建基础消息对象
            const message = {
                content,
                isUser,
                timestamp: Date.now()
            };
            
            // 如果有文件，先上传到服务器
            if (file) {
                try {
                    // 创建 FormData 对象
                    const formData = new FormData();
                    formData.append('file', file);
                    
                    // 发送文件到服务器
                    const response = await fetch('http://localhost:8000/upload', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!response.ok) {
                        throw new Error('文件上传失败');
                    }
                    
                    const result = await response.json();
                    // 添加一个配置常量
                    const API_BASE_URL = 'http://localhost:8000';
                    // 使用服务器返回的URL
                    message.file = {
                        type: file.type,
                        url: API_BASE_URL+result.url  // 服务器返回的完整URL
                    };
                } catch (error) {
                    console.error('文件上传失败:', error);
                    // 可以选择添加错误处理逻辑
                }
            }
            
            currentChat.messages.push(message);
            this.saveChats();
            this.displayCurrentChat();
        }
    }

    renameChat(chatId, newTitle) {
        const chat = this.chats.find(c => c.id === chatId);
        if (chat) {
            chat.title = newTitle;
            this.saveChats();
            this.displayCurrentChat();
        }
    }

    deleteChat(chatId) {
        const index = this.chats.findIndex(c => c.id === chatId);
        if (index !== -1) {
            this.chats.splice(index, 1);
            if (chatId === this.currentChatId) {
                this.currentChatId = this.chats.length > 0 ? this.chats[0].id : null;
                if (!this.currentChatId) {
                    this.createNewChat();
                }

            }
            this.saveChats();
            this.displayCurrentChat();
        }
    }

    displayCurrentChat() {
        // 更新聊天列表
        const chatList = document.querySelector('.chat-list');
        chatList.innerHTML = '';
        
        this.chats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${chat.id === this.currentChatId ? 'active' : ''}`;
            chatItem.dataset.chatId = chat.id;
            chatItem.textContent = chat.title;
            
            chatItem.onclick = () => {
                this.currentChatId = chat.id;
                this.displayCurrentChat();
            };
            
            chatItem.oncontextmenu = (e) => {
                e.preventDefault();
                const contextMenu = document.querySelector('.context-menu');
                contextMenu.style.display = 'block';
                contextMenu.style.left = e.pageX + 'px';
                contextMenu.style.top = e.pageY + 'px';
                contextMenu.dataset.chatId = chat.id;
            };
            
            chatList.appendChild(chatItem);
        });

        // 更新消息显示
        const messagesContainer = document.querySelector('.messages');
        messagesContainer.innerHTML = '';
        
        const currentChat = this.getCurrentChat();
        if (currentChat) {
            currentChat.messages.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${msg.isUser ? 'user-message' : 'assistant-message'}`;

                if (msg.file && msg.file.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = msg.file.url;
                    img.style.maxWidth = '200px';
                    img.style.marginBottom = '8px';
                    messageDiv.appendChild(img);
                }

                let contentDiv = document.createElement('div');
                // 如果内容是字符串
                if(typeof msg.content === 'string'){
                    try{
                        // 检查是否是用户消息且包含大量代码特征
                        if (msg.isUser && (
                            msg.content.includes('```') ||
                            (msg.content.match(/[{}<>]/g) || []).length > 5
                        )) {
                            // 作为纯文本代码显示
                            contentDiv.className = 'user-code-message';
                            contentDiv.textContent = msg.content;
                        } else if (!msg.isUser) {
                            // AI 回复使用 markdown 解析
                            contentDiv.innerHTML = marked.parse(msg.content);
                        } else {
                            // 普通用户消息
                            contentDiv.textContent = msg.content;
                        }
                        messageDiv.appendChild(contentDiv);
                    }catch(error){
                        console.error('Markdown解析失败:', error);
                        contentDiv.textContent = msg.content;
                        messageDiv.appendChild(contentDiv);
                }
                }else{
                    // 如果是图片
                    contentDiv.textContent = msg.content;
                    messageDiv.appendChild(contentDiv);
                }
                messagesContainer.appendChild(messageDiv);
        });

            // 代码块复制按钮事件监听
            setTimeout(() => {
            messagesContainer.querySelectorAll('pre code').forEach(codeBlock => {
                    const copyButton = document.createElement('button');
                    copyButton.textContent = '复制';
                    copyButton.classList.add('copy-code-btn');
                    codeBlock.parentNode.insertBefore(copyButton, codeBlock.nextSibling);

                    copyButton.addEventListener('click', () => {
                    navigator.clipboard.writeText(codeBlock.innerText)
                            .then(() => {
                            copyButton.textContent = '复制成功!';
                            setTimeout(() => {
                                copyButton.textContent = '复制';
                            }, 1000);
                            })
                            .catch(err => {
                            console.error('复制失败', err);
                            copyButton.textContent = '复制失败!';
                            });
                });
            });
        },0);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
}

// 添加右键菜单样式
const style = document.createElement('style');
style.textContent = `
    .context-menu {
        position: fixed;
        background: white;
        border: 1px solid #e5e5e5;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1000;
    }
    
    .context-menu-item {
        padding: 8px 12px;
        cursor: pointer;
    }
    
    .context-menu-item:hover {
        background: #f5f5f5;
    }
    
    .chat-item {
        padding: 8px 12px;
        cursor: pointer;
        border-radius: 4px;
        margin-bottom: 4px;
    }
    
    .chat-item:hover {
        background: rgba(255,255,255,0.1);
    }
    
    .chat-item.active {
        background: rgba(255,255,255,0.2);
    }
    
    .rename-input {
        width: 100%;
        padding: 4px 8px;
        border: 1px solid #4b4b4b;
        border-radius: 4px;
        background: transparent;
        color: white;
    }
`;
document.head.appendChild(style);

class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.init();
    }
    
    init() {
        const themeSelect = document.getElementById('themeSelect');
        themeSelect.value = this.currentTheme;
        this.applyTheme(this.currentTheme);
        
        themeSelect.addEventListener('change', (e) => {
            this.setTheme(e.target.value);
        });
    }
    
    setTheme(theme) {
        this.currentTheme = theme;
        localStorage.setItem('theme', theme);
        this.applyTheme(theme);
    }
    
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }
}

// 初始化主题管理器
let themeManager;

// 设置按钮点击事件
document.querySelector('.settings-btn').addEventListener('click', () => {
    document.querySelector('.settings-dialog').style.display = 'flex';
    modelManager.renderModelList();
});

// 关闭按钮点击事件
document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.closest('.settings-dialog, .add-model-dialog').style.display = 'none';
    });
});

// 点击对话框外部关闭
document.querySelectorAll('.settings-dialog, .add-model-dialog').forEach(dialog => {
    dialog.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            e.target.style.display = 'none';
        }
    });
});

// 在页面加载时初始化主题管理器
document.addEventListener('DOMContentLoaded', () => {
    themeManager = new ThemeManager();
});

async function sendMessageToAPI(content, file = null) {
    try {
        const selectedModel = modelSelect.value;
        // 获取选中模型的配置
        const modelConfig = modelManager.models.find(m => m.id === selectedModel);
        if (!modelConfig) {
            throw new Error('未找到模型配置');
        }

        const historyMessages = chatHistoryManager.getSessionMessages(
            chatManager.currentChatId,
            chatManager.chats
        );

        let messages = [...historyMessages];
        
        if (file) {
            // 处理图片消息
            const base64Image = await getBase64(file);
            messages.push({
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: base64Image
                        }
                    },
                    {
                        type: "text",
                        text: content || "图里有什么？"
                    }
                ]
            });
            
            // 使用视觉API
            endpoint = '/chat/vision';
        } else {
            // 处理文本消息
            messages.push({
                role: "user",
                content: content
            });
            endpoint = '/chat/completions';
        }

        const requestData = {
            model: selectedModel,
            messages: messages,
            temperature: modelConfig.temperature || 0.7,
            max_tokens: modelConfig.maxTokens || 1024,
            api_url: modelConfig.url,  // 添加API URL
            api_key: modelConfig.key   // 添加API Key
        };

        const response = await fetch(`http://localhost:8000${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${await response.text()}`);
        }

        return await response.json();
    } catch (error) {
        console.error('发送消息失败:', error);
        throw error;
    }
}
// 在 script 标签中添加文件上传预览功能
document.getElementById('fileUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        // 移除现有的预览
        const existingPreview = document.querySelector('.file-preview');
        if (existingPreview) {
            existingPreview.remove();
        }

        // 创建预览元素
        const preview = document.createElement('div');
        preview.className = 'file-preview';

        // 如果是图片，显示缩略图
        if (file.type.startsWith('image/')) {
            try {
                const img = document.createElement('img');
                const objectUrl = URL.createObjectURL(file);
                img.onload = () => {
                    URL.revokeObjectURL(objectUrl); // 清理创建的URL
                };
                img.onerror = () => {
                    console.error('图片加载失败');
                    URL.revokeObjectURL(objectUrl);
                };
                img.src = objectUrl;
                preview.appendChild(img);
            } catch (error) {
                console.error('创建图片预览失败:', error);
            }
        }

        // 添加文件名
        const fileName = document.createElement('span');
        fileName.textContent = file.name;
        preview.appendChild(fileName);

        // 添加删除按钮
        const removeBtn = document.createElement('span');
        removeBtn.className = 'remove-file';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => {
            preview.remove();
            e.target.value = ''; // 清除文件选择
        };
        preview.appendChild(removeBtn);

        // 将预览添加到输入框上方
        const inputArea = document.querySelector('.input-area');
        inputArea.insertBefore(preview, inputArea.firstChild);
    }
});

// 在发送消息后清除预览
// 在 sendBtn 的点击事件处理中，成功发送后添加：
const existingPreview = document.querySelector('.file-preview');
if (existingPreview) {
    existingPreview.remove();
}

// 添加滑动条值的实时更新
document.getElementById('modelTemperature').addEventListener('input', function(e) {
    document.getElementById('temperatureValue').textContent = e.target.value;
});

document.getElementById('modelMaxTokens').addEventListener('input', function(e) {
    document.getElementById('maxTokensValue').textContent = e.target.value;
});
