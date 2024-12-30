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
                code = result.value;
            } catch (__) {}
        } else {
            try {
                code = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
            } catch (__) {}
        }
        
        if (language) {
            return `<div class="code-block-container">
                <div class="code-header">
                    <span class="code-language">${language}</span>
                    <button class="copy-button" onclick="copyCode(this)">复制代码</button>
                </div>
                <pre><code class="hljs">${code}</code></pre>
            </div>`;
        } else {
            return `<div class="code-block-container">
                <div class="code-header">
                    <button class="copy-button" onclick="copyCode(this)">复制代码</button>
                </div>
                <pre><code class="hljs">${code}</code></pre>
            </div>`;
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
    
    // 直接使用
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
    
    // 初始化发送按钮状态
    initializeSendButtons();
    
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

    // 添加侧边栏切换功能
    const toggleBtn = document.querySelector('.toggle-sidebar-btn');
    const sidebar = document.querySelector('.sidebar');
    
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            // 更新按钮提示文本
            toggleBtn.title = sidebar.classList.contains('collapsed') ? '展开侧边栏' : '收起侧边栏';
        });
    }
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
            // 创建基本息对象
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
        // 模式选择消息容器
        const isDocMode = document.querySelector('.mode-btn[data-mode="doc"]').classList.contains('active');
        
        const messagesContainer = isDocMode ? 
            document.querySelector('.doc-messages') : 
            document.querySelector('.chat-mode-container .messages');
        
        if (!messagesContainer) return;
        messagesContainer.innerHTML = '';
        
        const currentChat = this.getCurrentChat();
        if (currentChat) {
            currentChat.messages.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${msg.isUser ? 'user-message' : 'assistant-message'}`;
                
                // 创建消息内容容器
                const contentContainer = document.createElement('div');
                contentContainer.className = 'message-content';
                
                // 如果消息包含图片，先渲染图片
                if (msg.file && msg.file.type.startsWith('image/')) {
                    const imgElement = document.createElement('img');
                    imgElement.src = msg.file.url;
                    imgElement.className = 'message-image';
                    contentContainer.appendChild(imgElement);
                }

                // 渲染消息文本内容

                if (msg.content) {
                    const textElement = document.createElement('div');
                    textElement.className = 'message-text';
                    if (msg.isUser) {
                        textElement.textContent = msg.content;
                    } else {
                        textElement.innerHTML = marked.parse(msg.content);               
                        // 为API回复添加复制按钮
                        const copyButton = document.createElement('button');
                        copyButton.className = 'message-copy-btn';
                        copyButton.innerHTML = `
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        `;
                        copyButton.onclick = () => {
                            navigator.clipboard.writeText(msg.content).then(() => {
                                // 只改变图标颜色来表示复制成功
                                copyButton.style.color = '#10a37f';
                                setTimeout(() => {
                                    copyButton.style.color = '';
                                }, 2000);
                            });
                        };
                        textElement.appendChild(copyButton);
                    }
                    contentContainer.appendChild(textElement);
                }
  
                // 将内容容器添加到消息div
                messageDiv.appendChild(contentContainer);
                messagesContainer.appendChild(messageDiv);

                // 如果是助手消息且有网络搜索结果，在消息内容后渲染搜索结果
                if (!msg.isUser && msg.web_search) {
                    const searchResultsDiv = document.createElement('div');
                    searchResultsDiv.className = 'search-results';
                    searchResultsDiv.innerHTML = `
                        <div class="search-results-header">参考文献：</div>
                        <div class="search-result-item">
                            ${msg.web_search.map((result, index) => `
                                <div class="result-row">
                                    <span class="result-ref">${result.refer}</span>
                                    <a href="${result.icon}" target="_blank" class="source-link">
                                        <img src="${result.icon}" class="source-icon" alt="${result.media}"/>
                                    </a>
                                    <span class="result-media">${result.media}</span>
                                    <a href="${result.link}" target="_blank" class="result-link">
                                        ${result.title}
                                    </a>
                                    <details class="result-details">
                                        <summary>展开内容</summary>
                                        <div class="result-content">
                                            ${result.content}
                                        </div>
                                    </details>
                                </div>
                            `).join('')}
                        </div>
                    `;
                    messagesContainer.appendChild(searchResultsDiv);
                }

                // 为新渲染的代码块添加复制按钮
                messageDiv.querySelectorAll('pre code').forEach(codeBlock => {
                    // 检查是否已经有复制按钮
                    if (!codeBlock.nextSibling || !codeBlock.nextSibling.classList?.contains('copy-code-btn')) {
                        const copyButton = document.createElement('button');
                        copyButton.textContent = '复制';
                        copyButton.classList.add('copy-code-btn');
                        
                        // 将按钮插入到代码块后面
                        codeBlock.parentNode.insertBefore(copyButton, codeBlock.nextSibling);
                        
                        // 添加点击事件
                        copyButton.onclick = () => {
                            navigator.clipboard.writeText(codeBlock.textContent)
                                .then(() => {
                                    copyButton.textContent = '复制成功!';
                                    setTimeout(() => {
                                        copyButton.textContent = '复制';
                                    }, 2000);
                                })
                                .catch(err => {
                                    console.error('复制失败:', err);
                                    copyButton.textContent = '复制失败!';
                                });
                        };
                    }
                });
            });
        }
    }

    async handleStreamResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let contentDiv = null;
        let webSearchResults = null;  // 存储搜索结果
        let hasDisplayedSearchResults = false;

        // 在开始处理响应前就清除预览
        const existingPreview = document.querySelector('.file-preview');
        if (existingPreview) {
            existingPreview.remove();
        }
        // 清除文件输入
        document.getElementById('fileUpload').value = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(5));
                        
                        // 处理网络搜索结果
                        if (data.web_search && !hasDisplayedSearchResults) {
                            hasDisplayedSearchResults = true;
                            webSearchResults = data.web_search;  // 保存搜索结果
                            // 显示搜索结果
                            const searchResultsDiv = document.createElement('div');
                            searchResultsDiv.className = 'search-results';
                            // ... 其他显示代码 ...
                        }
                        
                        // 处理模型回复
                        if (data.choices && data.choices[0].delta?.content) {
                            const content = data.choices[0].delta.content;
                            fullContent += content;
                            // ... 其他显示代码 ...
                        }
                    } catch (error) {
                        console.error('解析响应失败:', error);
                    }
                }
            }
        }

        // 保存完整的消息
        const currentChat = this.getCurrentChat();
        if (currentChat) {
            const message = {
                content: fullContent,
                isUser: false,
                timestamp: Date.now(),
                web_search: webSearchResults  // 将搜索结果添加消息对象
            };
            
            currentChat.messages.push(message);
            this.saveChats();  // 保存到 localStorage
            
            // 渲染消息
            this.renderMessage(message);
        }
        
        return;
    }

    // 修改 renderMessage 方法以支持显示 web_search
    renderMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.isUser ? 'user-message' : 'assistant-message'}`;
        
        // 如果是助手消息且有网络搜索结果，先渲染搜索结果
        if (!message.isUser && message.web_search) {
            const searchResultsDiv = document.createElement('div');
            searchResultsDiv.className = 'search-results';
            searchResultsDiv.innerHTML = `
                <div class="search-results-header">参考文献：</div>
                <div class="search-results-container">
                    ${message.web_search.map(result => `
                        <div class="search-result-item">
                            <div class="result-header">
                                <span class="result-ref">[${result.refer}]</span>
                                <a href="${result.link}" target="_blank" class="result-title">
                                    ${result.title}
                                </a>
                            </div>
                            <div class="result-source">
                                <span class="result-media">${result.media}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            messagesContainer.appendChild(searchResultsDiv);
        }
        
        // 渲染消息内容
        if (message.isUser) {
            messageDiv.textContent = message.content;
        } else {
            messageDiv.innerHTML = marked.parse(message.content);
            
            // 为新渲染的代码块添加复制按钮
            messageDiv.querySelectorAll('pre code').forEach(codeBlock => {
                // 检查是否已经有复制按钮
                if (!codeBlock.nextSibling || !codeBlock.nextSibling.classList?.contains('copy-code-btn')) {
                    const copyButton = document.createElement('button');
                    copyButton.textContent = '复制';
                    copyButton.classList.add('copy-code-btn');
                    
                    // 将按钮插入到代码块后面
                    codeBlock.parentNode.insertBefore(copyButton, codeBlock.nextSibling);
                    
                    // 添加点击事件
                    copyButton.onclick = () => {
                        navigator.clipboard.writeText(codeBlock.textContent)
                            .then(() => {
                                copyButton.textContent = '复制成功!';
                                setTimeout(() => {
                                    copyButton.textContent = '复制';
                                }, 2000);
                            })
                            .catch(err => {
                                console.error('复制失败:', err);
                                copyButton.textContent = '复制失败!';
                            });
                    };
                }
            });
        }
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
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

// 定义搜索提示模板
const SEARCH_PROMPT = `
# 以下是来自互联网的信息：
{search_result}

# 当前日期: ${new Date().toISOString().split('T')[0]}

# 要求：
1. 仅使用上述参考信息回答问题
2. 每个陈述必须在句末标注来源，使用[ref_序号]格式
3. 如果信息不足，告知用户"抱歉，没有找到相关信息"
4. 保持回答的准确性和时效性
`;

async function sendMessageToAPI(message, file = null,chatSendBtn) {
    try {
        const selectedModel = modelSelect.value;
        const modelConfig = modelManager.models.find(m => m.id === selectedModel);
        if (!modelConfig) {
            throw new Error('未找到模型配置');
        }

        // 检查是否启用了网络搜索
        const webSearchEnabled = document.getElementById('searchToggle').checked;

        const historyMessages = chatHistoryManager.getSessionMessages(
            chatManager.currentChatId,
            chatManager.chats
        );

        let messages = [...historyMessages];
        let endpoint;
        
        if (file) {
            // 处理图片消息
            const base64Image = await getBase64(file);
            messages.push({
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:${file.type};base64,${base64Image}`
                        }
                    },
                    {
                        type: "text",
                        text: message || "图里有什么？"
                    }
                ]
            });
            
            // 使用视觉API
            endpoint = '/chat/vision';
        } else {
            messages.push({
                role: "user",
                content: message
            });
            endpoint = '/chat/completions';
        }

        const requestData = {
            model: selectedModel,
            messages: messages,
            temperature: modelConfig.temperature || 0.7,
            max_tokens: modelConfig.maxTokens || 1024,
            api_url: modelConfig.url,
            api_key: modelConfig.key,
            stream: true,
            tools: webSearchEnabled ? [{
                "type": "web_search",
                "web_search": {
                    "enable": true,
                    "search_prompt": SEARCH_PROMPT,
                    "search_result": true
                }
            }] : undefined
        };
        
        const response = await fetch(`http://localhost:8000${endpoint}/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),

        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${await response.text()}`);
        }
        
        chatSendBtn.textContent = '接收中...';
        // 创建新的消息元素
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant-message';
        const contentDiv = document.createElement('div');
        messageDiv.appendChild(contentDiv);
        
        // 获取当前模式下的消息容器
        const isDocMode = document.querySelector('.mode-btn[data-mode="doc"]').classList.contains('active');
        const messagesContainer = isDocMode ? 
            document.querySelector('.doc-messages') : 
            document.querySelector('.chat-mode-container .messages');
        messagesContainer.appendChild(messageDiv);
        
        let fullContent = '';
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let hasDisplayedSearchResults = false;
        let webSearchResults = null;  // 存储搜索结果

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    // 检查是否是结束标记
                    if (line.trim() === 'data: [DONE]') {
                        continue;
                    }
                    
                    try {
                        const data = JSON.parse(line.slice(5));
                        
                        // 处理网络搜索结果
                        if (data.web_search && !hasDisplayedSearchResults) {
                            hasDisplayedSearchResults = true;
                            webSearchResults = data.web_search;  // 保存搜索结果
                            const searchResultsDiv = document.createElement('div');
                            searchResultsDiv.className = 'message assistant-message search-results';
                            searchResultsDiv.innerHTML = `
                                <div class="search-results-header">参考文献：</div>
                                <div class="search-result-item">
                                    ${data.web_search.map((result, index) => `
                                        <div class="result-row">
                                            <span class="result-ref">${result.refer}</span>
                                            <a href="${result.icon}" target="_blank" class="source-link">
                                                <img src="${result.icon}" class="source-icon" alt="${result.media}"/>
                                            </a>
                                            <span class="result-media">${result.media}</span>
                                            <a href="${result.link}" target="_blank" class="result-link">
                                                ${result.title}
                                            </a>
                                            <details class="result-details">
                                                <summary>展开内容</summary>
                                                <div class="result-content">
                                                    ${result.content}
                                                </div>
                                            </details>
                                        </div>
                                    `).join('')}
                                </div>
                            `;
                            messagesContainer.appendChild(searchResultsDiv);
                        }

                        // 处理模型回复
                        if (data.choices && data.choices[0].delta?.content) {
                            const content = data.choices[0].delta.content;
                            
                            if (!contentDiv) {
                                contentDiv = document.createElement('div');
                                contentDiv.className = 'message assistant-message';
                                messagesContainer.appendChild(contentDiv);
                            }
                            
                            fullContent += content;
                            contentDiv.innerHTML = marked.parse(fullContent);
                            
                            // 立即为新渲染的代码块添加复制按钮
                            contentDiv.querySelectorAll('pre code').forEach(codeBlock => {
                                // 检查是否已经有复制按钮
                                if (!codeBlock.nextSibling || !codeBlock.nextSibling.classList?.contains('copy-code-btn')) {
                                    const copyButton = document.createElement('button');
                                    copyButton.textContent = '复制';
                                    copyButton.classList.add('copy-code-btn');
                                    
                                    // 将按钮插入到代码块后面
                                    codeBlock.parentNode.insertBefore(copyButton, codeBlock.nextSibling);
                                    
                                    // 添加点击事件
                                    copyButton.onclick = () => {
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
                                    };
                                }
                            });

                            // 添加消息复制按钮（如果还没有添加）
                            if (!contentDiv.querySelector('.message-copy-btn')) {
                                const copyButton = document.createElement('button');
                                copyButton.className = 'message-copy-btn';
                                copyButton.innerHTML = `
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                `;
                                
                                // 直接设置按钮样式
                                Object.assign(copyButton.style, {
                                    position: 'absolute',
                                    bottom: '-24px',
                                    left: '0',
                                    width: '24px',
                                    height: '24px',
                                    padding: '4px',
                                    color: '#666',
                                    background: 'transparent',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease'
                                });

                                // 添加鼠标悬停效果
                                copyButton.onmouseenter = () => {
                                    copyButton.style.background = '#f5f5f5';
                                };
                                copyButton.onmouseleave = () => {
                                    copyButton.style.background = 'transparent';
                                };

                                copyButton.onclick = () => {
                                    navigator.clipboard.writeText(fullContent).then(() => {
                                        copyButton.style.color = '#10a37f';
                                        setTimeout(() => {
                                            copyButton.style.color = '#666';
                                        }, 2000);
                                    });
                                };

                                // 确保父元素有相对定位
                                contentDiv.style.position = 'relative';
                                contentDiv.appendChild(copyButton);
                            }
                        }
                    } catch (error) {
                        // 忽略 [DONE] 消息的解析错误
                        if (!line.includes('[DONE]')) {
                            console.error('解析响应数据失败:', error);
                        }
                    }
                }
            }
        }
        
        // 保存完整的消息到历史记录
        const currentChat = chatManager.getCurrentChat();
        if (currentChat) {
            currentChat.messages.push({
                content: fullContent,
                isUser: false,
                timestamp: Date.now(),
                web_search: webSearchResults  // 添加搜索结果到消息对象
            });
            chatManager.saveChats();
        }
        
        return;

    } catch (error) {
        console.error('发送消息失败:', error);
        chatManager.addMessage('抱歉，发生了错误，请稍后重试。', false);
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

        // 将预览加到输入框上方
        const inputArea = document.querySelector('.input-area');
        inputArea.insertBefore(preview, inputArea.firstChild);
    }
});

// 在发送消息后清除预览
// 在 sendBtn 的点击事件处理中，成发送后添加：
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

// 修改模式切换按钮的事件监听
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (mode === 'doc') {
            document.querySelector('.chat-mode-container').style.display = 'none';
            document.querySelector('.doc-mode-container').style.display = 'block';
            document.querySelector('.doc-toolbar').style.display = 'flex';
            document.querySelector('.doc-chat-area').style.display = 'flex';
            
            const docSendBtn = document.querySelector('.doc-chat-area .send-btn');
            const docTextarea = document.querySelector('.doc-textarea');
            
            docSendBtn.onclick = async () => {
                const message = docTextarea.value.trim();
                if (message) {
                    // 保存用户输入到聊天历史
                    chatManager.addMessage(message, true);
                    docTextarea.value = '';
                    
                    try {
                        await sendMessageToAPI(message);
                    } catch (error) {
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'message assistant-message';
                        errorDiv.textContent = '抱歉，发生了错误，请稍后重试。';
                        document.querySelector('.doc-messages').appendChild(errorDiv);
                        // 保存错误消息到聊天历史
                        chatManager.addMessage('抱歉，发生了错误，请稍后重试。', false);
                    }
                }
            };
            
            document.querySelector('.chat-mode-container .send-btn').onclick = null;
        } else {
            document.querySelector('.chat-mode-container').style.display = 'flex';
            document.querySelector('.doc-mode-container').style.display = 'none';
            document.querySelector('.doc-toolbar').style.display = 'none';
            document.querySelector('.doc-chat-area').style.display = 'none';
            
            const chatSendBtn = document.querySelector('.chat-mode-container .send-btn');
            const chatTextarea = document.querySelector('.chat-textarea');
            
            chatSendBtn.onclick = async () => {
                const message = chatTextarea.value.trim();
                const fileInput = document.getElementById('fileUpload');
                const file = fileInput?.files[0];
                
                if (!message && !file) return;
                
                try {
                    chatManager.addMessage(message, true, file);
                    chatTextarea.value = '';
                    if (fileInput) fileInput.value = '';
                    
                    await sendMessageToAPI(message, file);
                } catch (error) {
                    console.error('发送消息失败:', error);
                    chatManager.addMessage('抱歉，发生了错误，请稍后重试。', false);
                }
            };
            
            document.querySelector('.doc-chat-area .send-btn').onclick = null;
        }
    });
});
// 添加中断控制器

// 初始化发送按钮状态的函数
function initializeSendButtons() {
    // 激活聊天模式的发送按钮
    const chatSendBtn = document.querySelector('.chat-mode-container .send-btn');
    const chatTextarea = document.querySelector('.chat-mode-container textarea');
    
    // 初始化文件上传预览功能
    const fileInput = document.getElementById('fileUpload');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            // 如果是图片，创建预览
            if (file.type.startsWith('image/')) {
                const objectUrl = URL.createObjectURL(file);
                
                // 创建预览元素
                const preview = document.createElement('div');
                preview.className = 'file-preview';
                
                const img = document.createElement('img');
                img.src = objectUrl;
                preview.appendChild(img);
                
                // 添加删除按钮
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-file';
                removeBtn.textContent = '×';
                removeBtn.onclick = () => {
                    preview.remove();
                    e.target.value = ''; // 清空文件选择
                };
                preview.appendChild(removeBtn);
                
                // 将预览加到输入框上方
                const inputArea = document.querySelector('.chat-mode-container .input-area');
                inputArea.insertBefore(preview, inputArea.firstChild);
            }
        });
    }
    
    chatSendBtn.onclick = async () => {
        const message = chatTextarea.value.trim();
        const fileInput = document.getElementById('fileUpload');
        const file = fileInput?.files[0];



        if (!message && !file) return;
        
        try {
            chatManager.addMessage(message, true, file);
            chatTextarea.value = '';
            if (fileInput) fileInput.value = '';
            // 找到并移除预览框
            const inputArea = document.querySelector('.chat-mode-container .input-area');
            const preview = inputArea.querySelector('.file-preview');
            if (preview) {
                inputArea.removeChild(preview);
            }

             // 切换按钮状态为"发送中"
            chatSendBtn.textContent = '发送中';
            chatSendBtn.disabled = true; // 禁用按钮



            const response = await sendMessageToAPI(message, file,chatSendBtn);

            // 恢复按钮状态
            chatSendBtn.textContent = '发送';
            chatSendBtn.disabled = false; // 重新启用按钮


            if (response && response.choices && response.choices[0]) {
                const assistantMessage = response.choices[0].message.content;
                chatManager.addMessage(assistantMessage, false);
            }
        } catch (error) {
            console.error('发送消息失败:', error);
            chatManager.addMessage('抱歉，发生了错误，请稍后重试。', false);
        }
    };
    
    // 禁用文档模式的发送按钮
    const docSendBtn = document.querySelector('.doc-chat-area .send-btn');
    docSendBtn.onclick = null;
}

// 添加网络搜索开关事件监听
document.getElementById('searchToggle').addEventListener('change', function(e) {
    const isEnabled = e.target.checked;
    const tooltip = document.querySelector('.toggle-label .tooltip');
    if (tooltip) {
        tooltip.textContent = isEnabled ? '关闭网络搜索' : '开启网络搜索';
    }
});

// 添加复制代码功能
function copyCode(button) {
    const codeBlock = button.closest('.code-block-container').querySelector('code');
    const text = codeBlock.textContent;
    
    navigator.clipboard.writeText(text).then(() => {
        const originalText = button.textContent;
        button.textContent = '已复制！';
        setTimeout(() => {
            button.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('复制失败:', err);
    });
}

// 修改事件监听函数
function addEnterListener() {
    const textarea = document.querySelector('.chat-mode-container .input-box textarea');
    if (!textarea) return;

    // 保存初始高度
    const initialHeight = textarea.style.height;

    textarea.addEventListener('keydown', function(e) {
        // 检查是否按下了 Enter 键且没有按住 Shift 键
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // 阻止默认的换行行为
            
            const sendBtn = document.querySelector('.chat-mode-container .send-btn');
            if (sendBtn && !sendBtn.disabled) {
                sendBtn.click();
                // 重置文本框高度
                this.style.height = initialHeight || '50px';  // 使用初始高度或默认值
                this.style.overflowY = 'hidden';
            }
        }
    });

    textarea.addEventListener('input', function() {
        // 自动调整文本框高度
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        
        // 限制最大高度
        const maxHeight = 200;
        if (this.scrollHeight > maxHeight) {
            this.style.height = maxHeight + 'px';
            this.style.overflowY = 'auto';
        } else {
            this.style.overflowY = 'hidden';
        }
    });
}

// 确保在 DOM 加载完成后执行
document.addEventListener('DOMContentLoaded', addEnterListener);

// 添加发送按钮的点击事件监听
document.querySelector('.chat-mode-container .send-btn').addEventListener('click', function() {
    const textarea = document.querySelector('.chat-mode-container .input-box textarea');
    if (textarea) {
        // 发送后重置文本框高度
        setTimeout(() => {
            textarea.style.height = '50px';
            textarea.style.overflowY = 'hidden';
        }, 0);
    }
});
