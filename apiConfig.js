// apiConfig.js
class ApiConfigManager {
    constructor() {
        this.configFile = 'api_config.json';
    }

    async loadConfig() {
        try {
            const response = await fetch(this.configFile);
            if (!response.ok) {
                throw new Error('无法加载API配置');
            }
            return await response.json();
        } catch (error) {
            console.error('加载API配置失败:', error);
            return {
                defaultModel: 'glm-4v-flash',
                models: [
                    {
                        id: 'glm-4v-flash',
                        name: 'GLM-4V-Flash',
                        url: 'YOUR_DEFAULT_API_URL',
                        key: 'YOUR_DEFAULT_API_KEY'
                    }
                ]
            };
        }
    }

    async saveConfig(config) {
        try {
            const response = await fetch('/save-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(config)
            });
            if (!response.ok) {
                throw new Error('保存API配置失败');
            }
        } catch (error) {
            console.error('保存API配置失败:', error);
        }
    }
}