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
        this.renderModelList();

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
            this.renderModelList();
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
                    <div>${model.name}</div>
                    <div style="font-size: 12px; color: #666;">${model.description || ''}</div>
                </div>
                <div class="model-actions">
                    ${model.provider === 'custom' ? `
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
}