class ModelManager {
    constructor() {
        this.models = [];
        this.currentModel = "glm-4v-flash";
        this.init();
        console.log('ModelManager 已初始化');
    }

    async init() {
        await this.loadConfig();
        this.updateModelSelect();
        this.renderModelList(this.models);
    }

    // 添加自定义模型
    async addCustomModel() {
        const name = document.getElementById('modelName').value.trim();
        const url = document.getElementById('modelUrl').value.trim();
        const key = document.getElementById('modelKey').value.trim();
        const modelId = document.getElementById('modelId').value.trim();
        const temperature = parseFloat(document.getElementById('modelTemperature').value) || 0.7;
        const maxTokens = parseInt(document.getElementById('modelMaxTokens').value) || 1024;

        // 验证输入
        if (!name || !url || !key || !modelId) {
            alert('请填写所有必填字段');
            return;
        }

        // 验证 temperature 范围
        if (temperature < 0 || temperature > 1) {
            alert('temperature 必须在 0 到 1 之间');
            return;
        }

        // 创建新模型配置
        const newModel = {
            id: modelId,
            name: name,
            url: url,
            key: key,
            temperature: temperature,
            maxTokens: maxTokens,
            description: `自定义模型: ${name}`,
            provider: 'custom'
        };

        this.models.push(newModel);
        await this.saveConfig();
        this.updateModelSelect();
        this.renderModelList(this.models);

        // 清空表单
        document.getElementById('modelName').value = '';
        document.getElementById('modelUrl').value = '';
        document.getElementById('modelKey').value = '';
        document.getElementById('modelId').value = '';

        // 关闭对话框
        const dialog = document.querySelector('.add-model-dialog');
        if (dialog) {
            dialog.style.display = 'none';
        }
    }

    // 删除自定义模型
    async deleteCustomModel(modelId) {
        const index = this.models.findIndex(m => m.id === modelId);
        if (index !== -1) {
            this.models.splice(index, 1);
            if (this.currentModel === modelId) {
                this.currentModel = this.models[0]?.id || "glm-4v-flash";
            }
            await this.saveConfig();
            this.updateModelSelect();
            this.renderModelList(this.models);
        }
    }

    // 渲染模型列表
    renderModelList() {
        const modelListContainer = document.querySelector('.model-list');
        if (!modelListContainer) return;
        
        modelListContainer.innerHTML = '';
        
        this.models.forEach(model => {
            const modelItem = document.createElement('div');
            modelItem.className = 'model-item';
            modelItem.innerHTML = `
                <div class="model-info">
                    <div class="model-name">${model.name}</div>
                    <div class="model-description">${model.description || ''}</div>
                </div>
                <div class="model-actions">
                    ${model.provider === 'custom' ? `
                        <button class="edit-model-btn" onclick="modelManager.editModel('${model.id}')">编辑</button>
                        <button class="delete-model-btn" onclick="modelManager.deleteCustomModel('${model.id}')">删除</button>
                    ` : ''}
                </div>
            `;
            modelListContainer.appendChild(modelItem);
        });
    }

    // 更新模型选择下拉列表
    updateModelSelect() {
        const modelSelect = document.querySelector('#modelSelect');
        if (modelSelect) {
            modelSelect.innerHTML = '';
            this.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                modelSelect.appendChild(option);
            });
            modelSelect.value = this.currentModel;
        }
    }

    // 获取当前模型配置
    getModelConfig(modelId) {
        return this.models.find(m => m.id === modelId);
    }

    // 获取当前选中的模型
    getCurrentModel() {
        return this.currentModel;
    }

    // 设置当前模型
    setCurrentModel(modelId) {
        this.currentModel = modelId;
        this.saveConfig();
    }

    // 判断是否为视觉模型
    isVisionModel() {
        const model = this.getModelConfig(this.currentModel);
        return model && model.id === "glm-4v-flash";
    }

    // 加载配置
    async loadConfig() {
        try {
            const response = await fetch('http://localhost:8000/load-config');
            if (!response.ok) {
                console.warn('无法加载模型配置,使用默认配置');
                return;
            }
            const config = await response.json();
            this.models = config.models;
            this.currentModel = config.defaultModel;
            console.log('成功加载模型配置');
        } catch (error) {
            console.error('加载模型配置失败:', error);
        }
    }

    // 保存配置
    async saveConfig() {
        try {
            const config = {
                models: this.models,
                defaultModel: this.currentModel
            };
            const response = await fetch('http://localhost:8000/save-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(config)
            });
            if (!response.ok) {
                throw new Error('保存模型配置失败');
            }
            console.log('模型配置保存成功');
        } catch (error) {
            console.error('保存模型配置失败:', error);
        }
    }

    // 编辑模型的函数
    editModel(modelId) {
        console.log(`编辑模型 ID: ${modelId}`);
        const model = this.getModelConfig(modelId);
        if (model) {
            // 打开添加模型对话框
            const addModelDialog = document.querySelector('.add-model-dialog');
            if (addModelDialog) {
                // 填充表单数据
                document.getElementById('modelId').value = model.id;
                document.getElementById('modelName').value = model.name;
                document.getElementById('modelUrl').value = model.url;
                document.getElementById('modelKey').value = model.key;
                document.getElementById('modelTemperature').value = model.temperature || 0.7;
                document.getElementById('modelMaxTokens').value = model.maxTokens || 1024;

                // 更新滑块显示的值
                document.getElementById('temperatureValue').textContent = model.temperature || 0.7;
                document.getElementById('maxTokensValue').textContent = model.maxTokens || 1024;

                // 显示对话框
                addModelDialog.style.display = 'flex';

                // 修改保存按钮的行为
                const saveButton = addModelDialog.querySelector('.save-model-btn');
                if (saveButton) {
                    // 移除之前的事件监听器
                    const newSaveButton = saveButton.cloneNode(true);
                    saveButton.parentNode.replaceChild(newSaveButton, saveButton);

                    // 添加新的事件监听器
                    newSaveButton.addEventListener('click', async () => {
                        // 获取更新后的值
                        const updatedModel = {
                            id: document.getElementById('modelId').value,
                            name: document.getElementById('modelName').value,
                            url: document.getElementById('modelUrl').value,
                            key: document.getElementById('modelKey').value,
                            temperature: parseFloat(document.getElementById('modelTemperature').value),
                            maxTokens: parseInt(document.getElementById('modelMaxTokens').value),
                            description: `自定义模型: ${document.getElementById('modelName').value}`,
                            provider: 'custom'
                        };

                        // 更新模型
                        const index = this.models.findIndex(m => m.id === modelId);
                        if (index !== -1) {
                            this.models[index] = updatedModel;
                            await this.saveConfig();
                            this.updateModelSelect();
                            this.renderModelList();
                        }

                        // 关闭对话框
                        addModelDialog.style.display = 'none';
                    });
                }
            }
        } else {
            console.error(`未找到模型 ID: ${modelId}`);
        }
    }
}

// 添加编辑按钮的函数
function addEditButton(modelId) {
    const editButton = document.createElement('button');
    editButton.innerText = '编辑';
    editButton.onclick = function() {
        editModel(modelId);
    };
    return editButton;
}

// 在模型列表中添加编辑按钮
function renderModelList(models) {
    const modelListContainer = document.getElementById('modelList');
    modelListContainer.innerHTML = ''; // 清空现有列表
    models.forEach(model => {
        const modelItem = document.createElement('div');
        modelItem.innerText = model.name;
        modelItem.appendChild(addEditButton(model.id)); // 添加编辑按钮
        modelListContainer.appendChild(modelItem);
    });
}