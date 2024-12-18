class ChatHistoryManager {
    constructor() {
        this.API_BASE_URL = 'http://localhost:8000';
    }

    async loadHistory() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/load-history`);
            if (!response.ok) {
                throw new Error('加载历史记录失败');
            }
            return await response.json();
        } catch (error) {
            console.error('加载历史记录失败:', error);
            return [];
        }
    }

    async saveHistory(chats) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/save-history`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(chats)
            });
            if (!response.ok) {
                throw new Error('保存历史记录失败');
            }
        } catch (error) {
            console.error('保存历史记录失败:', error);
        }
    }

    getSessionMessages(chatId, messages) {
        const chat = messages.find(c => c.id === chatId);
        if (!chat) return [];
        
        return chat.messages.map(msg => ({
            role: msg.isUser ? "user" : "assistant",
            content: msg.content
        }));
    }
}

// 创建全局实例
const chatHistoryManager = new ChatHistoryManager();