class DocHandler {
    constructor() {
        this.docContent = document.querySelector('.doc-content');
        this.toolbar = document.querySelector('.doc-toolbar');
        this.selectedText = '';
        this.progressBar = null;
        // 保存当前选择的范围和文本
        this.currentSelection = {
            range: null,
            text: ''
        };
        
        this.init();
    }

    init() {
        // 监听文档内容选择
        this.docContent.addEventListener('mouseup', this.handleTextSelection.bind(this));
        
        // 初始化工具栏
        this.initToolbar();
        
        // 创建进度条
        this.createProgressBar();
        
        // 初始化文档设置菜单
        this.initDocSettings();
    }

    initToolbar() {
        // 添加工具栏按钮事件
        this.toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const command = btn.dataset.command;
                this.executeCommand(command);
            });
        });
        
        // 添加删除线按钮事件
        const strikeBtn = this.toolbar.querySelector('.strike-btn');
        if (strikeBtn) {
            strikeBtn.addEventListener('click', () => {
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const selectedText = range.toString();
                    if (selectedText) {
                        // 检查是否已经有删除线
                        const parent = range.commonAncestorContainer.parentElement;
                        if (parent && parent.style.textDecoration === 'line-through') {
                            // 如果已有删除线，则移除
                            const text = parent.textContent;
                            const textNode = document.createTextNode(text);
                            parent.parentNode.replaceChild(textNode, parent);
                            strikeBtn.classList.remove('active');
                        } else {
                            // 如果没有删除线，则添加
                            const span = document.createElement('span');
                            span.style.textDecoration = 'line-through';
                            span.style.color = '#ef5350';
                            span.textContent = selectedText;
                            
                            range.deleteContents();
                            range.insertNode(span);
                            
                            // 清除选择
                            selection.removeAllRanges();
                            
                            // 切换按钮状态
                            strikeBtn.classList.toggle('active');
                        }
                    }
                }
            });
        }
        
        // 初始化字体大小选择器
        const fontSizeSelect = this.toolbar.querySelector('.font-size');
        fontSizeSelect.addEventListener('change', () => {
            // 使用 CSS 方式设置字体大小
            document.execCommand('styleWithCSS', false, true);
            document.execCommand('fontSize', false, '1');
            const selection = document.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const span = range.commonAncestorContainer;
                if (span.nodeType === 3) { // 文本节点
                    const newSpan = document.createElement('span');
                    newSpan.style.fontSize = `${fontSizeSelect.value}px`;
                    range.surroundContents(newSpan);
                } else if (span.nodeType === 1) { // 元素节点
                    span.style.fontSize = `${fontSizeSelect.value}px`;
                }
            }
        });
        
        // 初始化颜色选择器
        const colorInput = this.toolbar.querySelector('.color-input');
        const colorPreview = this.toolbar.querySelector('.color-preview');
        const highlightInput = this.toolbar.querySelector('.highlight-input');
        const highlightPreview = this.toolbar.querySelector('.highlight-preview');
        
        // 设置初始颜色
        colorInput.value = '#000000';
        colorPreview.style.color = '#000000';
        highlightInput.value = '#ffeb3b';
        highlightPreview.style.backgroundColor = '#ffeb3b';
        
        // 监听选择范围变化
        document.addEventListener('selectionchange', () => {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const color = this.getSelectionColor(range);
                const bgColor = this.getSelectionBackground(range);
                if (color) {
                    colorInput.value = this.rgbToHex(color);
                    colorPreview.style.color = color;
                }
                if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
                    highlightInput.value = this.rgbToHex(bgColor);
                    highlightPreview.style.backgroundColor = bgColor;
                }
            }
        });
        
        // 处理背景色选择
        highlightInput.addEventListener('input', () => {
            document.execCommand('styleWithCSS', false, true);
            document.execCommand('backColor', false, highlightInput.value);
            highlightPreview.style.backgroundColor = highlightInput.value;
        });
        
        highlightInput.addEventListener('change', () => {
            document.execCommand('styleWithCSS', false, true);
            document.execCommand('backColor', false, highlightInput.value);
            highlightPreview.style.backgroundColor = highlightInput.value;
        });
        
        // 点击背景色选择器时更新当前颜色
        highlightInput.addEventListener('click', () => {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const bgColor = this.getSelectionBackground(range);
                if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
                    highlightInput.value = this.rgbToHex(bgColor);
                    highlightPreview.style.backgroundColor = bgColor;
                }
            }
        });
        
        // 初始化保存下拉菜单
        this.initSaveDropdown();
        
        // 添加快捷键支持
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'z':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.executeCommand('redo');
                        } else {
                            e.preventDefault();
                            this.executeCommand('undo');
                        }
                        break;
                    case 'b':
                        e.preventDefault();
                        this.executeCommand('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.executeCommand('italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.executeCommand('underline');
                        break;
                    case '.':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.executeCommand('superscript');
                        }
                        break;
                    case ',':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.executeCommand('subscript');
                        }
                        break;
                }
            }
        });
    }

    executeCommand(command) {
        document.execCommand(command, false, null);
        this.updateToolbarState();
    }

    updateToolbarState() {
        this.toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
            const command = btn.dataset.command;
            if (['bold', 'italic', 'underline'].includes(command)) {
                btn.classList.toggle('active', document.queryCommandState(command));
            }
        });
    }

    createProgressBar() {
        this.progressBar = document.createElement('div');
        this.progressBar.className = 'doc-progress';
        this.progressBar.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
            <div class="progress-text">0%</div>
        `;
        this.progressBar.style.display = 'none';
        this.docContent.parentNode.insertBefore(this.progressBar, this.docContent);
    }

    updateProgress(percent) {
        const progressBar = this.progressBar.querySelector('.progress-bar');
        const progressText = this.progressBar.querySelector('.progress-text');
        if (progressBar && progressText) {
            progressBar.style.width = `${percent}%`;
            progressText.textContent = `${percent}%`;
        }
    }

    addReuploadButton() {
        const reuploadBtn = document.createElement('button');
        reuploadBtn.className = 'reupload-btn';
        reuploadBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 2v6h-6"></path>
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                <path d="M3 22v-6h6"></path>
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
            </svg>
            重新上传
        `;
        reuploadBtn.style.display = 'none';
        this.uploadBtn.parentNode.insertBefore(reuploadBtn, this.uploadBtn.nextSibling);
        
        reuploadBtn.addEventListener('click', () => {
            this.docUploadBtn.value = '';
            this.docUploadBtn.click();
        });
        
        this.reuploadBtn = reuploadBtn;
    }

    handleTextSelection() {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText) {
            this.selectedText = selectedText;
            this.showSelectionToolbar(selection);
        } else {
            this.hideSelectionToolbar();
        }
    }

    showSelectionToolbar(selection) {
        let toolbar = document.querySelector('.selection-toolbar');
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.className = 'selection-toolbar';
            toolbar.innerHTML = `
                <button class="ask-ai-btn">聊天</button>
                <button class="modify-btn">编辑</button>
                <button class="accept-btn" style="display: none;">接受</button>
            `;
            document.body.appendChild(toolbar);
            
            // 添加按钮事件监听
            toolbar.querySelector('.ask-ai-btn').addEventListener('click', () => {
                this.handleAskAI(this.selectedText);
                toolbar.querySelector('.accept-btn').style.display = 'none';
                this.hideSelectionToolbar();
            });
            
            toolbar.querySelector('.modify-btn').addEventListener('click', () => {
                this.handleModifyRequest(this.selectedText);
                toolbar.querySelector('.accept-btn').style.display = 'inline-flex';
            });
            
            // 修改接受按钮的事件监听
            toolbar.querySelector('.accept-btn').addEventListener('click', () => {
                // 检查是否有保存的选择范围
                if (!this.currentSelection.range) {
                    console.error('没有找到选择的范围');
                    return;
                }
                
                const lastMessage = document.querySelector('.doc-messages .assistant-message:last-child');
                if (lastMessage) {
                    const newText = lastMessage.textContent;
                    this.applyModification(this.currentSelection.text, newText, this.currentSelection.range);
                }
                toolbar.querySelector('.accept-btn').style.display = 'none';
                this.hideSelectionToolbar();
                // 清除保存的选择
                this.currentSelection = { range: null, text: '' };
            });
        } else {
            // 如果工具栏已存在，重置接受按钮状态
            toolbar.querySelector('.accept-btn').style.display = 'none';
        }
        
        // 定位工具栏
        const range = selection.getRangeAt(0);
        // 保存当前选择的范围和文本
        this.currentSelection = {
            range: range.cloneRange(),
            text: range.toString().trim()
        };
        
        const rect = range.getBoundingClientRect();
        toolbar.style.position = 'fixed';
        toolbar.style.top = `${rect.top - toolbar.offsetHeight - 10}px`;
        toolbar.style.left = `${rect.left}px`;
        toolbar.style.display = 'flex';
    }

    hideSelectionToolbar() {
        const toolbar = document.querySelector('.selection-toolbar');
        if (toolbar) {
            toolbar.style.display = 'none';
        }
    }

    handleAskAI(text) {
        const textarea = document.querySelector('.doc-chat-area textarea');
        textarea.value = `关于这段文字："${text}"，帮我看看有没有什么问题：`;
        textarea.focus();
    }

    handleModifyRequest(text) {
        const textarea = document.querySelector('.doc-chat-area textarea');
        textarea.value = `请帮我修改这段文字："${text}"，请直接返回修改后的文字，不要有任何解释，注意事项和其他内容，修改要求：`;
        textarea.focus();
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            // 显示进度条
            this.progressBar.style.display = 'block';
            this.updateProgress(0);
            
            // 读取文件内容
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            
            // 使用 mammoth 转换 docx 为 HTML
            const result = await mammoth.convertToHtml({ arrayBuffer });
            
            // 更新进度
            this.updateProgress(100);
            
            if (result.value) {
                this.showNotification('文档上传成功');
                // 使文档区域可编辑
                this.docContent.contentEditable = 'true';
                // 设置文档内容
                this.docContent.innerHTML = result.value;
                
                // 添加基本样式
                this.addDocumentStyles();
                
                // 显示工具栏
                this.toolbar.style.display = 'flex';
                
                // 延迟隐藏进度条
                setTimeout(() => {
                    this.progressBar.style.display = 'none';
                }, 500);
            } else {
                throw new Error('文档内容为空');
            }
        } catch (error) {
            console.error('文档处理失败:', error);
            this.showNotification('文档处理失败，请重试', 'error');
            this.progressBar.style.display = 'none';
            // 清空文档内容
            this.docContent.innerHTML = '';
        }
    }

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    addDocumentStyles() {
        // 添加文档样式
        const styles = `
            .doc-content {
                color: inherit;
                padding: 20px;
                line-height: 1.6;
                outline: none;  /* 移除编辑时轮廓线 */
                cursor: text;   /* 显示文本光标 */
            }
            
            /* 编辑时的样式 */
            .doc-content:focus {
                outline: none;
            }
            
            /* 选中文本的样式 */
            .doc-content::selection {
                background: #b4d5fe;
                color: inherit;
            }
            
            [data-theme="dark"] .doc-content::selection {
                background: #264f78;
            }
            
            .doc-content h1,
            .doc-content h2,
            .doc-content h3,
            .doc-content h4,
            .doc-content h5,
            .doc-content h6,
            .doc-content p,
            .doc-content span {
                color: inherit;
                line-height: 1.6;
            }
            
            .doc-content p {
                margin: 1em 0;
            }
            
            .doc-content h1 { margin: 1.5em 0 1em; }
            .doc-content h2 { margin: 1.4em 0 0.8em; }
            .doc-content h3 { margin: 1.3em 0 0.6em; }
            .doc-content h4 { margin: 1.2em 0 0.4em; }
            .doc-content h5 { margin: 1.1em 0 0.3em; }
            .doc-content h6 { margin: 1em 0 0.2em; }
            
            .doc-content span[style*="color"] {
                color: inherit !important;
            }
            
            .doc-content ul,
            .doc-content ol {
                margin: 1em 0;
                padding-left: 2em;
            }
            
            .doc-content li {
                margin: 0.5em 0;
            }
            
            .doc-content img { max-width: 100%; height: auto; }
            .doc-content table {
                border-collapse: collapse;
                margin: 1.5em 0;
                width: 100%;
            }
            .doc-content th,
            .doc-content td {
                border: 1px solid #ddd;
                padding: 8px;
                line-height: 1.4;
            }
            [data-theme="dark"] .doc-content {
                color: #d4d4d4;
            }
            [data-theme="dark"] .doc-content table {
                border-color: #444;
            }
            [data-theme="dark"] .doc-content th,
            [data-theme="dark"] .doc-content td {
                border-color: #444;
            }
        `;

        // 检查是否已存在样式标签
        let styleTag = document.getElementById('doc-styles');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'doc-styles';
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = styles;
    }

    async saveDocument(format = 'html') {
        try {
            // 显示正在处理的提示
            this.showNotification(`正在生成 ${format.toUpperCase()} 文件...`, 'info');
            
            const content = this.docContent.innerHTML;
            let saveContent, mimeType, fileName;

            switch (format) {
                case 'docx':
                    // TODO: DOCX 导出功能尚未完成
                    this.showNotification('DOCX 导出功能开发中...', 'info');
                    break;
                case 'pdf':
                    // TODO: PDF 导出功能尚未完成
                    this.showNotification('PDF 导出功能开发中...', 'info');
                    break;
                default: // html
                    // 添加基本样式到HTML内容
                    saveContent = `
                        <!DOCTYPE html>
                        <html>
                            <head>
                                <meta charset="UTF-8">
                                <style>
                                    body { font-family: Arial, sans-serif; line-height: 1.6; }
                                    .doc-content { padding: 20px; }
                                    p { margin: 1em 0; }
                                    h1, h2, h3, h4, h5, h6 { margin: 1em 0; }
                                    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
                                    td, th { border: 1px solid #ddd; padding: 8px; }
                                    img { max-width: 100%; height: auto; }
                                </style>
                            </head>
                            <body>
                                <div class="doc-content">
                                    ${content}
                                </div>
                            </body>
                        </html>
                    `;
                    mimeType = 'text/html';
                    fileName = 'document.html';
                    
                    // 创建并下载文件
                    const blob = new Blob([saveContent], { type: mimeType });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);

                    this.showNotification('HTML 文件已保存');
            }
        } catch (error) {
            console.error('保存文档失败:', error);
            this.showNotification('保存失败，请重试', 'error');
        }
    }

    initSaveDropdown() {
        const saveBtn = this.toolbar.querySelector('.save-doc-btn');
        const saveDropdown = this.toolbar.querySelector('.save-dropdown');
        const saveOptions = this.toolbar.querySelector('.save-options');

        // 切换下拉菜单
        saveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // 关闭其他可能打开的下拉菜单
            document.querySelectorAll('.save-dropdown.active').forEach(dropdown => {
                if (dropdown !== saveDropdown) {
                    dropdown.classList.remove('active');
                }
            });
            saveDropdown.classList.toggle('active');
        });

        // 点击其他区域关闭下拉菜单
        document.addEventListener('click', () => {
            saveDropdown.classList.remove('active');
        });

        // 阻止下拉菜单点击事件冒泡
        saveOptions.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // 处理不同格式的保存选项
        saveOptions.querySelectorAll('.save-option').forEach(option => {
            option.addEventListener('click', () => {
                const format = option.dataset.format;
                this.saveDocument(format);
                saveDropdown.classList.remove('active');
            });
        });
    }

    showNotification(message, type = 'success') {
        let notification = document.querySelector('.doc-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'doc-notification';
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        notification.className = `doc-notification ${type}`;
        notification.style.display = 'block';

        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    getSelectionColor(range) {
        const container = range.commonAncestorContainer;
        let element;

        if (container.nodeType === 3) { // 文本节点
            element = container.parentNode;
        } else { // 元素节点
            element = container;
        }

        // 获取计算后的样式
        const computedStyle = window.getComputedStyle(element);
        const color = computedStyle.color;

        // 将 RGB 转换为十六进制
        if (color.startsWith('rgb')) {
            const rgb = color.match(/\d+/g);
            if (rgb) {
                const hex = '#' + rgb.map(x => {
                    const hex = parseInt(x).toString(16);
                    return hex.length === 1 ? '0' + hex : hex;
                }).join('');
                return hex;
            }
        }

        return color;
    }

    getSelectionBackground(range) {
        const container = range.commonAncestorContainer;
        let element;

        if (container.nodeType === 3) { // 文本节点
            element = container.parentNode;
        } else { // 元素节点
            element = container;
        }

        const computedStyle = window.getComputedStyle(element);
        return computedStyle.backgroundColor;
    }

    rgbToHex(rgb) {
        if (rgb.startsWith('#')) {
            return rgb;
        }
        const values = rgb.match(/\d+/g);
        if (!values) {
            return '#ffeb3b'; // 默认颜色
        }
        return '#' + values.map(x => {
            const hex = parseInt(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    initDocSettings() {
        const settingsBtn = this.toolbar.querySelector('.doc-settings-btn');
        const uploadBtn = this.toolbar.querySelector('.upload-doc-btn');
        const reuploadBtn = this.toolbar.querySelector('.reupload-doc-btn');
        const closeBtn = this.toolbar.querySelector('.close-doc-btn');
        
        // 创建文件输入元素
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.docx';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        // 上传文档
        uploadBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        // 重新上传
        reuploadBtn.addEventListener('click', () => {
            fileInput.value = '';
            fileInput.click();
        });
        
        // 监听文件上传
        fileInput.addEventListener('change', this.handleFileUpload.bind(this));
        
        // 关闭文档
        closeBtn.addEventListener('click', () => {
            this.docContent.innerHTML = '';
            this.toolbar.style.display = 'none';
            document.querySelector('.mode-btn[data-mode="chat"]').click();
        });
        
        // 显示工具栏
        this.toolbar.style.display = 'flex';
    }

    applyModification(oldText, newText, range) {
        try {
            // 创建一个新的范围
            const newRange = range.cloneRange();
            
            // 创建带有差异标记的内容
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = this.showDifferences(oldText, newText);
            
            // 删除原有内容
            newRange.deleteContents();
            
            // 插入新内容
            const fragment = document.createDocumentFragment();
            while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
            }
            newRange.insertNode(fragment);
            
            // 清除选择
            window.getSelection().removeAllRanges();
        } catch (error) {
            console.error('应用修改时发生错误:', error);
        }
    }

    showDifferences(oldText, newText) {
        // 将文本分割成单词，保留空格和标点
        const oldWords = oldText.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+|\s+|[^\s\u4e00-\u9fa5a-zA-Z]+/g) || [];
        const newWords = newText.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+|\s+|[^\s\u4e00-\u9fa5a-zA-Z]+/g) || [];
        
        // 计算差异矩阵
        const matrix = Array(oldWords.length + 1).fill().map(() => 
            Array(newWords.length + 1).fill(0)
        );
        
        // 初始化矩阵
        for (let i = 0; i <= oldWords.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= newWords.length; j++) matrix[0][j] = j;
        
        // 填充矩阵
        for (let i = 1; i <= oldWords.length; i++) {
            for (let j = 1; j <= newWords.length; j++) {
                if (oldWords[i-1] === newWords[j-1]) {
                    matrix[i][j] = matrix[i-1][j-1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i-1][j] + 1,  // 删除
                        matrix[i][j-1] + 1,  // 插入
                        matrix[i-1][j-1] + 1 // 替换
                    );
                }
            }
        }
        
        // 根据矩阵回溯生成差异标记
        let result = '';
        let i = oldWords.length;
        let j = newWords.length;
        
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && oldWords[i-1] === newWords[j-1]) {
                // 相同的词
                result = oldWords[i-1] + result;
                i--;
                j--;
            } else if (j > 0 && (i === 0 || matrix[i][j-1] <= matrix[i-1][j])) {
                // 新增的词
                result = `<span class="added" style="background-color: #ffebee; color: #f44336;">${newWords[j-1]}</span>` + result;
                j--;
            } else {
                // 删除的词
                result = `<span class="deleted" style="text-decoration: line-through; color: #9e9e9e;">${oldWords[i-1]}</span>` + result;
                i--;
            }
        }
        
        return result;
    }
}

// 初始化文档处理器
const docHandler = new DocHandler(); 